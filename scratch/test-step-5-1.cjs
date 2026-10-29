/**
 * Script kiểm thử tự động Bước 5.1: Sẵn sàng production
 * Chạy với: node scratch/test-step-5-1.cjs
 */
const http = require('http');
const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const { env, validateEnvironment } = require('../backend/config/env');
const logger = require('../backend/utils/logger');
const db = require('../backend/config/db');
const { getMigrationStatus, runMigrations } = require('../database/migrate');

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

function httpRequest(options) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
                } catch {
                    resolve({ status: res.statusCode, headers: res.headers, raw: body });
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function runTests() {
    console.log('=== BẮT ĐẦU KIỂM THỬ BƯỚC 5.1: SẴN SÀNG PRODUCTION ===\n');

    try {
        // =========================================================================
        // 1. KIỂM THỬ CẤU HÌNH MÔI TRƯỜNG & VALIDATION
        // =========================================================================
        console.log('--- 1. Kiểm thử Cấu hình Môi trường (backend/config/env.js) ---');
        
        // 1.1 Cấu hình hiện tại hợp lệ
        const currentValidation = validateEnvironment();
        assert(currentValidation.valid === true, 'validateEnvironment() trả về valid = true cho cấu hình hiện tại');

        // 1.2 Kiểm tra các biến bắt buộc
        assert(typeof env.PORT === 'number' && env.PORT > 0, `PORT được parse đúng kiểu số: ${env.PORT}`);
        assert(Array.isArray(env.cors.origins) && env.cors.origins.length > 0, 'CORS origins được phân tách thành mảng hợp lệ');
        assert(env.auth.jwtSecret.length >= 32, 'JWT_SECRET đáp ứng độ dài tối thiểu 32 ký tự');
        assert(env.auth.ingestToken.length >= 16, 'INGEST_TOKEN đáp ứng độ dài tối thiểu 16 ký tự');
        assert(Boolean(env.auth.password || env.auth.passwordHash), 'Đã có cấu hình mật khẩu quản trị');

        // =========================================================================
        // 2. KIỂM THỬ LOGGER SANITIZATION (BẢO MẬT LOGS)
        // =========================================================================
        console.log('\n--- 2. Kiểm thử Logger Sanitization (backend/utils/logger.js) ---');

        // 2.1 Che giấu Bearer Token trong chuỗi
        const logWithToken = 'Xác thực thất bại cho header: Bearer my_super_secret_jwt_token_123456';
        const cleanedTokenStr = logger.sanitize(logWithToken);
        assert(!cleanedTokenStr.includes('my_super_secret_jwt_token_123456'), 'Logger: Đã lọc bỏ chuỗi token bí mật');
        assert(cleanedTokenStr.includes('Bearer [REDACTED]'), 'Logger: Thay thế bằng Bearer [REDACTED]');

        // 2.2 Che giấu các trường nhạy cảm trong Object
        const sensitiveObject = {
            username: 'admin',
            password: 'my_plaintext_password_xyz',
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy',
            auth_password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
            raw_message: 'Tk 123456 bien dong +500,000 VND vao 12:00',
            safeField: 'Dữ liệu an toàn'
        };
        const sanitizedObj = logger.sanitize(sensitiveObject);
        assert(sanitizedObj.safeField === 'Dữ liệu an toàn', 'Logger: Giữ nguyên dữ liệu bình thường');
        assert(sanitizedObj.password !== 'my_plaintext_password_xyz', 'Logger: Đã che giấu password');
        assert(sanitizedObj.raw_message !== sensitiveObject.raw_message, 'Logger: Đã che giấu raw_message');
        assert(sanitizedObj.token !== sensitiveObject.token, 'Logger: Đã che giấu token');

        // =========================================================================
        // 3. KIỂM THỬ HEALTH CHECK PROBES & SECURITY HEADERS (qua HTTP)
        // =========================================================================
        console.log('\n--- 3. Kiểm thử Health Check & Security/Cache Headers ---');

        // Liveness probe: GET /health
        try {
            const healthRes = await httpRequest({
                hostname: 'localhost',
                port: env.PORT,
                path: '/health',
                method: 'GET'
            });

            assert(healthRes.status === 200, 'GET /health trả về HTTP 200 (Liveness Probe)');
            assert(healthRes.data?.status === 'UP', 'GET /health status là UP');
            assert(typeof healthRes.data?.uptime === 'number', 'GET /health cung cấp uptime của tiến trình');

            // Kiểm tra Security Headers trên phản hồi
            assert(healthRes.headers['x-content-type-options'] === 'nosniff', 'Header X-Content-Type-Options: nosniff');
            assert(healthRes.headers['x-frame-options'] === 'SAMEORIGIN', 'Header X-Frame-Options: SAMEORIGIN');
            assert(healthRes.headers['referrer-policy'] === 'strict-origin-when-cross-origin', 'Header Referrer-Policy hợp lệ');

            // Readiness probe: GET /health/ready
            const readyRes = await httpRequest({
                hostname: 'localhost',
                port: env.PORT,
                path: '/health/ready',
                method: 'GET'
            });

            assert(readyRes.status === 200, 'GET /health/ready trả về HTTP 200 (Readiness Probe)');
            assert(readyRes.data?.status === 'READY', 'GET /health/ready status là READY');
            assert(readyRes.data?.database === 'connected', 'Database kết nối thành công');
            assert(typeof readyRes.data?.latencyMs === 'number', `Đo độ trễ MySQL thành công: ${readyRes.data?.latencyMs}ms`);

            // Kiểm tra Cache-Control headers trên /api
            const apiRes = await httpRequest({
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/auth/me',
                method: 'GET'
            });
            const cacheControl = apiRes.headers['cache-control'] || '';
            assert(cacheControl.includes('no-store'), 'API Cache-Control chứa no-store (ngăn chặn lưu cache)');
            assert(cacheControl.includes('no-cache'), 'API Cache-Control chứa no-cache');
            assert(apiRes.headers['pragma'] === 'no-cache', 'Header Pragma: no-cache');

        } catch (serverErr) {
            console.log('  [INFO] Máy chủ nền hiện chưa chạy trên cổng ' + env.PORT + ' để test HTTP trực tiếp. Kiểm thử healthCheck qua module DB...');
            const dbCheck = await db.healthCheck();
            assert(dbCheck.connected === true, 'db.healthCheck() kết nối thành công');
            assert(typeof dbCheck.latencyMs === 'number', `db.healthCheck() đo được latency: ${dbCheck.latencyMs}ms`);
        }

        // =========================================================================
        // 4. KIỂM THỬ SCHEMA MIGRATIONS (VERSIONING & ORDERED MIGRATIONS)
        // =========================================================================
        console.log('\n--- 4. Kiểm thử Hệ thống Schema Migrations (database/migrate.js) ---');

        // 4.1 Kiểm tra trạng thái migrations
        const statusList = await getMigrationStatus();
        assert(Array.isArray(statusList) && statusList.length >= 5, `Hệ thống quét đủ ${statusList.length} migrations`);

        const versions = statusList.map(s => s.version);
        assert(versions.includes('001_initial_schema'), 'Có migration 001_initial_schema');
        assert(versions.includes('002_ingest_events'), 'Có migration 002_ingest_events');
        assert(versions.includes('003_category_rules'), 'Có migration 003_category_rules');
        assert(versions.includes('004_csv_import_batches'), 'Có migration 004_csv_import_batches');
        assert(versions.includes('005_reconciliations'), 'Có migration 005_reconciliations');

        // 4.2 Chạy runMigrations (đảm bảo tính idempotent, không bị trùng lặp)
        const runResult = await runMigrations();
        assert(typeof runResult.appliedCount === 'number', 'runMigrations() chạy thành công mà không gây lỗi');

        // 4.3 Kiểm tra bảng schema_migrations trong DB
        const [migRows] = await db.query('SELECT * FROM schema_migrations ORDER BY id ASC');
        assert(migRows.length >= 5, `Bảng schema_migrations lưu đúng ${migRows.length} phiên bản đã áp dụng`);
        assert(migRows.every(r => r.batch >= 1), 'Mỗi migration đều được gắn batch version rõ ràng');

    } catch (error) {
        console.error('LỖI KHÔNG MONG MUỐN TRONG QUÁ TRÌNH KIỂM THỬ:', error);
        failedTests++;
    } finally {
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

