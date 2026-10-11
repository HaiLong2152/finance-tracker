function TransactionFilters({ categories = [], accounts = [], filters, onChange, onReset }) {
  const isTransferType = filters.type === "transfer";

  return (
    <section className="filters" aria-label="Bộ lọc giao dịch">
      <div className="filter-field">
        <label htmlFor="transaction-search">Tìm kiếm</label>
        <input
          id="transaction-search"
          name="search"
          type="search"
          placeholder="Ghi chú, tên danh mục, ví..."
          value={filters.search}
          onChange={onChange}
        />
      </div>

      <div className="filter-field">
        <label htmlFor="transaction-type">Loại giao dịch</label>
        <select
          id="transaction-type"
          name="type"
          value={filters.type}
          onChange={onChange}
        >
          <option value="">Tất cả loại</option>
          <option value="expense">Chi tiêu</option>
          <option value="income">Thu nhập</option>
          <option value="transfer">Chuyển tiền</option>
        </select>
      </div>

      <div className="filter-field">
        <label htmlFor="transaction-account">Ví / Tài khoản</label>
        <select
          id="transaction-account"
          name="accountId"
          value={filters.accountId}
          onChange={onChange}
        >
          <option value="">Tất cả ví</option>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-field">
        <label htmlFor="transaction-category">Danh mục</label>
        <select
          id="transaction-category"
          name="categoryId"
          value={filters.categoryId}
          onChange={onChange}
          disabled={isTransferType}
        >
          <option value="">{isTransferType ? "(Không áp dụng)" : "Tất cả danh mục"}</option>
          {!isTransferType &&
            categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name} ({category.type === "income" ? "Thu" : "Chi"})
              </option>
            ))}
        </select>
      </div>

      <div className="filter-field">
        <label htmlFor="transaction-from">Từ ngày</label>
        <input
          id="transaction-from"
          name="from"
          type="date"
          value={filters.from}
          onChange={onChange}
        />
      </div>

      <div className="filter-field">
        <label htmlFor="transaction-to">Đến ngày</label>
        <input
          id="transaction-to"
          name="to"
          type="date"
          value={filters.to}
          onChange={onChange}
        />
      </div>

      <button
        type="button"
        className="button-secondary filter-reset"
        onClick={onReset}
      >
        Xóa bộ lọc
      </button>
    </section>
  );
}

export default TransactionFilters;
