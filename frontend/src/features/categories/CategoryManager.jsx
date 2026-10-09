import { useState } from "react";
import { categoryApi, getApiErrorMessage } from "../../services/api";
import { useUI } from "../../contexts/UIContext";

const emptyForm = { name: "", type: "expense" };

function CategoryManager({ categories, onChanged, onNotice, onError }) {
  const { confirm } = useUI();
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    onError("");
    onNotice("");
    try {
      if (editingId) {
        const response = await categoryApi.update(editingId, formData);
        onNotice(response.data?.message || "Đã cập nhật danh mục.");
      } else {
        const response = await categoryApi.create(formData);
        onNotice(response.data?.message || "Đã thêm danh mục.");
      }
      setFormData(emptyForm);
      setEditingId(null);
      await onChanged();
    } catch (requestError) {
      onError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (category) => {
    setEditingId(category.id);
    setFormData({ name: category.name, type: category.type });
    onError("");
    onNotice("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData(emptyForm);
  };

  const remove = async (category) => {
    const isConfirmed = await confirm("Xác nhận xóa", `Bạn có chắc muốn xóa danh mục ${category.name}?`);
    if (!isConfirmed) return;
    onError("");
    onNotice("");
    try {
      const response = await categoryApi.remove(category.id);
      if (editingId === category.id) cancelEdit();
      onNotice(response.data?.message || "Đã xóa danh mục.");
      await onChanged();
    } catch (requestError) {
      onError(getApiErrorMessage(requestError));
    }
  };

  return (
    <section className="panel" aria-labelledby="category-title">
      <div className="section-heading"><h2 id="category-title">Quản lý danh mục</h2><span>{categories.length} danh mục</span></div>
      <form className="category-form" onSubmit={handleSubmit}>
        <input aria-label="Tên danh mục" type="text" maxLength="100" placeholder="Tên danh mục" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} required />
        <select aria-label="Loại danh mục" value={formData.type} onChange={(event) => setFormData({ ...formData, type: event.target.value })}>
          <option value="expense">Chi</option>
          <option value="income">Thu</option>
        </select>
        <button type="submit" disabled={saving}>{saving ? "Đang lưu..." : editingId ? "Cập nhật" : "Thêm danh mục"}</button>
        {editingId && <button type="button" className="button-secondary" onClick={cancelEdit}>Hủy</button>}
      </form>
      <div className="category-list">
        {categories.map((category) => (
          <div className="category-item" key={category.id}>
            <span><strong>{category.name}</strong> <small>{category.type === "income" ? "Thu" : "Chi"}</small></span>
            <span className="actions"><button type="button" className="button-small button-secondary" onClick={() => startEdit(category)}>Sửa</button><button type="button" className="button-small button-danger" onClick={() => remove(category)}>Xóa</button></span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default CategoryManager;
