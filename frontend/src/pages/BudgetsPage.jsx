import BudgetManager from "../features/budgets/BudgetManager";

function BudgetsPage() {
  return (
    <>
      <header className="page-header">
        <p className="eyebrow">QUẢN LÝ NGÂN SÁCH</p>
        <h1>Hạn mức chi tiêu</h1>
        <p className="subtitle">
          Thiết lập hạn mức chi tiêu theo tháng cho từng danh mục để kiểm soát tài chính.
        </p>
      </header>
      <BudgetManager />
    </>
  );
}

export default BudgetsPage;

