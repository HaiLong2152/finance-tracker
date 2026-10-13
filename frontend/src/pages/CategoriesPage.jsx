import { NavLink } from "react-router-dom";
import { useCategories } from "../contexts/CategoryContext";
import CategoryManager from "../features/categories/CategoryManager";

function CategoriesPage() {
  const { categories } = useCategories();

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">DANH MỤC</p>
        <h1>Quản lý danh mục</h1>
        <p className="subtitle">Tạo các nhóm thu và chi để phân loại giao dịch.</p>
      </header>

      <div className="section-tab-nav" role="tablist" aria-label="Chuyển đổi ví và danh mục">
        <NavLink
          to="/accounts"
          className={({ isActive }) => `section-tab-btn ${isActive ? "active" : ""}`}
        >
          Ví tiền
        </NavLink>
        <NavLink
          to="/categories"
          className={({ isActive }) => `section-tab-btn ${isActive ? "active" : ""}`}
        >
          Danh mục ({categories.length})
        </NavLink>
      </div>

      <CategoryManager />
    </>
  );
}

export default CategoriesPage;
