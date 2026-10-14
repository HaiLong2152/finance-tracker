import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import DashboardLayout from "./app/DashboardLayout";
import DashboardPage from "./pages/DashboardPage";
import TransactionsPage from "./pages/TransactionsPage";
import CategoriesPage from "./pages/CategoriesPage";
import AccountsPage from "./pages/AccountsPage";
import BudgetsPage from "./pages/BudgetsPage";
import LoginPage from "./pages/LoginPage";
import { UIProvider } from "./contexts/UIContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CategoryProvider, useCategories } from "./contexts/CategoryContext";
import { AccountProvider, useAccounts } from "./contexts/AccountContext";
import { TransactionProvider, useTransactions } from "./contexts/TransactionContext";
import { BudgetProvider } from "./contexts/BudgetContext";
import { ReportProvider, useReports } from "./contexts/ReportContext";

function AppContent() {
  const { isAuthenticated, isChecking } = useAuth();
  const { fetchCategories } = useCategories();
  const { fetchAccounts } = useAccounts();
  const { fetchTransactions } = useTransactions();
  const { refreshReports } = useReports();

  useEffect(() => {
    if (isAuthenticated) {
      fetchCategories();
      fetchAccounts();
      fetchTransactions();
      refreshReports();
    }
  }, [isAuthenticated, fetchCategories, fetchAccounts, fetchTransactions, refreshReports]);

  if (isChecking) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-spinner" />
        <p>Đang kiểm tra phiên làm việc...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

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
      <AuthProvider>
        <BudgetProvider>
          <CategoryProvider>
            <AccountProvider>
              <ReportProvider>
                <TransactionProvider>
                  <AppContent />
                </TransactionProvider>
              </ReportProvider>
            </AccountProvider>
          </CategoryProvider>
        </BudgetProvider>
      </AuthProvider>
    </UIProvider>
  );
}

export default App;
