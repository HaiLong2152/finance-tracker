import { useCategories } from "../contexts/CategoryContext";
import { useUI } from "../contexts/UIContext";
import CategoryManager from "../features/categories/CategoryManager";

function CategoriesPage() {
  const { categories, fetchCategories } = useCategories();
  const { setNotice, setError } = useUI();

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">DANH MỤC</p>
        <h1>Quản lý danh mục</h1>
        <p className="subtitle">Tạo các nhóm thu và chi để phân loại giao dịch.</p>
      </header>
      <CategoryManager categories={categories} onChanged={fetchCategories} onNotice={setNotice} onError={setError} />
    </>
  );
}

export default CategoriesPage;
