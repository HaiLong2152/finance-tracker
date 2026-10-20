import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { inboxApi, getApiErrorMessage } from "../services/api";
import { useUI } from "./UIContext";

const InboxContext = createContext();

export function InboxProvider({ children }) {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    processed: 0,
    unparsed: 0,
    failed: 0,
    ignored: 0,
    total: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 1,
  });
  const [filterStatus, setFilterStatus] = useState("pending"); // "pending" | "unparsed" | "processed" | "ignored" | "all"
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const { setError, setNotice } = useUI();

  const filterStatusRef = useRef(filterStatus);
  const searchRef = useRef(search);

  useEffect(() => {
    filterStatusRef.current = filterStatus;
  }, [filterStatus]);

  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await inboxApi.getStats();
      if (res.data?.data) {
        setStats(res.data.data);
      }
    } catch {
      // Bỏ qua lỗi ngầm khi đếm số lượng
    }
  }, []);

  const fetchInbox = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const statusToUse = params.status !== undefined ? params.status : filterStatusRef.current;
      const searchToUse = params.search !== undefined ? params.search : searchRef.current;
      const pageToUse = params.page || 1;

      const res = await inboxApi.list({
        status: statusToUse,
        search: searchToUse,
        page: pageToUse,
        limit: 20,
      });

      if (res.data?.success) {
        setItems(res.data.data || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể tải danh sách thông báo hộp chờ."));
    } finally {
      setLoading(false);
    }
  }, [setError]);

  const refreshInbox = useCallback(async () => {
    await Promise.all([fetchStats(), fetchInbox({ page: 1 })]);
  }, [fetchStats, fetchInbox]);

  const handleStatusChange = (newStatus) => {
    setFilterStatus(newStatus);
    filterStatusRef.current = newStatus;
    fetchInbox({ status: newStatus, page: 1 });
  };

  const handleSearchChange = (newSearch) => {
    setSearch(newSearch);
    searchRef.current = newSearch;
    fetchInbox({ search: newSearch, page: 1 });
  };

  const handlePageChange = (newPage) => {
    fetchInbox({ page: newPage });
  };

  const resolveItem = async (id, action, transactionData) => {
    setResolvingId(id);
    setError("");
    try {
      const res = await inboxApi.resolve(id, { action, transaction: transactionData });
      setNotice(res.data?.message || "Đã xử lý thông báo.");
      await refreshInbox();
      return true;
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể xử lý thông báo."));
      return false;
    } finally {
      setResolvingId(null);
    }
  };

  const reparseItem = async (id) => {
    setResolvingId(id);
    setError("");
    try {
      const res = await inboxApi.reparse(id);
      setNotice(res.data?.message || "Đã phân tích lại thông báo từ dữ liệu gốc.");
      await refreshInbox();
      return true;
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể phân tích lại thông báo."));
      return false;
    } finally {
      setResolvingId(null);
    }
  };

  const unreadCount = (stats.pending || 0) + (stats.unparsed || 0) + (stats.failed || 0) + (stats.error || 0);

  return (
    <InboxContext.Provider
      value={{
        items,
        stats,
        pagination,
        filterStatus,
        search,
        loading,
        resolvingId,
        unreadCount,
        fetchInbox,
        fetchStats,
        refreshInbox,
        setFilterStatus: handleStatusChange,
        setSearch: handleSearchChange,
        setPage: handlePageChange,
        resolveItem,
        reparseItem,
      }}
    >
      {children}
    </InboxContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useInbox() {
  const context = useContext(InboxContext);
  if (!context) {
    throw new Error("useInbox phải được sử dụng bên trong InboxProvider.");
  }
  return context;
}

