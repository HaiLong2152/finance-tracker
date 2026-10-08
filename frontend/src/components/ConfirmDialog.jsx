import { useEffect } from "react";

export default function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay">
      <div className="dialog-content" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-desc">
        <h3 id="dialog-title">{title}</h3>
        <p id="dialog-desc">{message}</p>
        <div className="dialog-actions">
          <button className="button-secondary" onClick={onCancel}>Hủy</button>
          <button className="button-danger" onClick={onConfirm}>Xác nhận</button>
        </div>
      </div>
    </div>
  );
}
