import { useState } from "react";
import { formatMoney } from "../../utils/formatters";

const QUICK_AMOUNTS = [
  { label: "500k", value: 500000 },
  { label: "1tr", value: 1000000 },
  { label: "2tr", value: 2000000 },
  { label: "3tr", value: 3000000 },
  { label: "5tr", value: 5000000 },
  { label: "10tr", value: 10000000 },
];

function BudgetModal({
  isOpen,
  onClose,
  onSave,
  categories = [],
  editingBudget = null,
  month = "",
}) {
  const [categoryId, setCategoryId] = useState(
    editingBudget ? String(editingBudget.category_id) : (categories[0] ? String(categories[0].id) : "")
  );
  const [limitAmount, setLimitAmount] = useState(
    editingBudget ? String(editingBudget.limit_amount) : ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const parsedAmount = Number(limitAmount);
    if (!Number.isSafeInteger(parsedAmount) || parsedAmount <= 0) {
      setFormError("Hạn mức ngân sách phải là số nguyên dương lớn hơn 0.");
      return;
    }

    if (!editingBudget && !categoryId) {
      setFormError("Vui lòng chọn danh mục chi tiêu.");
      return;
    }

    setSubmitting(true);
    const success = await onSave({
      id: editingBudget?.id,
      category_id: editingBudget ? editingBudget.category_id : Number(categoryId),
      limit_amount: parsedAmount,
      month,
    });
    setSubmitting(false);

    if (success) {
      onClose();
    }
  };

  const handleQuickAmount = (val) => {
    setLimitAmount(String(val));
    setFormError("");
  };

  const numericValue = Number(limitAmount) || 0;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card budget-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="budget-modal-title"
      >
        <div className="modal-header">
          <div>
            <h3 id="budget-modal-title">
              {editingBudget ? "Sửa hạn mức ngân sách" : "Đặt hạn mức ngân sách"}
            </h3>
            <span className="modal-subtitle">Tháng {month}</span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {formError && (
          <p className="message error" role="alert">
            {formError}
          </p>
        )}

        <form onSubmit={handleSubmit} className="budget-form">
          {editingBudget ? (
            <div className="form-group">
              <label>Danh mục chi tiêu</label>
              <div className="readonly-category-badge">
                <strong>{editingBudget.category_name}</strong>
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="budget-category-select">
                Danh mục chi tiêu <span className="required">*</span>
              </label>
              <select
                id="budget-category-select"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                {categories.length === 0 ? (
                  <option value="">Không có danh mục chi tiêu nào</option>
                ) : (
                  categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="budget-limit-amount">
              Hạn mức tối đa (₫) <span className="required">*</span>
            </label>
            <input
              id="budget-limit-amount"
              type="number"
              inputMode="numeric"
              step="1000"
              min="1000"
              placeholder="VD: 2000000"
              value={limitAmount}
              onChange={(e) => setLimitAmount(e.target.value)}
              autoFocus
              required
            />
            {numericValue > 0 && (
              <span className="amount-preview">
                {formatMoney(numericValue)}
              </span>
            )}
          </div>

          <div className="quick-amount-container">
            <span className="quick-amount-label">Gợi ý nhanh:</span>
            <div className="quick-amount-chips">
              {QUICK_AMOUNTS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={`chip-btn ${numericValue === item.value ? "chip-active" : ""}`}
                  onClick={() => handleQuickAmount(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="button-primary"
              disabled={submitting || (!editingBudget && categories.length === 0)}
            >
              {submitting ? "Đang lưu..." : editingBudget ? "Cập nhật" : "Thiết lập"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BudgetModal;

