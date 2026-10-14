import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { transactionApi, getApiErrorMessage } from "../services/api";
import { useUI } from "./UIContext";
import { useAccounts } from "./AccountContext";
import { useBudgets } from "./BudgetContext";
import { useReports } from "./ReportContext";
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
  const [paginatedTransactions, setPaginatedTransactions] = useState([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);

  const { setError, setNotice, confirm } = useUI();
  const { fetchAccounts } = useAccounts();
  const { fetchBudgets } = useBudgets();
  const { refreshReports } = useReports();

  const currentPageRef = useRef(currentPage);
  const filtersRef = useRef(filters);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const fetchTransactions = useCallback(async (pageParam, filtersParam) => {
    setLoading(true);
    try {
      const pageToUse = pageParam ?? currentPageRef.current;
      const filtersToUse = filtersParam ?? filtersRef.current;

      const params = {
        page: pageToUse,
        limit: pageSize,
      };

      if (filtersToUse.search && filtersToUse.search.trim()) {
        params.search = filtersToUse.search.trim();
      }
      if (filtersToUse.type) {
        params.type = filtersToUse.type;
      }
      if (filtersToUse.accountId) {
        params.accountId = filtersToUse.accountId;
      }
      if (filtersToUse.categoryId) {
        params.categoryId = filtersToUse.categoryId;
      }
      if (filtersToUse.from) {
        params.from = filtersToUse.from;
      }
      if (filtersToUse.to) {
        params.to = filtersToUse.to;
      }

      const response = await transactionApi.list(params);
      const data = response.data?.data;

      if (data && data.items) {
        setPaginatedTransactions(data.items);
        setTotalTransactions(data.pagination.totalItems);
        setTotalPages(data.pagination.totalPages);
      } else if (Array.isArray(data)) {
        setPaginatedTransactions(data);
        setTotalTransactions(data.length);
        setTotalPages(Math.max(1, Math.ceil(data.length / pageSize)));
      }
    } catch (error) {
      setError(getApiErrorMessage(error, "Không thể tải giao dịch."));
    } finally {
      setLoading(false);
    }
  }, [setError]);

  const refreshAfterMutation = useCallback(async () => {
    await Promise.all([
      fetchTransactions(),
      fetchAccounts(),
      fetchBudgets(),
      refreshReports(),
    ]);
  }, [fetchTransactions, fetchAccounts, fetchBudgets, refreshReports]);

  const createTransaction = async (payload) => {
    const response = await transactionApi.create(payload);
    await refreshAfterMutation();
    return response;
  };

  // Debounce tìm kiếm văn bản 350ms trước khi gọi fetch
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchTransactions(1, filtersRef.current);
    }, 350);
    return () => clearTimeout(timer);
  }, [filters.search, fetchTransactions]);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
    fetchTransactions(page);
  }, [fetchTransactions]);

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
    const { name, value } = event.target;
    const nextFilters = { ...filters, [name]: value };
    setFilters(nextFilters);
    setCurrentPage(1);
    if (name !== "search") {
      fetchTransactions(1, nextFilters);
    }
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    setCurrentPage(1);
    fetchTransactions(1, emptyFilters);
  };

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
      await refreshAfterMutation();
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
      await refreshAfterMutation();
    } catch (error) {
      setError(getApiErrorMessage(error, "Không thể xóa giao dịch."));
    }
  };

  const bulkChangeCategory = async (ids, categoryId) => {
    if (!Array.isArray(ids) || ids.length === 0) return false;
    setError("");
    setNotice("");
    try {
      const response = await transactionApi.bulk({
        transaction_ids: ids,
        action: "change_category",
        category_id: Number(categoryId),
      });
      setNotice(response.data?.message || `Đã cập nhật danh mục cho ${ids.length} giao dịch.`);
      await refreshAfterMutation();
      return true;
    } catch (error) {
      setError(getApiErrorMessage(error, "Không thể cập nhật danh mục hàng loạt."));
      return false;
    }
  };

  const bulkDelete = async (ids, totalAmount = 0) => {
    if (!Array.isArray(ids) || ids.length === 0) return false;
    const isConfirmed = await confirm(
      "Xác nhận xóa hàng loạt",
      `Bạn có chắc muốn xóa ${ids.length} giao dịch đã chọn${totalAmount > 0 ? ` (tổng cộng: ${formatMoney(totalAmount)})` : ""}?`
    );
    if (!isConfirmed) return false;

    setError("");
    setNotice("");
    try {
      const response = await transactionApi.bulk({
        transaction_ids: ids,
        action: "delete",
      });
      setNotice(response.data?.message || `Đã xóa thành công ${ids.length} giao dịch.`);
      await refreshAfterMutation();
      return true;
    } catch (error) {
      setError(getApiErrorMessage(error, "Không thể xóa giao dịch hàng loạt."));
      return false;
    }
  };

  return (
    <TransactionContext.Provider
      value={{
        transactions: paginatedTransactions,
        paginatedTransactions,
        filteredTransactions: paginatedTransactions,
        totalTransactions,
        loading,
        fetchTransactions,
        createTransaction,
        refreshAfterMutation,
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
        bulkChangeCategory,
        bulkDelete,
        filters,
        handleFilterChange,
        resetFilters,
        activePage: currentPage,
        currentPage,
        totalPages,
        setCurrentPage: handlePageChange,
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTransactions = () => useContext(TransactionContext);
