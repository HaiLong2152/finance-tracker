import { useState, useRef, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import BrandLogo from "../components/BrandLogo";

function LoginPage() {
  const { login, authError, setAuthError, isSubmitting } = useAuth();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setAuthError("Vui lòng nhập mật khẩu.");
      return;
    }
    await login(password);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <BrandLogo size={48} instanceId="login-logo" />
          <h1>Finance Tracker</h1>
          <p className="login-subtitle">
            Nhập mật khẩu để truy cập sổ thu chi cá nhân của bạn
          </p>
        </div>

        {authError && (
          <div className="login-error-alert" role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="login-password">
            Mật khẩu
            <div className="password-input-wrapper">
              <input
                ref={inputRef}
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="Nhập mật khẩu truy cập..."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (authError) setAuthError("");
                }}
                disabled={isSubmitting}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          <button
            type="submit"
            className="login-submit-btn"
            disabled={isSubmitting || !password.trim()}
          >
            {isSubmitting ? "Đang xác thực..." : "Đăng nhập ➔"}
          </button>
        </form>

        <div className="login-footer">
          <small>
            Phiên đăng nhập được bảo mật bằng HTTP-only cookie 30 ngày.
          </small>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;

