import { useEffect, useState } from "react";
import { useTransactions } from "../contexts/TransactionContext";
import { useAccounts } from "../contexts/AccountContext";
import { useBudgets } from "../contexts/BudgetContext";
import { reportApi } from "../services/api";
import DashboardSummary from "../features/dashboard/DashboardSummary";

function DashboardPage() {
  const { transactions, dashboardMonth, setDashboardMonth } = useTransactions();
  const { activeAccounts, totalNetWorth } = useAccounts();
  const { budgetsData, fetchBudgets } = useBudgets();
  const [reportSummary, setReportSummary] = useState(null);
  const [trendData, setTrendData] = useState([]);

  useEffect(() => {
    if (dashboardMonth) {
      fetchBudgets(dashboardMonth);
    }
  }, [dashboardMonth, fetchBudgets]);

  useEffect(() => {
    let isMounted = true;
    const loadReports = async () => {
      try {
        if (dashboardMonth) {
          const [sumRes, trendRes] = await Promise.all([
            reportApi.getSummary(dashboardMonth),
            reportApi.getTrend(6),
          ]);
          if (isMounted) {
            setReportSummary(sumRes.data?.data || null);
            setTrendData(trendRes.data?.data?.data || []);
          }
        } else {
          const trendRes = await reportApi.getTrend(6);
          if (isMounted) {
            setReportSummary(null);
            setTrendData(trendRes.data?.data?.data || []);
          }
        }
      } catch (err) {
        console.error("Không thể tải dữ liệu báo cáo:", err);
      }
    };

    loadReports();
    return () => {
      isMounted = false;
    };
  }, [dashboardMonth, transactions]);

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">FINANCE TRACKER</p>
        <h1>Sổ thu chi cá nhân</h1>
        <p className="subtitle">Theo dõi tình hình tài chính của bạn theo từng tháng.</p>
      </header>
      <DashboardSummary
        transactions={transactions}
        month={dashboardMonth}
        onMonthChange={setDashboardMonth}
        accounts={activeAccounts}
        totalNetWorth={totalNetWorth}
        budgetsData={budgetsData}
        reportSummary={reportSummary}
        trendData={trendData}
      />
    </>
  );
}

export default DashboardPage;
