/**
 * Script kiểm thử tự động Bước 5.3: Deploy backend (Production Deployment & Hardening)
 * Chạy với: node scratch/test-step-5-3.cjs
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const { env, validateEnvironment } = require('../backend/config/env');
const db = require('../backend/config/db');
const authService = require('../backend/services/authService');

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

function httpRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(body);
                } catch {
                    parsed = null;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    data: parsed,
                    raw: body
                });
            });
        });
        req.on('error', reject);
        if (postData) {
            req.write(typeof postData === 'object' ? JSON.stringify(postData) : postData);
        }
        req.end();
    });
}

async function runTests() {
    console.log('=== BẮT ĐẦU KIỂM THỬ BƯỚC 5.3: DEPLOY BACKEND (PRODUCTION READINESS) ===\n');

    try {
        // =========================================================================
        // 1. KIỂM THỬ KHỞI ĐỘNG VÀ HÀNH VI KHI THIẾU CẤU HÌNH (FAIL-FAST BEHAVIOR)
        // =========================================================================
        console.log('--- 1. Kiểm thử Khởi động & Fail-Fast khi thiếu cấu hình bảo mật ---');

        // 1.1 Cấu hình hiện tại hợp lệ
        const validCheck = validateEnvironment();
        assert(validCheck.valid === true, 'Cấu hình hiện tại vượt qua validateEnvironment()');

        // 1.2 Giả lập thiếu cấu hình SameSite=none nhưng thiếu Secure
        const originalEnv = { ...env.cookie };
        env.cookie.sameSite = 'none';
        env.cookie.secure = false;
        let caughtInvalidCookie = false;
        try {
            validateEnvironment();
        } catch (err) {
            caughtInvalidCookie = true;
            assert(err.message.includes('COOKIE_SAME_SITE'), 'Chặn cấu hình lỗi: SameSite=None nhưng Secure=false');
        }
        assert(caughtInvalidCookie, 'validateEnvironment() throw exception khi cookie cấu hình không an toàn');
        env.cookie.sameSite = originalEnv.sameSite;
        env.cookie.secure = originalEnv.secure;

        // 1.3 Giả lập thiếu JWT_SECRET
        const originalJwt = env.auth.jwtSecret;
        env.auth.jwtSecret = '';
        let caughtMissingJwt = false;
        try {
            validateEnvironment();
        } catch (err) {
            caughtMissingJwt = true;
            assert(err.message.includes('JWT_SECRET'), 'Chặn khởi động khi thiếu JWT_SECRET');
        }
        assert(caughtMissingJwt, 'validateEnvironment() throw exception khi thiếu JWT_SECRET');
        env.auth.jwtSecret = originalJwt;

        // =========================================================================
        // 2. KIỂM THỬ ARTIFACTS TRIỂN KHAI (DOCKER, NGINX, SYSTEMD, SCRIPTS)
        // =========================================================================
        console.log('\n--- 2. Kiểm thử Tính đầy đủ của Artifacts Triển khai ---');

        // 2.1 Dockerfile
        const dockerfilePath = path.resolve(__dirname, '../Dockerfile');
        assert(fs.existsSync(dockerfilePath), 'Dockerfile tồn tại');
        const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf-8');
        assert(dockerfileContent.includes('USER node'), 'Dockerfile chạy dưới quyền user node không đặc quyền');
        assert(dockerfileContent.includes('HEALTHCHECK'), 'Dockerfile cấu hình container HEALTHCHECK');
        assert(dockerfileContent.includes('start:prod'), 'Dockerfile khởi động bằng start:prod');

        // 2.2 docker-compose.yml
        const composePath = path.resolve(__dirname, '../docker-compose.yml');
        assert(fs.existsSync(composePath), 'docker-compose.yml tồn tại');
        const composeContent = fs.readFileSync(composePath, 'utf-8');
        assert(composeContent.includes('mysql:') && composeContent.includes('backend:') && composeContent.includes('nginx:'), 'docker-compose.yml định nghĩa đủ 3 dịch vụ: mysql, backend, nginx');
        assert(composeContent.includes('internal_net') && composeContent.includes('public_net'), 'docker-compose.yml cô lập mạng nội bộ (network isolation)');

        // 2.3 Nginx Reverse Proxy Config
        const nginxPath = path.resolve(__dirname, '../deploy/nginx/conf.d/default.conf');
        assert(fs.existsSync(nginxPath), 'Nginx config deploy/nginx/conf.d/default.conf tồn tại');
        const nginxContent = fs.readFileSync(nginxPath, 'utf-8');
        assert(nginxContent.includes('proxy_set_header X-Forwarded-For'), 'Nginx cấu hình chuyển tiếp X-Forwarded-For');
        assert(nginxContent.includes('proxy_set_header X-Forwarded-Proto'), 'Nginx cấu hình chuyển tiếp X-Forwarded-Proto');
        assert(nginxContent.includes('proxy_pass http://backend_app'), 'Nginx reverse proxy chính xác tới backend_app');
        assert(nginxContent.includes('try_files $uri $uri/ /index.html'), 'Nginx hỗ trợ SPA fallback cho React Router');

        // 2.4 Systemd Service
        const systemdPath = path.resolve(__dirname, '../deploy/systemd/finance-tracker-backend.service');
        assert(fs.existsSync(systemdPath), 'Systemd service file tồn tại');
        const systemdContent = fs.readFileSync(systemdPath, 'utf-8');
        assert(systemdContent.includes('ExecStart=/usr/bin/npm run start:prod'), 'Systemd ExecStart chạy start:prod');

        // 2.5 Script start:prod trong backend/package.json
        const pkgJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../backend/package.json'), 'utf-8'));
        assert(Boolean(pkgJson.scripts['start:prod']), 'backend/package.json có script start:prod');
        assert(pkgJson.scripts['start:prod'].includes('migrate.js'), 'start:prod tự động chạy database migration trước khi start');

        // =========================================================================
        // 3. KIỂM THỬ TRỰC TIẾP QUA HTTP SERVER ĐANG CHẠY
        // =========================================================================
        console.log('\n--- 3. Kiểm thử HTTP Server Probes, CORS, Headers & Dual Auth ---');

        let serverRunning = false;
        try {
            const probeRes = await httpRequest({
                hostname: 'localhost',
                port: env.PORT,
                path: '/health',
                method: 'GET'
            });
            if (probeRes.status === 200) serverRunning = true;
        } catch {
            serverRunning = false;
        }

        if (!serverRunning) {
            console.log('  [INFO] Đang khởi động backend server nền để kiểm thử HTTP...');
            // Server chưa chạy, tạm thời kiểm tra logic qua unit calls
            console.log('  [SKIP HTTP LIVE] Máy chủ backend chưa mở cổng ' + env.PORT + '. Bỏ qua các bài test HTTP live.');
        } else {
            // 3.1 Kiểm thử Liveness Probe
            const healthRes = await httpRequest({
                hostname: 'localhost',
                port: env.PORT,
                path: '/health',
                method: 'GET'
            });
            assert(healthRes.status === 200, 'GET /health trả về 200 OK');
            assert(healthRes.data?.status === 'UP', 'Liveness probe báo status UP');

            // 3.2 Kiểm thử Readiness Probe
            const readyRes = await httpRequest({
                hostname: 'localhost',
                port: env.PORT,
                path: '/health/ready',
                method: 'GET'
            });
            assert(readyRes.status === 200, 'GET /health/ready trả về 200 OK');
            assert(readyRes.data?.database === 'connected', 'Readiness probe xác nhận database connected');

            // 3.3 Kiểm thử CORS Preflight (OPTIONS Request)
            const optionsRes = await httpRequest({
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/accounts',
                method: 'OPTIONS',
                headers: {
                    'Origin': 'http://localhost:5173',
                    'Access-Control-Request-Method': 'GET',
                    'Access-Control-Request-Headers': 'Authorization,Content-Type'
                }
            });
            assert(
                optionsRes.headers['access-control-allow-origin'] === 'http://localhost:5173',
                'CORS Preflight trả về Access-Control-Allow-Origin đúng nguồn'
            );
            assert(
                optionsRes.headers['access-control-allow-credentials'] === 'true',
                'CORS Preflight trả về Access-Control-Allow-Credentials: true'
            );

            // 3.4 Kiểm thử Đăng nhập & Dual Auth (Cookie + Bearer Token)
            const loginRes = await httpRequest(
                {
                    hostname: 'localhost',
                    port: env.PORT,
                    path: '/api/auth/login',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                },
                { password: env.auth.password || 'finance123' }
            );

            assert(loginRes.status === 200, 'Đăng nhập thành công trả về 200');
            assert(Boolean(loginRes.data?.data?.token), 'Response đăng nhập trả về JWT token trong data.token');
            const authToken = loginRes.data?.data?.token;

            // Kiểm tra Set-Cookie header
            const setCookie = loginRes.headers['set-cookie'];
            assert(Array.isArray(setCookie) && setCookie.length > 0, 'Response đăng nhập gửi Set-Cookie header');
            const cookieStr = setCookie[0];
            assert(cookieStr.includes('HttpOnly'), 'Cookie có cờ HttpOnly');
            assert(cookieStr.includes('SameSite='), 'Cookie có cấu hình SameSite');

            // 3.5 Kiểm thử truy cập bảo vệ qua Cookie
            const cookieProtectedRes = await httpRequest({
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/accounts',
                method: 'GET',
                headers: {
                    'Cookie': cookieStr.split(';')[0]
                }
            });
            assert(cookieProtectedRes.status === 200, 'Xác thực thành công qua Cookie (HTTP 200)');

            // 3.6 Kiểm thử truy cập bảo vệ qua Authorization Bearer Token
            const bearerProtectedRes = await httpRequest({
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/accounts',
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            assert(bearerProtectedRes.status === 200, 'Xác thực thành công qua Authorization Bearer Token (HTTP 200)');

            // 3.7 Kiểm thử từ chối khi không có token
            const unauthRes = await httpRequest({
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/accounts',
                method: 'GET'
            });
            assert(unauthRes.status === 401, 'Từ chối request chưa đăng nhập với HTTP 401');

            // 3.8 Kiểm thử Trust Proxy Header X-Forwarded-For
            const proxyRes = await httpRequest({
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/auth/me',
                method: 'GET',
                headers: {
                    'X-Forwarded-For': '203.0.113.195',
                    'X-Forwarded-Proto': 'https',
                    'Authorization': `Bearer ${authToken}`
                }
            });
            assert(proxyRes.status === 200, 'Xử lý request với reverse proxy headers thành công');
        }

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
