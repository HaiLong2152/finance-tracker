import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useCategories } from "../contexts/CategoryContext";
import CategoryManager from "../features/categories/CategoryManager";
import RuleManager from "../features/categories/RuleManager";

function CategoriesPage() {
  const { categories } = useCategories();
  const [activeTab, setActiveTab] = useState("categories"); // "categories" | "rules"

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">DANH MỤC & QUY TẮC</p>
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

      {/* Sub-nav chuyển giữa Quản lý Danh mục và Quy tắc tự gán (SPEC 4.4) */}
      <div className="category-subnav-bar">
        <button
          type="button"
          className={`category-subnav-btn ${activeTab === "categories" ? "active" : ""}`}
          onClick={() => setActiveTab("categories")}
        >
          📁 Danh mục ({categories.length})
        </button>
        <button
          type="button"
          className={`category-subnav-btn ${activeTab === "rules" ? "active" : ""}`}
          onClick={() => setActiveTab("rules")}
        >
          ⚡ Quy tắc tự gán
        </button>
      </div>

      {activeTab === "categories" ? <CategoryManager /> : <RuleManager />}
    </>
  );
}

export default CategoriesPage;
