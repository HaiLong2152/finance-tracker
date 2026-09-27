import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import "./index.css";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
const emptyForm = { amount: "", category_id: "", transaction_date: "", note: "" };
const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("vi-VN");

function App() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [transactionsResponse, categoriesResponse] = await Promise.all([
        axios.get(`${API_URL}/transactions`),
        axios.get(`${API_URL}/categories`),
      ]);
      setTransactions(transactionsResponse.data.data || []);
      setCategories(categoriesResponse.data.data || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Không thể tải dữ liệu. Hãy kiểm tra backend và kết nối cơ sở dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadTimer = setTimeout(fetchData, 0);
    return () => clearTimeout(loadTimer);
  }, [fetchData]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await axios.post(`${API_URL}/transactions`, {
        ...formData,
        amount: Number(formData.amount),
        category_id: Number(formData.category_id),
      });
      setFormData(emptyForm);
      setNotice("Đã lưu giao dịch.");
      await fetchData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Không thể lưu giao dịch. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page">
      <header className="page-header">
        <p className="eyebrow">FINANCE TRACKER</p>
        <h1>Sổ thu chi cá nhân</h1>
        <p className="subtitle">Theo dõi các khoản thu và chi của bạn.</p>
      </header>

      <section className="panel" aria-labelledby="form-title">
        <h2 id="form-title">Thêm giao dịch</h2>
        <form className="transaction-form" onSubmit={handleSubmit}>
          <label>Số tiền (VND)
            <input type="number" name="amount" min="1" step="1" placeholder="Ví dụ: 50000" value={formData.amount} onChange={(event) => setFormData({ ...formData, amount: event.target.value })} required />
          </label>
          <label>Danh mục
            <select name="category_id" value={formData.category_id} onChange={(event) => setFormData({ ...formData, category_id: event.target.value })} required>
              <option value="">Chọn danh mục</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name} ({category.type === "income" ? "Thu" : "Chi"})</option>)}
            </select>
          </label>
          <label>Ngày giao dịch
            <input type="date" name="transaction_date" value={formData.transaction_date} onChange={(event) => setFormData({ ...formData, transaction_date: event.target.value })} required />
          </label>
          <label>Ghi chú <span className="optional">(không bắt buộc)</span>
            <input type="text" name="note" maxLength="500" placeholder="Nội dung giao dịch" value={formData.note} onChange={(event) => setFormData({ ...formData, note: event.target.value })} />
          </label>
          <button type="submit" disabled={saving || categories.length === 0}>{saving ? "Đang lưu…" : "Lưu giao dịch"}</button>
        </form>
      </section>

      {error && <p className="message error" role="alert">{error}</p>}
      {notice && <p className="message success" role="status">{notice}</p>}

      <section className="panel" aria-labelledby="list-title">
        <div className="section-heading"><h2 id="list-title">Lịch sử giao dịch</h2><span>{transactions.length} giao dịch</span></div>
        {loading ? <p className="empty-state">Đang tải dữ liệu…</p> : transactions.length === 0 ? <p className="empty-state">Chưa có giao dịch nào. Hãy thêm giao dịch đầu tiên.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Ngày</th><th>Danh mục</th><th>Loại</th><th className="amount">Số tiền</th><th>Ghi chú</th></tr></thead>
            <tbody>{transactions.map((transaction) => <tr key={transaction.id}>
              <td>{date.format(new Date(`${String(transaction.transaction_date).slice(0, 10)}T00:00:00`))}</td>
              <td>{transaction.category_name}</td>
              <td><span className={`badge ${transaction.type}`}>{transaction.type === "income" ? "Thu" : "Chi"}</span></td>
              <td className="amount">{money.format(Number(transaction.amount))}</td>
              <td>{transaction.note || "—"}</td>
            </tr>)}</tbody>
          </table></div>
        )}
      </section>
    </main>
  );
}

export default App;
