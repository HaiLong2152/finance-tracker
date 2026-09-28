import { useCallback, useEffect, useMemo, useState } from "react";
import "./index.css";
import TransactionForm from "./features/transactions/TransactionForm";
import TransactionFilters from "./features/transactions/TransactionFilters";
import DashboardSummary from "./features/dashboard/DashboardSummary";
import CategoryManager from "./features/categories/CategoryManager";
import TransactionTable from "./features/transactions/TransactionTable";
import { categoryApi, getApiErrorMessage, transactionApi } from "./services/api";

const emptyForm = { amount: "", category_id: "", transaction_date: "", note: "" };
const emptyFilters = { search: "", type: "", categoryId: "", from: "", to: "" };

function App() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filters, setFilters] = useState(emptyFilters);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [transactionsResponse, categoriesResponse] = await Promise.all([transactionApi.list(), categoryApi.list()]);
      setTransactions(transactionsResponse.data.data || []);
      setCategories(categoriesResponse.data.data || []);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Không thể tải dữ liệu. Hãy kiểm tra backend và kết nối cơ sở dữ liệu."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadTimer = setTimeout(fetchData, 0);
    return () => clearTimeout(loadTimer);
  }, [fetchData]);

  const handleChange = (event) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleFilterChange = (event) => {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const filteredTransactions = useMemo(() => transactions.filter((transaction) => {
    const transactionDate = String(transaction.transaction_date).slice(0, 10);
    const search = filters.search.trim().toLowerCase();
    return (!search || String(transaction.note || "").toLowerCase().includes(search))
      && (!filters.type || transaction.type === filters.type)
      && (!filters.categoryId || String(transaction.category_id) === filters.categoryId)
      && (!filters.from || transactionDate >= filters.from)
      && (!filters.to || transactionDate <= filters.to);
  }), [transactions, filters]);

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = { ...formData, amount: Number(formData.amount), category_id: Number(formData.category_id) };
      if (editingId) {
        await transactionApi.update(editingId, payload);
        setNotice("Đã cập nhật giao dịch.");
      } else {
        await transactionApi.create(payload);
        setNotice("Đã thêm giao dịch.");
      }
      resetForm();
      await fetchData();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Không thể lưu giao dịch. Vui lòng thử lại."));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (transaction) => {
    setEditingId(transaction.id);
    setFormData({
      amount: String(transaction.amount),
      category_id: String(transaction.category_id),
      transaction_date: String(transaction.transaction_date).slice(0, 10),
      note: transaction.note || "",
    });
    setNotice("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (transaction) => {
    if (!window.confirm(`Xóa giao dịch ${transaction.category_name} trị giá ${transaction.amount}?`)) return;
    setError("");
    setNotice("");
    try {
      await transactionApi.remove(transaction.id);
      if (editingId === transaction.id) resetForm();
      setNotice("Đã xóa giao dịch.");
      await fetchData();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Không thể xóa giao dịch. Vui lòng thử lại."));
    }
  };

  return (
    <main className="page">
      <header className="page-header">
        <p className="eyebrow">FINANCE TRACKER</p>
        <h1>Sổ thu chi cá nhân</h1>
        <p className="subtitle">Theo dõi các khoản thu và chi của bạn.</p>
      </header>

      <DashboardSummary transactions={transactions} />
      <TransactionForm categories={categories} formData={formData} saving={saving} editing={editingId !== null} onChange={handleChange} onSubmit={handleSubmit} onCancel={resetForm} />
      {error && <p className="message error" role="alert">{error}</p>}
      {notice && <p className="message success" role="status">{notice}</p>}
      <TransactionFilters categories={categories} filters={filters} onChange={handleFilterChange} onReset={() => setFilters(emptyFilters)} />
      <TransactionTable transactions={filteredTransactions} loading={loading} onEdit={handleEdit} onDelete={handleDelete} />
      <CategoryManager categories={categories} onChanged={fetchData} onNotice={setNotice} onError={setError} />
    </main>
  );
}

export default App;
