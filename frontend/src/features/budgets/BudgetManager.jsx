import { useState, useMemo } from "react";
import { useBudgets } from "../../contexts/BudgetContext";
import { useCategories } from "../../contexts/CategoryContext";
import { formatMoney } from "../../utils/formatters";
import BudgetModal from "./BudgetModal";

const formatMonthDisplay = (monthStr) => {
  if (!monthStr || !monthStr.includes("-")) return monthStr;
  const [year, m] = monthStr.split("-");
  return `Tháng ${Number(m)}/${year}`;
};

const getShiftedMonth = (currentMonthStr, offset) => {
  if (!currentMonthStr) return currentMonthStr;
  const [year, m] = currentMonthStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + offset, 1));
  const newYear = date.getUTCFullYear();
  const newMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${newYear}-${newMonth}`;
};

function BudgetManager() {
  const {
    selectedMonth,
    setSelectedMonth,
    budgetsData,
    loading,
    saveBudget,
    updateBudget,
    deleteBudget,
    copyFromPrevious,
  } = useBudgets();

  const { categories } = useCategories();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);

  // Lọc các danh mục chi tiêu chưa được đặt hạn mức trong tháng này
  const unbudgetedCategories = useMemo(() => {
    const budgetedCatIds = new Set(budgetsData.items.map((b) => b.category_id));
    return categories.filter(
      (cat) => cat.type === "expense" && !budgetedCatIds.has(cat.id)
    );
  }, [categories, budgetsData.items]);

  const handlePrevMonth = () => {
    setSelectedMonth(getShiftedMonth(selectedMonth, -1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(getShiftedMonth(selectedMonth, 1));
  };

  const handleOpenAdd = () => {
    setEditingBudget(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (budget) => {
    setEditingBudget(budget);
    setIsModalOpen(true);
  };

  const handleSaveBudget = async ({ id, category_id, limit_amount, month }) => {
    if (id) {
      return await updateBudget(id, limit_amount, month);
    }
    return await saveBudget({ category_id, limit_amount, month });
  };

  const totalRemaining = budgetsData.total_budget - budgetsData.total_spent;
  const isOverallExceeded = totalRemaining < 0;

  return (
    <div className="budget-manager">
      {/* Thanh điều khiển chọn tháng & tác vụ */}
      <section className="budget-month-nav panel">
        <div className="month-controls">
          <button
            type="button"
            className="button-small button-secondary month-arrow-btn"
            onClick={handlePrevMonth}
            aria-label="Tháng trước"
          >
            ◀
          </button>
          <div className="month-current">
            <h2>{formatMonthDisplay(selectedMonth)}</h2>
            <input
              type="month"
              aria-label="Chọn tháng"
              value={selectedMonth}
              onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
              className="month-picker-input"
            />
          </div>
          <button
            type="button"
            className="button-small button-secondary month-arrow-btn"
            onClick={handleNextMonth}
            aria-label="Tháng sau"
          >
            ▶
          </button>
        </div>

        <div className="budget-top-actions">
          <button
            type="button"
            className="button-small button-secondary copy-budget-btn"
            onClick={() => copyFromPrevious(selectedMonth)}
            title="Sao chép toàn bộ hạn mức từ tháng trước sang tháng này"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Sao chép từ tháng trước
          </button>
          <button
            type="button"
            className="button-small button-primary"
            onClick={handleOpenAdd}
            disabled={unbudgetedCategories.length === 0}
            title={unbudgetedCategories.length === 0 ? "Tất cả danh mục chi tiêu đã được đặt hạn mức" : ""}
          >
            + Đặt hạn mức
          </button>
        </div>
      </section>

      {/* Cảnh báo nếu có danh mục sắp chạm mức hoặc đã vượt mức */}
      {(budgetsData.warning_count > 0 || budgetsData.exceeded_count > 0) && (
        <div
          className={`budget-alert-banner ${budgetsData.exceeded_count > 0 ? "banner-danger" : "banner-warning"}`}
          role="alert"
        >
          <span className="banner-icon">
            {budgetsData.exceeded_count > 0 ? "⚠️" : "⚡"}
          </span>
          <div className="banner-text">
            {budgetsData.exceeded_count > 0 && (
              <strong>Có {budgetsData.exceeded_count} danh mục đã vượt quá hạn mức cho phép! </strong>
            )}
            {budgetsData.warning_count > 0 && (
              <span>Có {budgetsData.warning_count} danh mục đã chi tiêu trên 80% ngân sách.</span>
            )}
          </div>
        </div>
      )}

      {/* Tổng quan ngân sách tháng */}
      <section className="summary-grid budget-summary-cards" aria-label="Tổng quan ngân sách">
        <article className="summary-card budget-total-card">
          <span>Tổng ngân sách</span>
          <strong>{formatMoney(budgetsData.total_budget)}</strong>
        </article>
        <article className="summary-card expense-card">
          <span>Đã chi tiêu</span>
          <strong>{formatMoney(budgetsData.total_spent)}</strong>
        </article>
        <article className={`summary-card ${isOverallExceeded ? "negative" : "balance-card"}`}>
          <span>{isOverallExceeded ? "Đã vượt ngân sách" : "Ngân sách còn lại"}</span>
          <strong className={isOverallExceeded ? "negative" : "positive"}>
            {formatMoney(Math.abs(totalRemaining))}
          </strong>
        </article>
        <article className="summary-card count-card">
          <span>Tỷ lệ sử dụng</span>
          <strong>{budgetsData.overall_percentage}%</strong>
        </article>
      </section>

      {/* Danh sách các hạn mức ngân sách */}
      <section className="panel budget-list-panel" aria-labelledby="budget-list-title">
        <div className="section-heading">
          <h2 id="budget-list-title">
            Hạn mức theo danh mục ({budgetsData.items.length})
          </h2>
          {budgetsData.items.length > 0 && unbudgetedCategories.length > 0 && (
            <span className="subtext">
              Còn {unbudgetedCategories.length} danh mục chi tiêu chưa đặt hạn mức
            </span>
          )}
        </div>

        {loading ? (
          <p className="loading-state">Đang tải dữ liệu ngân sách...</p>
        ) : budgetsData.items.length === 0 ? (
          <div className="empty-budget-state">
            <div className="empty-icon">📊</div>
            <h3>Chưa có hạn mức nào trong {formatMonthDisplay(selectedMonth)}</h3>
            <p>
              Hãy đặt hạn mức chi tiêu cho từng danh mục để kiểm soát tài chính hiệu quả hơn.
            </p>
            <div className="empty-actions">
              <button
                type="button"
                className="button-primary"
                onClick={handleOpenAdd}
                disabled={unbudgetedCategories.length === 0}
              >
                + Đặt hạn mức ngay
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => copyFromPrevious(selectedMonth)}
              >
                Sao chép từ tháng trước
              </button>
            </div>
          </div>
        ) : (
          <div className="budget-grid">
            {budgetsData.items.map((item) => {
              const clampedPercent = Math.min(item.percentage, 100);
              const isOver = item.status === "exceeded";

              return (
                <div key={item.id} className={`budget-card status-${item.status}`}>
                  <div className="budget-card-header">
                    <div>
                      <h3 className="budget-category-title">{item.category_name}</h3>
                      <span className="budget-sub-amounts">
                        Đã chi: <strong>{formatMoney(item.spent_amount)}</strong> /{" "}
                        {formatMoney(item.limit_amount)}
                      </span>
                    </div>

                    <span className={`budget-status-badge badge-${item.status}`}>
                      {item.status === "safe" && "An toàn"}
                      {item.status === "warning" && `Sắp chạm (${item.percentage}%)`}
                      {item.status === "exceeded" && `Vượt hạn mức (${item.percentage}%)`}
                    </span>
                  </div>

                  {/* Thanh tiến độ */}
                  <div className="budget-bar-track">
                    <div
                      className={`budget-bar-fill fill-${item.status}`}
                      style={{ width: `${clampedPercent}%` }}
                    />
                  </div>

                  <div className="budget-card-footer">
                    <span className={`budget-remaining ${isOver ? "text-danger" : "text-muted"}`}>
                      {isOver
                        ? `Vượt ${formatMoney(Math.abs(item.remaining_amount))}`
                        : `Còn lại ${formatMoney(item.remaining_amount)}`}
                    </span>

                    <div className="budget-actions">
                      <button
                        type="button"
                        className="budget-action-btn edit-btn"
                        onClick={() => handleOpenEdit(item)}
                        title="Sửa hạn mức"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        className="budget-action-btn delete-btn"
                        onClick={() => deleteBudget(item.id, item.category_name, selectedMonth)}
                        title="Xóa hạn mức"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal Đặt/Sửa hạn mức */}
      {isModalOpen && (
        <BudgetModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveBudget}
          categories={unbudgetedCategories}
          editingBudget={editingBudget}
          month={selectedMonth}
        />
      )}
    </div>
  );
}

export default BudgetManager;

