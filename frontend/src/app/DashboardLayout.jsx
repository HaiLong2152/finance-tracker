import { NavLink, Outlet } from "react-router-dom";
import { useUI } from "../contexts/UIContext";

const navigationItems = [
  { to: "/", label: "Tổng quan", end: true },
  { to: "/transactions", label: "Giao dịch" },
  { to: "/categories", label: "Danh mục" },
];

function DashboardLayout() {
  const { error, notice } = useUI();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">₫</span><span>Finance Tracker</span></div>
        <nav className="navigation" aria-label="Điều hướng chính">
          {navigationItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="app-content">
        {error && <p className="message error" role="alert">{error}</p>}
        {notice && <p className="message success" role="status">{notice}</p>}
        <Outlet />
      </main>
    </div>
  );
}

export default DashboardLayout;
