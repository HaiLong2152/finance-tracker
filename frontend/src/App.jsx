import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import DashboardLayout from "./app/DashboardLayout";
import DashboardPage from "./pages/DashboardPage";
import TransactionsPage from "./pages/TransactionsPage";
import CategoriesPage from "./pages/CategoriesPage";
import AccountsPage from "./pages/AccountsPage";
import BudgetsPage from "./pages/BudgetsPage";
import { UIProvider } from "./contexts/UIContext";
import { CategoryProvider, useCategories } from "./contexts/CategoryContext";
import { AccountProvider, useAccounts } from "./contexts/AccountContext";
import { TransactionProvider, useTransactions } from "./contexts/TransactionContext";
import { BudgetProvider, useBudgets } from "./contexts/BudgetContext";

function AppContent() {
  const { fetchCategories } = useCategories();
  const { fetchAccounts } = useAccounts();
  const { fetchTransactions } = useTransactions();
  const { fetchBudgets } = useBudgets();

  useEffect(() => {
    fetchCategories();
    fetchAccounts();
    fetchTransactions();
    fetchBudgets();
  }, [fetchCategories, fetchAccounts, fetchTransactions, fetchBudgets]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="budgets" element={<BudgetsPage />} />
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
          <BudgetProvider>
            <TransactionProvider>
              <AppContent />
            </TransactionProvider>
          </BudgetProvider>
        </AccountProvider>
      </CategoryProvider>
    </UIProvider>
  );
}

export default App;
