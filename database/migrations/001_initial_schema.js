/**
 * Migration 001: Khởi tạo các bảng cốt lõi (accounts, categories, transactions, budgets)
 */
module.exports = {
  version: '001_initial_schema',
  name: 'Khởi tạo các bảng accounts, categories, transactions, budgets',

  up: async (db) => {
    // 1. Bảng accounts
    await db.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type ENUM('cash', 'bank', 'ewallet', 'other') NOT NULL DEFAULT 'cash',
        initial_balance BIGINT NOT NULL DEFAULT 0,
        start_date DATE NOT NULL DEFAULT (CURRENT_DATE),
        identifier_hint VARCHAR(100) NULL,
        is_archived TINYINT(1) NOT NULL DEFAULT 0,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_accounts_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Bảng categories
    await db.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type ENUM('income', 'expense') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_categories_name_type (name, type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Bảng transactions
    await db.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        amount BIGINT NOT NULL,
        type ENUM('income', 'expense', 'transfer') NOT NULL DEFAULT 'expense',
        account_id INT NOT NULL,
        transfer_account_id INT NULL,
        category_id INT NULL,
        transaction_date DATE NOT NULL,
        note VARCHAR(500) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_transactions_date (transaction_date),
        KEY idx_transactions_account (account_id),
        KEY idx_transactions_transfer_account (transfer_account_id),
        KEY idx_transactions_category (category_id),
        CONSTRAINT fk_transactions_account
          FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE RESTRICT,
        CONSTRAINT fk_transactions_transfer_account
          FOREIGN KEY (transfer_account_id) REFERENCES accounts (id) ON DELETE RESTRICT,
        CONSTRAINT fk_transactions_category
          FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Bảng budgets
    await db.query(`
      CREATE TABLE IF NOT EXISTS budgets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category_id INT NOT NULL,
        month VARCHAR(7) NOT NULL,
        amount BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_budgets_category_month (category_id, month),
        CONSTRAINT fk_budgets_category
          FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  },

  down: async (db) => {
    await db.query('DROP TABLE IF EXISTS budgets');
    await db.query('DROP TABLE IF EXISTS transactions');
    await db.query('DROP TABLE IF EXISTS categories');
    await db.query('DROP TABLE IF EXISTS accounts');
  }
};

