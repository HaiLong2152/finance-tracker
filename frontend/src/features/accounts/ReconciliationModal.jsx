import { useState, useEffect, useMemo, useCallback } from "react";
import { reconciliationApi, getApiErrorMessage } from "../../services/api";
import { formatMoney, formatDate, getLocalDateString, formatAccountType } from "../../utils/formatters";
import { useCategories } from "../../contexts/CategoryContext";

export default function ReconciliationModal({ accounts = [], initialAccountId = null, onClose, onSuccess }) {
  const { categories } = useCategories();

  const [activeTab, setActiveTab] = useState("reconcile"); // 'reconcile' | 'history'
  const [selectedAccountId, setSelectedAccountId] = useState(() => {
    if (initialAccountId) return String(initialAccountId);
    return accounts[0] ? String(accounts[0].id) : "";
  });

  const [reconciliationDate, setReconciliationDate] = useState(() => getLocalDateString());
  const [actualBalance, setActualBalance] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  // Dữ liệu preview
  const [previewData, setPreviewData] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [customNote, setCustomNote] = useState("");

  // Dữ liệu lịch sử
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Kết quả sau khi confirm
  const [completedResult, setCompletedResult] = useState(null);

  // Tìm thông tin tài khoản hiện tại
  const currentAccount = useMemo(() => {
    return accounts.find((a) => String(a.id) === String(selectedAccountId));
  }, [accounts, selectedAccountId]);

  // Lọc danh mục phù hợp theo loại chênh lệch (nếu diff > 0 là income, nếu diff < 0 là expense)
  const availableCategories = useMemo(() => {
    if (!previewData || previewData.difference === 0) return [];
    const targetType = previewData.difference > 0 ? "income" : "expense";
    return categories.filter((c) => c.type === targetType);
  }, [previewData, categories]);

  // Load lịch sử đối soát khi người dùng yêu cầu
  const fetchHistory = useCallback(async (accId) => {
    setLoadingHistory(true);
    try {
      const res = await reconciliationApi.getHistory(accId || undefined);
      setHistoryList(res.data?.data || []);
    } catch (err) {
      console.error("Lỗi khi tải lịch sử đối soát:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "history") return;

    let ignore = false;
    reconciliationApi
      .getHistory(selectedAccountId || undefined)
      .then((res) => {
        if (!ignore) {
          setHistoryList(res.data?.data || []);
          setLoadingHistory(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error("Lỗi khi tải lịch sử đối soát:", err);
          setLoadingHistory(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [activeTab, selectedAccountId]);

  // Reset preview khi thay đổi tài khoản hoặc ngày hoặc số dư
  const handleAccountChange = (e) => {
    setSelectedAccountId(e.target.value);
    setPreviewData(null);
    setErrorMessage("");
    setCompletedResult(null);
  };

  const handleDateChange = (e) => {
    setReconciliationDate(e.target.value);
    setPreviewData(null);
    setErrorMessage("");
  };

  const handleBalanceChange = (e) => {
    setActualBalance(e.target.value);
    setPreviewData(null);
    setErrorMessage("");
  };

  // Bước 1: Xem trước số dư kỳ vọng và chênh lệch
  const handlePreview = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage("");

    if (!selectedAccountId) {
      setErrorMessage("Vui lòng chọn tài khoản cần đối soát.");
      return;
    }

    if (!reconciliationDate) {
      setErrorMessage("Vui lòng chọn ngày đối soát.");
      return;
    }

    if (actualBalance === "" || isNaN(Number(actualBalance))) {
      setErrorMessage("Vui lòng nhập số dư thực tế hợp lệ (số nguyên VND).");
      return;
    }

    setLoading(true);
    try {
      const res = await reconciliationApi.preview({
        account_id: Number(selectedAccountId),
        reconciliation_date: reconciliationDate,
        actual_balance: Number(actualBalance),
      });

      const data = res.data?.data;
      setPreviewData(data);
      if (data?.adjustment?.default_category) {
        setSelectedCategoryId(String(data.adjustment.default_category.id));
      } else {
        setSelectedCategoryId("");
      }
      setCustomNote(`Điều chỉnh số dư chênh lệch đối soát ngày ${reconciliationDate}`);
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, "Không thể tính toán số dư kỳ vọng."));
    } finally {
      setLoading(false);
    }
  };

  // Bước 2: Xác nhận đối soát
  const handleConfirm = async () => {
    if (!previewData) return;
    setErrorMessage("");
    setLoading(true);

    try {
      const payload = {
        account_id: Number(selectedAccountId),
        reconciliation_date: reconciliationDate,
        actual_balance: Number(actualBalance),
        category_id: previewData.difference !== 0 ? (Number(selectedCategoryId) || null) : null,
        note: customNote.trim() || undefined,
      };

      const res = await reconciliationApi.confirm(payload);
      setCompletedResult(res.data);
      if (onSuccess) {
        onSuccess(res.data);
      }
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, "Đối soát thất bại. Vui lòng kiểm tra lại."));
    } finally {
      setLoading(false);
    }
  };

  // Reset form để làm lần đối soát mới
  const handleReset = () => {
    setCompletedResult(null);
    setPreviewData(null);
    setActualBalance("");
    setErrorMessage("");
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="reconciliation-modal-title">
      <div className="modal-container reconciliation-modal-container">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 id="reconciliation-modal-title">⚖️ Đối soát số dư (Balance Reconciliation)</h2>
            <p className="modal-subtitle">
              Kiểm tra tính chính xác của số dư thực tế so với dòng tiền ghi chép trên hệ thống.
            </p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </div>

        {/* Tab chuyển đổi Đối soát / Lịch sử */}
        <div className="modal-tabs">
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === "reconcile" ? "active" : ""}`}
            onClick={() => setActiveTab("reconcile")}
          >
            Thực hiện đối soát
          </button>
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            Lịch sử đối soát
          </button>
        </div>

        {errorMessage && (
          <div className="alert-box error" role="alert" style={{ margin: "1rem 1.5rem 0" }}>
            <span>⚠️</span>
            <div>{errorMessage}</div>
          </div>
        )}

        {/* ===================== TAB 1: THỰC HIỆN ĐỐI SOÁT ===================== */}
        {activeTab === "reconcile" && (
          <div className="modal-body-scroll">
            {completedResult ? (
              /* KẾT QUẢ HOÀN TẤT */
              <div className="reconciliation-result-box success-step">
                <div className="success-icon-box">✓</div>
                <h3>{completedResult.message || "Đối soát thành công!"}</h3>
                <p className="success-desc">
                  Số dư ví <strong>{currentAccount?.name}</strong> đã được đồng bộ với thực tế.
                </p>

                <div className="reconciliation-summary-grid">
                  <div className="summary-item">
                    <span>Số dư kỳ vọng ban đầu</span>
                    <strong>{formatMoney(completedResult.data?.expected_balance)}</strong>
                  </div>
                  <div className="summary-item highlight">
                    <span>Số dư thực tế xác nhận</span>
                    <strong>{formatMoney(completedResult.data?.actual_balance)}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Chênh lệch đã xử lý</span>
                    <strong className={completedResult.data?.difference === 0 ? "zero-diff" : "has-diff"}>
                      {formatMoney(completedResult.data?.difference)}
                    </strong>
                  </div>
                </div>

                <div className="modal-actions justify-center" style={{ marginTop: "1.5rem" }}>
                  <button type="button" className="button-secondary" onClick={() => setActiveTab("history")}>
                    Xem lịch sử đối soát
                  </button>
                  <button type="button" className="button-primary" onClick={handleReset}>
                    Đối soát tiếp
                  </button>
                  <button type="button" className="button-secondary" onClick={onClose}>
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              /* FORM NHẬP LIỆU & XEM PREVIEW */
              <div className="reconciliation-form-content">
                <form onSubmit={handlePreview} className="reconciliation-input-grid">
                  <label>
                    Chọn ví / tài khoản
                    <select
                      value={selectedAccountId}
                      onChange={handleAccountChange}
                      disabled={loading}
                    >
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({formatAccountType(acc.type)}) {acc.is_archived ? " [Lưu trữ]" : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Ngày đối soát
                    <input
                      type="date"
                      value={reconciliationDate}
                      onChange={handleDateChange}
                      min={currentAccount?.start_date ? String(currentAccount.start_date).slice(0, 10) : undefined}
                      disabled={loading}
                      required
                    />
                    {currentAccount?.start_date && (
                      <small className="field-hint">
                        Bắt đầu theo dõi: {formatDate(currentAccount.start_date)}
                      </small>
                    )}
                  </label>

                  <label className="span-full">
                    Số dư thực tế tại ngày đối soát (VND)
                    <div className="input-with-button">
                      <input
                        type="number"
                        step="1"
                        placeholder="Ví dụ: 15500000"
                        value={actualBalance}
                        onChange={handleBalanceChange}
                        disabled={loading}
                        required
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="button-primary"
                        disabled={loading || actualBalance === ""}
                      >
                        {loading ? "Đang tính..." : "Kiểm tra chênh lệch 🔍"}
                      </button>
                    </div>
                    <small className="field-hint">
                      Mở app ngân hàng hoặc đếm tiền mặt tại ngày {formatDate(reconciliationDate)} và điền vào đây.
                    </small>
                  </label>
                </form>

                {/* PREVIEW BREAKDOWN KHI ĐÃ TÍNH TOÁN */}
                {previewData && (
                  <div className="reconciliation-breakdown-card">
                    <div className="breakdown-header">
                      <h3>Phân tích chi tiết số dư đến ngày {formatDate(previewData.reconciliation_date)}</h3>
                      <span className="tx-count-badge">
                        {previewData.breakdown.transaction_count} giao dịch đã ghi nhận
                      </span>
                    </div>

                    <div className="formula-box">
                      <div className="formula-step">
                        <span>Số dư ban đầu</span>
                        <strong>{formatMoney(previewData.breakdown.initial_balance)}</strong>
                      </div>
                      <div className="formula-op">+</div>
                      <div className="formula-step income">
                        <span>Tổng thu</span>
                        <strong>+{formatMoney(previewData.breakdown.total_income)}</strong>
                      </div>
                      <div className="formula-op">-</div>
                      <div className="formula-step expense">
                        <span>Tổng chi</span>
                        <strong>-{formatMoney(previewData.breakdown.total_expense)}</strong>
                      </div>
                      <div className="formula-op">+</div>
                      <div className="formula-step transfer">
                        <span>Chuyển đến</span>
                        <strong>+{formatMoney(previewData.breakdown.total_transfer_in)}</strong>
                      </div>
                      <div className="formula-op">-</div>
                      <div className="formula-step transfer">
                        <span>Chuyển đi</span>
                        <strong>-{formatMoney(previewData.breakdown.total_transfer_out)}</strong>
                      </div>
                      <div className="formula-op">=</div>
                      <div className="formula-step expected">
                        <span>Số dư kỳ vọng</span>
                        <strong>{formatMoney(previewData.expected_balance)}</strong>
                      </div>
                    </div>

                    {/* SO SÁNH THỰC TẾ VÀ KỲ VỌNG */}
                    <div className="comparison-row">
                      <div className="comp-block">
                        <span className="comp-label">Số dư kỳ vọng hệ thống</span>
                        <span className="comp-val">{formatMoney(previewData.expected_balance)}</span>
                      </div>
                      <div className="comp-divider">vs</div>
                      <div className="comp-block">
                        <span className="comp-label">Số dư thực tế bạn nhập</span>
                        <span className="comp-val highlight">{formatMoney(previewData.actual_balance)}</span>
                      </div>
                      <div className="comp-divider">=</div>
                      <div className={`comp-block diff ${previewData.difference === 0 ? "zero" : previewData.difference > 0 ? "positive" : "negative"}`}>
                        <span className="comp-label">Chênh lệch</span>
                        <span className="comp-val">
                          {previewData.difference > 0 ? `+${formatMoney(previewData.difference)}` : formatMoney(previewData.difference)}
                        </span>
                      </div>
                    </div>

                    {/* ĐỀ XUẤT XỬ LÝ */}
                    {previewData.difference === 0 ? (
                      <div className="adjustment-proposal matched">
                        <div className="proposal-icon">🎉</div>
                        <div>
                          <strong>Tuyệt vời! Số dư hoàn toàn khớp chính xác!</strong>
                          <p>
                            Mọi thu chi đã được ghi chép đầy đủ. Hệ thống sẽ lưu lại mốc đối soát này để đánh dấu ví đã được kiểm tra.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="adjustment-proposal diff-action">
                        <div className="proposal-icon">⚡</div>
                        <div className="proposal-content">
                          <strong>
                            Đề xuất điều chỉnh: Tạo giao dịch{" "}
                            {previewData.difference > 0 ? "Thu nhập (Thừa tiền)" : "Chi phí (Thiếu tiền)"}{" "}
                            {formatMoney(previewData.adjustment.amount)}
                          </strong>
                          <p>
                            Để đưa số dư trên hệ thống về đúng <strong>{formatMoney(previewData.actual_balance)}</strong>, một giao dịch điều chỉnh sẽ được tạo tại ngày đối soát.
                          </p>

                          <div className="adjustment-inputs">
                            <label>
                              Danh mục điều chỉnh:
                              <select
                                value={selectedCategoryId}
                                onChange={(e) => setSelectedCategoryId(e.target.value)}
                              >
                                {availableCategories.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label>
                              Ghi chú giao dịch:
                              <input
                                type="text"
                                value={customNote}
                                onChange={(e) => setCustomNote(e.target.value)}
                                placeholder="Ghi chú nguyên nhân chênh lệch..."
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="modal-actions" style={{ marginTop: "1.5rem" }}>
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => setPreviewData(null)}
                        disabled={loading}
                      >
                        Nhập lại số dư
                      </button>
                      <button
                        type="button"
                        className="button-primary"
                        onClick={handleConfirm}
                        disabled={loading}
                      >
                        {loading
                          ? "Đang lưu đối soát..."
                          : previewData.difference === 0
                          ? "✓ Lưu mốc đối soát đã khớp"
                          : `⚖️ Xác nhận tạo điều chỉnh ${formatMoney(previewData.adjustment.amount)}`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 2: LỊCH SỬ ĐỐI SOÁT ===================== */}
        {activeTab === "history" && (
          <div className="modal-body-scroll">
            <div className="history-filter-bar">
              <label>
                Xem theo ví:
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                >
                  <option value="">-- Tất cả ví --</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="button-small button-secondary"
                onClick={() => fetchHistory(selectedAccountId)}
                disabled={loadingHistory}
              >
                {loadingHistory ? "Đang tải..." : "Làm mới ↻"}
              </button>
            </div>

            {loadingHistory ? (
              <p className="empty-state">Đang tải lịch sử đối soát...</p>
            ) : historyList.length === 0 ? (
              <div className="empty-state">
                <p>Chưa có lịch sử đối soát nào cho ví này.</p>
                <button
                  type="button"
                  className="button-small button-primary"
                  onClick={() => setActiveTab("reconcile")}
                >
                  Thực hiện đối soát ngay
                </button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="reconciliation-history-table">
                  <thead>
                    <tr>
                      <th>Ngày đối soát</th>
                      <th>Ví / Tài khoản</th>
                      <th className="text-right">Kỳ vọng</th>
                      <th className="text-right">Thực tế</th>
                      <th className="text-right">Chênh lệch</th>
                      <th>Điều chỉnh</th>
                      <th>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyList.map((rec) => {
                      const diff = Number(rec.difference || 0);
                      return (
                        <tr key={rec.id}>
                          <td>
                            <strong>{formatDate(rec.reconciliation_date)}</strong>
                          </td>
                          <td>{rec.account_name}</td>
                          <td className="text-right">{formatMoney(rec.expected_balance)}</td>
                          <td className="text-right font-medium">{formatMoney(rec.actual_balance)}</td>
                          <td className={`text-right ${diff === 0 ? "zero-diff" : diff > 0 ? "positive-diff" : "negative-diff"}`}>
                            {diff === 0 ? "0 đ" : diff > 0 ? `+${formatMoney(diff)}` : formatMoney(diff)}
                          </td>
                          <td>
                            {rec.transaction_id ? (
                              <span className={`badge ${rec.transaction_type}`}>
                                {rec.transaction_type === "income" ? "Thu" : "Chi"} {formatMoney(rec.transaction_amount)}
                              </span>
                            ) : (
                              <span className="badge badge-success">Khớp hoàn toàn</span>
                            )}
                          </td>
                          <td className="note-cell">{rec.note || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

