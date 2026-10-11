import { formatDate, formatMoney } from "../../utils/formatters";

function TransactionTable({ transactions, totalTransactions, loading, onEdit, onDelete }) {
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
    <section className="panel" aria-labelledby="list-title">
      <div className="section-heading">
        <h2 id="list-title">Lịch sử giao dịch</h2>
        <span>{totalTransactions} giao dịch</span>
      </div>
      {loading ? (
        <p className="empty-state">Đang tải dữ liệu…</p>
      ) : transactions.length === 0 ? (
        <p className="empty-state">Chưa có giao dịch nào phù hợp với bộ lọc.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
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
                return (
                  <tr key={transaction.id}>
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
                        onClick={() => onEdit(transaction)}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        className="button-small button-danger"
                        onClick={() => onDelete(transaction)}
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
    </section>
  );
}

export default TransactionTable;
