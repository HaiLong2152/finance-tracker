function TransactionForm({ categories, formData, saving, editing, onChange, onSubmit, onCancel }) {
  return (
    <section className="panel" aria-labelledby="form-title">
      <h2 id="form-title">{editing ? "Sửa giao dịch" : "Thêm giao dịch"}</h2>
      <form className="transaction-form" onSubmit={onSubmit}>
        <label>
          Số tiền (VND)
          <input type="number" name="amount" min="1" step="1" placeholder="Ví dụ: 50000" value={formData.amount} onChange={onChange} required />
        </label>
        <label>
          Danh mục
          <select name="category_id" value={formData.category_id} onChange={onChange} required>
            <option value="">Chọn danh mục</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name} ({category.type === "income" ? "Thu" : "Chi"})
              </option>
            ))}
          </select>
        </label>
        <label>
          Ngày giao dịch
          <input type="date" name="transaction_date" value={formData.transaction_date} onChange={onChange} required />
        </label>
        <label>
          Ghi chú <span className="optional">(không bắt buộc)</span>
          <input type="text" name="note" maxLength="500" placeholder="Nội dung giao dịch" value={formData.note} onChange={onChange} />
        </label>
        <div className="form-actions">
          <button type="submit" disabled={saving || categories.length === 0}>{saving ? "Đang lưu…" : editing ? "Cập nhật" : "Lưu giao dịch"}</button>
          {editing && <button type="button" className="button-secondary" onClick={onCancel} disabled={saving}>Hủy sửa</button>}
        </div>
      </form>
    </section>
  );
}

export default TransactionForm;
