import { NavLink } from "react-router-dom";
import { useAccounts } from "../contexts/AccountContext";
import AccountManager from "../features/accounts/AccountManager";
import { formatMoney } from "../utils/formatters";

function AccountsPage() {
  const {
    accounts,
    totalNetWorth,
    loading,
    showArchived,
    toggleShowArchived,
    fetchAccounts,
  } = useAccounts();

  return (
    <>
      <header className="page-header">
        <div className="page-header-flex">
          <div>
            <p className="eyebrow">VÍ & TÀI KHOẢN</p>
            <h1>Quản lý ví & tài khoản</h1>
            <p className="subtitle">
              Theo dõi tiền mặt, tài khoản ngân hàng và các ví điện tử.
            </p>
          </div>
          <div className="net-worth-badge">
            <span>Tổng tài sản hiện có</span>
            <strong>{formatMoney(totalNetWorth)}</strong>
          </div>
        </div>
      </header>

      <div className="section-tab-nav" role="tablist" aria-label="Chuyển đổi ví và danh mục">
        <NavLink
          to="/accounts"
          className={({ isActive }) => `section-tab-btn ${isActive ? "active" : ""}`}
        >
          Ví tiền ({accounts.length})
        </NavLink>
        <NavLink
          to="/categories"
          className={({ isActive }) => `section-tab-btn ${isActive ? "active" : ""}`}
        >
          Danh mục
        </NavLink>
      </div>

      <AccountManager
        accounts={accounts}
        loading={loading}
        showArchived={showArchived}
        onToggleArchived={toggleShowArchived}
        onChanged={fetchAccounts}
      />
    </>
  );
}

export default AccountsPage;

