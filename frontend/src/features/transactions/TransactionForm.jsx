import { useMemo } from "react";
import { formatAccountType } from "../../utils/formatters";

function TransactionForm({
  categories = [],
  accounts = [],
  formData,
  saving,
  editing,
  onChange,
  onSubmit,
  onCancel,
}) {
  // Lọc danh mục theo loại giao dịch (expense hoặc income)
  const availableCategories = useMemo(() => {
    return categories.filter((c) => c.type === formData.type);
  }, [categories, formData.type]);

  // Tìm ví nguồn đang chọn để kiểm tra ngày bắt đầu
  const selectedSourceAccount = useMemo(() => {
    return accounts.find((a) => String(a.id) === String(formData.account_id));
  }, [accounts, formData.account_id]);

  const sourceStartDate = selectedSourceAccount?.start_date
    ? String(selectedSourceAccount.start_date).slice(0, 10)
    : null;

  const isDateBeforeStart =
    sourceStartDate && formData.transaction_date && formData.transaction_date < sourceStartDate;

  const isTransfer = formData.type === "transfer";

  // Danh sách ví đích (loại bỏ ví nguồn đang chọn)
  const availableTargetAccounts = useMemo(() => {
    return accounts.filter((a) => String(a.id) !== String(formData.account_id));
  }, [accounts, formData.account_id]);

  const cannotSubmit =
    saving ||
    accounts.length === 0 ||
    (!isTransfer && availableCategories.length === 0) ||
    (isTransfer && accounts.length < 2) ||
    isDateBeforeStart;

  return (
    <section className="panel" aria-labelledby="form-title">
      <h2 id="form-title">{editing ? "Sửa giao dịch" : "Thêm giao dịch mới"}</h2>

      <div className="type-toggle-group">
        <button
          type="button"
          className={`type-toggle-btn ${formData.type === "expense" ? "active expense" : ""}`}
          onClick={() => onChange({ target: { name: "type", value: "expense" } })}
        >
          Chi tiêu
        </button>
        <button
          type="button"
          className={`type-toggle-btn ${formData.type === "income" ? "active income" : ""}`}
          onClick={() => onChange({ target: { name: "type", value: "income" } })}
        >
          Thu nhập
        </button>
        <button
          type="button"
          className={`type-toggle-btn ${formData.type === "transfer" ? "active transfer" : ""}`}
          onClick={() => onChange({ target: { name: "type", value: "transfer" } })}
        >
          Chuyển tiền nội bộ
        </button>
      </div>

      <form className="transaction-form" onSubmit={onSubmit}>
        <div className="form-grid">
          <label>
            Số tiền (VND)
            <input
              type="number"
              name="amount"
              min="1"
              step="1"
              placeholder="Ví dụ: 50000"
              value={formData.amount}
              onChange={onChange}
              required
            />
          </label>

          <label>
            {isTransfer ? "Ví nguồn (Chuyển đi)" : formData.type === "income" ? "Ví nhận tiền" : "Ví chi tiền"}
            <select
              name="account_id"
              value={formData.account_id}
              onChange={onChange}
              required
            >
              <option value="">-- Chọn ví --</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({formatAccountType(acc.type)})
                </option>
              ))}
            </select>
          </label>

          {isTransfer ? (
            <label>
              Ví đích (Nhận tiền)
              <select
                name="transfer_account_id"
                value={formData.transfer_account_id}
                onChange={onChange}
                required
              >
                <option value="">-- Chọn ví đích --</option>
                {availableTargetAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatAccountType(acc.type)})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Danh mục
              <select
                name="category_id"
                value={formData.category_id}
                onChange={onChange}
                required
              >
                <option value="">-- Chọn danh mục --</option>
                {availableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Ngày giao dịch
            <input
              type="date"
              name="transaction_date"
              value={formData.transaction_date}
              onChange={onChange}
              required
            />
          </label>
        </div>

        {isDateBeforeStart && (
          <p className="field-warning" role="alert">
            ⚠️ Ngày giao dịch ({formData.transaction_date}) trước ngày bắt đầu theo dõi của ví "
            {selectedSourceAccount?.name}" ({sourceStartDate}). Vui lòng chọn ngày từ {sourceStartDate} trở đi.
          </p>
        )}

        {accounts.length === 0 && (
          <p className="field-warning" role="alert">
            ⚠️ Bạn chưa tạo ví nào. Vui lòng vào trang <strong>Ví / Tài khoản</strong> để tạo ví trước.
          </p>
        )}

        {isTransfer && accounts.length === 1 && (
          <p className="field-warning" role="alert">
            ⚠️ Cần ít nhất 2 ví để thực hiện giao dịch chuyển tiền.
          </p>
        )}

        <label>
          Ghi chú <span className="optional">(không bắt buộc)</span>
          <input
            type="text"
            name="note"
            maxLength="500"
            placeholder="Nội dung chi tiết giao dịch"
            value={formData.note}
            onChange={onChange}
          />
        </label>

        <div className="form-actions">
          <button type="submit" disabled={cannotSubmit}>
            {saving ? "Đang lưu…" : editing ? "Cập nhật" : "Lưu giao dịch"}
          </button>
          {editing && (
            <button
              type="button"
              className="button-secondary"
              onClick={onCancel}
              disabled={saving}
            >
              Hủy sửa
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

export default TransactionForm;
