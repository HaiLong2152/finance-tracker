import { useCallback, useEffect, useState } from "react";
import "./index.css";
import TransactionForm from "./features/transactions/TransactionForm";
import TransactionTable from "./features/transactions/TransactionTable";
import { categoryApi, getApiErrorMessage, transactionApi } from "./services/api";

const emptyForm = { amount: "", category_id: "", transaction_date: "", note: "" };

function App() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [transactionsResponse, categoriesResponse] = await Promise.all([
        transactionApi.list(),
        categoryApi.list(),
      ]);
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await transactionApi.create({
        ...formData,
        amount: Number(formData.amount),
        category_id: Number(formData.category_id),
      });
      setFormData(emptyForm);
      setNotice("Đã lưu giao dịch.");
      await fetchData();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Không thể lưu giao dịch. Vui lòng thử lại."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page">
      <header className="page-header">
        <p className="eyebrow">FINANCE TRACKER</p>
        <h1>Sổ thu chi cá nhân</h1>
        <p className="subtitle">Theo dõi các khoản thu và chi của bạn.</p>
      </header>

      <TransactionForm categories={categories} formData={formData} saving={saving} onChange={handleChange} onSubmit={handleSubmit} />

      {error && <p className="message error" role="alert">{error}</p>}
      {notice && <p className="message success" role="status">{notice}</p>}

      <TransactionTable transactions={transactions} loading={loading} />
    </main>
  );
}

export default App;
