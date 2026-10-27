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

-- Bảng quản lý đợt nhập sao kê (Import Batches - SPEC 4.5)
CREATE TABLE IF NOT EXISTS import_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  file_hash VARCHAR(64) NOT NULL,
  account_id INT NOT NULL,
  total_rows INT NOT NULL DEFAULT 0,
  imported_rows INT NOT NULL DEFAULT 0,
  skipped_rows INT NOT NULL DEFAULT 0,
  status ENUM('preview', 'completed', 'failed') NOT NULL DEFAULT 'completed',
  error_log JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_import_batches_hash (file_hash),
  KEY idx_import_batches_account (account_id),
  CONSTRAINT fk_import_batches_account
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
);

-- Bảng giao dịch
CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  amount BIGINT NOT NULL,
  type ENUM('income', 'expense', 'transfer') NOT NULL DEFAULT 'expense',
  account_id INT NOT NULL,
  transfer_account_id INT NULL,
  category_id INT NULL,
  import_batch_id INT NULL,
  import_row_hash VARCHAR(64) NULL,
  transaction_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_transactions_account
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CONSTRAINT fk_transactions_transfer_account
    FOREIGN KEY (transfer_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  CONSTRAINT fk_transactions_category
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT fk_transactions_import_batch
    FOREIGN KEY (import_batch_id) REFERENCES import_batches(id) ON DELETE SET NULL,
  CONSTRAINT chk_transactions_amount
    CHECK (amount > 0),
  CONSTRAINT chk_transactions_transfer_rules
    CHECK (
      (type = 'transfer' AND transfer_account_id IS NOT NULL AND transfer_account_id <> account_id AND category_id IS NULL)
      OR
      (type IN ('income', 'expense') AND transfer_account_id IS NULL AND category_id IS NOT NULL)
    ),
  INDEX idx_transactions_date (transaction_date),
  INDEX idx_transactions_import_hash (import_row_hash)
);

-- Bảng ngân sách theo danh mục & tháng
CREATE TABLE IF NOT EXISTS budgets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  month VARCHAR(7) NOT NULL,
  limit_amount BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_budgets_category_month (category_id, month),
  KEY idx_budgets_month (month),
  CONSTRAINT fk_budgets_category
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT chk_budgets_amount
    CHECK (limit_amount > 0)
);

-- Bảng nhận thông báo tự động (Inbox & Ingest Events - SPEC 4.1 & SPEC 7 & 9)
CREATE TABLE IF NOT EXISTS ingest_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  package VARCHAR(255) NOT NULL,
  title VARCHAR(500) NULL,
  text TEXT NOT NULL,
  raw_payload JSON NULL,
  posted_at BIGINT NULL,
  device_id VARCHAR(100) NULL,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  idempotency_key VARCHAR(64) NOT NULL,
  status ENUM('pending', 'approved', 'processed', 'ignored', 'failed', 'unparsed', 'duplicate', 'error') NOT NULL DEFAULT 'pending',
  parser_name VARCHAR(100) NULL,
  parsed_json JSON NULL,
  error_message TEXT NULL,
  transaction_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ingest_idempotency (idempotency_key),
  KEY idx_ingest_status (status),
  KEY idx_ingest_received_at (received_at),
  KEY idx_ingest_package (package),
  CONSTRAINT fk_ingest_events_transaction
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);

-- Bảng quy tắc tự gán danh mục (Category Rules - SPEC 4.4)
CREATE TABLE IF NOT EXISTS category_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  keyword VARCHAR(100) NOT NULL,
  match_type ENUM('contains', 'exact') NOT NULL DEFAULT 'contains',
  transaction_type ENUM('income', 'expense') NOT NULL DEFAULT 'expense',
  account_id INT NULL,
  category_id INT NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_rules_priority (priority DESC),
  KEY idx_rules_active (is_active),
  CONSTRAINT fk_rules_category
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT fk_rules_account
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);


