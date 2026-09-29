import { useMemo } from "react";
import { formatMoney } from "../../utils/formatters";

const formatMonth = (month) => {
  const [year, value] = month.split("-");
  return `Tháng ${Number(value)}/${year}`;
};

function DashboardSummary({ transactions, month, onMonthChange }) {
  const availableMonths = useMemo(() => [...new Set(
    transactions.map((transaction) => String(transaction.transaction_date).slice(0, 7)),
  )].filter(Boolean).sort().reverse(), [transactions]);

  const monthTransactions = useMemo(() => transactions.filter((transaction) => (
    !month || String(transaction.transaction_date).slice(0, 7) === month
  )), [transactions, month]);

  const { income, expense, expenseCategories } = monthTransactions.reduce((result, transaction) => {
    const amount = Number(transaction.amount);
    if (transaction.type === "income") result.income += amount;
    if (transaction.type === "expense") {
      result.expense += amount;
      result.expenseCategories[transaction.category_name] = (result.expenseCategories[transaction.category_name] || 0) + amount;
    }
    return result;
  }, { income: 0, expense: 0, expenseCategories: {} });

  const categoryAmounts = Object.entries(expenseCategories).sort(([, first], [, second]) => second - first);
  const largestExpense = categoryAmounts[0]?.[1] || 1;

  return (
    <>
      <section className="dashboard-toolbar">
        <div><h2>Tổng quan</h2><span>{month ? formatMonth(month) : "Tất cả thời gian"}</span></div>
        <label htmlFor="dashboard-month">Thời gian
          <select id="dashboard-month" value={month} onChange={(event) => onMonthChange(event.target.value)}>
            <option value="">Tất cả thời gian</option>
            {availableMonths.map((value) => <option key={value} value={value}>{formatMonth(value)}</option>)}
          </select>
        </label>
      </section>
      <section className="summary-grid" aria-label="Tổng quan tài chính">
        <article className="summary-card income-card"><span>Tổng thu</span><strong>{formatMoney(income)}</strong></article>
        <article className="summary-card expense-card"><span>Tổng chi</span><strong>{formatMoney(expense)}</strong></article>
        <article className="summary-card balance-card"><span>Số dư</span><strong>{formatMoney(income - expense)}</strong></article>
        <article className="summary-card count-card"><span>Số giao dịch</span><strong>{monthTransactions.length}</strong></article>
      </section>
      <section className="panel category-breakdown" aria-labelledby="breakdown-title">
        <div className="section-heading"><h2 id="breakdown-title">Chi theo danh mục</h2><span>{categoryAmounts.length} danh mục</span></div>
        {categoryAmounts.length === 0 ? <p className="empty-state">Chưa có khoản chi trong khoảng thời gian này.</p> : categoryAmounts.map(([name, amount]) => (
          <div className="breakdown-row" key={name}><div><span>{name}</span><strong>{formatMoney(amount)}</strong></div><div className="bar-track"><div className="bar-fill" style={{ width: `${(amount / largestExpense) * 100}%` }} /></div></div>
        ))}
      </section>
    </>
  );
}

export default DashboardSummary;
