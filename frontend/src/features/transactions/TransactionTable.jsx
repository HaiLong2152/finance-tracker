import { formatDate, formatMoney } from "../../utils/formatters";

function TransactionTable({ transactions, totalTransactions, loading, onEdit, onDelete }) {
  return (
    <section className="panel" aria-labelledby="list-title">
      <div className="section-heading">
        <h2 id="list-title">Lịch sử giao dịch</h2>
        <span>{totalTransactions} giao dịch</span>
      </div>
      {loading ? (
        <p className="empty-state">Đang tải dữ liệu…</p>
      ) : transactions.length === 0 ? (
        <p className="empty-state">Chưa có giao dịch nào. Hãy thêm giao dịch đầu tiên.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Ngày</th><th>Danh mục</th><th>Loại</th><th className="amount">Số tiền</th><th>Ghi chú</th><th>Thao tác</th></tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{formatDate(transaction.transaction_date)}</td>
                  <td>{transaction.category_name}</td>
                  <td><span className={`badge ${transaction.type}`}>{transaction.type === "income" ? "Thu" : "Chi"}</span></td>
                  <td className="amount">{formatMoney(transaction.amount)}</td>
                  <td>{transaction.note || "—"}</td>
                  <td className="actions">
                    <button type="button" className="button-small button-secondary" onClick={() => onEdit(transaction)}>Sửa</button>
                    <button type="button" className="button-small button-danger" onClick={() => onDelete(transaction)}>Xóa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default TransactionTable;
