import { useOutletContext } from "react-router-dom";
import CategoryManager from "../features/categories/CategoryManager";

function CategoriesPage() {
  const { categories, fetchData, setNotice, setError } = useOutletContext();

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">DANH MỤC</p>
        <h1>Quản lý danh mục</h1>
        <p className="subtitle">Tạo các nhóm thu và chi để phân loại giao dịch.</p>
      </header>
      <CategoryManager categories={categories} onChanged={fetchData} onNotice={setNotice} onError={setError} />
    </>
  );
}

export default CategoriesPage;
