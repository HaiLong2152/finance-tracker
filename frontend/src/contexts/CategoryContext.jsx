import { createContext, useContext, useState, useCallback } from "react";
import { categoryApi } from "../services/api";
import { useUI } from "./UIContext";

const CategoryContext = createContext();

export function CategoryProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const { setError } = useUI();

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const response = await categoryApi.list();
      setCategories(response.data.data || []);
    // eslint-disable-next-line no-unused-vars
    } catch (error) {
      setError("Không thể tải danh mục.");
    } finally {
      setLoading(false);
    }
  }, [setError]);

  return (
    <CategoryContext.Provider value={{ categories, loading, fetchCategories }}>
      {children}
    </CategoryContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useCategories = () => useContext(CategoryContext);

