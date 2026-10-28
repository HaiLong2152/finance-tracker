const db = require('../backend/config/db.js');

async function migrate() {
  console.log('--- Đang thực hiện Migration CSDL cho Giai đoạn 1 ---');

  // 1. Tạo bảng accounts (nếu chưa có)
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
  console.log('✓ Bảng accounts đã sẵn sàng (không chứa dữ liệu giả định).');

  // 2. Kiểm tra và bổ sung các cột mới vào transactions (nếu chưa có)
  const [cols] = await db.query('DESCRIBE transactions');
  const colNames = cols.map(c => c.Field);

  if (!colNames.includes('type')) {
    await db.query(`ALTER TABLE transactions ADD COLUMN type ENUM('income', 'expense', 'transfer') NOT NULL DEFAULT 'expense' AFTER amount`);
    console.log('✓ Đã thêm cột type vào transactions.');
  }

  if (!colNames.includes('account_id')) {
    await db.query(`ALTER TABLE transactions ADD COLUMN account_id INT NULL AFTER type`);
    console.log('✓ Đã thêm cột account_id vào transactions.');
  }

  if (!colNames.includes('transfer_account_id')) {
    await db.query(`ALTER TABLE transactions ADD COLUMN transfer_account_id INT NULL AFTER account_id`);
    console.log('✓ Đã thêm cột transfer_account_id vào transactions.');
  }

  // 3. Xử lý gán ví cho các giao dịch cũ đang thiếu account_id (nếu có)
  const [[unassigned]] = await db.query('SELECT COUNT(*) as count FROM transactions WHERE account_id IS NULL');
  if (unassigned.count > 0) {
    console.log(`Tìm thấy ${unassigned.count} giao dịch cũ chưa có account_id. Bắt đầu gán ví...`);

    // Tìm ngày giao dịch sớm nhất trong số các giao dịch chưa có ví
    const [[earliestRow]] = await db.query(
      'SELECT MIN(transaction_date) as earliest_date FROM transactions WHERE account_id IS NULL'
    );
    const getVietnamDateStr = (dateObj = new Date()) => {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(dateObj);
    };
    const earliestTxDate = earliestRow?.earliest_date
      ? getVietnamDateStr(new Date(earliestRow.earliest_date))
      : getVietnamDateStr();

    // Ưu tiên tìm ví tiền mặt (cash) đang hoạt động, nếu không có thì lấy ví đang hoạt động đầu tiên
    const [cashAccounts] = await db.query(
      "SELECT id, start_date FROM accounts WHERE type = 'cash' AND is_archived = 0 ORDER BY sort_order ASC, id ASC LIMIT 1"
    );
    let targetAccount = cashAccounts[0];

    if (!targetAccount) {
      const [activeAccounts] = await db.query(
        "SELECT id, start_date FROM accounts WHERE is_archived = 0 ORDER BY sort_order ASC, id ASC LIMIT 1"
      );
      targetAccount = activeAccounts[0];
    }

    let fallbackAccountId;
    if (targetAccount) {
      fallbackAccountId = targetAccount.id;
      // Đảm bảo start_date của ví bao quát được giao dịch cũ nhất (start_date <= earliestTxDate)
      await db.query(
        'UPDATE accounts SET start_date = LEAST(start_date, ?) WHERE id = ?',
        [earliestTxDate, fallbackAccountId]
      );
      console.log(`✓ Đã chọn ví ID ${fallbackAccountId} và điều chỉnh start_date <= ${earliestTxDate}.`);
    } else {
      // Nếu chưa có ví nào trong CSDL, tạo ví 'Tiền mặt' với start_date bằng đúng ngày giao dịch sớm nhất
      const [newAcc] = await db.query(`
        INSERT INTO accounts (name, type, initial_balance, start_date, identifier_hint)
        VALUES ('Tiền mặt', 'cash', 0, ?, 'Ví tiền mặt tạo tự động cho giao dịch lịch sử')
      `, [earliestTxDate]);
      fallbackAccountId = newAcc.insertId;
      console.log(`✓ Đã tạo ví 'Tiền mặt' với start_date = ${earliestTxDate} (ID: ${fallbackAccountId}).`);
    }

    // Gán các giao dịch cũ vào fallbackAccountId
    await db.query(`
      UPDATE transactions t 
      LEFT JOIN categories c ON t.category_id = c.id 
      SET 
        t.account_id = ?,
        t.type = CASE 
          WHEN c.type IS NOT NULL THEN c.type 
          ELSE t.type 
        END
      WHERE t.account_id IS NULL;
    `, [fallbackAccountId]);
    console.log(`✓ Đã liên kết ${unassigned.count} giao dịch cũ vào ví ID ${fallbackAccountId}.`);
  }

  // 4. Cho phép category_id NULL (dành cho transfer) và đặt account_id NOT NULL
  await db.query(`ALTER TABLE transactions MODIFY category_id INT NULL`);
  await db.query(`ALTER TABLE transactions MODIFY account_id INT NOT NULL`);

  // 5. Thêm foreign keys nếu chưa có
  const [fks] = await db.query(`
    SELECT CONSTRAINT_NAME 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  `);
  const fkNames = fks.map(f => f.CONSTRAINT_NAME);

  if (!fkNames.includes('fk_transactions_account')) {
    await db.query(`
      ALTER TABLE transactions 
      ADD CONSTRAINT fk_transactions_account 
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
    `);
    console.log('✓ Đã thêm foreign key fk_transactions_account.');
  }

  if (!fkNames.includes('fk_transactions_transfer_account')) {
    await db.query(`
      ALTER TABLE transactions 
      ADD CONSTRAINT fk_transactions_transfer_account 
      FOREIGN KEY (transfer_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
    `);
    console.log('✓ Đã thêm foreign key fk_transactions_transfer_account.');
  }

  // 6. Thêm CHECK constraints nếu chưa có
  const [checks] = await db.query(`
    SELECT CONSTRAINT_NAME 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND CONSTRAINT_TYPE = 'CHECK'
  `);
  const checkNames = checks.map(c => c.CONSTRAINT_NAME);

  if (!checkNames.includes('chk_transactions_amount')) {
    await db.query(`
      ALTER TABLE transactions 
      ADD CONSTRAINT chk_transactions_amount 
      CHECK (amount > 0)
    `);
    console.log('✓ Đã thêm CHECK constraint chk_transactions_amount.');
  }

  if (!checkNames.includes('chk_transactions_transfer_rules')) {
    await db.query(`
      ALTER TABLE transactions 
      ADD CONSTRAINT chk_transactions_transfer_rules 
      CHECK (
        (type = 'transfer' AND transfer_account_id IS NOT NULL AND transfer_account_id <> account_id AND category_id IS NULL)
        OR
        (type IN ('income', 'expense') AND transfer_account_id IS NULL AND category_id IS NOT NULL)
      )
    `);
    console.log('✓ Đã thêm CHECK constraint chk_transactions_transfer_rules.');
  }

  // 7. Tạo bảng budgets (Ngân sách theo danh mục & tháng)
  await db.query(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category_id INT NOT NULL,
      month VARCHAR(7) NOT NULL,
      limit_amount BIGINT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_budgets_category_month (category_id, month),
      KEY idx_budgets_month (month),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
      CONSTRAINT chk_budgets_amount CHECK (limit_amount > 0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Đảm bảo foreign key fk_budgets_category là ON DELETE RESTRICT nếu trước đó đã tạo với ON DELETE CASCADE
  const [budgetFks] = await db.query(`
    SELECT CONSTRAINT_NAME, DELETE_RULE 
    FROM information_schema.REFERENTIAL_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'budgets' AND CONSTRAINT_NAME = 'fk_budgets_category'
  `);
  if (budgetFks.length > 0 && budgetFks[0].DELETE_RULE !== 'RESTRICT') {
    await db.query(`ALTER TABLE budgets DROP FOREIGN KEY fk_budgets_category`);
    await db.query(`ALTER TABLE budgets ADD CONSTRAINT fk_budgets_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT`);
    console.log('✓ Đã cập nhật foreign key fk_budgets_category sang ON DELETE RESTRICT.');
  }

  console.log('✓ Bảng budgets đã sẵn sàng.');

  // 8. Tạo hoặc nâng cấp bảng ingest_events (Nhận thông báo tự động & Hộp chờ duyệt Inbox - SPEC 4.1)
  await db.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Kiểm tra và bổ sung các cột cho bảng ingest_events nếu đã tạo từ phiên bản trước
  const [ingestCols] = await db.query('DESCRIBE ingest_events');
  const ingestColNames = ingestCols.map(c => c.Field);

  if (!ingestColNames.includes('raw_payload')) {
    await db.query('ALTER TABLE ingest_events ADD COLUMN raw_payload JSON NULL AFTER text');
    console.log('✓ Đã thêm cột raw_payload vào bảng ingest_events.');
  }

  if (!ingestColNames.includes('error_message')) {
    await db.query('ALTER TABLE ingest_events ADD COLUMN error_message TEXT NULL AFTER parsed_json');
    console.log('✓ Đã thêm cột error_message vào bảng ingest_events.');
  }

  // Cập nhật enum status để hỗ trợ approved và failed theo SPEC 4.1
  await db.query(`
    ALTER TABLE ingest_events 
    MODIFY COLUMN status ENUM('pending', 'approved', 'processed', 'ignored', 'failed', 'unparsed', 'duplicate', 'error') NOT NULL DEFAULT 'pending'
  `);

  console.log('✓ Bảng ingest_events (Inbox & Dữ liệu nguồn - SPEC 4.1) đã sẵn sàng.');

  // 9. Tạo bảng category_rules (Quy tắc tự gán danh mục - SPEC 4.4)
  await db.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ Bảng category_rules (Quy tắc tự gán danh mục - SPEC 4.4) đã sẵn sàng.');

  // 10. Tạo bảng import_batches và liên kết vào transactions (SPEC 4.5)
  await db.query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const [txCols] = await db.query('DESCRIBE transactions');
  const txColNames = txCols.map(c => c.Field);

  if (!txColNames.includes('import_batch_id')) {
    await db.query(`ALTER TABLE transactions ADD COLUMN import_batch_id INT NULL AFTER category_id`);
    console.log('✓ Đã thêm cột import_batch_id vào bảng transactions.');
  }

  if (!txColNames.includes('import_row_hash')) {
    await db.query(`ALTER TABLE transactions ADD COLUMN import_row_hash VARCHAR(64) NULL AFTER import_batch_id`);
    console.log('✓ Đã thêm cột import_row_hash vào bảng transactions.');
  }

  const [txFks] = await db.query(`
    SELECT CONSTRAINT_NAME 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  `);
  const txFkNames = txFks.map(f => f.CONSTRAINT_NAME);

  if (!txFkNames.includes('fk_transactions_import_batch')) {
    await db.query(`
      ALTER TABLE transactions 
      ADD CONSTRAINT fk_transactions_import_batch 
      FOREIGN KEY (import_batch_id) REFERENCES import_batches(id) ON DELETE SET NULL
    `);
    console.log('✓ Đã thêm foreign key fk_transactions_import_batch.');
  }

  const [txIndexes] = await db.query(`
    SELECT INDEX_NAME 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions'
  `);
  const txIndexNames = txIndexes.map(i => i.INDEX_NAME);

  if (!txIndexNames.includes('idx_transactions_import_hash')) {
    await db.query(`ALTER TABLE transactions ADD INDEX idx_transactions_import_hash (import_row_hash)`);
    console.log('✓ Đã thêm index idx_transactions_import_hash vào bảng transactions.');
  }

  console.log('✓ Bảng import_batches và liên kết giao dịch (SPEC 4.5) đã sẵn sàng.');

  // 11. Tạo bảng reconciliations và khởi tạo danh mục điều chỉnh (SPEC 4.6)
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

  // Tạo danh mục hệ thống "Điều chỉnh số dư" cho Thu và Chi nếu chưa có
  await db.query(`
    INSERT IGNORE INTO categories (name, type) 
    VALUES ('Điều chỉnh số dư', 'income'), ('Điều chỉnh số dư', 'expense');
  `);
  console.log('✓ Bảng reconciliations và danh mục điều chỉnh số dư (SPEC 4.6) đã sẵn sàng.');

  console.log('=== Migration hoàn tất thành công 100%! ===');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration thất bại:', err);
  process.exit(1);
});
