import { useOutletContext } from "react-router-dom";
import DashboardSummary from "../features/dashboard/DashboardSummary";

function DashboardPage() {
  const { transactions, dashboardMonth, setDashboardMonth } = useOutletContext();

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">FINANCE TRACKER</p>
        <h1>Sổ thu chi cá nhân</h1>
        <p className="subtitle">Theo dõi tình hình tài chính của bạn theo từng tháng.</p>
      </header>
      <DashboardSummary transactions={transactions} month={dashboardMonth} onMonthChange={setDashboardMonth} />
    </>
  );
}

export default DashboardPage;
