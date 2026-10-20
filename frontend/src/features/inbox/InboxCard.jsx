import { useState } from "react";
import { formatDateTime, formatMoney } from "../../utils/formatters";

// Map package name sang tên ứng dụng thân thiện
const getAppDisplayName = (pkg) => {
  if (!pkg) return "Thông báo hệ thống";
  const p = pkg.toLowerCase();
  if (p.includes("vietcombank") || p.includes("vcb")) return "Vietcombank";
  if (p.includes("mbmobile") || p.includes("mbbank")) return "MB Bank";
  if (p.includes("techcombank")) return "Techcombank";
  if (p.includes("bidv")) return "BIDV";
  if (p.includes("momopay") || p.includes("mservice")) return "Ví MoMo";
  if (p.includes("vnpay")) return "Ví VNPay";
  if (p.includes("zalopay")) return "ZaloPay";
  if (p.includes("tpbank")) return "TPBank";
  if (p.includes("acb")) return "ACB";
  if (p.includes("vpbank")) return "VPBank";
  if (p.includes("vib")) return "VIB";
  return pkg;
};

const getStatusBadge = (status) => {
  switch (status) {
    case "pending":
      return <span className="inbox-status-pill pending">⏳ Chờ duyệt</span>;
    case "unparsed":
      return <span className="inbox-status-pill unparsed">❓ Chưa đọc được</span>;
    case "approved":
    case "processed":
      return <span className="inbox-status-pill processed">✓ Đã duyệt</span>;
    case "failed":
    case "error":
      return <span className="inbox-status-pill failed">⚠️ Thất bại</span>;
    case "ignored":
      return <span className="inbox-status-pill ignored">✕ Đã bỏ qua</span>;
    default:
      return <span className="inbox-status-pill">{status}</span>;
  }
};

export default function InboxCard({
  item,
  onOpenConvert,
  onIgnore,
  onReparse,
  isResolving,
}) {
  const [showDetails, setShowDetails] = useState(false);

  const parsed = typeof item.parsed_json === "string"
    ? (() => {
        try {
          return JSON.parse(item.parsed_json);
        } catch {
          return null;
        }
      })()
    : item.parsed_json;

  const appName = getAppDisplayName(item.package);
  const timeFormatted = formatDateTime(item.posted_at || item.received_at);

  return (
    <article className={`inbox-card inbox-card-${item.status}`}>
      {/* Card Header: Tên App, Thời gian, Trạng thái */}
      <div className="inbox-card-header">
        <div className="inbox-source-info">
          <div className="inbox-app-icon">
            {appName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="inbox-app-title">
              <strong>{appName}</strong>
              <span className="inbox-package-sub">{item.package}</span>
            </div>
            <div className="inbox-time-str">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>{timeFormatted}</span>
            </div>
          </div>
        </div>

        <div className="inbox-header-badge">
          {getStatusBadge(item.status)}
        </div>
      </div>

      {/* Card Body: Khung hiển thị nội dung tin gốc */}
      <div className="inbox-raw-container">
        <div className="inbox-raw-label">
          <span>NỘI DUNG TIN GỐC</span>
          {item.device_id && <span className="inbox-device-tag">Thiết bị: {item.device_id}</span>}
        </div>
        <div className="inbox-raw-quote">
          {item.title && <div className="raw-title-row">{item.title}</div>}
          <div className="raw-text-row">{item.text}</div>
        </div>
      </div>

      {/* Gợi ý sơ bộ từ Parser */}
      {parsed?.detected_amount && (
        <div className="inbox-preview-banner">
          <span className="preview-label">Gợi ý phát hiện:</span>
          <span className={`preview-amount ${parsed.detected_type}`}>
            {parsed.detected_type === "income" ? "+" : "-"}
            {formatMoney(parsed.detected_amount)}
          </span>
          <span className="preview-type-text">
            ({parsed.detected_type === "income" ? "Thu tiền vào" : "Chi tiền ra"})
          </span>
        </div>
      )}

      {/* Cảnh báo lý do lỗi nếu parser hoặc phân tích gặp lỗi (SPEC 4.1) */}
      {item.error_message && (
        <div className="inbox-error-banner">
          <span className="error-icon">⚠️</span>
          <span><strong>Lý do lỗi:</strong> {item.error_message}</span>
        </div>
      )}

      {/* Thông tin giao dịch đã liên kết */}
      {(item.status === "processed" || item.status === "approved") && item.transaction_id && (
        <div className="inbox-linked-tx-info">
          <span>Liên kết giao dịch: <strong>#{item.transaction_id}</strong></span>
          {item.transaction_amount && (
            <span> | Số tiền: <strong>{formatMoney(item.transaction_amount)}</strong></span>
          )}
        </div>
      )}

      {/* Chi tiết kỹ thuật & Idempotency Key toggle */}
      <div className="inbox-card-meta">
        <button
          type="button"
          className="meta-toggle-btn"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? "Ẩn chi tiết kỹ thuật ▴" : "Xem chi tiết kỹ thuật (Idempotency, Payload) ▾"}
        </button>

        {showDetails && (
          <div className="inbox-meta-content">
            <div className="meta-row">
              <span className="meta-key">Idempotency Key:</span>
              <code className="meta-val">{item.idempotency_key}</code>
            </div>
            <div className="meta-row">
              <span className="meta-key">Thời điểm nhận máy chủ:</span>
              <span className="meta-val">{formatDateTime(item.received_at)}</span>
            </div>
            {item.parser_name && (
              <div className="meta-row">
                <span className="meta-key">Parser:</span>
                <span className="meta-val">{item.parser_name}</span>
              </div>
            )}
            {item.raw_payload && (
              <div className="meta-row">
                <span className="meta-key">Raw Payload:</span>
                <code className="meta-val">
                  {typeof item.raw_payload === 'object' ? JSON.stringify(item.raw_payload) : String(item.raw_payload)}
                </code>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card Actions */}
      <div className="inbox-card-actions">
        {item.status !== "processed" && item.status !== "approved" ? (
          <>
            <button
              type="button"
              className="button-primary inbox-create-tx-btn"
              onClick={() => onOpenConvert(item)}
              disabled={isResolving}
            >
              <span>+</span> Tạo giao dịch
            </button>

            {(item.status === "unparsed" || item.status === "failed" || item.status === "error") && onReparse && (
              <button
                type="button"
                className="button-secondary inbox-reparse-btn"
                onClick={() => onReparse(item.id)}
                disabled={isResolving}
                title="Phân tích lại nội dung từ dữ liệu gốc"
              >
                🔄 Thử đọc lại
              </button>
            )}

            {item.status !== "ignored" && (
              <button
                type="button"
                className="button-secondary inbox-ignore-btn"
                onClick={() => onIgnore(item.id)}
                disabled={isResolving}
              >
                Bỏ qua
              </button>
            )}
          </>
        ) : (
          <div className="inbox-processed-label">
            ✓ Đã duyệt và lưu thành công vào lịch sử giao dịch
          </div>
        )}
      </div>
    </article>
  );
}

