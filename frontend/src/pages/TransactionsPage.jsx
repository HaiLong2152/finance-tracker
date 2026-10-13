import { useTransactions } from "../contexts/TransactionContext";
import { useCategories } from "../contexts/CategoryContext";
import { useAccounts } from "../contexts/AccountContext";
import Pagination from "../components/Pagination";
import TransactionFilters from "../features/transactions/TransactionFilters";
import TransactionForm from "../features/transactions/TransactionForm";
import TransactionTable from "../features/transactions/TransactionTable";

function TransactionsPage() {
  const { categories } = useCategories();
  const { accounts, activeAccounts } = useAccounts();
  const {
    formData, saving, editingId, handleChange, handleSubmit, resetForm,
    filters, handleFilterChange, resetFilters, paginatedTransactions, filteredTransactions,
    loading, handleEdit, handleDelete, bulkChangeCategory, bulkDelete,
    activePage, totalPages, setCurrentPage,
  } = useTransactions();

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">GIAO DỊCH</p>
        <h1>Quản lý giao dịch</h1>
        <p className="subtitle">Thêm, tìm, sửa hoặc xóa các khoản thu chi và chuyển tiền.</p>
      </header>
      <TransactionForm
        categories={categories}
        accounts={activeAccounts}
        formData={formData}
        saving={saving}
        editing={editingId !== null}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onCancel={resetForm}
      />
      <TransactionFilters
        categories={categories}
        accounts={accounts}
        filters={filters}
        onChange={handleFilterChange}
        onReset={resetFilters}
      />
      <TransactionTable
        transactions={paginatedTransactions}
        allTransactions={filteredTransactions}
        totalTransactions={filteredTransactions.length}
        loading={loading}
        categories={categories}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onBulkChangeCategory={bulkChangeCategory}
        onBulkDelete={bulkDelete}
      />
      <Pagination currentPage={activePage} totalPages={totalPages} onChange={setCurrentPage} />
    </>
  );
}

export default TransactionsPage;
