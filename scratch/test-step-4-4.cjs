const http = require('http');
const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const db = require('../backend/config/db');
const authService = require('../backend/services/authService');
const ruleService = require('../backend/services/ruleService');

function request(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch {
                    resolve({ status: res.statusCode, raw: body });
                }
            });
        });
        req.on('error', reject);
        if (data) {
            req.write(typeof data === 'string' ? data : JSON.stringify(data));
        }
        req.end();
    });
}

async function runTests() {
    console.log('=== BẮT ĐẦU KIỂM THỬ BƯỚC 4.4 (CATEGORY RULES ENGINE & INBOX GỢI Ý) ===\n');
    let passed = 0;
    let failed = 0;

    function assert(condition, desc) {
        if (condition) {
            console.log(`  ✓ PASS: ${desc}`);
            passed++;
        } else {
            console.error(`  ✗ FAIL: ${desc}`);
            failed++;
        }
    }

    try {
        const jwtToken = authService.generateToken({ role: 'owner' });
        const ingestToken = process.env.INGEST_TOKEN;

        // Chuẩn bị dữ liệu danh mục để test
        const [categories] = await db.query('SELECT * FROM categories');
        let expenseCat = categories.find(c => c.type === 'expense');
        let incomeCat = categories.find(c => c.type === 'income');
        let altExpenseCat = categories.filter(c => c.type === 'expense')[1] || expenseCat;

        if (!expenseCat || !incomeCat) {
            throw new Error('Cần ít nhất 1 danh mục Thu và 1 danh mục Chi trong CSDL.');
        }

        const [accounts] = await db.query('SELECT * FROM accounts WHERE is_archived = 0 LIMIT 2');
        const testAccount = accounts[0];

        // --- PHẦN 1: UNIT TEST CHO RULE SERVICE & STRING NORMALIZATION ---
        console.log('[1] Kiểm tra Chuẩn hóa Chuỗi (normalizeText)');
        assert(ruleService.normalizeText('Cà phê Phúc Long') === 'ca phe phuc long', 'Loại bỏ dấu tiếng Việt đúng: "ca phe phuc long"');
        assert(ruleService.normalizeText('  ĐIỆN THOẠI   DI ĐỘNG  ') === 'dien thoai di dong', 'Xử lý ký tự đ/Đ và khoảng trắng thừa');

        // --- PHẦN 2: CRUD API QUY TẮC DANH MỤC ---
        console.log('\n[2] Kiểm tra CRUD API Quy tắc Danh mục (/api/rules)');

        // Test 2.1: Tạo quy tắc mới
        const createRes1 = await request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/rules',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            }
        }, {
            keyword: 'PHUC LONG',
            match_type: 'contains',
            transaction_type: 'expense',
            category_id: expenseCat.id,
            priority: 10
        });

        assert(createRes1.status === 201, `Tạo quy tắc PHUC LONG trả về 201 (status=${createRes1.status})`);
        const rule1 = createRes1.data?.data;
        assert(rule1?.keyword === 'PHUC LONG', `Từ khóa đúng: ${rule1?.keyword}`);
        assert(rule1?.category_id === expenseCat.id, `Category id đúng: ${rule1?.category_id}`);

        // Test 2.2: Tạo quy tắc có độ ưu tiên cao hơn để test xung đột
        const createRes2 = await request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/rules',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            }
        }, {
            keyword: 'GRAB',
            match_type: 'contains',
            transaction_type: 'expense',
            category_id: expenseCat.id,
            priority: 5
        });
        const ruleGrab = createRes2.data?.data;

        const createRes3 = await request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/rules',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            }
        }, {
            keyword: 'GRABFOOD',
            match_type: 'contains',
            transaction_type: 'expense',
            category_id: altExpenseCat.id,
            priority: 25 // Cao hơn GRAB (5)
        });
        const ruleGrabFood = createRes3.data?.data;
        assert(ruleGrabFood?.priority === 25, `Tạo quy tắc GRABFOOD priority=25`);

        // Test 2.3: Lấy danh sách quy tắc
        const listRes = await request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/rules',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        assert(listRes.status === 200, `Lấy danh sách quy tắc trả về 200 (status=${listRes.status})`);
        assert(Array.isArray(listRes.data?.data), 'Data là mảng quy tắc');

        // Test 2.4: Bật/tắt quy tắc (Toggle)
        const toggleRes = await request({
            hostname: 'localhost',
            port: 5000,
            path: `/api/rules/${rule1.id}/toggle`,
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        assert(toggleRes.status === 200, `Toggle quy tắc trả về 200`);
        assert(toggleRes.data?.is_active === false, `Quy tắc chuyển sang tắt (is_active=false)`);

        // Bật lại
        await request({
            hostname: 'localhost',
            port: 5000,
            path: `/api/rules/${rule1.id}/toggle`,
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });

        // --- PHẦN 3: KIỂM TRA TÍNH ỔN ĐỊNH CỦA RULE MATCHING ENGINE ---
        console.log('\n[3] Kiểm tra Giải quyết Xung đột & Độ ưu tiên (Deterministic Matching)');

        // Khi chuỗi chứa cả "GRAB" và "GRABFOOD", rule "GRABFOOD" (priority 25) phải thắng "GRAB" (priority 5)
        const matchRes1 = await ruleService.matchRule('Thanh toan GRABFOOD luc 12:30', 'expense');
        assert(matchRes1 !== null, 'Tìm thấy quy tắc khớp');
        assert(matchRes1.keyword === 'GRABFOOD', `Ưu tiên cao hơn thắng: ${matchRes1.keyword} == GRABFOOD (priority ${matchRes1.priority})`);
        assert(matchRes1.category_id === altExpenseCat.id, `Khớp đúng danh mục altExpenseCat`);

        // Khi chỉ có "GRAB", rule "GRAB" sẽ khớp
        const matchRes2 = await ruleService.matchRule('Di chuyen chuyen xe GRAB bike', 'expense');
        assert(matchRes2?.keyword === 'GRAB', `Khớp đúng rule GRAB: ${matchRes2?.keyword}`);

        // Tiếng Việt không dấu khớp với từ khóa có dấu hoặc ngược lại
        const matchRes3 = await ruleService.matchRule('Uong ca phe phuc long cung ban', 'expense');
        assert(matchRes3?.keyword === 'PHUC LONG', `Khớp không phân biệt dấu/chữ hoa: ${matchRes3?.keyword}`);

        // Khác loại giao dịch (income vs expense) không được khớp
        const matchRes4 = await ruleService.matchRule('Uong ca phe phuc long', 'income');
        assert(matchRes4 === null, 'Loại giao dịch không trùng thì không khớp');

        // --- PHẦN 4: TÍCH HỢP TỰ GỢI Ý DANH MỤC TRONG INGEST & INBOX ---
        console.log('\n[4] Kiểm tra Tự động Đề xuất Danh mục qua Ingest API');

        const uniqueKey = `test-rule-ingest-${Date.now()}`;
        const ingestRes = await request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/ingest',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Ingest-Token': ingestToken
            }
        }, {
            package: 'com.vcb.vietcombank',
            title: 'Biến động số dư',
            text: 'TK 0011008899 -85,000 VND luc 15:00 26/10/2026. ND: Thanh toan ca phe PHUC LONG',
            idempotency_key: uniqueKey
        });

        assert(ingestRes.status === 201, `Ingest thành công (status=${ingestRes.status})`);
        const eventId = ingestRes.data?.data?.id;

        // Lấy chi tiết Inbox Item để xem đề xuất danh mục
        const inboxItemRes = await request({
            hostname: 'localhost',
            port: 5000,
            path: `/api/inbox/${eventId}`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });

        const parsedJson = typeof inboxItemRes.data?.data?.parsed_json === 'string'
            ? JSON.parse(inboxItemRes.data.data.parsed_json)
            : inboxItemRes.data?.data?.parsed_json;

        assert(inboxItemRes.data?.data?.status === 'pending', `Trạng thái Inbox là 'pending' (không tự tạo giao dịch)`);
        assert(parsedJson?.suggested_category_id === expenseCat.id, `Tự động đề xuất đúng danh mục: suggested_category_id=${parsedJson?.suggested_category_id} == ${expenseCat.id}`);
        assert(parsedJson?.suggested_category_name === expenseCat.name, `Tên danh mục đề xuất: ${parsedJson?.suggested_category_name}`);
        assert(parsedJson?.matched_rule?.keyword === 'PHUC LONG', `Quy tắc khớp ghi nhận: ${parsedJson?.matched_rule?.keyword}`);

        // --- PHẦN 5: TẠO QUY TẮC MỚI TỪ GIAO DỊCH ĐÃ ĐƯỢC DUYỆT (SPEC 4.4) ---
        console.log('\n[5] Kiểm tra Tạo quy tắc mới từ hành động duyệt Inbox');

        const approveWithRuleRes = await request({
            hostname: 'localhost',
            port: 5000,
            path: `/api/inbox/${eventId}/resolve`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            }
        }, {
            action: 'approve',
            transaction: {
                amount: 85000,
                type: 'expense',
                account_id: testAccount.id,
                category_id: altExpenseCat.id,
                transaction_date: '2026-10-26'
            },
            create_rule: {
                keyword: 'FAHASA_SACH',
                category_id: altExpenseCat.id,
                priority: 30
            }
        });

        assert(approveWithRuleRes.status === 200, `Duyệt tạo giao dịch kèm tạo rule trả về 200`);
        assert(approveWithRuleRes.data?.data?.status === 'approved', `Trạng thái Inbox chuyển sang approved`);

        // Kiểm tra xem rule 'FAHASA_SACH' đã được tạo trong bảng category_rules chưa
        const [fahasaRows] = await db.query('SELECT * FROM category_rules WHERE keyword = ?', ['FAHASA_SACH']);
        assert(fahasaRows.length === 1, 'Quy tắc mới FAHASA_SACH đã được lưu vào database');
        assert(fahasaRows[0].category_id === altExpenseCat.id, `Gán đúng category_id=${altExpenseCat.id}`);
        assert(fahasaRows[0].priority === 30, `Priority đúng: ${fahasaRows[0].priority}`);

        // Dọn dẹp các quy tắc test
        await db.query('DELETE FROM category_rules WHERE keyword IN (?, ?, ?, ?)', ['PHUC LONG', 'GRAB', 'GRABFOOD', 'FAHASA_SACH']);

    } catch (err) {
        console.error('LỖI KIỂM THỬ:', err);
        failed++;
    } finally {
        await db.end();
        console.log(`\n========================================`);
        console.log(`KẾT QUẢ: ${passed} PASS, ${failed} FAIL`);
        console.log(`========================================`);
        process.exit(failed > 0 ? 1 : 0);
    }
}

runTests();

