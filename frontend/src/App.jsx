import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import DashboardLayout from "./app/DashboardLayout";
import DashboardPage from "./pages/DashboardPage";
import TransactionsPage from "./pages/TransactionsPage";
import CategoriesPage from "./pages/CategoriesPage";
import { UIProvider, useUI } from "./contexts/UIContext";
import { CategoryProvider, useCategories } from "./contexts/CategoryContext";
import { TransactionProvider, useTransactions } from "./contexts/TransactionContext";
import { getApiErrorMessage } from "./services/api";

function AppContent() {
  const { fetchCategories } = useCategories();
  const { fetchTransactions } = useTransactions();
  const { setError } = useUI();

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([fetchCategories(), fetchTransactions()]);
      // eslint-disable-next-line no-unused-vars
      } catch (e) {
        setError(getApiErrorMessage(e, "Không thể tải dữ liệu."));
      }
    };
    loadData();
  }, [fetchCategories, fetchTransactions, setError]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <UIProvider>
      <CategoryProvider>
        <TransactionProvider>
          <AppContent />
        </TransactionProvider>
      </CategoryProvider>
    </UIProvider>
  );
}

export default App;
