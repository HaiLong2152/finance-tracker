/**
 * Migration 004: Tạo bảng import_batches và cột import_batch_id, import_row_hash trên transactions
 */
module.exports = {
  version: '004_csv_import_batches',
  name: 'Tạo bảng import_batches và hỗ trợ nhập CSV sao kê',

  up: async (db) => {
    // 1. Bảng import_batches
    await db.query(`
      CREATE TABLE IF NOT EXISTS import_batches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        account_id INT NOT NULL,
        total_rows INT NOT NULL DEFAULT 0,
        imported_count INT NOT NULL DEFAULT 0,
        skipped_count INT NOT NULL DEFAULT 0,
        error_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_import_batches_account (account_id),
        CONSTRAINT fk_import_batches_account
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Kiểm tra cột trên bảng transactions
    const [cols] = await db.query('DESCRIBE transactions');
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('import_batch_id')) {
      await db.query(`ALTER TABLE transactions ADD COLUMN import_batch_id INT NULL AFTER note`);
    }

    if (!colNames.includes('import_row_hash')) {
      await db.query(`ALTER TABLE transactions ADD COLUMN import_row_hash VARCHAR(64) NULL AFTER import_batch_id`);
    }

    // 3. Kiểm tra foreign key fk_transactions_import_batch
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
    }

    // 4. Index import_row_hash
    const [txIndexes] = await db.query(`
      SELECT INDEX_NAME 
      FROM information_schema.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions'
    `);
    const txIndexNames = txIndexes.map(i => i.INDEX_NAME);

    if (!txIndexNames.includes('idx_transactions_import_hash')) {
      await db.query(`ALTER TABLE transactions ADD INDEX idx_transactions_import_hash (import_row_hash)`);
    }
  },

  down: async (db) => {
    // Xóa FK và index nếu có
    try {
      await db.query('ALTER TABLE transactions DROP FOREIGN KEY fk_transactions_import_batch');
    } catch {
      // Ignored if already dropped
    }
    try {
      await db.query('ALTER TABLE transactions DROP INDEX idx_transactions_import_hash');
    } catch {
      // Ignored if already dropped
    }
    await db.query('DROP TABLE IF EXISTS import_batches');
  }
};

