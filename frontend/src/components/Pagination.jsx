function Pagination({ currentPage, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label="Phân trang giao dịch">
      <button type="button" className="button-secondary" disabled={currentPage === 1} onClick={() => onChange(currentPage - 1)}>Trước</button>
      <span>Trang {currentPage} / {totalPages}</span>
      <button type="button" className="button-secondary" disabled={currentPage === totalPages} onClick={() => onChange(currentPage + 1)}>Sau</button>
    </nav>
  );
}

export default Pagination;
