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

  console.log('=== Migration hoàn tất thành công 100%! ===');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration thất bại:', err);
  process.exit(1);
});
