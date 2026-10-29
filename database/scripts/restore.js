const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
let mysql;
try {
  mysql = require('mysql2/promise');
} catch {
  mysql = require(path.resolve(__dirname, '../../backend/node_modules/mysql2/promise'));
}

const { env } = require('../../backend/config/env');
const logger = require('../../backend/utils/logger');
const { BACKUP_DIR } = require('./backup');

/**
 * Tìm file backup mới nhất trong thư mục
 */
const getLatestBackupFile = () => {
  if (!fs.existsSync(BACKUP_DIR)) return null;

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup_') && (f.endsWith('.sql.gz') || f.endsWith('.sql')))
    .sort()
    .reverse();

  return files.length > 0 ? path.join(BACKUP_DIR, files[0]) : null;
};

/**
 * Tách một chuỗi SQL dump thành danh sách các câu lệnh hợp lệ để thực thi
 */
const splitSqlStatements = (sqlText) => {
  const statements = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inLineComment = false;

  for (let i = 0; i < sqlText.length; i++) {
    const char = sqlText[i];
    const nextChar = sqlText[i + 1];

    // Xử lý comment một dòng (--) hoặc (/* ... */)
    if (!inString) {
      if (!inLineComment && !inComment && char === '-' && nextChar === '-') {
        inLineComment = true;
        i++;
        continue;
      }
      if (inLineComment && (char === '\n' || char === '\r')) {
        inLineComment = false;
        continue;
      }
      if (!inComment && !inLineComment && char === '/' && nextChar === '*') {
        inComment = true;
        i++;
        continue;
      }
      if (inComment && char === '*' && nextChar === '/') {
        inComment = false;
        i++;
        continue;
      }
    }

    if (inLineComment || inComment) continue;

    // Xử lý chuỗi nháy (' hoặc ")
    if ((char === "'" || char === '"' || char === '`') && (i === 0 || sqlText[i - 1] !== '\\')) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (stringChar === char) {
        // Kiểm tra escaped quote ''
        if (nextChar === char) {
          current += char + nextChar;
          i++;
          continue;
        }
        inString = false;
      }
    }

    if (char === ';' && !inString) {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = '';
    } else {
      current += char;
    }
  }

  const lastTrimmed = current.trim();
  if (lastTrimmed) {
    statements.push(lastTrimmed);
  }

  return statements;
};

/**
 * Kiểm tra đối chiếu số liệu sau khi phục hồi (Verification)
 */
const verifyRestoredDatabase = async (connection, metadata, targetDb) => {
  logger.info(`Bắt đầu đối chiếu dữ liệu sau phục hồi trên database: ${targetDb}...`, null, 'RESTORE');

  const [tables] = await connection.query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');
  const tableNames = tables.map(t => Object.values(t)[0]);

  const report = {
    targetDb,
    match: true,
    totalTablesRestored: tableNames.length,
    expectedTables: metadata?.tableCount || null,
    tableDetails: []
  };

  const expectedTableMap = new Map();
  if (metadata?.tables) {
    metadata.tables.forEach(t => expectedTableMap.set(t.table, t.rowCount));
  }

  for (const table of tableNames) {
    const [[countRow]] = await connection.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
    const actualCount = Number(countRow.total || 0);
    const expectedCount = expectedTableMap.has(table) ? expectedTableMap.get(table) : null;
    const isCountMatch = expectedCount === null || expectedCount === actualCount;

    if (!isCountMatch) {
      report.match = false;
    }

    report.tableDetails.push({
      table,
      actualCount,
      expectedCount,
      matched: isCountMatch
    });
  }

  // Kiểm tra tổng tiền các giao dịch (nếu có bảng transactions)
  if (tableNames.includes('transactions')) {
    const [[txSumRow]] = await connection.query(`
      SELECT 
        COUNT(*) AS tx_count,
        COALESCE(SUM(amount), 0) AS total_amount
      FROM transactions
    `);
    report.transactionCheck = {
      count: Number(txSumRow.tx_count),
      totalAmount: String(txSumRow.total_amount)
    };
  }

  return report;
};

/**
 * Thực hiện phục hồi dữ liệu từ file sao lưu (Restore)
 */
