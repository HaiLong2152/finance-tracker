import { useState } from "react";
import { useUI } from "../../contexts/UIContext";
import { useAccounts } from "../../contexts/AccountContext";
import { formatMoney, formatDate, formatAccountType, getLocalDateString } from "../../utils/formatters";
import ReconciliationModal from "./ReconciliationModal";

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

export default function AccountManager() {
  const {
    accounts,
    loading,
    saving,
    showArchived,
    toggleShowArchived,
    createAccount,
    updateAccount,
    archiveAccount,
    deleteAccount,
  } = useAccounts();

  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editingEarliestTxDate, setEditingEarliestTxDate] = useState(null);
  const [editingTransactionCount, setEditingTransactionCount] = useState(0);
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [reconcileAccountId, setReconcileAccountId] = useState(null);
  const { setNotice, setError } = useUI();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const startEdit = (acc) => {
    setEditingId(acc.id);
    setEditingEarliestTxDate(acc.earliest_transaction_date ? String(acc.earliest_transaction_date).slice(0, 10) : null);
    setEditingTransactionCount(Number(acc.transaction_count || 0));
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
    setEditingEarliestTxDate(null);
    setEditingTransactionCount(0);
    setFormData(emptyForm);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (editingId && editingEarliestTxDate && formData.start_date > editingEarliestTxDate) {
      setError(`Ngày bắt đầu theo dõi (${formData.start_date}) không thể sau ngày giao dịch sớm nhất của ví (${formatDate(editingEarliestTxDate)}). Vui lòng chọn ngày trước hoặc bằng ngày giao dịch này.`);
      return;
    }

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      initial_balance: Number(formData.initial_balance),
      start_date: formData.start_date,
      identifier_hint: formData.identifier_hint.trim() || null,
      sort_order: Number(formData.sort_order),
      is_archived: Boolean(formData.is_archived),
    };

    const success = editingId
      ? await updateAccount(editingId, payload)
      : await createAccount(payload);

    if (success) {
      setFormData(emptyForm);
      setEditingId(null);
      setEditingEarliestTxDate(null);
    }
  };

  const handleArchiveToggle = async (acc) => {
    await archiveAccount(acc);
  };

  const handleDelete = async (acc) => {
    const success = await deleteAccount(acc);
    if (success && editingId === acc.id) {
      cancelEdit();
    }
  };

  const handleOpenReconcile = (accId = null) => {
    setReconcileAccountId(accId);
    setReconcileModalOpen(true);
  };

  const handleReconcileSuccess = async (result) => {
    setNotice(result?.message || "Đối soát số dư thành công!");
    await toggleShowArchived(showArchived); // Làm mới danh sách ví để cập nhật số dư
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
                disabled={editingTransactionCount > 0}
                max={editingEarliestTxDate || undefined}
                required
              />
              {editingTransactionCount > 0 ? (
                <small className="field-hint warning">
                  Ví đã có {editingTransactionCount} giao dịch. Không thể sửa ngày bắt đầu theo dõi để tránh làm thay đổi số dư hồi tố.
                </small>
              ) : editingEarliestTxDate ? (
                <small className="field-hint warning">
                  Ví đã có giao dịch từ ngày {formatDate(editingEarliestTxDate)}. Ngày bắt đầu không thể sau ngày này.
                </small>
              ) : null}
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
          <div className="heading-actions">
            <button
              type="button"
              className="button-small button-secondary"
              onClick={() => handleOpenReconcile(null)}
              disabled={accounts.length === 0}
            >
              ⚖️ Đối soát số dư
            </button>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => toggleShowArchived(e.target.checked)}
              />
              Hiện ví đã lưu trữ
            </label>
          </div>
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
                    {!acc.is_archived && (
                      <button
                        type="button"
                        className="button-small button-primary"
                        onClick={() => handleOpenReconcile(acc.id)}
                        title="Đối soát số dư thực tế với số dư hệ thống"
                      >
                        ⚖️ Đối soát
                      </button>
                    )}
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

      {reconcileModalOpen && (
        <ReconciliationModal
          accounts={accounts.filter((a) => !a.is_archived)}
          initialAccountId={reconcileAccountId}
          onClose={() => setReconcileModalOpen(false)}
          onSuccess={handleReconcileSuccess}
        />
      )}
    </>
  );
}

