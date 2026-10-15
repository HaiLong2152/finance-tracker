import { NavLink, Outlet } from "react-router-dom";
import { useUI } from "../contexts/UIContext";
import { useAuth } from "../contexts/AuthContext";
import { useInbox } from "../contexts/InboxContext";
import QuickAddModal from "../features/transactions/QuickAddModal";
import BrandLogo from "../components/BrandLogo";

const navItems = [
  {
    to: "/",
    label: "Tổng quan",
    end: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    to: "/transactions",
    label: "Giao dịch",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    to: "/inbox",
    label: "Chờ duyệt",
    badgeKey: "unreadCount",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
    ),
  },
  {
    to: "/budgets",
    label: "Ngân sách",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
        <path d="M22 12A10 10 0 0 0 12 2v10z" />
      </svg>
    ),
  },
  {
    to: "/accounts",
    label: "Ví tiền",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
        <circle cx="17" cy="15" r="1.5" />
      </svg>
    ),
  },
  {
    to: "/categories",
    label: "Danh mục",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
  },
];

function DashboardLayout() {
  const { error, notice, isQuickAddOpen, openQuickAdd, closeQuickAdd } = useUI();
  const { logout } = useAuth();
  const { unreadCount } = useInbox();

  return (
    <div className="app-shell">
      {/* Sidebar trên Desktop */}
      <aside className="sidebar">
        <div className="brand">
          <BrandLogo size={36} />
          <span>Finance Tracker</span>
        </div>

        <nav className="navigation" aria-label="Điều hướng chính">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              <div className="nav-link-main">
                {item.icon}
                <span>{item.label}</span>
              </div>
              {item.badgeKey === "unreadCount" && unreadCount > 0 && (
                <span className="nav-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Nút Nhập nhanh & Đăng xuất trên Sidebar desktop */}
        <div className="sidebar-bottom-actions">
          <button
            type="button"
            className="sidebar-quick-add-btn"
            onClick={openQuickAdd}
          >
            <span>+</span> Nhập nhanh
          </button>
          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={logout}
            title="Đăng xuất khỏi hệ thống"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Header gọn trên Mobile */}
      <header className="mobile-header">
        <div className="brand">
          <BrandLogo size={32} />
          <span>Finance Tracker</span>
        </div>
        <div className="mobile-header-actions">
          <NavLink
            to="/inbox"
            className="mobile-inbox-btn"
            aria-label="Hộp chờ duyệt"
            title="Hộp chờ duyệt"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
            </svg>
            {unreadCount > 0 && (
              <span className="mobile-inbox-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
            )}
          </NavLink>
          <button
            type="button"
            className="mobile-quick-btn"
            onClick={openQuickAdd}
            aria-label="Thêm nhanh"
          >
            + Nhập
          </button>
          <button
            type="button"
            className="mobile-logout-btn"
            onClick={logout}
            aria-label="Đăng xuất"
            title="Đăng xuất"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Nội dung chính */}
      <main className="app-content">
        {error && <p className="message error" role="alert">{error}</p>}
        {notice && <p className="message success" role="status">{notice}</p>}
        <Outlet />
      </main>

      {/* Thanh điều hướng dưới đáy (Bottom Navigation Bar) cho Mobile */}
      <nav className="mobile-bottom-nav" aria-label="Điều hướng dưới">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`}
        >
          {navItems[0].icon}
          <span>Tổng quan</span>
        </NavLink>

        <NavLink
          to="/transactions"
          className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`}
        >
          {navItems[1].icon}
          <span>Giao dịch</span>
        </NavLink>

        {/* Nút Nhập nhanh lớn ở giữa */}
        <button
          type="button"
          className="bottom-nav-fab"
          onClick={openQuickAdd}
          aria-label="Nhập nhanh giao dịch"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <NavLink
          to="/budgets"
          className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`}
        >
          {navItems[2].icon}
          <span>Ngân sách</span>
        </NavLink>

        <NavLink
          to="/accounts"
          className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`}
        >
          {navItems[3].icon}
          <span>Ví tiền</span>
        </NavLink>
      </nav>

      {/* Bottom Sheet / Modal Nhập Nhanh */}
      {isQuickAddOpen && <QuickAddModal onClose={closeQuickAdd} />}
    </div>
  );
}

export default DashboardLayout;
