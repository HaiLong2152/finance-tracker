import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import DashboardLayout from "./app/DashboardLayout";
import DashboardPage from "./pages/DashboardPage";
import TransactionsPage from "./pages/TransactionsPage";
import CategoriesPage from "./pages/CategoriesPage";
import AccountsPage from "./pages/AccountsPage";
import { UIProvider } from "./contexts/UIContext";
import { CategoryProvider, useCategories } from "./contexts/CategoryContext";
import { AccountProvider, useAccounts } from "./contexts/AccountContext";
import { TransactionProvider, useTransactions } from "./contexts/TransactionContext";

function AppContent() {
  const { fetchCategories } = useCategories();
  const { fetchAccounts } = useAccounts();
  const { fetchTransactions } = useTransactions();

  useEffect(() => {
    fetchCategories();
    fetchAccounts();
    fetchTransactions();
  }, [fetchCategories, fetchAccounts, fetchTransactions]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="accounts" element={<AccountsPage />} />
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
        <AccountProvider>
          <TransactionProvider>
            <AppContent />
          </TransactionProvider>
        </AccountProvider>
      </CategoryProvider>
    </UIProvider>
  );
}

export default App;
