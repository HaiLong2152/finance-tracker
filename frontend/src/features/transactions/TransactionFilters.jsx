function TransactionFilters({ categories, filters, onChange, onReset }) {
  return (
    <section className="filters" aria-label="Bộ lọc giao dịch">
      <div className="filter-field">
        <label htmlFor="transaction-search">Tìm ghi chú</label>
        <input id="transaction-search" name="search" type="search" placeholder="Nhập từ khóa" value={filters.search} onChange={onChange} />
      </div>
      <div className="filter-field">
        <label htmlFor="transaction-type">Loại</label>
        <select id="transaction-type" name="type" value={filters.type} onChange={onChange}>
          <option value="">Tất cả</option>
          <option value="income">Thu</option>
          <option value="expense">Chi</option>
        </select>
      </div>
      <div className="filter-field">
        <label htmlFor="transaction-category">Danh mục</label>
        <select id="transaction-category" name="categoryId" value={filters.categoryId} onChange={onChange}>
          <option value="">Tất cả</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </div>
      <div className="filter-field">
        <label htmlFor="transaction-from">Từ ngày</label>
        <input id="transaction-from" name="from" type="date" value={filters.from} onChange={onChange} />
      </div>
      <div className="filter-field">
        <label htmlFor="transaction-to">Đến ngày</label>
        <input id="transaction-to" name="to" type="date" value={filters.to} onChange={onChange} />
      </div>
      <button type="button" className="button-secondary filter-reset" onClick={onReset}>Xóa bộ lọc</button>
    </section>
  );
}

export default TransactionFilters;
