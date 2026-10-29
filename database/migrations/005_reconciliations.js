/**
 * Migration 005: Tạo bảng reconciliations và danh mục hệ thống Điều chỉnh số dư
 */
module.exports = {
  version: '005_reconciliations',
  name: 'Tạo bảng reconciliations và danh mục hệ thống Điều chỉnh số dư',

  up: async (db) => {
    // 1. Tạo bảng reconciliations
    await db.query(`
      CREATE TABLE IF NOT EXISTS reconciliations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        account_id INT NOT NULL,
        reconciliation_date DATE NOT NULL,
        expected_balance BIGINT NOT NULL,
        actual_balance BIGINT NOT NULL,
        difference BIGINT NOT NULL,
        transaction_id INT NULL,
        note TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_reconciliations_account (account_id),
        KEY idx_reconciliations_date (reconciliation_date),
        CONSTRAINT fk_reconciliations_account
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
        CONSTRAINT fk_reconciliations_transaction
          FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Tạo danh mục hệ thống "Điều chỉnh số dư" cho Thu và Chi nếu chưa có
    await db.query(`
      INSERT IGNORE INTO categories (name, type) 
      VALUES ('Điều chỉnh số dư', 'income'), ('Điều chỉnh số dư', 'expense');
    `);
  },

  down: async (db) => {
    await db.query('DROP TABLE IF EXISTS reconciliations');
  }
};

