import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { transactionApi, getApiErrorMessage } from "../services/api";
import { useUI } from "./UIContext";
import { useAccounts } from "./AccountContext";
import { formatMoney, getLocalDateString } from "../utils/formatters";

const TransactionContext = createContext();

const defaultToday = () => getLocalDateString();

const emptyForm = {
  amount: "",
  type: "expense",
  account_id: "",
  transfer_account_id: "",
  category_id: "",
  transaction_date: defaultToday(),
  note: "",
};

const emptyFilters = {
  search: "",
  type: "",
  accountId: "",
  categoryId: "",
  from: "",
  to: "",
};

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
  const { fetchAccounts } = useAccounts();

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await transactionApi.list();
      setTransactions(response.data.data || []);
    } catch (error) {
      setError(getApiErrorMessage(error, "Không thể tải giao dịch."));
    } finally {
      setLoading(false);
    }
  }, [setError]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => {
      const next = { ...current, [name]: value };
      // Khi đổi type, reset category_id hoặc transfer_account_id nếu cần
      if (name === "type") {
        if (value === "transfer") {
          next.category_id = "";
        } else {
          next.transfer_account_id = "";
        }
      }
      return next;
    });
  };

  const handleFilterChange = (event) => {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    setCurrentPage(1);
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const transactionDate = String(transaction.transaction_date).slice(0, 10);
      const search = filters.search.trim().toLowerCase();

      const matchesSearch =
        !search ||
        String(transaction.note || "").toLowerCase().includes(search) ||
        String(transaction.category_name || "").toLowerCase().includes(search) ||
        String(transaction.account_name || "").toLowerCase().includes(search) ||
        String(transaction.transfer_account_name || "").toLowerCase().includes(search);

      const matchesType = !filters.type || transaction.type === filters.type;

      const matchesAccount =
        !filters.accountId ||
        String(transaction.account_id) === filters.accountId ||
        String(transaction.transfer_account_id) === filters.accountId;

      const matchesCategory =
        !filters.categoryId || String(transaction.category_id) === filters.categoryId;

      const matchesFrom = !filters.from || transactionDate >= filters.from;
      const matchesTo = !filters.to || transactionDate <= filters.to;

      return (
        matchesSearch &&
        matchesType &&
        matchesAccount &&
        matchesCategory &&
        matchesFrom &&
        matchesTo
      );
    });
  }, [transactions, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedTransactions = filteredTransactions.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize
  );

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
      const payload = {
        amount: Number(formData.amount),
        type: formData.type,
        account_id: Number(formData.account_id),
        transaction_date: formData.transaction_date,
        note: formData.note ? formData.note.trim() : null,
      };

      if (formData.type === "transfer") {
        payload.transfer_account_id = Number(formData.transfer_account_id);
      } else {
        payload.category_id = Number(formData.category_id);
      }

      if (editingId) {
        const response = await transactionApi.update(editingId, payload);
        setNotice(response.data?.message || "Đã cập nhật giao dịch.");
      } else {
        const response = await transactionApi.create(payload);
        setNotice(response.data?.message || "Đã thêm giao dịch.");
      }

      resetForm();
      await Promise.all([fetchTransactions(), fetchAccounts()]);
    } catch (error) {
      setError(getApiErrorMessage(error, "Không thể lưu giao dịch."));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (transaction) => {
    setEditingId(transaction.id);
    setFormData({
      amount: String(transaction.amount),
      type: transaction.type || "expense",
      account_id: String(transaction.account_id || ""),
      transfer_account_id: String(transaction.transfer_account_id || ""),
      category_id: String(transaction.category_id || ""),
      transaction_date: String(transaction.transaction_date).slice(0, 10),
      note: transaction.note || "",
    });
    setNotice("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (transaction) => {
    const label =
      transaction.type === "transfer"
        ? `chuyển khoản (${transaction.account_name} → ${transaction.transfer_account_name})`
        : transaction.category_name;

    const isConfirmed = await confirm(
      "Xác nhận xóa",
      `Bạn có chắc muốn xóa giao dịch ${label} trị giá ${formatMoney(transaction.amount)}?`
    );
    if (!isConfirmed) return;

    setError("");
    setNotice("");
    try {
      const response = await transactionApi.remove(transaction.id);
      if (editingId === transaction.id) resetForm();
      setNotice(response.data?.message || "Đã xóa giao dịch.");
      await Promise.all([fetchTransactions(), fetchAccounts()]);
    } catch (error) {
      setError(getApiErrorMessage(error, "Không thể xóa giao dịch."));
    }
  };

  return (
    <TransactionContext.Provider
      value={{
        transactions,
        loading,
        fetchTransactions,
        formData,
        editingId,
        saving,
        handleChange,
        handleSubmit,
        resetForm,
        setFormData,
        setEditingId,
        handleEdit,
        handleDelete,
        filters,
        handleFilterChange,
        resetFilters,
        dashboardMonth,
        setDashboardMonth,
        filteredTransactions,
        paginatedTransactions,
        activePage,
        totalPages,
        setCurrentPage,
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTransactions = () => useContext(TransactionContext);