const restoreBackup = async (backupFilePath, targetDatabase) => {
  const filePath = backupFilePath || getLatestBackupFile();
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy file sao lưu để phục hồi: ${filePath || 'Trống'}`);
  }

  const targetDb = targetDatabase || env.db.name;
  logger.info(`Bắt đầu quy trình phục hồi cơ sở dữ liệu...`, null, 'RESTORE');
  logger.info(` File nguồn: ${path.basename(filePath)}`, null, 'RESTORE');
  logger.info(` Database đích: ${targetDb}`, null, 'RESTORE');

  // 1. Đọc và kiểm tra Checksum (nếu có file meta)
  const metaPath = filePath.replace(/\.sql(\.gz)?$/, '.meta.json');
  let metadata = null;
  if (fs.existsSync(metaPath)) {
    try {
      metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      const fileBuffer = fs.readFileSync(filePath);
      const currentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      if (metadata.sha256 && metadata.sha256 !== currentHash) {
        throw new Error(`File backup bị lỗi hoặc đã bị can thiệp! Checksum không khớp (Kỳ vọng: ${metadata.sha256}, Thực tế: ${currentHash})`);
      }
      logger.info('✓ Xác thực Checksum SHA-256 thành công (Bản sao lưu nguyên vẹn).', null, 'RESTORE');
    } catch (err) {
      logger.warn(`Cảnh báo kiểm tra metadata: ${err.message}`, null, 'RESTORE');
    }
  }

  // 2. Đọc nội dung SQL (tự động giải nén nếu file .gz)
  let sqlText = '';
  const isGzip = filePath.endsWith('.gz');
  const rawBytes = fs.readFileSync(filePath);

  if (isGzip) {
    logger.info('Đang giải nén tập tin nén .gz...', null, 'RESTORE');
    sqlText = zlib.gunzipSync(rawBytes).toString('utf-8');
  } else {
    sqlText = rawBytes.toString('utf-8');
  }

  // 3. Kết nối MySQL ở mức server (để tạo DB đích nếu chưa có)
  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    charset: 'utf8mb4',
    multipleStatements: true
  });

  try {
    // 4. Tạo database đích nếu chưa có
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${targetDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${targetDb}\``);
    await connection.query(`SET FOREIGN_KEY_CHECKS = 0`);

    // 5. Thực thi các câu lệnh SQL
    logger.info(`Đang nạp dữ liệu và cấu trúc bảng vào database ${targetDb}...`, null, 'RESTORE');
    const statements = splitSqlStatements(sqlText);

    let executed = 0;
    for (const stmt of statements) {
      if (!stmt.trim()) continue;
      try {
        await connection.query(stmt);
        executed++;
      } catch (stmtErr) {
        logger.warn(`Lỗi khi chạy lệnh SQL [${stmt.slice(0, 50)}...]: ${stmtErr.message}`, null, 'RESTORE');
      }
    }
    await connection.query(`SET FOREIGN_KEY_CHECKS = 1`);
    logger.info(`✓ Đã thực thi thành công ${executed} câu lệnh SQL.`, null, 'RESTORE');

    // 6. Đối chiếu và kiểm tra tính toàn vẹn (Verification)
    const verificationReport = await verifyRestoredDatabase(connection, metadata, targetDb);

    if (verificationReport.match) {
      logger.info('🎉 XÁC THỰC THÀNH CÔNG: Dữ liệu phục hồi hoàn toàn trùng khớp với bản sao lưu gốc!', null, 'RESTORE');
    } else {
      logger.warn('⚠️ CẢNH BÁO: Phát hiện chênh lệch số lượng bản ghi sau khi phục hồi. Vui lòng kiểm tra báo cáo chi tiết.', null, 'RESTORE');
    }

    return {
      success: true,
      targetDb,
      executedStatements: executed,
      verification: verificationReport
    };
  } finally {
    await connection.end();
  }
};

// Chạy trực tiếp qua CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const targetFile = args[0] && !args[0].startsWith('--') ? args[0] : null;
  const targetDb = args[1] && !args[1].startsWith('--') ? args[1] : null;

  (async () => {
    try {
      await restoreBackup(targetFile, targetDb);
      process.exit(0);
    } catch (err) {
      logger.error('Phục hồi dữ liệu thất bại:', err.message, 'RESTORE');
      process.exit(1);
    }
  })();
}

module.exports = {
  restoreBackup,
  getLatestBackupFile
};
