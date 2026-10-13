import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { budgetApi, getApiErrorMessage } from "../services/api";
import { useUI } from "./UIContext";
import { getLocalDateString } from "../utils/formatters";

const BudgetContext = createContext();

const getDefaultMonth = () => getLocalDateString().slice(0, 7);

const initialBudgetData = {
  month: getDefaultMonth(),
  total_budget: 0,
  total_spent: 0,
  total_remaining: 0,
  overall_percentage: 0,
  warning_count: 0,
  exceeded_count: 0,
  items: [],
};

export function BudgetProvider({ children }) {
  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth());
  const [budgetsData, setBudgetsData] = useState(initialBudgetData);
  const [loading, setLoading] = useState(false);
  const { setError, setNotice, confirm } = useUI();

  // Dùng ref để giữ giá trị selectedMonth mới nhất mà không làm thay đổi identity của fetchBudgets
  const selectedMonthRef = useRef(selectedMonth);
  useEffect(() => {
    selectedMonthRef.current = selectedMonth;
  }, [selectedMonth]);

  const fetchBudgets = useCallback(async (month) => {
    const targetMonth = month || selectedMonthRef.current;
    setLoading(true);
    try {
      const response = await budgetApi.list(targetMonth);
      setBudgetsData(response.data.data || initialBudgetData);
    } catch (error) {
      setError(getApiErrorMessage(error, "Không thể tải thông tin ngân sách."));
    } finally {
      setLoading(false);
    }
  }, [setError]);

  // Tải ngân sách tháng ban đầu khi BudgetProvider được mount
  useEffect(() => {
    fetchBudgets(selectedMonthRef.current);
  }, [fetchBudgets]);

  const saveBudget = async ({ category_id, month = selectedMonthRef.current, limit_amount }) => {
    try {
      setError("");
      const response = await budgetApi.save({
        category_id: Number(category_id),
        month,
        limit_amount: Number(limit_amount),
      });
      setNotice(response.data.message || "Đã lưu hạn mức ngân sách.");
      await fetchBudgets(month);
      return true;
    } catch (error) {
      setError(getApiErrorMessage(error, "Không thể lưu ngân sách."));
      return false;
    }
  };

  const updateBudget = async (id, limit_amount, month = selectedMonthRef.current) => {
    try {
      setError("");
      const response = await budgetApi.update(id, {
        limit_amount: Number(limit_amount),
      });
      setNotice(response.data.message || "Đã cập nhật hạn mức ngân sách.");
      await fetchBudgets(month);
      return true;
    } catch (error) {
      setError(getApiErrorMessage(error, "Không thể cập nhật ngân sách."));
      return false;
    }
  };

  const deleteBudget = async (id, categoryName, month = selectedMonthRef.current) => {
    const isConfirmed = await confirm(
      "Xóa hạn mức",
      `Bạn có chắc muốn xóa hạn mức ngân sách của danh mục "${categoryName}" trong tháng ${month}?`
    );
    if (!isConfirmed) return false;

    try {
      setError("");
      const response = await budgetApi.remove(id);
      setNotice(response.data.message || "Đã xóa hạn mức ngân sách.");
      await fetchBudgets(month);
      return true;
    } catch (error) {
      setError(getApiErrorMessage(error, "Không thể xóa ngân sách."));
      return false;
    }
  };

  const copyFromPrevious = async (targetMonth = selectedMonthRef.current) => {
    const isConfirmed = await confirm(
      "Sao chép ngân sách",
      `Bạn có muốn sao chép toàn bộ hạn mức từ tháng trước sang tháng ${targetMonth}? Các danh mục đã có hạn mức sẽ được cập nhật.`
    );
    if (!isConfirmed) return false;

    try {
      setError("");
      const response = await budgetApi.copyPrevious({ month: targetMonth });
      setNotice(response.data.message || "Đã sao chép ngân sách từ tháng trước.");
      if (response.data?.data?.budgets) {
        setBudgetsData(response.data.data.budgets);
      } else {
        await fetchBudgets(targetMonth);
      }
      return true;
    } catch (error) {
      setError(getApiErrorMessage(error, "Không thể sao chép ngân sách từ tháng trước."));
      return false;
    }
  };

  const handleMonthChange = (newMonth) => {
    setSelectedMonth(newMonth);
    fetchBudgets(newMonth);
  };

  return (
    <BudgetContext.Provider
      value={{
        selectedMonth,
        setSelectedMonth: handleMonthChange,
        budgetsData,
        loading,
        fetchBudgets,
        saveBudget,
        updateBudget,
        deleteBudget,
        copyFromPrevious,
      }}
    >
      {children}
    </BudgetContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useBudgets = () => useContext(BudgetContext);
