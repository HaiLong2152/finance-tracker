const path = require('path');
const fs = require('fs');
const db = require('../backend/config/db.js');
const logger = require('../backend/utils/logger.js');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Đảm bảo bảng schema_migrations tồn tại
 */
const ensureMigrationsTable = async (connection) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      version VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      batch INT NOT NULL DEFAULT 1,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await connection.query(sql);
};

/**
 * Tự động ghi nhận các migration đã có từ trước (Bootstrap Idempotency)
 * Giúp tương thích ngược hoàn hảo với các database đã được khởi tạo trong các bước trước
 */
const bootstrapExistingSchema = async (connection) => {
  const [rows] = await connection.query('SELECT COUNT(*) AS count FROM schema_migrations');
  if (rows[0].count > 0) return; // Đã có lịch sử migration, không cần bootstrap

  const [tables] = await connection.query('SHOW TABLES');
  const tableNames = tables.map(t => Object.values(t)[0].toLowerCase());

  const bootstrapList = [];
  if (tableNames.includes('accounts') && tableNames.includes('transactions')) {
    bootstrapList.push({ version: '001_initial_schema', name: 'Khởi tạo các bảng accounts, categories, transactions, budgets' });
  }
  if (tableNames.includes('ingest_events')) {
    bootstrapList.push({ version: '002_ingest_events', name: 'Tạo bảng ingest_events và idempotency cho Ingest API' });
  }
  if (tableNames.includes('category_rules')) {
    bootstrapList.push({ version: '003_category_rules', name: 'Tạo bảng category_rules cho quy tắc tự động phân loại giao dịch' });
  }
  if (tableNames.includes('import_batches')) {
    bootstrapList.push({ version: '004_csv_import_batches', name: 'Tạo bảng import_batches và hỗ trợ nhập CSV sao kê' });
  }
  if (tableNames.includes('reconciliations')) {
    bootstrapList.push({ version: '005_reconciliations', name: 'Tạo bảng reconciliations và danh mục hệ thống Điều chỉnh số dư' });
  }

  if (bootstrapList.length > 0) {
    logger.info(`Tự động ghi nhận ${bootstrapList.length} migrations đã hiện diện vào schema_migrations...`, null, 'MIGRATE');
    for (const item of bootstrapList) {
      await connection.query(
        'INSERT IGNORE INTO schema_migrations (version, name, batch) VALUES (?, ?, 1)',
        [item.version, item.name]
      );
    }
  }
};

/**
 * Đọc tất cả các file migration từ thư mục migrations/
 */
const loadAllMigrations = () => {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.js'))
    .sort();

  return files.map(file => {
    const fullPath = path.join(MIGRATIONS_DIR, file);
    const migration = require(fullPath);
    return {
      file,
      version: migration.version || file.replace('.js', ''),
      name: migration.name || file,
      up: migration.up,
      down: migration.down
    };
  });
};

/**
 * Kiểm tra trạng thái hiện tại của các migrations
 */
const getMigrationStatus = async () => {
  const connection = await db.getConnection();
  try {
    await ensureMigrationsTable(connection);
    await bootstrapExistingSchema(connection);

    const [appliedRows] = await connection.query('SELECT * FROM schema_migrations ORDER BY id ASC');
    const appliedMap = new Map(appliedRows.map(r => [r.version, r]));

    const allMigrations = loadAllMigrations();
    return allMigrations.map(m => {
      const applied = appliedMap.get(m.version);
      return {
        version: m.version,
        name: m.name,
        file: m.file,
        isApplied: Boolean(applied),
        appliedAt: applied ? applied.applied_at : null,
        batch: applied ? applied.batch : null
      };
    });
  } finally {
    connection.release();
  }
};

/**
 * Chạy các migration còn thiếu
 */
