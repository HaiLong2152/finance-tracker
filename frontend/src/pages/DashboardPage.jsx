import { useEffect, useState } from "react";
import { useTransactions } from "../contexts/TransactionContext";
import { useAccounts } from "../contexts/AccountContext";
import { useBudgets } from "../contexts/BudgetContext";
import { reportApi } from "../services/api";
import DashboardSummary from "../features/dashboard/DashboardSummary";

function DashboardPage() {
  const { dashboardMonth, setDashboardMonth } = useTransactions();
  const { activeAccounts, totalNetWorth } = useAccounts();
  const { budgetsData, fetchBudgets } = useBudgets();
  const [reportSummary, setReportSummary] = useState(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);

  useEffect(() => {
    if (dashboardMonth) {
      fetchBudgets(dashboardMonth);
    }
  }, [dashboardMonth, fetchBudgets]);

  // Tải danh sách các tháng có dữ liệu giao dịch
  useEffect(() => {
    let isMounted = true;
    reportApi.getMonths()
      .then((res) => {
        if (isMounted) {
          setAvailableMonths(res.data?.data || []);
        }
      })
      .catch((err) => {
        console.error("Không thể tải danh sách tháng:", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Tải báo cáo thu chi và phân bổ danh mục theo tháng
  useEffect(() => {
    let isMounted = true;
    const loadReports = async () => {
      try {
        const [sumRes, catRes, trendRes] = await Promise.all([
          reportApi.getSummary(dashboardMonth),
          reportApi.getByCategory(dashboardMonth),
          reportApi.getTrend(6),
        ]);
        if (isMounted) {
          setReportSummary(sumRes.data?.data || null);
          setCategoryBreakdown(catRes.data?.data?.items || []);
          setTrendData(trendRes.data?.data?.data || []);
        }
      } catch (err) {
        console.error("Không thể tải dữ liệu báo cáo:", err);
      }
    };

    loadReports();
    return () => {
      isMounted = false;
    };
  }, [dashboardMonth]);

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">FINANCE TRACKER</p>
        <h1>Sổ thu chi cá nhân</h1>
        <p className="subtitle">Theo dõi tình hình tài chính của bạn theo từng tháng.</p>
      </header>
      <DashboardSummary
        month={dashboardMonth}
        onMonthChange={setDashboardMonth}
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
