/**
 * Script kiểm thử tự động Bước 5.2: Database production và bảo vệ dữ liệu
 * Chạy với: node scratch/test-step-5-2.cjs
 */
const fs = require('fs');
const path = require('path');
const mysql = require('../backend/node_modules/mysql2/promise');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const { env } = require('../backend/config/env');
const db = require('../backend/config/db');
const { createBackup, cleanupOldBackups, BACKUP_DIR } = require('../database/scripts/backup');
const { restoreBackup, getLatestBackupFile } = require('../database/scripts/restore');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, detail = '') {
    if (condition) {
        console.log(`  [PASS] ${testName}`);
        passedTests++;
    } else {
        console.error(`  [FAIL] ${testName}${detail ? ' -> ' + detail : ''}`);
        failedTests++;
    }
}

async function runTests() {
    console.log('=== BẮT ĐẦU KIỂM THỬ BƯỚC 5.2: DATABASE PRODUCTION VÀ BẢO VỆ DỮ LIỆU ===\n');

    const testDbName = 'finance_tracker_restore_test';
    let backupResult = null;
    let rootConnection = null;

    try {
        // =========================================================================
        // 1. KIỂM THỬ CẤU HÌNH BẢO MẬT VÀ PHÂN QUYỀN LEAST PRIVILEGE
        // =========================================================================
        console.log('--- 1. Kiểm thử Cấu hình Bảo mật, SSL & Least Privilege ---');

        // 1.1 Kiểm tra file production_setup.sql
        const setupSqlPath = path.resolve(__dirname, '../database/production_setup.sql');
        assert(fs.existsSync(setupSqlPath), 'File database/production_setup.sql tồn tại');
        const setupContent = fs.readFileSync(setupSqlPath, 'utf-8');
        assert(setupContent.includes('CREATE USER'), 'production_setup.sql có lệnh tạo user riêng');
        assert(setupContent.includes('GRANT SELECT, INSERT, UPDATE, DELETE'), 'production_setup.sql cấp quyền tối thiểu (Least Privilege)');
        assert(!setupContent.includes('GRANT ALL PRIVILEGES ON *.*'), 'Tuyệt đối không cấp SUPERUSER hay quyền root');
        assert(setupContent.includes('REQUIRE SSL'), 'Có lệnh bắt buộc mã hóa SSL/TLS cho kết nối database');

        // 1.2 Kiểm tra cấu hình SSL trong env
        assert(typeof env.db.ssl === 'boolean', 'env.db.ssl được quản lý chuẩn xác (boolean)');
        assert(typeof env.db.backupRetentionDays === 'number' && env.db.backupRetentionDays > 0, `Chính sách lưu trữ backup: ${env.db.backupRetentionDays} ngày`);

        // =========================================================================
        // 2. KIỂM THỬ TẠO BẢN SAO LƯU TOÀN VẸN (AUTOMATED BACKUP)
        // =========================================================================
        console.log('\n--- 2. Kiểm thử Tạo bản Sao lưu Toàn vẹn (Backup Execution) ---');

        backupResult = await createBackup({ compress: true });
        assert(backupResult.success === true, 'Tạo bản sao lưu thành công');
        assert(fs.existsSync(backupResult.filePath), 'File sao lưu .sql.gz đã được tạo trên đĩa');
        assert(fs.existsSync(backupResult.metaPath), 'File metadata .meta.json đã được tạo trên đĩa');

        const fileStats = fs.statSync(backupResult.filePath);
        assert(fileStats.size > 0, `Kích thước file sao lưu hợp lệ (${(fileStats.size / 1024).toFixed(2)} KB)`);

        const metadata = backupResult.metadata;
        assert(metadata.compressed === true, 'Bản sao lưu đã được nén gzip tiết kiệm dung lượng');
        assert(typeof metadata.sha256 === 'string' && metadata.sha256.length === 64, `Tính toán checksum SHA-256 hợp lệ: ${metadata.sha256}`);
        assert(metadata.tableCount > 0, `Đã sao lưu đầy đủ ${metadata.tableCount} bảng`);
        assert(Array.isArray(metadata.tables) && metadata.tables.length === metadata.tableCount, 'Metadata liệt kê đầy đủ chi tiết từng bảng');

        // =========================================================================
        // 3. KIỂM THỬ PHỤC HỒI DỮ LIỆU VÀO MÔI TRƯỜNG RIÊNG (RESTORE EXECUTION)
        // =========================================================================
        console.log(`\n--- 3. Kiểm thử Phục hồi Dữ liệu vào Môi trường Riêng (${testDbName}) ---`);

        // Chuẩn bị kết nối server MySQL
        rootConnection = await mysql.createConnection({
            host: env.db.host,
            port: env.db.port,
            user: env.db.user,
            password: env.db.password,
            charset: 'utf8mb4'
        });

        // Xóa testDbName nếu đã có từ trước để đảm bảo môi trường sạch
        await rootConnection.query(`DROP DATABASE IF EXISTS \`${testDbName}\``);

        // Thực hiện phục hồi từ file backup vừa tạo
        const restoreResult = await restoreBackup(backupResult.filePath, testDbName);
        assert(restoreResult.success === true, 'Thực thi phục hồi backup thành công');
        assert(restoreResult.executedStatements > 0, `Đã thực thi ${restoreResult.executedStatements} câu lệnh SQL`);

        // =========================================================================
        // 4. KIỂM THỬ ĐỐI CHIẾU TÍNH TOÀN VẸN DỮ LIỆU (POST-RESTORE VERIFICATION)
        // =========================================================================
        console.log('\n--- 4. Kiểm thử Đối chiếu Tính Toàn vẹn Dữ liệu (Post-Restore Verification) ---');

        const verification = restoreResult.verification;
        assert(verification.match === true, 'Toàn bộ số lượng bản ghi của các bảng trùng khớp 100% với metadata');
        assert(verification.totalTablesRestored === metadata.tableCount, `Số bảng phục hồi (${verification.totalTablesRestored}) khớp với số bảng gốc (${metadata.tableCount})`);

        // Kết nối trực tiếp vào database vừa phục hồi để kiểm tra sâu các bảng cốt lõi
        const testDbConnection = await mysql.createConnection({
            host: env.db.host,
            port: env.db.port,
            user: env.db.user,
            password: env.db.password,
            database: testDbName,
            charset: 'utf8mb4'
        });

        try {
            // Đối chiếu từng bảng cốt lõi giữa database gốc và database phục hồi
            const coreTables = [
                'accounts',
                'categories',
                'transactions',
                'budgets',
                'ingest_events',
                'category_rules',
                'import_batches',
                'reconciliations',
                'schema_migrations'
            ];

            for (const tbl of coreTables) {
                const [[origCount]] = await db.query(`SELECT COUNT(*) AS total FROM \`${tbl}\``);
                const [[restCount]] = await testDbConnection.query(`SELECT COUNT(*) AS total FROM \`${tbl}\``);
                assert(
                    Number(origCount.total) === Number(restCount.total),
                    `Bảng '${tbl}': số dòng gốc (${origCount.total}) = số dòng phục hồi (${restCount.total})`
                );
            }

            // Đối chiếu tổng tiền giao dịch (Financial Integrity Check)
            const [[origSum]] = await db.query('SELECT COALESCE(SUM(amount), 0) AS total_sum FROM transactions');
            const [[restSum]] = await testDbConnection.query('SELECT COALESCE(SUM(amount), 0) AS total_sum FROM transactions');
            assert(
                String(origSum.total_sum) === String(restSum.total_sum),
                `Tổng số tiền giao dịch khớp chuẩn xác: ${origSum.total_sum} VND`
            );

        } finally {
            await testDbConnection.end();
        }

        // =========================================================================
        // 5. KIỂM THỬ CHÍNH SÁCH XOAY VÒNG BẢN SAO LƯU (RETENTION CLEANUP)
        // =========================================================================
        console.log('\n--- 5. Kiểm thử Chính sách Xoay vòng Bản sao lưu (Retention Policy) ---');

        // Tạo một file backup giả lập có mtime cũ hơn 10 ngày
        const dummyOldFile = path.join(BACKUP_DIR, 'backup_old_dummy_test.sql');
        fs.writeFileSync(dummyOldFile, '-- Old backup test', 'utf-8');
        const tenDaysAgo = Date.now() - (10 * 24 * 60 * 60 * 1000);
        fs.utimesSync(dummyOldFile, new Date(tenDaysAgo), new Date(tenDaysAgo));

        // Chạy hàm dọn dẹp với retention 7 ngày
        const cleaned = cleanupOldBackups(7);
        assert(cleaned.includes('backup_old_dummy_test.sql'), 'Hệ thống tự động phát hiện và xóa file backup cũ hơn 7 ngày');
        assert(!fs.existsSync(dummyOldFile), 'File backup cũ đã được dọn sạch khỏi ổ đĩa');
        assert(fs.existsSync(backupResult.filePath), 'File backup mới nhất vẫn được bảo tồn an toàn');

    } catch (error) {
        console.error('LỖI KHÔNG MONG MUỐN TRONG QUÁ TRÌNH KIỂM THỬ:', error);
        failedTests++;
    } finally {
        // Dọn dẹp database test và file test
        console.log('\n--- 6. Dọn dẹp Tài nguyên Kiểm thử ---');
        if (rootConnection) {
            try {
                await rootConnection.query(`DROP DATABASE IF EXISTS \`${testDbName}\``);
                console.log(`  Đã xóa cơ sở dữ liệu kiểm thử: ${testDbName}`);
            } catch (err) {
                console.error('Lỗi khi xóa test database:', err.message);
            }
            await rootConnection.end();
        }
        await db.end();
    }

    console.log(`\n======================================================`);
    console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests} PASS, ${failedTests} FAIL`);
    console.log(`======================================================\n`);

    if (failedTests > 0) {
        process.exit(1);
    }
}

runTests();
