import { useState, useEffect, useMemo, useCallback } from "react";
import { useAccounts } from "../../contexts/AccountContext";
import { useCategories } from "../../contexts/CategoryContext";
import { useTransactions } from "../../contexts/TransactionContext";
import { useUI } from "../../contexts/UIContext";
import { transactionApi, getApiErrorMessage } from "../../services/api";
import { formatMoney, formatAccountType } from "../../utils/formatters";

export default function QuickAddModal({ onClose }) {
  const { activeAccounts, fetchAccounts } = useAccounts();
  const { categories } = useCategories();
  const { fetchTransactions } = useTransactions();
  const { setNotice, setError } = useUI();

  const [type, setType] = useState("expense");
  const [amountStr, setAmountStr] = useState("");

  const [accountId, setAccountId] = useState(() => {
    const saved = localStorage.getItem("last_used_account_id");
    if (saved && activeAccounts.some((a) => String(a.id) === saved)) return saved;
    return activeAccounts[0] ? String(activeAccounts[0].id) : "";
  });

  const [categoryId, setCategoryId] = useState(() => {
    const saved = localStorage.getItem("last_used_cat_expense");
    const expenseCats = categories.filter((c) => c.type === "expense");
    if (saved && expenseCats.some((c) => String(c.id) === saved)) return saved;
    return expenseCats[0] ? String(expenseCats[0].id) : "";
  });

  const [note, setNote] = useState("");
  const [transactionDate, setTransactionDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [saving, setSaving] = useState(false);

  // Khi đổi type (chi/thu), cập nhật categoryId phù hợp
  const handleTypeChange = (newType) => {
    setType(newType);
    const available = categories.filter((c) => c.type === newType);
    const savedCatId = localStorage.getItem(`last_used_cat_${newType}`);
    if (savedCatId && available.some((c) => String(c.id) === savedCatId)) {
      setCategoryId(savedCatId);
    } else if (available.length > 0) {
      setCategoryId(String(available[0].id));
    } else {
      setCategoryId("");
    }
  };

  const availableCategories = useMemo(() => {
    return categories.filter((c) => c.type === type);
  }, [categories, type]);

  const numericAmount = Number(amountStr) || 0;

  // Xử lý bấm phím số Numpad
  const handleNumpad = useCallback((key) => {
    if (key === "C") {
      setAmountStr("");
      return;
    }
    if (key === "BACK") {
      setAmountStr((prev) => prev.slice(0, -1));
      return;
    }
    if (key === "000") {
      setAmountStr((prev) => {
        if (!prev || prev === "0") return prev;
        if (prev.length > 11) return prev;
        return prev + "000";
      });
      return;
    }
    // Các số 0 - 9
    setAmountStr((prev) => {
      if (prev.length > 12) return prev;
      if (prev === "0") return key === "0" ? "0" : key;
      return prev + key;
    });
  }, []);

  // Xử lý cộng nhanh tiền (+10k, +50k, ...)
  const handleAddPreset = (value) => {
    setAmountStr((prev) => {
      const current = Number(prev) || 0;
      const next = current + value;
      return String(next);
    });
  };

  // Hỗ trợ bấm phím vật lý trên bàn phím máy tính
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT") return;
      if (e.key >= "0" && e.key <= "9") {
        handleNumpad(e.key);
      } else if (e.key === "Backspace") {
        handleNumpad("BACK");
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNumpad, onClose]);

  // Submit lưu giao dịch
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (numericAmount <= 0) {
      setError("Vui lòng nhập số tiền lớn hơn 0.");
      return;
    }
    if (!accountId) {
      setError("Vui lòng chọn ví.");
      return;
    }
    if (!categoryId) {
      setError("Vui lòng chọn danh mục.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        amount: numericAmount,
        type,
        account_id: Number(accountId),
        category_id: Number(categoryId),
        transaction_date: transactionDate,
        note: note.trim() || null,
      };

      await transactionApi.create(payload);

      // Lưu lại lựa chọn để lần sau tự điền
      localStorage.setItem("last_used_account_id", accountId);
      localStorage.setItem(`last_used_cat_${type}`, categoryId);

      const catObj = categories.find((c) => String(c.id) === String(categoryId));
      setNotice(`Đã thêm ${formatMoney(numericAmount)} (${catObj?.name || ""})`);

      await Promise.all([fetchTransactions(), fetchAccounts()]);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể lưu giao dịch."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="quick-add-overlay" onClick={onClose} role="presentation">
      <div
        className="quick-add-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
      >
        <div className="sheet-handle" />

        <div className="sheet-header">
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
          <button
            type="button"
            className="sheet-close-btn"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Màn hình hiển thị số tiền */}
        <div className="sheet-amount-display">
          <span className="amount-label">Số tiền:</span>
          <div className="amount-value-wrap">
            <span className={`amount-digits ${numericAmount > 0 ? "has-value" : ""}`}>
              {numericAmount > 0 ? formatMoney(numericAmount) : "0 ₫"}
            </span>
          </div>
        </div>

        {/* Nút cộng nhanh tiền */}
        <div className="sheet-presets">
          <button type="button" onClick={() => handleAddPreset(10000)}>+10k</button>
          <button type="button" onClick={() => handleAddPreset(20000)}>+20k</button>
          <button type="button" onClick={() => handleAddPreset(50000)}>+50k</button>
          <button type="button" onClick={() => handleAddPreset(100000)}>+100k</button>
          <button type="button" onClick={() => handleAddPreset(500000)}>+500k</button>
        </div>

        {/* Chọn Ví & Ngày */}
        <div className="sheet-selectors">
          <label className="sheet-select-item">
            <span>Ví:</span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {activeAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({formatAccountType(acc.type)})
                </option>
              ))}
            </select>
          </label>

          <label className="sheet-select-item">
            <span>Ngày:</span>
            <input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
            />
          </label>
        </div>

        {/* Chip chọn danh mục */}
        <div className="sheet-categories-section">
          <span className="section-sublabel">Chọn danh mục:</span>
          <div className="sheet-category-chips">
            {availableCategories.map((c) => {
              const isSelected = String(c.id) === String(categoryId);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`category-chip ${isSelected ? "selected" : ""}`}
                  onClick={() => setCategoryId(String(c.id))}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ghi chú ngắn */}
        <div className="sheet-note-row">
          <input
            type="text"
            placeholder="Ghi chú nhanh (ví dụ: Cơm trưa, Grab...)"
            value={note}
            maxLength="200"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {/* Bàn phím số Numpad */}
        <div className="sheet-numpad">
          <button type="button" onClick={() => handleNumpad("1")}>1</button>
          <button type="button" onClick={() => handleNumpad("2")}>2</button>
          <button type="button" onClick={() => handleNumpad("3")}>3</button>
          <button type="button" onClick={() => handleNumpad("4")}>4</button>
          <button type="button" onClick={() => handleNumpad("5")}>5</button>
          <button type="button" onClick={() => handleNumpad("6")}>6</button>
          <button type="button" onClick={() => handleNumpad("7")}>7</button>
          <button type="button" onClick={() => handleNumpad("8")}>8</button>
          <button type="button" onClick={() => handleNumpad("9")}>9</button>
          <button type="button" className="btn-func" onClick={() => handleNumpad("C")}>C</button>
          <button type="button" onClick={() => handleNumpad("0")}>0</button>
          <button type="button" onClick={() => handleNumpad("000")}>000</button>
        </div>

        {/* Nút hành động */}
        <div className="sheet-actions">
          <button
            type="button"
            className="sheet-backspace-btn"
            onClick={() => handleNumpad("BACK")}
            aria-label="Xóa 1 ký tự"
          >
            ⌫ Xóa
          </button>
          <button
            type="button"
            className="sheet-submit-btn"
            disabled={saving || numericAmount <= 0 || !categoryId || !accountId}
            onClick={handleSubmit}
          >
            {saving ? "Đang lưu…" : "Lưu ngay ➔"}
          </button>
        </div>
      </div>
    </div>
  );
}

