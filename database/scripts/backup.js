const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { spawn } = require('child_process');

const db = require('../../backend/config/db');
const { env } = require('../../backend/config/env');
const logger = require('../../backend/utils/logger');

const BACKUP_DIR = path.resolve(__dirname, '../backups');

const formatTimestamp = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${y}${m}${d}_${hh}${mm}${ss}`;
};

/**
 * Thu thập thông tin thống kê các bảng và số dòng
 */
const collectDatabaseStats = async (connection, dbName) => {
  const [tables] = await connection.query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');
  const tableNames = tables.map(t => Object.values(t)[0]);

  const stats = [];
  for (const table of tableNames) {
    const [[countRow]] = await connection.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
    stats.push({
      table,
      rowCount: Number(countRow.total || 0)
    });
  }

  return {
    tableCount: tableNames.length,
    tables: stats
  };
};

/**
 * Dump database thuần bằng Node.js & MySQL connection (hoạt động độc lập 100% không phụ thuộc mysqldump binary)
 */
const dumpDatabaseViaDriver = async (connection, dbName) => {
  const lines = [];
  lines.push(`-- ==============================================================================`);
  lines.push(`-- FINANCE TRACKER DATABASE BACKUP (NODE DRIVER DUMP)`);
  lines.push(`-- Database: ${dbName}`);
  lines.push(`-- Generated At: ${new Date().toISOString()}`);
  lines.push(`-- ==============================================================================\n`);
  lines.push(`SET FOREIGN_KEY_CHECKS = 0;`);
  lines.push(`SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";\n`);

  const [tables] = await connection.query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');
  const tableNames = tables.map(t => Object.values(t)[0]);

  for (const table of tableNames) {
    lines.push(`--\n-- Table structure for table \`${table}\`\n--`);
    lines.push(`DROP TABLE IF EXISTS \`${table}\`;`);
    const [[createRow]] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
    lines.push(`${createRow['Create Table']};\n`);

    const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
    if (rows.length > 0) {
      lines.push(`--\n-- Dumping data for table \`${table}\` (${rows.length} rows)\n--`);
      const cols = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');

      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const valuesList = batch.map(row => {
          const vals = Object.values(row).map(val => {
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number' || typeof val === 'bigint') return String(val);
            if (val instanceof Date) {
              const pad = (n) => String(n).padStart(2, '0');
              const y = val.getFullYear();
              const m = pad(val.getMonth() + 1);
              const d = pad(val.getDate());
              const hh = pad(val.getHours());
              const mm = pad(val.getMinutes());
              const ss = pad(val.getSeconds());
              return `'${y}-${m}-${d} ${hh}:${mm}:${ss}'`;
            }
            if (typeof val === 'object') {
              return `'${JSON.stringify(val).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
            }
            return `'${String(val).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
          });
          return `(${vals.join(', ')})`;
        });
        lines.push(`INSERT INTO \`${table}\` (${cols}) VALUES\n  ${valuesList.join(',\n  ')};`);
      }
      lines.push('');
    }
  }

  lines.push(`SET FOREIGN_KEY_CHECKS = 1;`);
  return lines.join('\n');
};

/**
 * Dump database sử dụng lệnh mysqldump (nếu khả dụng)
 */
