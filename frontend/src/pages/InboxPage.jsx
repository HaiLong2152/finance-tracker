import { useEffect, useState } from "react";
import { useInbox } from "../contexts/InboxContext";
import { useTransactions } from "../contexts/TransactionContext";
import { useAccounts } from "../contexts/AccountContext";
import { useReports } from "../contexts/ReportContext";
import InboxCard from "../features/inbox/InboxCard";
import ConvertTransactionModal from "../features/inbox/ConvertTransactionModal";

export default function InboxPage() {
  const {
    items,
    stats,
    pagination,
    filterStatus,
    search,
    loading,
    resolvingId,
    fetchInbox,
    fetchStats,
    refreshInbox,
    setFilterStatus,
    setSearch,
    setPage,
    resolveItem,
  } = useInbox();

  const { fetchTransactions } = useTransactions();
  const { fetchAccounts } = useAccounts();
  const { refreshReports } = useReports();

  const [selectedItemForConvert, setSelectedItemForConvert] = useState(null);
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    fetchStats();
    fetchInbox({ page: 1 });
  }, [fetchStats, fetchInbox]);

  const handleTabChange = (status) => {
    setFilterStatus(status);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleResetSearch = () => {
    setSearchInput("");
    setSearch("");
  };

  const handleOpenConvert = (item) => {
    setSelectedItemForConvert(item);
  };

  const handleCloseConvert = () => {
    setSelectedItemForConvert(null);
  };

  const handleConfirmConvert = async (txData) => {
    if (!selectedItemForConvert) return;
    const success = await resolveItem(selectedItemForConvert.id, "confirm", txData);
    if (success) {
      setSelectedItemForConvert(null);
      // Đồng bộ toàn bộ dữ liệu giao dịch, số dư tài khoản và báo cáo
      fetchTransactions();
      fetchAccounts();
      refreshReports();
    }
  };

  const handleIgnore = async (id) => {
    await resolveItem(id, "ignore");
  };

  const tabs = [
    { id: "pending", label: "Chờ duyệt", count: stats.pending, badgeClass: "badge-pending" },
    { id: "unparsed", label: "Chưa đọc được", count: stats.unparsed, badgeClass: "badge-unparsed" },
    { id: "processed", label: "Đã tạo giao dịch", count: stats.processed, badgeClass: "badge-processed" },
    { id: "ignored", label: "Đã bỏ qua", count: stats.ignored, badgeClass: "badge-ignored" },
    { id: "all", label: "Tất cả", count: stats.total, badgeClass: "badge-all" },
  ];

  return (
    <div className="page inbox-page">
      {/* Header */}
      <header className="page-header">
        <p className="eyebrow">HỘP CHỜ DUYỆT • GIAI ĐOẠN 4</p>
        <h1>Thông báo & Biến động số dư</h1>
        <p className="subtitle">
          Thu nhận thông báo giao dịch từ điện thoại, lưu giữ dữ liệu gốc không chỉnh sửa và kiểm duyệt trước khi tạo giao dịch.
        </p>
      </header>

      {/* Tabs chuyển trạng thái */}
      <div className="inbox-tabs-container">
        <div className="inbox-tabs" role="tablist">
          {tabs.map((tab) => {
            const isActive = filterStatus === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`inbox-tab-btn ${isActive ? "active" : ""}`}
                onClick={() => handleTabChange(tab.id)}
              >
                <span>{tab.label}</span>
                <span className={`tab-counter ${tab.badgeClass}`}>
                  {tab.count || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Thanh tìm kiếm & Làm mới */}
      <div className="inbox-toolbar-row">
        <form onSubmit={handleSearchSubmit} className="inbox-search-form">
          <input
            type="search"
            placeholder="Tìm theo nội dung tin, tiêu đề, ứng dụng..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="inbox-search-input"
          />
          <button type="submit" className="button-secondary">
            Tìm kiếm
          </button>
          {searchInput && (
            <button
              type="button"
              className="button-secondary"
              onClick={handleResetSearch}
            >
              Xóa lọc
            </button>
          )}
        </form>

        <button
          type="button"
          className="button-secondary inbox-refresh-btn"
          onClick={refreshInbox}
          disabled={loading}
          title="Làm mới danh sách"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={loading ? "spin" : ""}
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          <span>{loading ? "Đang tải..." : "Làm mới"}</span>
        </button>
      </div>

      {/* Danh sách thông báo */}
      <div className="inbox-content-area">
        {loading && items.length === 0 ? (
          <div className="inbox-loading-state">
            <div className="app-loading-spinner" />
            <p>Đang tải thông báo từ máy chủ...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state inbox-empty-state">
            <div className="inbox-empty-icon">📭</div>
            <h3>Không có thông báo nào trong mục này</h3>
            <p>
              {filterStatus === "pending"
                ? "Tất cả thông báo đã được kiểm duyệt hoặc chưa có tin mới gửi đến từ điện thoại."
                : "Không tìm thấy dữ liệu phù hợp với bộ lọc hiện tại."}
            </p>
            <button
              type="button"
              className="button-secondary"
              onClick={() => handleTabChange("all")}
            >
              Xem tất cả thông báo
            </button>
          </div>
        ) : (
          <div className="inbox-list">
            {items.map((item) => (
              <InboxCard
                key={item.id}
                item={item}
                onOpenConvert={handleOpenConvert}
                onIgnore={handleIgnore}
                isResolving={resolvingId === item.id}
              />
            ))}
          </div>
        )}

        {/* Phân trang */}
        {pagination.totalPages > 1 && (
          <div className="pagination inbox-pagination">
            <button
              type="button"
              className="button-secondary button-small"
              disabled={pagination.page <= 1 || loading}
              onClick={() => setPage(pagination.page - 1)}
            >
              ← Trang trước
            </button>
            <span>
              Trang {pagination.page} / {pagination.totalPages} ({pagination.totalItems} thông báo)
            </span>
            <button
              type="button"
              className="button-secondary button-small"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => setPage(pagination.page + 1)}
            >
              Trang sau →
            </button>
          </div>
        )}
      </div>

      {/* Modal xác thực tạo giao dịch an toàn từ tin gốc */}
      {selectedItemForConvert && (
        <ConvertTransactionModal
          item={selectedItemForConvert}
          onClose={handleCloseConvert}
          onConfirm={handleConfirmConvert}
          isResolving={resolvingId === selectedItemForConvert.id}
        />
      )}
    </div>
  );
}

