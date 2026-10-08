import { createContext, useContext, useState, useCallback } from "react";
import ConfirmDialog from "../components/ConfirmDialog";

const UIContext = createContext();

export function UIProvider({ children }) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    onCancel: () => {},
  });

  const confirm = useCallback((title, message) => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        title,
        message,
        onConfirm: () => {
          setDialogState((prev) => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setDialogState((prev) => ({ ...prev, isOpen: false }));
          resolve(false);
        }
      });
    });
  }, []);

  return (
    <UIContext.Provider value={{ error, setError, notice, setNotice, confirm }}>
      {children}
      <ConfirmDialog {...dialogState} />
    </UIContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useUI = () => useContext(UIContext);

