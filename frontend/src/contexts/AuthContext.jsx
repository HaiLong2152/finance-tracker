import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi, setOnUnauthorizedCallback, getApiErrorMessage } from "../services/api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Đăng ký callback khi có bất kỳ request API nào trả về 401
  useEffect(() => {
    setOnUnauthorizedCallback(() => {
      setIsAuthenticated(false);
    });
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const response = await authApi.me();
      setIsAuthenticated(Boolean(response.data?.data?.authenticated));
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const verifyInitialSession = async () => {
      try {
        const response = await authApi.me();
        if (isMounted) {
          setIsAuthenticated(Boolean(response.data?.data?.authenticated));
        }
      } catch {
        if (isMounted) {
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    };

    verifyInitialSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (password) => {
    setIsSubmitting(true);
    setAuthError("");
    try {
      const response = await authApi.login(password);
      if (response.data?.success) {
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (err) {
      const msg = getApiErrorMessage(err, "Mật khẩu không chính xác.");
      setAuthError(msg);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Bỏ qua lỗi mạng khi logout
    } finally {
      setIsAuthenticated(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isChecking,
        authError,
        setAuthError,
        isSubmitting,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
