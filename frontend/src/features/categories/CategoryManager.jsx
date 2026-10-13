import { useState, useMemo, useRef } from "react";
import { useCategories } from "../../contexts/CategoryContext";

function CategoryManager({ categories: propCategories }) {
  const {
    categories: ctxCategories,
    saving: ctxSaving,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useCategories();

  const categories = propCategories ?? ctxCategories;

  const [currentType, setCurrentType] = useState("expense"); // "expense" | "income"
  const [categoryName, setCategoryName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  const saving = ctxSaving || submitting;

  const expenseCount = useMemo(
    () => categories.filter((c) => c.type === "expense").length,
    [categories]
  );
  const incomeCount = useMemo(
    () => categories.filter((c) => c.type === "income").length,
    [categories]
  );

  const currentList = useMemo(
    () => categories.filter((c) => c.type === currentType),
    [categories, currentType]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = categoryName.trim();
    if (!trimmed) return;

    setSubmitting(true);
    const success = editingId
      ? await updateCategory(editingId, { name: trimmed, type: currentType })
      : await createCategory({ name: trimmed, type: currentType });
    setSubmitting(false);

    if (success) {
      setCategoryName("");
      setEditingId(null);
    }
  };

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setCategoryName(cat.name);
    setCurrentType(cat.type);
    inputRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setCategoryName("");
  };

  const handleRemove = async (cat) => {
    const success = await deleteCategory(cat);
    if (success && editingId === cat.id) {
      cancelEdit();
    }
  };

  const isExpense = currentType === "expense";

  return (
    <section className="panel" aria-labelledby="category-title">
      <div className="section-heading">
        <div>
          <h2 id="category-title">Quản lý danh mục</h2>
          <span>Phân loại các khoản chi tiêu và thu nhập</span>
        </div>
      </div>

      {/* Nút bấm chuyển đổi duy nhất: Bấm Thu chỉ hiện Thu, bấm Chi chỉ hiện Chi */}
      <div className="category-switch-bar">
        <button
          type="button"
          className={`category-switch-btn ${isExpense ? "active expense" : ""}`}
          onClick={() => {
            setCurrentType("expense");
            cancelEdit();
          }}
        >
          Chi tiêu ({expenseCount})
        </button>
        <button
          type="button"
          className={`category-switch-btn ${!isExpense ? "active income" : ""}`}
          onClick={() => {
            setCurrentType("income");
            cancelEdit();
          }}
        >
          Thu nhập ({incomeCount})
        </button>
      </div>

      {/* Form nhập đơn giản, rõ ràng theo đúng loại đang chọn */}
      <form className="simple-category-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          maxLength="100"
          placeholder={
            editingId
              ? "Tên danh mục mới..."
              : isExpense
              ? "Nhập tên danh mục Chi tiêu (ví dụ: Ăn uống, Tiền nhà...)"
              : "Nhập tên danh mục Thu nhập (ví dụ: Lương, Thưởng...)"
          }
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={saving}
          className={isExpense ? "button-expense-submit" : ""}
        >
          {saving
            ? "Đang lưu..."
            : editingId
            ? "Cập nhật"
            : isExpense
            ? "+ Thêm chi tiêu"
            : "+ Thêm thu nhập"}
        </button>
        {editingId && (
          <button
            type="button"
            className="button-secondary"
            onClick={cancelEdit}
          >
            Hủy
          </button>
        )}
      </form>

      {/* Chỉ hiển thị duy nhất danh sách của loại đang chọn */}
      <div className="category-items-container">
        {currentList.length === 0 ? (
          <p className="empty-hint">
            Chưa có danh mục {isExpense ? "chi tiêu" : "thu nhập"} nào. Hãy thêm danh mục đầu tiên ở trên!
          </p>
        ) : (
          <div className="category-items-stack">
            {currentList.map((cat) => (
              <div className="category-item" key={cat.id}>
                <div className="category-item-info">
                  <span className="category-item-name">{cat.name}</span>
                  {Number(cat.budget_count) > 0 && (
                    <span className="cat-badge-budget" title={`Có ${cat.budget_count} hạn mức ngân sách qua các tháng`}>
                      {cat.budget_count} ngân sách
                    </span>
                  )}
                  {Number(cat.transaction_count) > 0 && (
                    <span className="cat-badge-tx" title={`Có ${cat.transaction_count} giao dịch liên quan`}>
                      {cat.transaction_count} gd
                    </span>
                  )}
                </div>
                <span className="actions">
                  <button
                    type="button"
                    className="button-small button-secondary"
                    onClick={() => startEdit(cat)}
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    className="button-small button-danger"
                    onClick={() => handleRemove(cat)}
                    title={Number(cat.transaction_count) > 0 ? "Không thể xóa danh mục đang có giao dịch" : ""}
                  >
                    Xóa
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default CategoryManager;
