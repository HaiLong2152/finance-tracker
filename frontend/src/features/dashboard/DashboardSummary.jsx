import { formatMoney } from "../../utils/formatters";

function DashboardSummary({ transactions }) {
  const summary = transactions.reduce((result, transaction) => {
    const amount = Number(transaction.amount);
    if (transaction.type === "income") result.income += amount;
    if (transaction.type === "expense") result.expense += amount;
    return result;
  }, { income: 0, expense: 0 });

  return (
    <section className="summary-grid" aria-label="Tổng quan tài chính">
      <article className="summary-card income-card">
        <span>Tổng thu</span>
        <strong>{formatMoney(summary.income)}</strong>
      </article>
      <article className="summary-card expense-card">
        <span>Tổng chi</span>
        <strong>{formatMoney(summary.expense)}</strong>
      </article>
      <article className="summary-card balance-card">
        <span>Số dư</span>
        <strong>{formatMoney(summary.income - summary.expense)}</strong>
      </article>
      <article className="summary-card count-card">
        <span>Số giao dịch</span>
        <strong>{transactions.length}</strong>
      </article>
    </section>
  );
}

export default DashboardSummary;
