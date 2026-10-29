/**
 * Migration 003: Tạo bảng category_rules cho quy tắc tự động phân loại
 */
module.exports = {
  version: '003_category_rules',
  name: 'Tạo bảng category_rules cho quy tắc tự động phân loại giao dịch',

  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS category_rules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        keyword VARCHAR(100) NOT NULL,
        match_type ENUM('contains', 'exact', 'starts_with', 'regex') NOT NULL DEFAULT 'contains',
        transaction_type ENUM('income', 'expense', 'any') NOT NULL DEFAULT 'expense',
        account_id INT NULL,
        category_id INT NOT NULL,
        priority INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_category_rules_active_priority (is_active, priority DESC),
        CONSTRAINT fk_category_rules_account
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        CONSTRAINT fk_category_rules_category
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  },

  down: async (db) => {
    await db.query('DROP TABLE IF EXISTS category_rules');
  }
};

