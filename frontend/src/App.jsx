import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import DashboardLayout from "./app/DashboardLayout";
import DashboardPage from "./pages/DashboardPage";
import TransactionsPage from "./pages/TransactionsPage";
import CategoriesPage from "./pages/CategoriesPage";
import { UIProvider } from "./contexts/UIContext";
import { CategoryProvider, useCategories } from "./contexts/CategoryContext";
import { TransactionProvider, useTransactions } from "./contexts/TransactionContext";

function AppContent() {
  const { fetchCategories } = useCategories();
  const { fetchTransactions } = useTransactions();

  useEffect(() => {
    fetchCategories();
    fetchTransactions();
  }, [fetchCategories, fetchTransactions]);

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
