import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { accountApi, getApiErrorMessage } from "../services/api";
import { useUI } from "./UIContext";

const AccountContext = createContext();

export function AccountProvider({ children }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const { setError } = useUI();

  const fetchAccounts = useCallback(async (includeArchived = showArchived) => {
    setLoading(true);
    try {
      const response = await accountApi.list(includeArchived);
      setAccounts(response.data.data || []);
    } catch (error) {
      setError(getApiErrorMessage(error, "Không thể tải danh sách ví."));
    } finally {
      setLoading(false);
    }
  }, [showArchived, setError]);

  const activeAccounts = useMemo(() => {
    return accounts.filter((a) => !a.is_archived);
  }, [accounts]);

  const totalNetWorth = useMemo(() => {
    return activeAccounts.reduce((sum, a) => sum + Number(a.current_balance || 0), 0);
  }, [activeAccounts]);

  const toggleShowArchived = useCallback(async (val) => {
    const nextVal = typeof val === "boolean" ? val : !showArchived;
    setShowArchived(nextVal);
    await fetchAccounts(nextVal);
  }, [showArchived, fetchAccounts]);

  return (
    <AccountContext.Provider
      value={{
        accounts,
        activeAccounts,
        totalNetWorth,
        loading,
        showArchived,
        setShowArchived,
        toggleShowArchived,
        fetchAccounts,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAccounts = () => useContext(AccountContext);

