import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { transactionApi, getApiErrorMessage } from "../services/api";
import { useUI } from "./UIContext";

import { formatMoney } from "../utils/formatters";

const TransactionContext = createContext();

const emptyForm = { amount: "", category_id: "", transaction_date: "", note: "" };
const emptyFilters = { search: "", type: "", categoryId: "", from: "", to: "" };
const pageSize = 10;

export function TransactionProvider({ children }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);
  const [dashboardMonth, setDashboardMonth] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { setError, setNotice, confirm } = useUI();

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await transactionApi.list();
      setTransactions(response.data.data || []);
    } catch (error) {
      setError(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [setError]);

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
        const response = await transactionApi.update(editingId, payload);
        setNotice(response.data?.message || "Đã cập nhật giao dịch.");
      } else {
        const response = await transactionApi.create(payload);
        setNotice(response.data?.message || "Đã thêm giao dịch.");
      }
      resetForm();
      await fetchTransactions();
    } catch (error) {
      setError(getApiErrorMessage(error));
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
    const isConfirmed = await confirm("Xác nhận xóa", `Bạn có chắc muốn xóa giao dịch ${transaction.category_name} trị giá ${formatMoney(transaction.amount)}?`);
    if (!isConfirmed) return;
    
    setError("");
    setNotice("");
    try {
      const response = await transactionApi.remove(transaction.id);
      if (editingId === transaction.id) resetForm();
      setNotice(response.data?.message || "Đã xóa giao dịch.");
      await fetchTransactions();
    } catch (error) {
      setError(getApiErrorMessage(error));
    }
  };

  return (
    <TransactionContext.Provider value={{
      transactions, loading, fetchTransactions,
      formData, editingId, saving, handleChange, handleSubmit, resetForm, setFormData, setEditingId, handleEdit, handleDelete,
      filters, handleFilterChange, resetFilters,
      dashboardMonth, setDashboardMonth,
      filteredTransactions, paginatedTransactions, activePage, totalPages, setCurrentPage
    }}>
      {children}
    </TransactionContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTransactions = () => useContext(TransactionContext);
