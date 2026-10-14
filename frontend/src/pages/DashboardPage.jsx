import { useEffect } from "react";
import { useAccounts } from "../contexts/AccountContext";
import { useBudgets } from "../contexts/BudgetContext";
import { useReports } from "../contexts/ReportContext";
import DashboardSummary from "../features/dashboard/DashboardSummary";

function DashboardPage() {
  const { activeAccounts, totalNetWorth } = useAccounts();
  const { budgetsData, fetchBudgets } = useBudgets();
  const {
    reportMonth,
    setReportMonth,
    reportSummary,
    categoryBreakdown,
    trendData,
    availableMonths,
  } = useReports();

  useEffect(() => {
    if (reportMonth) {
      fetchBudgets(reportMonth);
    }
  }, [reportMonth, fetchBudgets]);

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">FINANCE TRACKER</p>
        <h1>Sổ thu chi cá nhân</h1>
        <p className="subtitle">Theo dõi tình hình tài chính của bạn theo từng tháng.</p>
      </header>
      <DashboardSummary
        month={reportMonth}
        onMonthChange={setReportMonth}
        availableMonths={availableMonths}
        accounts={activeAccounts}
        totalNetWorth={totalNetWorth}
        budgetsData={budgetsData}
        reportSummary={reportSummary}
        categoryBreakdown={categoryBreakdown}
        trendData={trendData}
      />
    </>
  );
}

export default DashboardPage;
