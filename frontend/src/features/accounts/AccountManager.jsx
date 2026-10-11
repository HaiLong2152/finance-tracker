import { useState } from "react";
import { accountApi, getApiErrorMessage } from "../../services/api";
import { useUI } from "../../contexts/UIContext";
import { formatMoney, formatDate, formatAccountType, getLocalDateString } from "../../utils/formatters";

const defaultStartDate = () => getLocalDateString();

const emptyForm = {
  name: "",
  type: "cash",
  initial_balance: "0",
  start_date: defaultStartDate(),
  identifier_hint: "",
  sort_order: "0",
  is_archived: false,
};

export default function AccountManager({
  accounts,
  loading,
  showArchived,
  onToggleArchived,
  onChanged,
}) {
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const { setNotice, setError, confirm } = useUI();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const startEdit = (acc) => {
    setEditingId(acc.id);
    setFormData({
      name: acc.name,
      type: acc.type,
      initial_balance: String(acc.initial_balance ?? 0),
      start_date: acc.start_date ? String(acc.start_date).slice(0, 10) : defaultStartDate(),
      identifier_hint: acc.identifier_hint || "",
      sort_order: String(acc.sort_order ?? 0),
      is_archived: Boolean(acc.is_archived),
    });
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      initial_balance: Number(formData.initial_balance),
      start_date: formData.start_date,
      identifier_hint: formData.identifier_hint.trim() || null,
      sort_order: Number(formData.sort_order),
      is_archived: Boolean(formData.is_archived),
    };

    try {
      if (editingId) {
        await accountApi.update(editingId, payload);
        setNotice("Đã cập nhật thông tin ví.");
      } else {
        await accountApi.create(payload);
        setNotice("Đã tạo ví mới thành công.");
      }
      setFormData(emptyForm);
      setEditingId(null);
      await onChanged();
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể lưu thông tin ví."));
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async (acc) => {
    const actionText = acc.is_archived ? "khôi phục" : "lưu trữ";
    const confirmed = await confirm(
      `Xác nhận ${actionText}`,
      `Bạn có chắc muốn ${actionText} ví "${acc.name}"?`
    );
    if (!confirmed) return;

    setError("");
    setNotice("");
    try {
      await accountApi.archive(acc.id, !acc.is_archived);
      setNotice(acc.is_archived ? `Đã khôi phục ví "${acc.name}".` : `Đã lưu trữ ví "${acc.name}".`);
      await onChanged();
    } catch (err) {
      setError(getApiErrorMessage(err, `Không thể ${actionText} ví.`));
    }
  };

  const handleDelete = async (acc) => {
    if (acc.transaction_count > 0) {
      setError(`Ví "${acc.name}" đã có ${acc.transaction_count} giao dịch. Vui lòng chuyển sang chế độ lưu trữ thay vì xóa.`);
      return;
    }

    const confirmed = await confirm(
      "Xác nhận xóa ví",
      `Bạn có chắc chắn muốn xóa vĩnh viễn ví "${acc.name}"? Thao tác này không thể hoàn tác.`
    );
    if (!confirmed) return;

    setError("");
    setNotice("");
    try {
      await accountApi.remove(acc.id);
      if (editingId === acc.id) cancelEdit();
      setNotice(`Đã xóa ví "${acc.name}".`);
      await onChanged();
    } catch (err) {
      setError(getApiErrorMessage(err, "Không thể xóa ví."));
    }
  };

  return (
    <>
      <section className="panel" aria-labelledby="account-form-title">
        <h2 id="account-form-title">
          {editingId
            ? `Sửa thông tin ví${formData.is_archived ? " (Đang lưu trữ)" : ""}`
            : "Thêm ví / tài khoản mới"}
        </h2>
        <form className="account-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Tên ví / Tài khoản
              <input
                type="text"
                name="name"
                maxLength="100"
                placeholder="Ví dụ: MB Bank, Tiền mặt, MoMo..."
                value={formData.name}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Loại tài khoản
              <select name="type" value={formData.type} onChange={handleChange}>
                <option value="cash">Tiền mặt</option>
                <option value="bank">Tài khoản Ngân hàng</option>
                <option value="ewallet">Ví điện tử</option>
                <option value="other">Khác</option>
              </select>
            </label>

            <label>
              Số dư ban đầu (VND)
              <input
                type="number"
                name="initial_balance"
                step="1"
                placeholder="0"
                value={formData.initial_balance}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Ngày bắt đầu theo dõi
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Gợi ý nhận diện <span className="optional">(tùy chọn)</span>
              <input
                type="text"
                name="identifier_hint"
                maxLength="100"
                placeholder="Ví dụ: 4 số cuối STK, MBBank..."
                value={formData.identifier_hint}
                onChange={handleChange}
              />
            </label>

            <label>
              Thứ tự hiển thị
              <input
                type="number"
                name="sort_order"
                step="1"
                placeholder="0"
                value={formData.sort_order}
                onChange={handleChange}
              />
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Đang lưu…" : editingId ? "Cập nhật ví" : "Tạo ví"}
            </button>
            {editingId && (
              <button
                type="button"
                className="button-secondary"
                onClick={cancelEdit}
                disabled={saving}
              >
                Hủy sửa
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel" aria-labelledby="account-list-title">
        <div className="section-heading">
          <div>
            <h2 id="account-list-title">Danh sách ví</h2>
            <span>{accounts.length} ví</span>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => onToggleArchived(e.target.checked)}
            />
            Hiện ví đã lưu trữ (Archived)
          </label>
        </div>

        {loading ? (
          <p className="empty-state">Đang tải danh sách ví…</p>
        ) : accounts.length === 0 ? (
          <p className="empty-state">Chưa có ví nào. Hãy tạo ví đầu tiên của bạn.</p>
        ) : (
          <div className="account-grid">
            {accounts.map((acc) => {
              const currentBalance = Number(acc.current_balance ?? acc.initial_balance ?? 0);
              return (
                <article
                  key={acc.id}
                  className={`account-card ${acc.is_archived ? "is-archived" : ""}`}
                >
                  <div className="account-card-header">
                    <div>
                      <div className="account-title-wrap">
                        <h3>{acc.name}</h3>
                        <span className={`badge ${acc.type}`}>{formatAccountType(acc.type)}</span>
                        {acc.is_archived === 1 && (
                          <span className="badge archived">Đã lưu trữ</span>
                        )}
                      </div>
                      {acc.identifier_hint && (
                        <p className="account-hint">{acc.identifier_hint}</p>
                      )}
                    </div>
                  </div>

                  <div className="account-balance-section">
                    <span className="balance-label">Số dư hiện tại</span>
                    <strong
                      className={`account-balance ${currentBalance < 0 ? "negative" : "positive"}`}
                    >
                      {formatMoney(currentBalance)}
                    </strong>
                  </div>

                  <div className="account-meta">
                    <small>
                      Số dư ban đầu: <strong>{formatMoney(acc.initial_balance)}</strong>
                    </small>
                    <small>
                      Bắt đầu: <strong>{formatDate(acc.start_date)}</strong>
                    </small>
                    <small>
                      Giao dịch: <strong>{acc.transaction_count || 0}</strong>
                    </small>
                  </div>

                  <div className="account-card-actions">
                    <button
                      type="button"
                      className="button-small button-secondary"
                      onClick={() => startEdit(acc)}
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="button-small button-secondary"
                      onClick={() => handleArchiveToggle(acc)}
                    >
                      {acc.is_archived ? "Khôi phục" : "Lưu trữ"}
                    </button>
                    <button
                      type="button"
                      className="button-small button-danger"
                      disabled={acc.transaction_count > 0}
                      title={
                        acc.transaction_count > 0
                          ? "Không thể xóa ví đã có giao dịch"
                          : "Xóa vĩnh viễn ví"
                      }
                      onClick={() => handleDelete(acc)}
                    >
                      Xóa
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

