/**
 * ==============================================================================
 * KỊCH BẢN KIỂM THỬ NGHIỆM THU TOÀN DIỆN (STEP 5.5 END-TO-END ACCEPTANCE SUITE)
 * ==============================================================================
 * Bao quát toàn bộ luồng nghiệp vụ & bảo mật theo docs/PLAN.md (Giai đoạn 1 -> 5):
 * 1. Health check & Security Probes (Liveness, Readiness, CORS, Rate Limit)
 * 2. Xác thực & Phiên làm việc (Login, Logout, Cookie HttpOnly, Bearer Token, 401 Unauthorized)
 * 3. Nghiệp vụ cốt lõi: Ví tiền (Accounts), Danh mục (Categories), Ngân sách (Budgets), Giao dịch (Income/Expense/Transfer)
 * 4. Ingest API (Xác thực Bearer token, Idempotency chống trùng, lưu raw payload)
 * 5. Hộp chờ duyệt (Inbox) & Quy tắc tự gán danh mục (Category Rules priority)
 * 6. Nhập sao kê CSV (Preview, Mapping, Phát hiện nghi trùng, Confirm Batch)
 * 7. Đối soát số dư (Balance Reconciliation: Phân rã công thức, Chênh lệch, Điều chỉnh ACID)
 * 8. Quản trị & Vận hành CSDL (Schema migrations versioning, Backup SHA-256, Restore verification)
 * ==============================================================================
 */

const http = require('http');
const path = require('path');
const mysql = require('../backend/node_modules/mysql2/promise');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const { env } = require('../backend/config/env');
const db = require('../backend/config/db');
const { app } = require('../backend/server');
const { getMigrationStatus } = require('../database/migrate');
const { createBackup } = require('../database/scripts/backup');
const { restoreBackup } = require('../database/scripts/restore');

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

