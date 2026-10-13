import { useMemo } from "react";
import { Link } from "react-router-dom";
import { formatMoney, formatAccountType, getCurrentMonth } from "../../utils/formatters";
import CategoryPieChart from "./CategoryPieChart";
import TrendBarChart from "./TrendBarChart";

const formatMonth = (month) => {
  if (!month) return "";
  const [year, value] = month.split("-");
  return `Tháng ${Number(value)}/${year}`;
};

function DashboardSummary({
  transactions,
  month,
  onMonthChange,
  accounts = [],
  totalNetWorth = 0,
  budgetsData = null,
  reportSummary = null,
  trendData = [],
}) {
  const currentMonth = useMemo(() => getCurrentMonth(), []);

  const availableMonths = useMemo(() => {
    const months = new Set(
      transactions.map((transaction) =>
        String(transaction.transaction_date).slice(0, 7)
      )
    );
    if (currentMonth) months.add(currentMonth);
    if (month) months.add(month);
    return Array.from(months).filter(Boolean).sort().reverse();
  }, [transactions, currentMonth, month]);

  const monthTransactions = useMemo(() => transactions.filter((transaction) => (
    !month || String(transaction.transaction_date).slice(0, 7) === month
  )), [transactions, month]);

  const { income, expense, expenseCategories } = useMemo(() => monthTransactions.reduce((result, transaction) => {
    const amount = Number(transaction.amount);
    if (transaction.type === "income") result.income += amount;
    if (transaction.type === "expense") {
      result.expense += amount;
      const catName = transaction.category_name || "Khác";
      result.expenseCategories[catName] = (result.expenseCategories[catName] || 0) + amount;
    }
    return result;
  }, { income: 0, expense: 0, expenseCategories: {} }), [monthTransactions]);

  const categoryAmounts = Object.entries(expenseCategories).sort(([, first], [, second]) => second - first);
  const largestExpense = categoryAmounts[0]?.[1] || 1;

  // Chuẩn bị dữ liệu cho Biểu đồ tròn
  const pieChartData = useMemo(() => {
    return categoryAmounts.map(([name, amount]) => ({
      category_name: name,
      total_amount: amount,
      percentage: expense > 0 ? Math.round((amount / expense) * 100) : 0,
    }));
  }, [categoryAmounts, expense]);

  // So sánh tháng trước từ reportSummary
  const comparison = reportSummary?.comparison;

  return (
    <>
      <section className="dashboard-toolbar">
        <div>
          <h2>Tổng quan thu chi</h2>
          <span>{month ? formatMonth(month) : "Tất cả thời gian"}</span>
        </div>
        <label htmlFor="dashboard-month">
          Thời gian
          <select
            id="dashboard-month"
            value={month}
            onChange={(event) => onMonthChange(event.target.value)}
          >
            <option value="">Tất cả thời gian</option>
            {availableMonths.map((value) => (
              <option key={value} value={value}>
                {formatMonth(value)}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* Thẻ tổng quan tài chính kèm so sánh tháng trước */}
      <section className="summary-grid" aria-label="Tổng quan tài chính">
        <article className="summary-card income-card">
          <span>Tổng thu</span>
          <strong>{formatMoney(income)}</strong>
          {Boolean(month) && comparison && comparison.income_pct_change !== null && (
            <small className={`compare-tag ${comparison.income_pct_change >= 0 ? "compare-pos" : "compare-neg"}`}>
              {comparison.income_pct_change >= 0 ? "▲ +" : "▼ "}
              {comparison.income_pct_change}% so với tháng trước
            </small>
          )}
        </article>
        <article className="summary-card expense-card">
          <span>Tổng chi</span>
          <strong>{formatMoney(expense)}</strong>
          {Boolean(month) && comparison && comparison.expense_pct_change !== null && (
            <small className={`compare-tag ${comparison.expense_pct_change <= 0 ? "compare-pos" : "compare-danger"}`}>
              {comparison.expense_pct_change >= 0 ? "▲ +" : "▼ "}
              {comparison.expense_pct_change}% so với tháng trước
            </small>
          )}
        </article>
        <article className="summary-card balance-card">
          <span>Thu - Chi</span>
          <strong className={income - expense >= 0 ? "positive" : "negative"}>
            {formatMoney(income - expense)}
          </strong>
          {income > 0 && (
            <small className="compare-tag compare-neutral">
              Tỷ lệ tiết kiệm: {Math.max(0, Math.round(((income - expense) / income) * 100))}%
            </small>
          )}
        </article>
        <article className="summary-card count-card">
          <span>Số giao dịch</span>
          <strong>{monthTransactions.length}</strong>
        </article>
      </section>

      {/* Khu vực 2 Biểu đồ: Tỷ trọng Danh mục & Xu hướng 6 tháng */}
      <section className="dashboard-charts-grid" aria-label="Biểu đồ trực quan">
        <div className="panel chart-panel">
          <div className="section-heading">
            <div>
              <h2>Tỷ trọng chi tiêu</h2>
              <span>{month ? formatMonth(month) : "Toàn bộ thời gian"}</span>
            </div>
            {pieChartData.length > 0 && (
              <span className="badge-stat">{pieChartData.length} danh mục</span>
            )}
          </div>
          <CategoryPieChart data={pieChartData} />
        </div>

        <div className="panel chart-panel">
          <div className="section-heading">
            <div>
              <h2>Xu hướng Thu & Chi</h2>
              <span>6 tháng gần nhất</span>
            </div>
          </div>
          <TrendBarChart data={trendData} />
        </div>
      </section>

      {/* Widget số dư ví & tổng tài sản */}
      <section className="panel account-summary-panel" aria-labelledby="wallet-title">
        <div className="section-heading">
          <div>
            <h2 id="wallet-title">Số dư các ví</h2>
            <span>Tổng tài sản: <strong className="net-worth-highlight">{formatMoney(totalNetWorth)}</strong></span>
          </div>
          <Link to="/accounts" className="button-small button-secondary">
            Quản lý ví ➔
          </Link>
        </div>

        {accounts.length === 0 ? (
          <p className="empty-state">
            Chưa có ví nào. <Link to="/accounts">Tạo ví ngay</Link>
          </p>
        ) : (
          <div className="dashboard-account-grid">
            {accounts.map((acc) => {
              const bal = Number(acc.current_balance ?? acc.initial_balance ?? 0);
              return (
                <div key={acc.id} className="dashboard-account-chip">
                  <div className="account-chip-info">
                    <strong>{acc.name}</strong>
                    <span className={`badge ${acc.type}`}>{formatAccountType(acc.type)}</span>
                  </div>
                  <strong className={`account-chip-balance ${bal < 0 ? "negative" : "positive"}`}>
                    {formatMoney(bal)}
                  </strong>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Widget Ngân sách tháng */}
      <section className="panel budget-summary-panel" aria-labelledby="budget-summary-title">
        <div className="section-heading">
          <div>
            <h2 id="budget-summary-title">Tiến độ ngân sách</h2>
            {month && budgetsData && budgetsData.month === month && budgetsData.items.length > 0 ? (
              <span>
                Đã dùng {formatMoney(budgetsData.total_spent)} / {formatMoney(budgetsData.total_budget)} ({budgetsData.overall_percentage}%)
              </span>
            ) : (
              <span>Hạn mức chi tiêu theo tháng</span>
            )}
          </div>
          <Link to="/budgets" className="button-small button-secondary">
            Quản lý ngân sách ➔
          </Link>
        </div>

        {!month ? (
          <div className="empty-state">
            <p>Ngân sách được theo dõi theo từng tháng cụ thể. Hãy chọn một tháng để theo dõi tiến độ chi tiêu.</p>
            <button
              type="button"
              className="button-small"
              style={{ marginTop: "10px", width: "auto", display: "inline-block" }}
              onClick={() => onMonthChange(currentMonth)}
            >
              Xem tháng hiện tại ({formatMonth(currentMonth)})
            </button>
          </div>
        ) : !budgetsData || budgetsData.month !== month || budgetsData.items.length === 0 ? (
          <p className="empty-state">
            Chưa thiết lập ngân sách cho {formatMonth(month)}. <Link to="/budgets">Thiết lập ngay</Link>
          </p>
        ) : (
          <div className="dashboard-budget-list">
            {budgetsData.items.slice(0, 5).map((b) => {
              const clampedPercent = Math.min(b.percentage, 100);
              return (
                <div key={b.id} className="breakdown-row">
                  <div>
                    <span className="dashboard-budget-name">
                      {b.category_name}
                      {b.status === "exceeded" && <span className="budget-tag tag-exceeded">Vượt ({b.percentage}%)</span>}
                      {b.status === "warning" && <span className="budget-tag tag-warning">Sắp chạm ({b.percentage}%)</span>}
                    </span>
                    <strong>
                      {formatMoney(b.spent_amount)} / <small className="text-muted">{formatMoney(b.limit_amount)}</small>
                    </strong>
                  </div>
                  <div className="bar-track">
                    <div
                      className={`bar-fill fill-${b.status}`}
                      style={{ width: `${clampedPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Danh sách phân bổ chi tiết chi theo danh mục */}
      <section className="panel category-breakdown" aria-labelledby="breakdown-title">
        <div className="section-heading">
          <h2 id="breakdown-title">Chi tiết chi theo danh mục</h2>
          <span>{categoryAmounts.length} danh mục</span>
        </div>
        {categoryAmounts.length === 0 ? (
          <p className="empty-state">Chưa có khoản chi trong khoảng thời gian này.</p>
        ) : (
          categoryAmounts.map(([name, amount]) => (
            <div className="breakdown-row" key={name}>
              <div>
                <span>{name}</span>
                <strong>{formatMoney(amount)}</strong>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${(amount / largestExpense) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </section>
    </>
  );
}

export default DashboardSummary;
