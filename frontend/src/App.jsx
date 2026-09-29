import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import DashboardLayout from "./app/DashboardLayout";
import DashboardPage from "./pages/DashboardPage";
import TransactionsPage from "./pages/TransactionsPage";
import CategoriesPage from "./pages/CategoriesPage";
import { categoryApi, getApiErrorMessage, transactionApi } from "./services/api";

const emptyForm = { amount: "", category_id: "", transaction_date: "", note: "" };
const emptyFilters = { search: "", type: "", categoryId: "", from: "", to: "" };
const pageSize = 10;

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
  const [dashboardMonth, setDashboardMonth] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

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

  const handleChange = (event) => setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));

  const handleFilterChange = (event) => {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    setCurrentPage(1);
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

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedTransactions = filteredTransactions.slice((activePage - 1) * pageSize, activePage * pageSize);

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
    setFormData({ amount: String(transaction.amount), category_id: String(transaction.category_id), transaction_date: String(transaction.transaction_date).slice(0, 10), note: transaction.note || "" });
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

  const sharedContext = {
    transactions, categories, formData, saving, editingId, loading, filters,
    dashboardMonth, setDashboardMonth, handleChange, handleSubmit, resetForm,
    handleFilterChange, resetFilters, paginatedTransactions, filteredTransactions,
    handleEdit, handleDelete, activePage, totalPages, setCurrentPage,
    fetchData, setNotice, setError,
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout error={error} notice={notice} context={sharedContext} />}>
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