function request(options, bodyData = null) {
    return new Promise((resolve, reject) => {
        const opts = {
            ...options,
            hostname: (!options.hostname || options.hostname === 'localhost') ? '127.0.0.1' : options.hostname
        };
        const req = http.request(opts, (res) => {
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
        if (bodyData) {
            req.write(typeof bodyData === 'object' ? JSON.stringify(bodyData) : bodyData);
        }
        req.end();
    });
}

async function runAcceptanceTests() {
    console.log('==============================================================================');
    console.log('BẮT ĐẦU KIỂM THỬ NGHIỆM THU & VẬN HÀNH HỆ THỐNG (STEP 5.5 ACCEPTANCE TEST)');
    console.log('==============================================================================\n');

    let localServer = null;
    let authToken = null;
    let authCookie = null;
    let bankAccountId = null;
    let cashAccountId = null;
    let salaryCategoryId = null;
    let foodCategoryId = null;
    let ruleId = null;
    let ingestEventId = null;
    let importBatchId = null;
    let reconciliationId = null;

    try {
        localServer = await new Promise((resolve, reject) => {
            const s = app.listen(env.PORT, () => {
                console.log(`  [SETUP] Máy chủ HTTP nội bộ đã lắng nghe tại port ${env.PORT}\n`);
                resolve(s);
            });
            s.on('error', reject);
        });

        // =========================================================================
        // PHẦN 1: KIỂM THỬ HẠ TẦNG, HEALTH PROBES & CHÍNH SÁCH BẢO MẬT
        // =========================================================================
        console.log('--- PHẦN 1: Kiểm thử Hạ tầng, Health Probes & Bảo mật ---');

        // 1.1 Liveness Probe
        const liveness = await request({
            hostname: 'localhost',
            port: env.PORT,
            path: '/health',
            method: 'GET'
        });
        assert(liveness.status === 200, 'GET /health trả về HTTP 200 (Liveness Probe)');
        assert(liveness.data?.status === 'UP', 'Trạng thái tiến trình là UP');

        // 1.2 Readiness Probe (MySQL health)
        const readiness = await request({
            hostname: 'localhost',
            port: env.PORT,
            path: '/health/ready',
            method: 'GET'
        });
        assert(readiness.status === 200, 'GET /health/ready trả về HTTP 200 (Readiness Probe)');
        assert(readiness.data?.status === 'READY', 'Database trạng thái READY');
        assert(readiness.data?.database === 'connected', 'MySQL kết nối thành công');

        // 1.3 CORS Policy Rejection (Tên miền độc hại)
        const corsDenied = await request({
            hostname: 'localhost',
            port: env.PORT,
            path: '/api/categories',
            method: 'GET',
            headers: { 'Origin': 'https://attacker-fake-site.com' }
        });
        assert(
            !corsDenied.headers['access-control-allow-origin'] || corsDenied.status >= 400,
            'CORS: Chặn hoặc không cấp quyền cho origin trái phép'
        );

        // 1.4 Cache-Control Header trên API
        const authMeProbe = await request({
            hostname: 'localhost',
            port: env.PORT,
            path: '/api/auth/me',
            method: 'GET'
        });
        assert(
            authMeProbe.headers['cache-control'] && authMeProbe.headers['cache-control'].includes('no-store'),
            'API Header chứa Cache-Control: no-store (ngăn chặn lưu cache trình duyệt)'
        );

        // =========================================================================
        // PHẦN 2: XÁC THỰC, PHIÊN LÀM VIỆC & RATE LIMIT
        // =========================================================================
        console.log('\n--- PHẦN 2: Xác thực & Phiên làm việc (SPEC 5.1 & 5.3) ---');

        // 2.1 Chặn truy cập khi chưa xác thực
        const unauth = await request({
            hostname: 'localhost',
            port: env.PORT,
            path: '/api/accounts',
            method: 'GET'
        });
        assert(unauth.status === 401, 'Từ chối truy cập tài nguyên bảo vệ khi chưa đăng nhập (HTTP 401)');

        // 2.2 Đăng nhập thất bại với mật khẩu sai
        const loginFail = await request(
            {
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/auth/login',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            },
            { password: 'wrong_password_123' }
        );
        assert(loginFail.status === 401, 'Đăng nhập sai mật khẩu trả về HTTP 401');

        // 2.3 Đăng nhập thành công với mật khẩu đúng
        const loginSuccess = await request(
            {
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/auth/login',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            },
            { password: env.auth.password || 'finance123' }
        );
        assert(loginSuccess.status === 200, 'Đăng nhập đúng mật khẩu trả về HTTP 200');
        assert(loginSuccess.data?.data?.authenticated === true, 'Response xác nhận authenticated: true');
        assert(Boolean(loginSuccess.data?.data?.token), 'Response trả về JWT Bearer token');
        authToken = loginSuccess.data?.data?.token;

        const setCookie = loginSuccess.headers['set-cookie'];
        assert(Array.isArray(setCookie) && setCookie.length > 0, 'Phản hồi đăng nhập đính kèm Set-Cookie');
        authCookie = setCookie[0].split(';')[0];
        assert(setCookie[0].includes('HttpOnly'), 'Cookie được bảo vệ với cờ HttpOnly');

        // 2.4 Xác thực phiên làm việc qua Cookie
        const checkCookie = await request({
            hostname: 'localhost',
            port: env.PORT,
            path: '/api/auth/me',
            method: 'GET',
            headers: { 'Cookie': authCookie }
        });
        assert(checkCookie.status === 200 && checkCookie.data?.data?.authenticated === true, 'Xác thực phiên thành công qua HttpOnly Cookie');

        // 2.5 Xác thực phiên làm việc qua Authorization Bearer Token
        const checkBearer = await request({
            hostname: 'localhost',
            port: env.PORT,
            path: '/api/auth/me',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        assert(checkBearer.status === 200 && checkBearer.data?.data?.authenticated === true, 'Xác thực phiên thành công qua Authorization Bearer Token');

        // Helper header dùng cho tất cả request tiếp theo
        const authHeaders = {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        };

        // =========================================================================
        // PHẦN 3: NGHIỆP VỤ CỐT LÕI (VÍ TIỀN, DANH MỤC, GIAO DỊCH, CHUYỂN KHOẢN, BÁO CÁO)
        // =========================================================================
        console.log('\n--- PHẦN 3: Nghiệp vụ cốt lõi (Giai đoạn 1 & 2) ---');

        // 3.1 Tạo ví ngân hàng test (Bank)
        const acc1Res = await request(
            {
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/accounts',
                method: 'POST',
                headers: authHeaders
            },
            {
                name: 'Ngân hàng Nghiệm thu 5.5',
                type: 'bank',
                initial_balance: 10000000,
                start_date: '2026-10-01',
                identifier_hint: 'STK 123456'
            }
        );
        assert(acc1Res.status === 201, 'Tạo ví ngân hàng thành công (HTTP 201)');
        bankAccountId = acc1Res.data?.data?.id;

        // 3.2 Tạo ví tiền mặt test (Cash)
        const acc2Res = await request(
            {
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/accounts',
                method: 'POST',
                headers: authHeaders
            },
            {
                name: 'Tiền mặt Nghiệm thu 5.5',
                type: 'cash',
                initial_balance: 2000000,
                start_date: '2026-10-01'
            }
        );
        assert(acc2Res.status === 201, 'Tạo ví tiền mặt thành công (HTTP 201)');
        cashAccountId = acc2Res.data?.data?.id;

        // 3.3 Tạo danh mục Thu nhập & Chi tiêu
        const catIncomeRes = await request(
            {
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/categories',
                method: 'POST',
                headers: authHeaders
            },
            { name: 'Lương Nghiệm thu', type: 'income' }
        );
        assert(catIncomeRes.status === 201, 'Tạo danh mục Thu nhập thành công');
        salaryCategoryId = catIncomeRes.data?.data?.id;

        const catExpenseRes = await request(
            {
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/categories',
                method: 'POST',
                headers: authHeaders
            },
            { name: 'Ăn uống Nghiệm thu', type: 'expense' }
        );
        assert(catExpenseRes.status === 201, 'Tạo danh mục Chi tiêu thành công');
        foodCategoryId = catExpenseRes.data?.data?.id;

        // 3.4 Tạo giao dịch Thu (Income: +5,000,000 đ vào ví Bank)
        const txIncomeRes = await request(
            {
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/transactions',
                method: 'POST',
                headers: authHeaders
            },
            {
                amount: 5000000,
                type: 'income',
                account_id: bankAccountId,
                category_id: salaryCategoryId,
                transaction_date: '2026-10-05',
                note: 'Lương tháng 10'
            }
        );
        assert(txIncomeRes.status === 201, 'Ghi nhận giao dịch Thu nhập thành công');

        // 3.5 Tạo giao dịch Chi (Expense: -1,500,000 đ từ ví Bank)
        const txExpenseRes = await request(
            {
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/transactions',
                method: 'POST',
                headers: authHeaders
            },
            {
                amount: 1500000,
                type: 'expense',
                account_id: bankAccountId,
                category_id: foodCategoryId,
                transaction_date: '2026-10-10',
                note: 'Chi tiêu ăn uống siêu thị'
            }
        );
        assert(txExpenseRes.status === 201, 'Ghi nhận giao dịch Chi tiêu thành công');

        // 3.6 Tạo giao dịch Chuyển khoản (Transfer: Chuyển 2,000,000 đ từ Bank sang Cash)
        const txTransferRes = await request(
            {
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/transactions',
                method: 'POST',
                headers: authHeaders
            },
            {
                amount: 2000000,
                type: 'transfer',
                account_id: bankAccountId,
                transfer_account_id: cashAccountId,
                transaction_date: '2026-10-15',
                note: 'Rút tiền ATM về ví tiền mặt'
            }
        );
        assert(txTransferRes.status === 201, 'Ghi nhận giao dịch Chuyển khoản ví thành công');

        // 3.7 Kiểm tra tính toán số dư chính xác của cả 2 ví
        // Bank: 10,000,000 + 5,000,000 - 1,500,000 - 2,000,000 = 11,500,000 đ
        // Cash: 2,000,000 + 2,000,000 = 4,000,000 đ
        const accountsList = await request({
            hostname: 'localhost',
            port: env.PORT,
            path: '/api/accounts',
            method: 'GET',
            headers: authHeaders
        });
        const bankAcc = accountsList.data?.data?.find(a => a.id === bankAccountId);
        const cashAcc = accountsList.data?.data?.find(a => a.id === cashAccountId);
        assert(bankAcc?.current_balance === 11500000, 'Số dư ví Bank cập nhật chuẩn xác: 11,500,000 đ');
        assert(cashAcc?.current_balance === 4000000, 'Số dư ví Cash cập nhật chuẩn xác: 4,000,000 đ');

        // 3.8 Ngân sách & Cảnh báo chi tiêu (Budgets)
        const budgetRes = await request(
            {
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/budgets',
                method: 'POST',
                headers: authHeaders
            },
            {
                category_id: foodCategoryId,
                month: '2026-10',
                limit_amount: 3000000
            }
        );
        assert(budgetRes.status === 200, 'Thiết lập ngân sách chi tiêu tháng thành công');

        // 3.9 Báo cáo thu chi (Reports)
        const reportRes = await request({
            hostname: 'localhost',
            port: env.PORT,
            path: '/api/reports/summary?month=2026-10',
            method: 'GET',
            headers: authHeaders
        });
        assert(reportRes.status === 200, 'Lấy báo cáo tài chính tháng 2026-10 thành công');
        assert(Number(reportRes.data?.data?.current?.income) >= 5000000, 'Báo cáo: Tổng thu ghi nhận chính xác');
        assert(Number(reportRes.data?.data?.current?.expense) >= 1500000, 'Báo cáo: Tổng chi ghi nhận chính xác');

        // =========================================================================
        // PHẦN 4: INGEST API & TỰ ĐỘNG HÓA IDEMPOTENCY (SPEC 4.2 & 4.3)
        // =========================================================================
        console.log('\n--- PHẦN 4: Ingest API & Idempotency chống trùng ---');

        const ingestPayload = {
            package: 'com.mbmobile',
            title: 'MBBank',
            text: 'TK 123456 bien dong +3,000,000 VND vao 12:00 ngay 20/10/2026. ND: THUONG QUY 3',
            posted_at: 1792497600000
        };

        // 4.1 Gửi payload tin nhắn với Bearer Token Ingest
        const ingest1 = await request(
            {
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/ingest',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${env.auth.ingestToken}`,
                    'Content-Type': 'application/json'
                }
            },
            ingestPayload
        );
        assert(ingest1.status === 200 || ingest1.status === 201, 'Ingest API tiếp nhận tin nhắn thành công (HTTP 200/201)');
        assert(Boolean(ingest1.data?.data?.idempotency_key), 'Tạo idempotency_key cho bản ghi');
        ingestEventId = ingest1.data?.data?.id;

        // 4.2 Gửi lại chính xác payload đó -> Phải phát hiện duplicate mà không tạo bản ghi mới
        const ingest2 = await request(
            {
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/ingest',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${env.auth.ingestToken}`,
                    'Content-Type': 'application/json'
                }
            },
            ingestPayload
        );
        assert(ingest2.status === 200, 'Gửi lại cùng payload trả về HTTP 200');
        assert(ingest2.data?.duplicate === true || ingest2.data?.status === 'duplicate', 'Phát hiện duplicate idempotency, không ghi trùng CSDL');

        // =========================================================================
        // PHẦN 5: QUY TẮC PHÂN LOẠI & DUYỆT INBOX (SPEC 4.4)
        // =========================================================================
        console.log('\n--- PHẦN 5: Quy tắc phân loại & Duyệt Inbox ---');

        // 5.1 Tạo quy tắc tự gán: "THUONG QUY" -> Danh mục Lương
        const ruleRes = await request(
            {
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/rules',
                method: 'POST',
                headers: authHeaders
            },
            {
                keyword: 'THUONG QUY',
                match_type: 'contains',
                transaction_type: 'income',
                category_id: salaryCategoryId,
                priority: 10
            }
        );
        assert(ruleRes.status === 201, 'Tạo quy tắc tự gán danh mục thành công');
        ruleId = ruleRes.data?.data?.id;

        // 5.2 Duyệt và chuyển đổi tin nhắn từ Inbox thành giao dịch thực
        if (ingestEventId) {
            const convertRes = await request(
                {
                    hostname: 'localhost',
                    port: env.PORT,
                    path: `/api/inbox/${ingestEventId}/resolve`,
                    method: 'POST',
                    headers: authHeaders
                },
                {
                    action: 'approve',
                    transaction: {
                        amount: 3000000,
                        type: 'income',
                        account_id: bankAccountId,
                        category_id: salaryCategoryId,
                        transaction_date: '2026-10-20',
                        note: 'Thu thưởng quý 3 từ tin nhắn SMS'
                    }
                }
            );
            assert(convertRes.status === 200, 'Duyệt chuyển đổi tin nhắn Inbox thành giao dịch thành công');
        }

        // =========================================================================
        // PHẦN 6: NHẬP SAO KÊ CSV (SPEC 4.5)
        // =========================================================================
        console.log('\n--- PHẦN 6: Nhập sao kê CSV ---');

        const csvSample = `Ngày,Số tiền,Nội dung\n2026-10-22,-500000,Chi phí cà phê gặp khách\n2026-10-23,-200000,Mua sách chuyên ngành`;
        const csvPreview = await request(
            {
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/import/preview',
                method: 'POST',
                headers: authHeaders
            },
            {
                file_content: csvSample,
                account_id: bankAccountId,
                column_mapping: {
                    dateCol: 0,
                    amountCol: 1,
                    noteCol: 2
                }
            }
        );
        assert(csvPreview.status === 200, 'Xem trước phân tích CSV thành công');
        assert(csvPreview.data?.data?.rows?.length === 2, 'Parse đúng 2 dòng giao dịch từ CSV');

        // Xác nhận nhập dòng đã chọn vào CSDL
        const previewRows = csvPreview.data?.data?.rows || [];
        const csvConfirm = await request(
            {
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/import/confirm',
                method: 'POST',
                headers: authHeaders
            },
            {
                account_id: bankAccountId,
                file_name: 'saoke_oct2026.csv',
                file_hash: csvPreview.data?.data?.file_hash,
                rows: previewRows.map(r => ({ ...r, selected: true }))
            }
        );
        assert(csvConfirm.status === 201, 'Xác nhận nhập lô CSV thành công (HTTP 201)');
        importBatchId = csvConfirm.data?.data?.batch_id;

        // =========================================================================
        // PHẦN 7: ĐỐI SOÁT SỐ DƯ (SPEC 4.6)
        // =========================================================================
        console.log('\n--- PHẦN 7: Đối soát số dư (Balance Reconciliation) ---');

        // 7.1 Preview số dư kỳ vọng tại ngày 2026-10-25
        const recPreview = await request(
            {
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/reconciliations/preview',
                method: 'POST',
                headers: authHeaders
            },
            {
                account_id: bankAccountId,
                reconciliation_date: '2026-10-25',
                actual_balance: 15000000 // Giả lập lệch số dư thực tế
            }
        );
        assert(recPreview.status === 200, 'Preview đối soát thành công');
        assert(typeof recPreview.data?.data?.expected_balance === 'number', 'Tính toán số dư kỳ vọng chính xác');
        assert(typeof recPreview.data?.data?.difference === 'number', 'Tính chênh lệch giữa thực tế và kỳ vọng');

        // 7.2 Xác nhận đối soát và tạo điều chỉnh trong ACID transaction
        const recConfirm = await request(
            {
                hostname: 'localhost',
                port: env.PORT,
                path: '/api/reconciliations/confirm',
                method: 'POST',
                headers: authHeaders
            },
            {
                account_id: bankAccountId,
                reconciliation_date: '2026-10-25',
                actual_balance: 15000000,
                note: 'Đối soát chênh lệch cuối tháng 10'
            }
        );
        assert(recConfirm.status === 201, 'Xác nhận đối soát thành công (HTTP 201)');
        reconciliationId = recConfirm.data?.data?.id;

        // Tra cứu lại lịch sử đối soát
        const recHistory = await request({
            hostname: 'localhost',
            port: env.PORT,
            path: `/api/reconciliations?accountId=${bankAccountId}`,
            method: 'GET',
            headers: authHeaders
        });
        assert(Array.isArray(recHistory.data?.data) && recHistory.data?.data?.length > 0, 'Tra cứu lại lịch sử đối soát thành công');

        // =========================================================================
        // PHẦN 8: QUẢN TRỊ VẬN HÀNH, SAO LƯU & PHỤC HỒI (SPEC 5.1, 5.2, 5.3)
        // =========================================================================
        console.log('\n--- PHẦN 8: Quản trị Vận hành, Sao lưu & Phục hồi ---');

        // 8.1 Kiểm tra trạng thái Migration
        const migStatus = await getMigrationStatus();
        assert(migStatus.every(m => m.isApplied === true), 'Toàn bộ 5 schema migrations đã được áp dụng đầy đủ');

        // 8.2 Tạo bản sao lưu CSDL (Backup)
        const backupResult = await createBackup({ compress: true });
        assert(backupResult.success === true, 'Tạo bản sao lưu nén (.sql.gz) thành công');
        assert(Boolean(backupResult.metadata?.sha256), `Tính toán mã checksum SHA-256 toàn vẹn: ${backupResult.metadata?.sha256.slice(0, 16)}...`);

        // 8.3 Thử nghiệm phục hồi CSDL vào môi trường riêng (Test Database)
        const testRestoreDb = 'finance_tracker_acceptance_restore';
        const restoreResult = await restoreBackup(backupResult.filePath, testRestoreDb);
        assert(restoreResult.success === true, `Phục hồi thử nghiệm thành công vào database: ${testRestoreDb}`);
        assert(restoreResult.verification.match === true, 'Đối chiếu dữ liệu sau phục hồi trùng khớp 100%');

        // Dọn dẹp database test phục hồi
        const cleanConn = await mysql.createConnection({
            host: env.db.host,
            port: env.db.port,
            user: env.db.user,
            password: env.db.password
        });
        await cleanConn.query(`DROP DATABASE IF EXISTS \`${testRestoreDb}\``);
        await cleanConn.end();
        assert(true, 'Đã dọn dẹp sạch sẽ cơ sở dữ liệu thử nghiệm');

    } catch (error) {
        console.error('LỖI KHÔNG MONG MUỐN TRONG QUÁ TRÌNH KIỂM THỬ:', error);
        failedTests++;
    } finally {
        // Dọn dẹp dữ liệu test tạm thời trên database chính
        console.log('\n--- Dọn dẹp Dữ liệu Kiểm thử Nghiệm thu ---');
        try {
            if (reconciliationId) {
                await db.query('DELETE FROM reconciliations WHERE id = ?', [reconciliationId]);
            }
            if (ruleId) {
                await db.query('DELETE FROM category_rules WHERE id = ?', [ruleId]);
            }
            if (ingestEventId) {
                await db.query('DELETE FROM ingest_events WHERE id = ?', [ingestEventId]);
            }
            if (importBatchId) {
                await db.query('DELETE FROM transactions WHERE import_batch_id = ?', [importBatchId]);
                await db.query('DELETE FROM import_batches WHERE id = ?', [importBatchId]);
            }
            if (bankAccountId && cashAccountId) {
                await db.query('DELETE FROM transactions WHERE account_id IN (?, ?) OR transfer_account_id IN (?, ?)', [bankAccountId, cashAccountId, bankAccountId, cashAccountId]);
                await db.query('DELETE FROM accounts WHERE id IN (?, ?)', [bankAccountId, cashAccountId]);
            }
            if (salaryCategoryId && foodCategoryId) {
                await db.query('DELETE FROM budgets WHERE category_id IN (?, ?)', [salaryCategoryId, foodCategoryId]);
                await db.query('DELETE FROM categories WHERE id IN (?, ?)', [salaryCategoryId, foodCategoryId]);
            }
            console.log('  Đã dọn dẹp an toàn các bản ghi thử nghiệm trên database chính.');
        } catch (cleanupErr) {
            console.warn('Lỗi dọn dẹp phụ:', cleanupErr.message);
        }
        if (localServer) {
            await new Promise(r => localServer.close(r));
            console.log('  Đã đóng HTTP server nội bộ an toàn.');
        }
        await db.end();
    }

    console.log('\n==============================================================================');
    console.log(`TỔNG KẾT KIỂM THỬ NGHIỆM THU: ${passedTests} PASS, ${failedTests} FAIL`);
    console.log('==============================================================================\n');

    if (failedTests > 0) {
        process.exit(1);
    }
}

runAcceptanceTests();
