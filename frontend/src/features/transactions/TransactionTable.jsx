import { useState, useMemo } from "react";
import { formatDate, formatMoney } from "../../utils/formatters";
import BulkCategoryModal from "./BulkCategoryModal";

function TransactionTable({
  transactions = [],
  allTransactions,
  totalTransactions,
  loading,
  categories = [],
  onEdit,
  onDelete,
  onBulkChangeCategory,
  onBulkDelete,
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Danh sách giao dịch nguồn để tra cứu: ưu tiên allTransactions (toàn bộ kết quả lọc trên tất cả các trang)
  const transactionSource = allTransactions ?? transactions;

  // Tập hợp ID thực tế tồn tại trong nguồn dữ liệu hiện tại
  const validIdSet = useMemo(() => {
    return new Set(transactionSource.map((t) => t.id));
  }, [transactionSource]);

  // Các ID được chọn thực sự hợp lệ (tự động loại bỏ các ID không còn tồn tại khi thay đổi bộ lọc)
  const effectiveSelectedIds = useMemo(() => {
    return selectedIds.filter((id) => validIdSet.has(id));
  }, [selectedIds, validIdSet]);

  const selectedTransactions = useMemo(() => {
    const idSet = new Set(effectiveSelectedIds);
    return transactionSource.filter((t) => idSet.has(t.id));
  }, [transactionSource, effectiveSelectedIds]);

  const totalSelectedAmount = useMemo(() => {
    return selectedTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [selectedTransactions]);

  const hasTransfer = useMemo(() => {
    return selectedTransactions.some((t) => t.type === "transfer");
  }, [selectedTransactions]);

  const hasIncome = useMemo(() => {
    return selectedTransactions.some((t) => t.type === "income");
  }, [selectedTransactions]);

  const hasExpense = useMemo(() => {
    return selectedTransactions.some((t) => t.type === "expense");
  }, [selectedTransactions]);

  // Trạng thái checkbox ở header: áp dụng cho các giao dịch trong trang hiện tại
  const isCurrentPageAllSelected = useMemo(() => {
    if (transactions.length === 0) return false;
    const idSet = new Set(effectiveSelectedIds);
    return transactions.every((t) => idSet.has(t.id));
  }, [transactions, effectiveSelectedIds]);

  const isCurrentPageSomeSelected = useMemo(() => {
    if (transactions.length === 0) return false;
    const idSet = new Set(effectiveSelectedIds);
    return transactions.some((t) => idSet.has(t.id)) && !isCurrentPageAllSelected;
  }, [transactions, effectiveSelectedIds, isCurrentPageAllSelected]);

  const toggleSelectAll = () => {
    const pageIds = transactions.map((t) => t.id);
    if (isCurrentPageAllSelected) {
      // Bỏ chọn toàn bộ trang hiện tại nhưng giữ các trang khác
      const pageIdSet = new Set(pageIds);
      setSelectedIds(effectiveSelectedIds.filter((id) => !pageIdSet.has(id)));
    } else {
      // Chọn tất cả trang hiện tại và hợp nhất với các ID đã chọn ở trang khác
      setSelectedIds(Array.from(new Set([...effectiveSelectedIds, ...pageIds])));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const base = prev.filter((item) => validIdSet.has(item));
      return base.includes(id) ? base.filter((item) => item !== id) : [...base, id];
    });
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleBulkChangeCategoryConfirm = async (categoryId) => {
    const success = await onBulkChangeCategory(effectiveSelectedIds, categoryId);
    if (success) {
      setSelectedIds([]);
      setIsCategoryModalOpen(false);
    }
    return success;
  };

  const handleBulkDeleteClick = async () => {
    const success = await onBulkDelete(effectiveSelectedIds, totalSelectedAmount);
    if (success) {
      setSelectedIds([]);
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case "income":
        return <span className="badge income">Thu</span>;
      case "expense":
        return <span className="badge expense">Chi</span>;
      case "transfer":
        return <span className="badge transfer">Chuyển</span>;
      default:
        return <span className="badge">{type}</span>;
    }
  };

  return (
    <section className="panel transaction-list-panel" aria-labelledby="list-title">
      <div className="section-heading">
        <h2 id="list-title">Lịch sử giao dịch</h2>
        <span>{totalTransactions} giao dịch</span>
      </div>

      {/* Thanh tác vụ hàng loạt nổi bật khi có chọn */}
      {effectiveSelectedIds.length > 0 && (
        <div className="bulk-action-bar" role="toolbar" aria-label="Thao tác hàng loạt">
          <div className="bulk-info">
            <span className="bulk-badge">{effectiveSelectedIds.length}</span>
            <span>
              Đã chọn <strong>{effectiveSelectedIds.length}</strong> giao dịch
              <span className="bulk-total-text">
                {" "}(Tổng: {formatMoney(totalSelectedAmount)})
              </span>
            </span>
          </div>

          <div className="bulk-actions-group">
            <button
              type="button"
              className="button-small button-secondary"
              onClick={() => setIsCategoryModalOpen(true)}
              disabled={hasTransfer && !hasIncome && !hasExpense}
              title={hasTransfer ? "Lưu ý: Không áp dụng đổi danh mục cho giao dịch chuyển tiền" : ""}
            >
              🏷️ Đổi danh mục
            </button>
            <button
              type="button"
              className="button-small button-danger"
              onClick={handleBulkDeleteClick}
            >
              🗑️ Xóa ({effectiveSelectedIds.length})
            </button>
            <button
              type="button"
              className="button-small button-outline"
              onClick={handleClearSelection}
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="empty-state">Đang tải dữ liệu…</p>
      ) : transactions.length === 0 ? (
        <p className="empty-state">Chưa có giao dịch nào phù hợp với bộ lọc.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="checkbox-col">
                  <input
                    type="checkbox"
                    ref={(el) => {
                      if (el) el.indeterminate = isCurrentPageSomeSelected;
                    }}
                    checked={isCurrentPageAllSelected}
                    onChange={toggleSelectAll}
                    aria-label="Chọn tất cả giao dịch trong trang"
                  />
                </th>
                <th>Ngày</th>
                <th>Ví / Tài khoản</th>
                <th>Danh mục</th>
                <th>Loại</th>
                <th className="amount">Số tiền</th>
                <th>Ghi chú</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => {
                const isTransfer = transaction.type === "transfer";
                const isSelected = effectiveSelectedIds.includes(transaction.id);

                return (
                  <tr
                    key={transaction.id}
                    className={isSelected ? "row-selected" : ""}
                    onClick={(e) => {
                      // Cho phép click vào hàng để toggle checkbox nếu không click vào nút
                      if (e.target.closest("button") || e.target.closest("input")) return;
                      toggleSelect(transaction.id);
                    }}
                  >
                    <td className="checkbox-col">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(transaction.id)}
                        aria-label={`Chọn giao dịch ID ${transaction.id}`}
                      />
                    </td>
                    <td>{formatDate(transaction.transaction_date)}</td>
                    <td className="account-cell">
                      {isTransfer ? (
                        <span className="transfer-flow">
                          <strong>{transaction.account_name || "—"}</strong>
                          <span className="transfer-arrow">➔</span>
                          <strong>{transaction.transfer_account_name || "—"}</strong>
                        </span>
                      ) : (
                        <span>{transaction.account_name || "—"}</span>
                      )}
                    </td>
                    <td>
                      {isTransfer ? (
                        <span className="text-muted">— (Chuyển nội bộ)</span>
                      ) : (
                        transaction.category_name || "—"
                      )}
                    </td>
                    <td>{getTypeBadge(transaction.type)}</td>
                    <td className={`amount ${transaction.type}`}>
                      {transaction.type === "expense" && "-"}
                      {transaction.type === "income" && "+"}
                      {formatMoney(transaction.amount)}
                    </td>
                    <td className="note-cell">{transaction.note || "—"}</td>
                    <td className="actions">
                      <button
                        type="button"
                        className="button-small button-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(transaction);
                        }}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        className="button-small button-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(transaction);
                        }}
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal chọn danh mục hàng loạt */}
      {isCategoryModalOpen && (
        <BulkCategoryModal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          onConfirm={handleBulkChangeCategoryConfirm}
          categories={categories}
          selectedCount={effectiveSelectedIds.length}
          hasIncome={hasIncome}
          hasExpense={hasExpense}
        />
      )}
    </section>
  );
}

export default TransactionTable;
