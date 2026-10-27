import { useState } from "react";
import { useTransactions } from "../contexts/TransactionContext";
import { useCategories } from "../contexts/CategoryContext";
import { useAccounts } from "../contexts/AccountContext";
import Pagination from "../components/Pagination";
import TransactionFilters from "../features/transactions/TransactionFilters";
import TransactionForm from "../features/transactions/TransactionForm";
import TransactionTable from "../features/transactions/TransactionTable";
import CsvImportModal from "../features/import/CsvImportModal";

function TransactionsPage() {
  const { categories } = useCategories();
  const { accounts, activeAccounts } = useAccounts();
  const {
    formData, saving, editingId, handleChange, handleSubmit, resetForm,
    filters, handleFilterChange, resetFilters, paginatedTransactions, totalTransactions,
    loading, handleEdit, handleDelete, bulkChangeCategory, bulkDelete,
    activePage, totalPages, setCurrentPage, refreshAfterMutation
  } = useTransactions();

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleImportSuccess = () => {
    refreshAfterMutation();
  };

  return (
    <>
      <header className="page-header with-actions">
        <div>
          <p className="eyebrow">GIAO DỊCH</p>
          <h1>Quản lý giao dịch</h1>
          <p className="subtitle">Thêm, tìm, sửa hoặc xóa các khoản thu chi và chuyển tiền.</p>
        </div>
        <button
          type="button"
          className="button-secondary import-csv-trigger-btn"
          onClick={() => setIsImportModalOpen(true)}
        >
          📥 Nhập sao kê CSV
        </button>
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
        totalTransactions={totalTransactions}
        loading={loading}
        categories={categories}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onBulkChangeCategory={bulkChangeCategory}
        onBulkDelete={bulkDelete}
      />
      <Pagination currentPage={activePage} totalPages={totalPages} onChange={setCurrentPage} />

      {isImportModalOpen && (
        <CsvImportModal
          accounts={activeAccounts}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={handleImportSuccess}
        />
      )}
    </>
  );
}

export default TransactionsPage;
