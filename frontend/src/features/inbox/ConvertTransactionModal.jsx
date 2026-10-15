import { useState } from "react";
import { useAccounts } from "../../contexts/AccountContext";
import { useCategories } from "../../contexts/CategoryContext";
import { formatMoney, formatAccountType, getLocalDateString } from "../../utils/formatters";

export default function ConvertTransactionModal({ item, onClose, onConfirm, isResolving }) {
  const { activeAccounts } = useAccounts();
  const { categories } = useCategories();

  // Đọc thông tin đã phân tích sơ bộ nếu có
  const parsed = typeof item.parsed_json === "string"
    ? (() => {
        try {
          return JSON.parse(item.parsed_json);
        } catch {
          return null;
        }
      })()
    : item.parsed_json;

  const initialType = parsed?.detected_type === "income" ? "income" : "expense";
  const initialAmount = parsed?.detected_amount ? String(parsed.detected_amount) : "";
  const initialDate = item.posted_at
    ? getLocalDateString(new Date(item.posted_at))
    : getLocalDateString();

  const [type, setType] = useState(initialType);
  const [amountStr, setAmountStr] = useState(initialAmount);
  const [accountId, setAccountId] = useState(() => {
    return activeAccounts[0] ? String(activeAccounts[0].id) : "";
  });

  const [categoryId, setCategoryId] = useState(() => {
    const matchedCats = categories.filter((c) => c.type === initialType);
    return matchedCats[0] ? String(matchedCats[0].id) : "";
  });

  const [transactionDate, setTransactionDate] = useState(initialDate);
  const [note, setNote] = useState(() => {
    if (item.title) return item.title;
    if (item.text) return item.text.slice(0, 100);
    return "";
  });
  const [localError, setLocalError] = useState("");

  const handleTypeChange = (newType) => {
    setType(newType);
    const available = categories.filter((c) => c.type === newType);
    if (available.length > 0) {
      setCategoryId(String(available[0].id));
    } else {
      setCategoryId("");
    }
  };

  const availableCategories = categories.filter((c) => c.type === type);
  const numericAmount = Number(amountStr) || 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    setLocalError("");

    if (numericAmount <= 0) {
      setLocalError("Vui lòng nhập số tiền lớn hơn 0.");
      return;
    }
    if (!accountId) {
      setLocalError("Vui lòng chọn ví nhận hoặc thanh toán.");
      return;
    }
    if (!categoryId) {
      setLocalError("Vui lòng chọn danh mục phù hợp.");
      return;
    }

    onConfirm({
      amount: numericAmount,
      type,
      account_id: Number(accountId),
      category_id: Number(categoryId),
      transaction_date: transactionDate,
      note: note.trim() || null,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-content convert-tx-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="convert-tx-title"
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">XÁC THỰC THÔNG BÁO</span>
            <h2 id="convert-tx-title">Tạo giao dịch từ thông báo</h2>
          </div>
          <button
            type="button"
            className="sheet-close-btn"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Khối hiển thị nội dung tin gốc */}
        <div className="inbox-raw-preview-box">
          <div className="raw-preview-header">
            <span className="raw-badge">Tin gốc từ điện thoại</span>
            <span className="raw-pkg">{item.package}</span>
          </div>
          <blockquote className="raw-text-quote">
            {item.title && <div className="raw-quote-title">{item.title}</div>}
            <div className="raw-quote-body">{item.text}</div>
          </blockquote>
          {parsed?.detected_amount && (
            <div className="raw-detected-hint">
              <span>Đã nhận diện: </span>
              <strong>{formatMoney(parsed.detected_amount)}</strong>
              <span className="detected-type-tag">
                ({parsed.detected_type === "income" ? "Thu nhập" : "Chi tiêu"})
              </span>
            </div>
          )}
        </div>

        {localError && <div className="message error">{localError}</div>}

        <form onSubmit={handleSubmit} className="convert-tx-form">
          {/* Loại giao dịch */}
          <div className="form-group">
            <span className="form-label">Loại giao dịch</span>
            <div className="sheet-type-pills">
              <button
                type="button"
                className={`pill-btn ${type === "expense" ? "active expense" : ""}`}
                onClick={() => handleTypeChange("expense")}
              >
                Chi tiêu
              </button>
              <button
                type="button"
                className={`pill-btn ${type === "income" ? "active income" : ""}`}
                onClick={() => handleTypeChange("income")}
              >
                Thu nhập
              </button>
            </div>
          </div>

          {/* Số tiền */}
          <div className="form-group">
            <label htmlFor="tx-amount" className="form-label">
              Số tiền (₫) *
            </label>
            <input
              id="tx-amount"
              type="number"
              min="1"
              step="1"
              required
              value={amountStr}
              placeholder="VD: 50000"
              onChange={(e) => setAmountStr(e.target.value)}
            />
            {numericAmount > 0 && (
              <span className="form-help-amount">
                Hiển thị: <strong>{formatMoney(numericAmount)}</strong>
              </span>
            )}
          </div>

          <div className="form-row-2col">
            {/* Chọn ví */}
            <div className="form-group">
              <label htmlFor="tx-account" className="form-label">
                Ví thanh toán *
              </label>
              <select
                id="tx-account"
                value={accountId}
                required
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">-- Chọn ví --</option>
                {activeAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatAccountType(acc.type)})
                  </option>
                ))}
              </select>
            </div>

            {/* Chọn danh mục */}
            <div className="form-group">
              <label htmlFor="tx-category" className="form-label">
                Danh mục *
              </label>
              <select
                id="tx-category"
                value={categoryId}
                required
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">-- Chọn danh mục --</option>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row-2col">
            {/* Ngày giao dịch */}
            <div className="form-group">
              <label htmlFor="tx-date" className="form-label">
                Ngày giao dịch *
              </label>
              <input
                id="tx-date"
                type="date"
                required
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
              />
            </div>

            {/* Ghi chú */}
            <div className="form-group">
              <label htmlFor="tx-note" className="form-label">
                Ghi chú
              </label>
              <input
                id="tx-note"
                type="text"
                placeholder="Nội dung hoặc ghi chú..."
                value={note}
                maxLength="200"
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={onClose}
              disabled={isResolving}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="button-primary"
              disabled={isResolving || numericAmount <= 0 || !accountId || !categoryId}
            >
              {isResolving ? "Đang xử lý..." : "Xác nhận tạo giao dịch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

