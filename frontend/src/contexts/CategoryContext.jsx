import { createContext, useContext, useState, useCallback } from "react";
import { categoryApi, getApiErrorMessage } from "../services/api";
import { useUI } from "./UIContext";
import { useBudgets } from "./BudgetContext";

const CategoryContext = createContext();

export function CategoryProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { setError, setNotice, confirm } = useUI();
  const { fetchBudgets } = useBudgets();

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const response = await categoryApi.list();
      setCategories(response.data.data || []);
    } catch (error) {
      setError(getApiErrorMessage(error, "Không thể tải danh mục."));
    } finally {
      setLoading(false);
    }
  }, [setError]);

  const createCategory = async (payload) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await categoryApi.create(payload);
      setNotice(res.data?.message || `Đã thêm danh mục ${payload.type === "expense" ? "chi tiêu" : "thu nhập"}.`);
      await fetchCategories();
      return true;
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể tạo danh mục."));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateCategory = async (id, payload) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await categoryApi.update(id, payload);
      setNotice(res.data?.message || "Đã cập nhật danh mục.");
      await fetchCategories();
      return true;
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể cập nhật danh mục."));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (cat) => {
    if (Number(cat.transaction_count) > 0) {
      await confirm(
        "Không thể xóa danh mục",
        `Danh mục "${cat.name}" đang được sử dụng trong ${cat.transaction_count} giao dịch. Vui lòng chuyển các giao dịch này sang danh mục khác trước khi xóa.`
      );
      return false;
    }

    const hasBudgets = Number(cat.budget_count) > 0;
    const confirmTitle = hasBudgets ? "Cảnh báo: Danh mục đang có ngân sách" : "Xác nhận xóa danh mục";
    const confirmMessage = hasBudgets
      ? `Danh mục "${cat.name}" đang có ${cat.budget_count} hạn mức ngân sách được thiết lập qua các tháng. Việc xóa danh mục sẽ đồng thời XÓA TOÀN BỘ các hạn mức ngân sách này.\n\nBạn có chắc chắn muốn tiếp tục xóa không?`
      : `Bạn có chắc muốn xóa danh mục "${cat.name}"?`;

    const isConfirmed = await confirm(confirmTitle, confirmMessage);
    if (!isConfirmed) return false;

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await categoryApi.remove(cat.id);
      setNotice(res.data?.message || "Đã xóa danh mục.");
      await fetchCategories();
      if (hasBudgets && typeof fetchBudgets === "function") {
        await fetchBudgets();
      }
      return true;
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể xóa danh mục."));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <CategoryContext.Provider
      value={{
        categories,
        loading,
        saving,
        fetchCategories,
        createCategory,
        updateCategory,
        deleteCategory,
      }}
    >
      {children}
    </CategoryContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useCategories = () => useContext(CategoryContext);
