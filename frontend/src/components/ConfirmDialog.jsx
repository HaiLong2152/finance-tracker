export default function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="dialog-overlay">
      <div className="dialog-content" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <h3 id="dialog-title">{title}</h3>
        <p>{message}</p>
        <div className="dialog-actions">
          <button className="button-secondary" onClick={onCancel}>Hủy</button>
          <button className="button-danger" onClick={onConfirm}>Xác nhận</button>
        </div>
      </div>
    </div>
  );
}