const dumpViaMysqldump = (dbConfig) => {
  return new Promise((resolve, reject) => {
    const args = [
      `--host=${dbConfig.host}`,
      `--port=${dbConfig.port}`,
      `--user=${dbConfig.user}`,
      `--single-transaction`,
      `--quick`,
      `--routines`,
      `--triggers`,
      `--default-character-set=utf8mb4`,
      dbConfig.name
    ];

    if (dbConfig.password) {
      args.push(`--password=${dbConfig.password}`);
    }

    const child = spawn('mysqldump', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', chunk => stdoutData += chunk);
    child.stderr.on('data', chunk => stderrData += chunk);

    child.on('error', err => reject(err));
    child.on('close', code => {
      if (code === 0 && stdoutData.length > 0) {
        resolve(stdoutData);
      } else {
        reject(new Error(`mysqldump thất bại (mã ${code}): ${stderrData}`));
      }
    });
  });
};

/**
 * Dọn dẹp các bản backup cũ theo chính sách lưu trữ (Retention Policy)
 */
const cleanupOldBackups = (retentionDays = 7) => {
  if (!fs.existsSync(BACKUP_DIR)) return [];

  const now = Date.now();
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
  const deletedFiles = [];

  const files = fs.readdirSync(BACKUP_DIR);
  for (const file of files) {
    if (!file.startsWith('backup_') && !file.includes('.sql')) continue;
    const filePath = path.join(BACKUP_DIR, file);
    try {
      const stats = fs.statSync(filePath);
      const ageMs = now - stats.mtimeMs;
      if (ageMs > maxAgeMs) {
        fs.unlinkSync(filePath);
        deletedFiles.push(file);
      }
    } catch (err) {
      logger.warn(`Không thể kiểm tra/xóa file backup cũ ${file}: ${err.message}`, null, 'BACKUP');
    }
  }

  if (deletedFiles.length > 0) {
    logger.info(`Đã dọn dẹp ${deletedFiles.length} file backup cũ hơn ${retentionDays} ngày.`, deletedFiles, 'BACKUP');
  }

  return deletedFiles;
};

/**
 * Thực hiện tạo bản sao lưu toàn vẹn (Full Backup)
 */
const createBackup = async (options = {}) => {
  const targetDbName = options.database || env.db.name;
  const retentionDays = options.retentionDays || env.db.backupRetentionDays || 7;
  const compress = options.compress !== false; // Mặc định nén gzip

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = formatTimestamp();
  const baseName = `backup_${targetDbName}_${timestamp}`;
  const sqlFileName = `${baseName}.sql`;
  const finalFileName = compress ? `${baseName}.sql.gz` : sqlFileName;
  const finalFilePath = path.join(BACKUP_DIR, finalFileName);
  const metaFilePath = path.join(BACKUP_DIR, `${baseName}.meta.json`);

  logger.info(`Bắt đầu sao lưu cơ sở dữ liệu: ${targetDbName}...`, null, 'BACKUP');

  const connection = await db.getConnection();
  try {
    // 1. Thu thập số liệu thống kê để xác thực sau này
    const stats = await collectDatabaseStats(connection, targetDbName);
    logger.info(`Tìm thấy ${stats.tableCount} bảng với tổng số dòng: ${stats.tables.reduce((acc, t) => acc + t.rowCount, 0)}`, null, 'BACKUP');

    // 2. Xuất dữ liệu SQL
    let sqlContent = '';
    let dumpMethod = 'mysqldump';
    try {
      sqlContent = await dumpViaMysqldump({
        host: env.db.host,
        port: env.db.port,
        user: env.db.user,
        password: env.db.password,
        name: targetDbName
      });
      logger.info('Xuất dữ liệu thành công bằng mysqldump.', null, 'BACKUP');
    } catch (dumpErr) {
      logger.warn(`mysqldump không khả dụng (${dumpErr.message}), chuyển sang xuất bằng Node Driver...`, null, 'BACKUP');
      sqlContent = await dumpDatabaseViaDriver(connection, targetDbName);
      dumpMethod = 'node_driver';
      logger.info('Xuất dữ liệu thành công bằng Node Driver.', null, 'BACKUP');
    }

    // 3. Nén hoặc ghi trực tiếp
    let finalBuffer;
    if (compress) {
      finalBuffer = zlib.gzipSync(Buffer.from(sqlContent, 'utf-8'));
    } else {
      finalBuffer = Buffer.from(sqlContent, 'utf-8');
    }
    fs.writeFileSync(finalFilePath, finalBuffer);

    // 4. Tính toán Checksum SHA-256
    const hash = crypto.createHash('sha256').update(finalBuffer).digest('hex');

    // 5. Ghi file Metadata
    const metadata = {
      database: targetDbName,
      timestamp: new Date().toISOString(),
      fileName: finalFileName,
      fileSize: finalBuffer.length,
      compressed: compress,
      dumpMethod,
      sha256: hash,
      retentionDays,
      tableCount: stats.tableCount,
      tables: stats.tables
    };
    fs.writeFileSync(metaFilePath, JSON.stringify(metadata, null, 2), 'utf-8');

    logger.info(`✓ Sao lưu thành công: ${finalFileName} (${(finalBuffer.length / 1024).toFixed(2)} KB)`, null, 'BACKUP');
    logger.info(`✓ Checksum SHA-256: ${hash}`, null, 'BACKUP');

    // 6. Tự động xoay vòng xóa bản cũ
    const cleaned = cleanupOldBackups(retentionDays);

    return {
      success: true,
      filePath: finalFilePath,
      metaPath: metaFilePath,
      metadata,
      cleanedFiles: cleaned
    };
  } finally {
    connection.release();
  }
};

// Chạy trực tiếp qua CLI
if (require.main === module) {
  (async () => {
    try {
      await createBackup();
      process.exit(0);
    } catch (err) {
      logger.error('Sao lưu cơ sở dữ liệu thất bại:', err.message, 'BACKUP');
      process.exit(1);
    }
  })();
}

module.exports = {
  createBackup,
  cleanupOldBackups,
  BACKUP_DIR
};

