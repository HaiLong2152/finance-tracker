import { useState, useMemo } from "react";
import { formatDate, formatMoney } from "../../utils/formatters";
import BulkCategoryModal from "./BulkCategoryModal";

function TransactionTable({
  transactions = [],
  totalTransactions = 0,
  loading,
  categories = [],
  onEdit,
  onDelete,
  onBulkChangeCategory,
  onBulkDelete,
}) {
  const [selectedMap, setSelectedMap] = useState({});
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const selectedTransactions = useMemo(() => {
    return Object.values(selectedMap);
  }, [selectedMap]);

  const selectedIds = useMemo(() => {
    return Object.keys(selectedMap).map(Number);
  }, [selectedMap]);

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
    return transactions.every((t) => Boolean(selectedMap[t.id]));
  }, [transactions, selectedMap]);

  const isCurrentPageSomeSelected = useMemo(() => {
    if (transactions.length === 0) return false;
    return transactions.some((t) => Boolean(selectedMap[t.id])) && !isCurrentPageAllSelected;
  }, [transactions, selectedMap, isCurrentPageAllSelected]);

  const toggleSelectAll = () => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (isCurrentPageAllSelected) {
        // Bỏ chọn toàn bộ trang hiện tại nhưng giữ các trang khác
        transactions.forEach((t) => {
          delete next[t.id];
        });
      } else {
        // Chọn tất cả trang hiện tại và lưu đủ thông tin (id, amount, type)
        transactions.forEach((t) => {
          next[t.id] = { id: t.id, amount: t.amount, type: t.type };
        });
      }
      return next;
    });
  };

  const toggleSelect = (transaction) => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[transaction.id]) {
        delete next[transaction.id];
      } else {
        next[transaction.id] = {
          id: transaction.id,
          amount: transaction.amount,
          type: transaction.type,
        };
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedMap({});
  };

  const handleBulkChangeCategoryConfirm = async (categoryId) => {
    const success = await onBulkChangeCategory(selectedIds, categoryId);
    if (success) {
      setSelectedMap({});
      setIsCategoryModalOpen(false);
    }
    return success;
  };

  const handleBulkDeleteClick = async () => {
    const success = await onBulkDelete(selectedIds, totalSelectedAmount);
    if (success) {
      setSelectedMap({});
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
      {selectedIds.length > 0 && (
        <div className="bulk-action-bar" role="toolbar" aria-label="Thao tác hàng loạt">
          <div className="bulk-info">
            <span className="bulk-badge">{selectedIds.length}</span>
            <span>
              Đã chọn <strong>{selectedIds.length}</strong> giao dịch
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
              🗑️ Xóa ({selectedIds.length})
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
                const isSelected = Boolean(selectedMap[transaction.id]);

                return (
                  <tr
                    key={transaction.id}
                    className={isSelected ? "row-selected" : ""}
                    onClick={(e) => {
                      // Cho phép click vào hàng để toggle checkbox nếu không click vào nút
                      if (e.target.closest("button") || e.target.closest("input")) return;
                      toggleSelect(transaction);
                    }}
                  >
                    <td className="checkbox-col">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(transaction)}
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
          selectedCount={selectedIds.length}
          hasIncome={hasIncome}
          hasExpense={hasExpense}
        />
      )}
    </section>
  );
}

export default TransactionTable;