const runMigrations = async () => {
  const connection = await db.getConnection();
  try {
    await ensureMigrationsTable(connection);
    await bootstrapExistingSchema(connection);

    const [appliedRows] = await connection.query('SELECT version FROM schema_migrations');
    const appliedVersions = new Set(appliedRows.map(r => r.version));

    const [[{ maxBatch }]] = await connection.query('SELECT COALESCE(MAX(batch), 0) AS maxBatch FROM schema_migrations');
    const nextBatch = Number(maxBatch) + 1;

    const allMigrations = loadAllMigrations();
    const pendingMigrations = allMigrations.filter(m => !appliedVersions.has(m.version));

    if (pendingMigrations.length === 0) {
      logger.info('Không có migration nào cần chạy. Cơ sở dữ liệu đã ở phiên bản mới nhất.', null, 'MIGRATE');
      return { appliedCount: 0, pendingMigrations: [] };
    }

    logger.info(`Bắt đầu chạy ${pendingMigrations.length} migration(s) mới (Batch ${nextBatch})...`, null, 'MIGRATE');

    for (const m of pendingMigrations) {
      logger.info(` Đang chạy migration: ${m.version} - ${m.name}...`, null, 'MIGRATE');
      await connection.beginTransaction();
      try {
        await m.up(connection);
        await connection.query(
          'INSERT INTO schema_migrations (version, name, batch) VALUES (?, ?, ?)',
          [m.version, m.name, nextBatch]
        );
        await connection.commit();
        logger.info(` ✓ Thành công: ${m.version}`, null, 'MIGRATE');
      } catch (err) {
        await connection.rollback();
        logger.error(` ✖ Lỗi khi thực thi migration ${m.version}`, err.message, 'MIGRATE');
        throw err;
      }
    }

    logger.info(`=== Hoàn tất! Đã áp dụng ${pendingMigrations.length} migration(s). ===`, null, 'MIGRATE');
    return { appliedCount: pendingMigrations.length, batch: nextBatch };
  } finally {
    connection.release();
  }
};

/**
 * Rollback batch migration gần nhất
 */
const rollbackLastBatch = async () => {
  const connection = await db.getConnection();
  try {
    await ensureMigrationsTable(connection);

    const [[{ maxBatch }]] = await connection.query('SELECT COALESCE(MAX(batch), 0) AS maxBatch FROM schema_migrations');
    const targetBatch = Number(maxBatch);

    if (targetBatch === 0) {
      logger.info('Chưa có migration nào trong schema_migrations để rollback.', null, 'MIGRATE');
      return { rolledBackCount: 0 };
    }

    const [appliedRows] = await connection.query(
      'SELECT * FROM schema_migrations WHERE batch = ? ORDER BY id DESC',
      [targetBatch]
    );

    if (appliedRows.length === 0) {
      logger.info(`Không tìm thấy bản ghi nào trong batch ${targetBatch}.`, null, 'MIGRATE');
      return { rolledBackCount: 0 };
    }

    logger.warn(`Bắt đầu rollback Batch ${targetBatch} gồm ${appliedRows.length} migration(s)...`, null, 'MIGRATE');

    const allMigrations = loadAllMigrations();
    const migrationMap = new Map(allMigrations.map(m => [m.version, m]));

    for (const row of appliedRows) {
      const m = migrationMap.get(row.version);
      if (!m) {
        throw new Error(`Không tìm thấy file định nghĩa migration cho version ${row.version}`);
      }

      logger.info(` Đang rollback: ${m.version}...`, null, 'MIGRATE');
      await connection.beginTransaction();
      try {
        if (typeof m.down === 'function') {
          await m.down(connection);
        } else {
          logger.warn(` Migration ${m.version} không có hàm down(), bỏ qua việc chạy down SQL.`, null, 'MIGRATE');
        }
        await connection.query('DELETE FROM schema_migrations WHERE id = ?', [row.id]);
        await connection.commit();
        logger.info(` ✓ Đã rollback: ${m.version}`, null, 'MIGRATE');
      } catch (err) {
        await connection.rollback();
        logger.error(` ✖ Lỗi khi rollback migration ${m.version}`, err.message, 'MIGRATE');
        throw err;
      }
    }

    logger.info(`=== Đã rollback thành công Batch ${targetBatch}! ===`, null, 'MIGRATE');
    return { rolledBackCount: appliedRows.length, batch: targetBatch };
  } finally {
    connection.release();
  }
};

// Xử lý CLI arguments
if (require.main === module) {
  const args = process.argv.slice(2);

  (async () => {
    try {
      if (args.includes('--status')) {
        console.log('\n=== TRẠNG THÁI SCHEMA MIGRATIONS ===\n');
        const status = await getMigrationStatus();
        console.table(status.map(s => ({
          'Trạng thái': s.isApplied ? '✓ ĐÃ CHẠY' : '○ CHỜ CHẠY',
          'Phiên bản': s.version,
          'Batch': s.batch || '—',
          'Tên migration': s.name,
          'Thời gian': s.appliedAt ? new Date(s.appliedAt).toLocaleString('vi-VN') : '—'
        })));
      } else if (args.includes('--rollback')) {
        await rollbackLastBatch();
      } else {
        await runMigrations();
      }
      process.exit(0);
    } catch (err) {
      console.error('\nLỗi khi thực hiện migration:', err.message);
      process.exit(1);
    }
  })();
}

module.exports = {
  getMigrationStatus,
  runMigrations,
  rollbackLastBatch
};
