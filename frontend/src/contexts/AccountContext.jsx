import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from "react";
import { accountApi, getApiErrorMessage } from "../services/api";
import { useUI } from "./UIContext";

const AccountContext = createContext();

export function AccountProvider({ children }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const { setError, setNotice, confirm } = useUI();

  const showArchivedRef = useRef(showArchived);
  useEffect(() => {
    showArchivedRef.current = showArchived;
  }, [showArchived]);

  const fetchAccounts = useCallback(async (includeArchived) => {
    const shouldInclude = typeof includeArchived === "boolean" ? includeArchived : showArchivedRef.current;
    setLoading(true);
    try {
      const response = await accountApi.list(shouldInclude);
      setAccounts(response.data.data || []);
    } catch (error) {
      setError(getApiErrorMessage(error, "Không thể tải danh sách ví."));
    } finally {
      setLoading(false);
    }
  }, [setError]);

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

  const createAccount = async (payload) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await accountApi.create(payload);
      setNotice(response.data?.message || "Đã tạo ví mới thành công.");
      await fetchAccounts();
      return true;
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể tạo ví mới."));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateAccount = async (id, payload) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await accountApi.update(id, payload);
      setNotice(response.data?.message || "Đã cập nhật thông tin ví.");
      await fetchAccounts();
      return true;
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể cập nhật thông tin ví."));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const archiveAccount = async (account) => {
    const actionText = account.is_archived ? "khôi phục" : "lưu trữ";
    const confirmed = await confirm(
      `Xác nhận ${actionText}`,
      `Bạn có chắc muốn ${actionText} ví "${account.name}"?`
    );
    if (!confirmed) return false;

    setError("");
    setNotice("");
    try {
      await accountApi.archive(account.id, !account.is_archived);
      setNotice(account.is_archived ? `Đã khôi phục ví "${account.name}".` : `Đã lưu trữ ví "${account.name}".`);
      await fetchAccounts();
      return true;
    } catch (err) {
      setError(getApiErrorMessage(err, `Không thể ${actionText} ví.`));
      return false;
    }
  };

  const deleteAccount = async (account) => {
    if (account.transaction_count > 0) {
      setError(`Ví "${account.name}" đã có ${account.transaction_count} giao dịch. Vui lòng chuyển sang chế độ lưu trữ thay vì xóa.`);
      return false;
    }

    const confirmed = await confirm(
      "Xác nhận xóa ví",
      `Bạn có chắc chắn muốn xóa vĩnh viễn ví "${account.name}"? Thao tác này không thể hoàn tác.`
    );
    if (!confirmed) return false;

    setError("");
    setNotice("");
    try {
      const response = await accountApi.remove(account.id);
      setNotice(response.data?.message || `Đã xóa ví "${account.name}".`);
      await fetchAccounts();
      return true;
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể xóa ví."));
      return false;
    }
  };

  return (
    <AccountContext.Provider
      value={{
        accounts,
        activeAccounts,
        totalNetWorth,
        loading,
        saving,
        showArchived,
        setShowArchived,
        toggleShowArchived,
        fetchAccounts,
        createAccount,
        updateAccount,
        archiveAccount,
        deleteAccount,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAccounts = () => useContext(AccountContext);
