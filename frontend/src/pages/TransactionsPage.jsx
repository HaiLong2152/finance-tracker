import { useOutletContext } from "react-router-dom";
import Pagination from "../components/Pagination";
import TransactionFilters from "../features/transactions/TransactionFilters";
import TransactionForm from "../features/transactions/TransactionForm";
import TransactionTable from "../features/transactions/TransactionTable";

function TransactionsPage() {
  const {
    categories, formData, saving, editingId, handleChange, handleSubmit, resetForm,
    filters, handleFilterChange, resetFilters, paginatedTransactions, filteredTransactions,
    loading, handleEdit, handleDelete, activePage, totalPages, setCurrentPage,
  } = useOutletContext();

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">GIAO DỊCH</p>
        <h1>Quản lý giao dịch</h1>
        <p className="subtitle">Thêm, tìm, sửa hoặc xóa các khoản thu chi.</p>
      </header>
      <TransactionForm categories={categories} formData={formData} saving={saving} editing={editingId !== null} onChange={handleChange} onSubmit={handleSubmit} onCancel={resetForm} />
      <TransactionFilters categories={categories} filters={filters} onChange={handleFilterChange} onReset={resetFilters} />
      <TransactionTable transactions={paginatedTransactions} totalTransactions={filteredTransactions.length} loading={loading} onEdit={handleEdit} onDelete={handleDelete} />
      <Pagination currentPage={activePage} totalPages={totalPages} onChange={setCurrentPage} />
    </>
  );
}

export default TransactionsPage;
