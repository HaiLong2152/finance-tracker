CREATE DATABASE IF NOT EXISTS finance_tracker
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE finance_tracker;

-- Bảng tài khoản / ví
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
);

-- Bảng danh mục
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type ENUM('income', 'expense') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_categories_name_type (name, type)
);

-- Bảng giao dịch
CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  amount BIGINT NOT NULL,
  type ENUM('income', 'expense', 'transfer') NOT NULL DEFAULT 'expense',
  account_id INT NOT NULL,
  transfer_account_id INT NULL,
  category_id INT NULL,
  transaction_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_transactions_account
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CONSTRAINT fk_transactions_transfer_account
    FOREIGN KEY (transfer_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CONSTRAINT fk_transactions_category
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);
