const db = require('../backend/config/db.js');

async function migrate() {
  console.log('--- Đang thực hiện Migration CSDL cho Giai đoạn 1 ---');

  // 1. Tạo bảng accounts
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
  console.log('✓ Bảng accounts đã sẵn sàng.');

  // 2. Chèn ví mẫu nếu chưa có
  await db.query(`
    INSERT IGNORE INTO accounts (id, name, type, initial_balance, identifier_hint) VALUES
    (1, 'Tiền mặt', 'cash', 500000, 'Tiền mặt trong ví'),
    (2, 'Tài khoản Ngân hàng (MB Bank)', 'bank', 5000000, 'MBBank - 9999'),
    (3, 'Ví điện tử (MoMo)', 'ewallet', 200000, 'MoMo');
  `);
  console.log('✓ Dữ liệu ví mẫu đã được khởi tạo.');

  // 3. Kiểm tra các cột trong transactions
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

  // 4. Đồng bộ dữ liệu cũ
  await db.query(`
    UPDATE transactions t 
    LEFT JOIN categories c ON t.category_id = c.id 
    SET 
      t.account_id = COALESCE(t.account_id, 1),
      t.type = CASE 
        WHEN c.type IS NOT NULL THEN c.type 
        ELSE t.type 
      END
    WHERE t.account_id IS NULL OR t.type IS NULL;
  `);
  console.log('✓ Dữ liệu giao dịch cũ đã được gán ví mặc định và loại giao dịch.');

  // Cho phép category_id NULL (dành cho transfer) và đặt account_id NOT NULL
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

  console.log('=== Migration hoàn tất thành công 100%! ===');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration thất bại:', err);
  process.exit(1);
});

