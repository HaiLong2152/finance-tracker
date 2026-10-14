import { createContext, useContext, useState, useCallback, useRef } from "react";
import { reportApi, getApiErrorMessage } from "../services/api";
import { useUI } from "./UIContext";
import { getCurrentMonth } from "../utils/formatters";

const ReportContext = createContext();

export function ReportProvider({ children }) {
  const [reportMonth, setReportMonthState] = useState(() => getCurrentMonth());
  const [reportSummary, setReportSummary] = useState(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [loading, setLoading] = useState(false);
  const { setError } = useUI();

  const reportMonthRef = useRef(reportMonth);

  const fetchAvailableMonths = useCallback(async () => {
    try {
      const res = await reportApi.getMonths();
      setAvailableMonths(res.data?.data || []);
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể tải danh sách tháng có dữ liệu."));
    }
  }, [setError]);

  const fetchReports = useCallback(async (monthParam) => {
    const targetMonth = monthParam !== undefined ? monthParam : reportMonthRef.current;
    const targetPeriod = targetMonth || "all";
    setLoading(true);
    try {
      const [sumRes, catRes, trendRes] = await Promise.all([
        reportApi.getSummary(targetPeriod),
        reportApi.getByCategory(targetPeriod),
        reportApi.getTrend(6),
      ]);
      setReportSummary(sumRes.data?.data || null);
      setCategoryBreakdown(catRes.data?.data?.items || []);
      setTrendData(trendRes.data?.data?.data || []);
      if (monthParam !== undefined && monthParam !== reportMonthRef.current) {
        reportMonthRef.current = monthParam;
        setReportMonthState(monthParam);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể tải dữ liệu báo cáo thu chi."));
    } finally {
      setLoading(false);
    }
  }, [setError]);

  const setReportMonth = useCallback((newMonth) => {
    reportMonthRef.current = newMonth;
    setReportMonthState(newMonth);
    fetchReports(newMonth);
  }, [fetchReports]);

  const refreshReports = useCallback(async () => {
    await Promise.all([
      fetchAvailableMonths(),
      fetchReports(reportMonthRef.current),
    ]);
  }, [fetchAvailableMonths, fetchReports]);

  return (
    <ReportContext.Provider
      value={{
        reportMonth,
        setReportMonth,
        reportSummary,
        categoryBreakdown,
        trendData,
        availableMonths,
        loading,
        fetchReports,
        fetchAvailableMonths,
        refreshReports,
      }}
    >
      {children}
    </ReportContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useReports() {
  const context = useContext(ReportContext);
  if (!context) {
    throw new Error("useReports phải được sử dụng bên trong ReportProvider.");
  }
  return context;
}
