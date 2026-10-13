import { useState, useMemo } from "react";

function BulkCategoryModal({
  isOpen,
  onClose,
  onConfirm,
  categories = [],
  selectedCount = 0,
  hasIncome = false,
  hasExpense = false,
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Lọc danh mục tương thích với các giao dịch được chọn
  const filteredCategories = useMemo(() => {
    if (hasIncome && !hasExpense) {
      return categories.filter((c) => c.type === "income");
    }
    if (hasExpense && !hasIncome) {
      return categories.filter((c) => c.type === "expense");
    }
    return categories;
  }, [categories, hasIncome, hasExpense]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCategoryId) {
      setError("Vui lòng chọn danh mục mới.");
      return;
    }
    setSubmitting(true);
    const success = await onConfirm(Number(selectedCategoryId));
    setSubmitting(false);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="bulk-modal-title"
      >
        <div className="modal-header">
          <div>
            <h3 id="bulk-modal-title">Đổi danh mục hàng loạt</h3>
            <span className="modal-subtitle">
              Áp dụng cho {selectedCount} giao dịch đã chọn
            </span>
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

        {error && <p className="message error" role="alert">{error}</p>}

        {hasIncome && hasExpense && (
          <div className="alert-notice-box" role="alert">
            ⚠️ Bạn đang chọn cả giao dịch <strong>Thu nhập</strong> và <strong>Chi tiêu</strong>. Hãy chọn danh mục phù hợp hoặc tách riêng từng loại để tránh lỗi không khớp loại giao dịch.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="bulk-category-select">
              Chọn danh mục mới <span className="required">*</span>
            </label>
            <select
              id="bulk-category-select"
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setError("");
              }}
              required
              autoFocus
            >
              <option value="">-- Chọn danh mục --</option>
              <optgroup label="Chi tiêu">
                {filteredCategories
                  .filter((c) => c.type === "expense")
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Thu nhập">
                {filteredCategories
                  .filter((c) => c.type === "income")
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </optgroup>
            </select>
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
              disabled={submitting || !selectedCategoryId}
            >
              {submitting ? "Đang xử lý..." : "Cập nhật danh mục"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BulkCategoryModal;

