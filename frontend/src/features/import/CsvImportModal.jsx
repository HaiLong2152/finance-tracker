import { useState, useMemo } from "react";
import { importApi, getApiErrorMessage } from "../../services/api";
import { formatMoney, formatAccountType } from "../../utils/formatters";
import { useCategories } from "../../contexts/CategoryContext";

export default function CsvImportModal({ accounts, onClose, onSuccess }) {
  const { categories } = useCategories();

  // Wizard step: 1 (Upload & Account) -> 2 (Mapping) -> 3 (Preview) -> 4 (Result)
  const [step, setStep] = useState(1);

  // Dữ liệu file
  const [selectedAccount, setSelectedAccount] = useState(() => (accounts[0] ? String(accounts[0].id) : ""));
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");

  // Dữ liệu sau khi parse preview
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [previewData, setPreviewData] = useState(null);

  // Ánh xạ cột
  const [useSeparateCols, setUseSeparateCols] = useState(false);
  const [mapping, setMapping] = useState({
    dateCol: 0,
    amountCol: 1,
    inflowCol: null,
    outflowCol: null,
    noteCol: 2,
    categoryCol: null,
  });

  // Trạng thái các dòng được chọn ở bước 3
  const [rows, setRows] = useState([]);

  // Kết quả sau khi confirm
  const [resultSummary, setResultSummary] = useState(null);

  // Xử lý khi người dùng chọn file
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrorMessage("Vui lòng chọn tập tin có định dạng .csv");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Dung lượng file vượt quá giới hạn tối đa (5MB).");
      return;
    }

    setFileName(file.name);
    setErrorMessage("");

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      setFileContent(text || "");
    };
    reader.onerror = () => {
      setErrorMessage("Không thể đọc nội dung file. Vui lòng thử lại.");
    };
    reader.readAsText(file, "UTF-8");
  };

  // Tải file CSV mẫu chuẩn
  const handleDownloadSample = () => {
    const sampleCsv = `Ngày,Số tiền,Nội dung,Ghi chú
15/10/2026,-120000,Thanh toan ca phe Phuc Long,Chi tieu
16/10/2026,5000000,Nhan luong thang 10,Thu nhap
18/10/2026,-85000,Chuyen xe GrabBike,Di lai
20/10/2026,-250000,Sieu thi WinMart,Mua sam`;

    const blob = new Blob(["\uFEFF" + sampleCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "sao_ke_mau_finance_tracker.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bước 1 -> Bước 2: Phân tích sơ bộ headers
  const handleProceedToMapping = async () => {
    setErrorMessage("");
    if (!selectedAccount) {
      setErrorMessage("Vui lòng chọn ví nhận dữ liệu sao kê.");
      return;
    }
    if (!fileContent.trim()) {
      setErrorMessage("Vui lòng chọn một file CSV có dữ liệu.");
      return;
    }

    try {
      setLoading(true);
      // Gọi preview với auto-detect mapping
      const res = await importApi.preview({
        file_name: fileName,
        file_content: fileContent,
        account_id: Number(selectedAccount),
      });

      const data = res.data?.data;
      setPreviewData(data);

      // Cập nhật mapping từ backend gợi ý
      const det = data.detected_mapping || {};
      const hasSep = det.inflowCol !== null || det.outflowCol !== null;
      setUseSeparateCols(hasSep);

      setMapping({
        dateCol: det.dateCol ?? 0,
        amountCol: det.amountCol ?? 1,
        inflowCol: det.inflowCol ?? null,
        outflowCol: det.outflowCol ?? null,
        noteCol: det.noteCol ?? (data.headers.length > 2 ? 2 : 1),
        categoryCol: det.categoryCol ?? null,
      });

      // Mặc định chọn các dòng hợp lệ, bỏ chọn dòng nghi trùng hoặc lỗi
      const initialRows = (data.rows || []).map((r) => ({
        ...r,
        selected: r.status === "valid", // Chỉ chọn mặc định dòng hợp lệ
      }));
      setRows(initialRows);

      setStep(3); // Chuyển thẳng tới xem trước nếu auto-detect thành công
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, "Không thể xử lý file CSV."));
    } finally {
      setLoading(false);
    }
  };

  // Tùy chỉnh lại mapping nếu muốn đổi cột
  const handleReApplyMapping = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      const activeMap = {
        dateCol: mapping.dateCol !== null ? Number(mapping.dateCol) : null,
        amountCol: !useSeparateCols && mapping.amountCol !== null ? Number(mapping.amountCol) : null,
        inflowCol: useSeparateCols && mapping.inflowCol !== null ? Number(mapping.inflowCol) : null,
        outflowCol: useSeparateCols && mapping.outflowCol !== null ? Number(mapping.outflowCol) : null,
        noteCol: mapping.noteCol !== null ? Number(mapping.noteCol) : null,
        categoryCol: mapping.categoryCol !== null ? Number(mapping.categoryCol) : null,
      };

      const res = await importApi.preview({
        file_name: fileName,
        file_content: fileContent,
        account_id: Number(selectedAccount),
        column_mapping: activeMap,
      });

      const data = res.data?.data;
      setPreviewData(data);
      setRows(
        (data.rows || []).map((r) => ({
          ...r,
          selected: r.status === "valid",
        }))
      );
      setStep(3);
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, "Không thể áp dụng ánh xạ cột."));
    } finally {
      setLoading(false);
    }
  };

  // Toggle chọn một dòng
  const handleToggleRow = (idx) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r))
    );
  };

  // Toggle chọn tất cả các dòng không bị lỗi
  const handleToggleAll = (select) => {
    setRows((prev) =>
      prev.map((r) => (r.status !== "error" ? { ...r, selected: select } : r))
    );
  };

  // Thay đổi danh mục cho một dòng cụ thể trên bảng preview
  const handleRowCategoryChange = (idx, newCatId) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const cat = categories.find((c) => c.id === Number(newCatId));
        return {
          ...r,
          category_id: newCatId ? Number(newCatId) : null,
          category_name: cat ? cat.name : null,
        };
      })
    );
  };

  // Xác nhận nhập chính thức vào CSDL (Bước 3 -> Bước 4)
  const handleConfirmImport = async () => {
    setErrorMessage("");
    const selectedCount = rows.filter((r) => r.selected && r.status !== "error").length;
    if (selectedCount === 0) {
      setErrorMessage("Vui lòng tích chọn ít nhất 1 dòng hợp lệ để nhập.");
      return;
    }

    try {
      setLoading(true);
      const res = await importApi.confirm({
        file_name: fileName,
        file_hash: previewData.file_hash,
        account_id: Number(selectedAccount),
        rows: rows,
      });

      setResultSummary(res.data?.data);
      setStep(4);
      if (typeof onSuccess === "function") {
        onSuccess();
      }
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, "Nhập sao kê thất bại."));
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = useMemo(
    () => rows.filter((r) => r.selected && r.status !== "error").length,
    [rows]
  );

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-content csv-import-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="csv-import-title"
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">NHẬP DỮ LIỆU TỰ ĐỘNG</span>
            <h2 id="csv-import-title">Nhập sao kê từ file CSV</h2>
          </div>
          <button type="button" className="sheet-close-btn" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </div>

        {/* Thanh tiến trình từng bước */}
        <div className="import-steps-indicator">
          <div className={`step-dot ${step >= 1 ? "active" : ""}`}>
            <span>1</span> Tải file & Chọn ví
          </div>
          <div className="step-line" />
          <div className={`step-dot ${step >= 2 ? "active" : ""}`}>
            <span>2</span> Ánh xạ cột
          </div>
          <div className="step-line" />
          <div className={`step-dot ${step >= 3 ? "active" : ""}`}>
            <span>3</span> Xem trước ({previewData ? previewData.total_rows : 0})
          </div>
          <div className="step-line" />
          <div className={`step-dot ${step >= 4 ? "active" : ""}`}>
            <span>4</span> Hoàn tất
          </div>
        </div>

        {errorMessage && <div className="message error">{errorMessage}</div>}

        {/* ==================== BƯỚC 1: UPLOAD FILE & CHỌN VÍ ==================== */}
        {step === 1 && (
          <div className="import-step-content">
            <div className="form-group">
              <label htmlFor="import-account" className="form-label">
                Ví nhận giao dịch sao kê *
              </label>
              <select
                id="import-account"
                value={selectedAccount}
                required
                onChange={(e) => setSelectedAccount(e.target.value)}
              >
                <option value="">-- Chọn ví --</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatAccountType(acc.type)})
                  </option>
                ))}
              </select>
            </div>

            <div className="csv-dropzone">
              <input
                id="csv-file-input"
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="csv-file-hidden"
              />
              <label htmlFor="csv-file-input" className="csv-dropzone-label">
                <div className="dropzone-icon">📁</div>
                <div className="dropzone-text">
                  <strong>{fileName ? fileName : "Bấm vào đây để chọn file .CSV"}</strong>
                  <span>Hỗ trợ file UTF-8, kích thước tối đa 5MB, tối đa 1.000 dòng.</span>
                </div>
              </label>
            </div>

            <div className="sample-download-bar">
              <span>Chưa có file mẫu? </span>
              <button
                type="button"
                className="link-button"
                onClick={handleDownloadSample}
              >
                Tải file CSV mẫu (.csv)
              </button>
            </div>

            <div className="modal-actions">
              <button type="button" className="button-secondary" onClick={onClose}>
                Hủy
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={handleProceedToMapping}
                disabled={loading || !selectedAccount || !fileContent}
              >
                {loading ? "Đang phân tích..." : "Tiếp tục: Phân tích file ➔"}
              </button>
            </div>
          </div>
        )}

        {/* ==================== BƯỚC 2: CẤU HÌNH ÁNH XẠ CỘT ==================== */}
        {step === 2 && previewData && (
          <div className="import-step-content">
            <p className="step-hint">
              Hệ thống đã nhận diện các cột tiêu đề. Bạn có thể kiểm tra lại ánh xạ cột để đảm bảo bóc tách chính xác:
            </p>

            <div className="mapping-form-grid">
              <div className="form-group">
                <label className="form-label">Cột Ngày giao dịch *</label>
                <select
                  value={mapping.dateCol ?? ""}
                  onChange={(e) => setMapping({ ...mapping, dateCol: Number(e.target.value) })}
                >
                  {previewData.headers.map((h, i) => (
                    <option key={i} value={i}>
                      Cột {i + 1}: {h}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Cột Nội dung / Ghi chú</label>
                <select
                  value={mapping.noteCol ?? ""}
                  onChange={(e) => setMapping({ ...mapping, noteCol: Number(e.target.value) })}
                >
                  <option value="">-- Không chọn --</option>
                  {previewData.headers.map((h, i) => (
                    <option key={i} value={i}>
                      Cột {i + 1}: {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Toggle chế độ 1 cột tiền hay 2 cột Thu/Chi riêng biệt */}
            <div className="mapping-amount-mode">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={useSeparateCols}
                  onChange={(e) => setUseSeparateCols(e.target.checked)}
                />
                <span>Sao kê có 2 cột riêng cho Thu tiền và Chi tiền (Inflow / Outflow)</span>
              </label>
            </div>

            {useSeparateCols ? (
              <div className="mapping-form-grid">
                <div className="form-group">
                  <label className="form-label">Cột Tiền Thu (Inflow / Ghi có) *</label>
                  <select
                    value={mapping.inflowCol ?? ""}
                    onChange={(e) => setMapping({ ...mapping, inflowCol: Number(e.target.value) })}
                  >
                    <option value="">-- Chọn cột Thu --</option>
                    {previewData.headers.map((h, i) => (
                      <option key={i} value={i}>
                        Cột {i + 1}: {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Cột Tiền Chi (Outflow / Ghi nợ) *</label>
                  <select
                    value={mapping.outflowCol ?? ""}
                    onChange={(e) => setMapping({ ...mapping, outflowCol: Number(e.target.value) })}
                  >
                    <option value="">-- Chọn cột Chi --</option>
                    {previewData.headers.map((h, i) => (
                      <option key={i} value={i}>
                        Cột {i + 1}: {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Cột Số tiền chung *</label>
                <select
                  value={mapping.amountCol ?? ""}
                  onChange={(e) => setMapping({ ...mapping, amountCol: Number(e.target.value) })}
                >
                  {previewData.headers.map((h, i) => (
                    <option key={i} value={i}>
                      Cột {i + 1}: {h}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="button-secondary" onClick={() => setStep(1)}>
                ⬅ Quay lại
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={handleReApplyMapping}
                disabled={loading}
              >
                {loading ? "Đang áp dụng..." : "Xem trước bảng dữ liệu ➔"}
              </button>
            </div>
          </div>
        )}

        {/* ==================== BƯỚC 3: XEM TRƯỚC VÀ ĐỐI SOÁT ==================== */}
        {step === 3 && previewData && (
          <div className="import-step-content">
            {/* Cảnh báo nếu file trùng */}
            {previewData.is_file_duplicate && (
              <div className="inbox-error-banner">
                <span className="error-icon">⚠️</span>
                <span>
                  <strong>Cảnh báo:</strong> File này từng được nhập vào hệ thống vào lúc{" "}
                  {new Date(previewData.previous_batch?.imported_at).toLocaleString("vi-VN")}. Hãy kiểm tra kỹ các dòng nghi trùng để tránh nhân đôi giao dịch.
                </span>
              </div>
            )}

            {/* Khối thống kê tổng quan */}
            <div className="preview-summary-pills">
              <span className="summary-pill total">
                Tổng cộng: <strong>{previewData.total_rows}</strong> dòng
              </span>
              <span className="summary-pill valid">
                ✓ Hợp lệ: <strong>{previewData.valid_count}</strong>
              </span>
              <span className="summary-pill duplicate">
                ⚠️ Nghi trùng: <strong>{previewData.duplicate_count}</strong>
              </span>
              <span className="summary-pill error">
                ✕ Lỗi: <strong>{previewData.error_count}</strong>
              </span>
              <button
                type="button"
                className="reconfig-mapping-btn"
                onClick={() => setStep(2)}
              >
                ⚙ Đổi ánh xạ cột
              </button>
            </div>

            {/* Thanh công cụ chọn dòng */}
            <div className="preview-selection-toolbar">
              <span>Đang chọn: <strong>{selectedCount}</strong> / {rows.length} giao dịch</span>
              <div className="toolbar-btns">
                <button
                  type="button"
                  className="button-secondary button-small"
                  onClick={() => handleToggleAll(true)}
                >
                  Chọn tất cả hợp lệ
                </button>
                <button
                  type="button"
                  className="button-secondary button-small"
                  onClick={() => handleToggleAll(false)}
                >
                  Bỏ chọn tất cả
                </button>
              </div>
            </div>

            {/* Bảng dữ liệu xem trước */}
            <div className="csv-preview-table-wrapper">
              <table className="csv-preview-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>Chọn</th>
                    <th>Trạng thái</th>
                    <th>Ngày</th>
                    <th>Số tiền</th>
                    <th>Loại</th>
                    <th>Ghi chú / Nội dung</th>
                    <th>Danh mục</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const isError = row.status === "error";
                    const isDup = row.status === "duplicate";

                    return (
                      <tr
                        key={idx}
                        className={`preview-row ${isError ? "row-error" : ""} ${isDup ? "row-duplicate" : ""} ${row.selected ? "row-selected" : ""}`}
                      >
                        <td className="text-center">
                          <input
                            type="checkbox"
                            disabled={isError}
                            checked={row.selected}
                            onChange={() => handleToggleRow(idx)}
                          />
                        </td>
                        <td>
                          {isError && (
                            <span className="status-badge error" title={row.error_message}>
                              ✕ Lỗi: {row.error_message}
                            </span>
                          )}
                          {isDup && (
                            <span className="status-badge duplicate" title={row.duplicate_hint}>
                              ⚠️ Nghi trùng
                            </span>
                          )}
                          {!isError && !isDup && (
                            <span className="status-badge valid">✓ Hợp lệ</span>
                          )}
                        </td>
                        <td className="mono">{row.date || row.raw_date}</td>
                        <td className={`mono font-bold ${row.type === "income" ? "income-text" : "expense-text"}`}>
                          {row.amount ? formatMoney(row.amount) : "---"}
                        </td>
                        <td>
                          <span className={`type-tag ${row.type}`}>
                            {row.type === "income" ? "Thu" : "Chi"}
                          </span>
                        </td>
                        <td className="note-cell" title={row.note}>
                          {row.note}
                          {row.matched_rule && (
                            <div className="rule-tag-sub">
                              ⚡ Khớp quy tắc: "{row.matched_rule.keyword}"
                            </div>
                          )}
                        </td>
                        <td>
                          <select
                            disabled={isError}
                            value={row.category_id || ""}
                            onChange={(e) => handleRowCategoryChange(idx, e.target.value)}
                            className="preview-cat-select"
                          >
                            <option value="">-- Chưa gán --</option>
                            {categories
                              .filter((c) => c.type === row.type)
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              <button type="button" className="button-secondary" onClick={() => setStep(1)}>
                ⬅ Đổi file khác
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={handleConfirmImport}
                disabled={loading || selectedCount === 0}
              >
                {loading ? "Đang nhập giao dịch..." : `Xác nhận nhập (${selectedCount}) giao dịch`}
              </button>
            </div>
          </div>
        )}

        {/* ==================== BƯỚC 4: KẾT QUẢ HOÀN TẤT ==================== */}
        {step === 4 && resultSummary && (
          <div className="import-step-content success-step">
            <div className="success-icon-box">✓</div>
            <h3>Nhập sao kê thành công!</h3>
            <p className="success-desc">
              Đã tạo <strong>{resultSummary.imported_count}</strong> giao dịch mới vào hệ thống.
            </p>

            <div className="result-stats-card">
              <div className="stat-item">
                <span>Tổng số dòng:</span>
                <strong>{resultSummary.total_rows}</strong>
              </div>
              <div className="stat-item success">
                <span>Đã nhập:</span>
                <strong>{resultSummary.imported_count}</strong>
              </div>
              <div className="stat-item skipped">
                <span>Đã bỏ qua / Loại trừ:</span>
                <strong>{resultSummary.skipped_count}</strong>
              </div>
            </div>

            <div className="modal-actions justify-center">
              <button
                type="button"
                className="button-primary"
                onClick={onClose}
              >
                Đóng và xem danh sách giao dịch
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

