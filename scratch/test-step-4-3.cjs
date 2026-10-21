const http = require('http');
const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const db = require('../backend/config/db');
const { parseNotification } = require('../backend/parsers');
const vcbParser = require('../backend/parsers/vcbParser');
const genericParser = require('../backend/parsers/genericParser');
const authService = require('../backend/services/authService');

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
    console.log('=== BẮT ĐẦU KIỂM THỬ BƯỚC 4.3 (PARSER & INBOX DUYỆT ACID) ===\n');
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
        const ingestToken = process.env.INGEST_TOKEN;
        const jwtToken = authService.generateToken({ role: 'owner' });

        // --- PHẦN 1: UNIT TEST CHO PURE PARSER FUNCTIONS ---
        console.log('[1] Kiểm tra Vietcombank Parser (vcbParser)');
        
        // Test 1.1: Chi tiêu VCB
        const vcbExpenseSample = 'TK 0011008899 -120,000 VND luc 15:30 15/10/2026. So du: 15,400,000 VND. ND: Thanh toan ca phe Phuc Long';
        const vcbExpResult = vcbParser.parse(vcbExpenseSample, '', 'com.vcb.vietcombank');
        assert(vcbExpResult.success === true, 'Bóc tách thành công tin VCB chi tiêu');
        assert(vcbExpResult.detected_amount === 120000, `Số tiền đúng: ${vcbExpResult.detected_amount} == 120000`);
        assert(vcbExpResult.detected_type === 'expense', `Loại đúng: ${vcbExpResult.detected_type} == expense`);
        assert(vcbExpResult.detected_date === '2026-10-15', `Ngày đúng: ${vcbExpResult.detected_date} == 2026-10-15`);
        assert(vcbExpResult.account_identifier === '0011008899', `Số TK đúng: ${vcbExpResult.account_identifier} == 0011008899`);
        assert(vcbExpResult.confidence === 'high', `Độ tin cậy: ${vcbExpResult.confidence} == high`);
        assert(vcbExpResult.note === 'Thanh toan ca phe Phuc Long', `Ghi chú đúng: ${vcbExpResult.note}`);

        // Test 1.2: Thu nhập VCB
        const vcbIncomeSample = 'Biến động số dư: TK 0011008899 +2,500,000 VND lúc 09:15 21/10/2026. Số dư cuối: 17,900,000 VND. Nội dung: Nhan luong thang 10';
        const vcbIncResult = vcbParser.parse(vcbIncomeSample, 'Biến động số dư', 'com.vietcombank.digibank');
        assert(vcbIncResult.success === true, 'Bóc tách thành công tin VCB thu tiền vào');
        assert(vcbIncResult.detected_amount === 2500000, `Số tiền đúng: ${vcbIncResult.detected_amount} == 2500000`);
        assert(vcbIncResult.detected_type === 'income', `Loại đúng: ${vcbIncResult.detected_type} == income`);
        assert(vcbIncResult.detected_date === '2026-10-21', `Ngày đúng: ${vcbIncResult.detected_date} == 2026-10-21`);
        assert(vcbIncResult.confidence === 'high', `Độ tin cậy cao`);

        // Test 1.3: Generic Parser cho ngân hàng khác
        console.log('\n[2] Kiểm tra Generic Parser fallback');
        const genericSample = 'Tài khoản 1903345678 tại Techcombank đã trừ 85.000 VND lúc 18:20 19/10/2026. GD Shopee';
        const genResult = genericParser.parse(genericSample, '', 'com.techcombank.mobile');
        assert(genResult.success === true, 'Generic parser bóc tách thành công');
        assert(genResult.detected_amount === 85000, `Số tiền generic: ${genResult.detected_amount} == 85000`);
        assert(genResult.detected_type === 'expense', `Loại generic: ${genResult.detected_type} == expense`);
        assert(genResult.detected_date === '2026-10-19', `Ngày generic: ${genResult.detected_date} == 2026-10-19`);
        assert(genResult.account_identifier === '1903345678', `Số TK generic: ${genResult.account_identifier}`);

        // Test 1.4: Tin rác / không có số tiền
        const spamSample = 'Chúc mừng quý khách nhận voucher 50% xem chi tiết tại link';
        const spamResult = parseNotification(spamSample, 'Khuyến mãi', 'com.shopee');
        assert(spamResult.success === false, 'Tin không có tiền trả về success: false');
        assert(spamResult.confidence === 'low', 'Confidence low cho tin rác');

        // --- PHẦN 2: TÍCH HỢP INGEST, SO KHỚP VÍ VÀ ACID TRANSACTION ---
        console.log('\n[3] Kiểm tra Ingest API và Gợi ý Ví nguồn tự động (identifier_hint)');
        
        // Tìm hoặc chọn ví Ngân hàng VCB để test gợi ý ví
        const [accRows] = await db.query('SELECT * FROM accounts WHERE id = 2 AND is_archived = 0');
        const testAccount = accRows.length > 0 ? accRows[0] : (await db.query('SELECT * FROM accounts WHERE is_archived = 0 LIMIT 1'))[0][0];
        await db.query('UPDATE accounts SET identifier_hint = ? WHERE id = ?', ['001100', testAccount.id]);
        console.log(`  -> Đã gán identifier_hint='001100' cho ví: "${testAccount.name}" (ID: ${testAccount.id})`);

        // Tìm 1 category để dùng khi duyệt
        const [catRows] = await db.query('SELECT * FROM categories LIMIT 1');
        const testCategory = catRows[0];

        // Gửi thông báo VCB đến Ingest API
        const uniqueKey = `test-vcb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
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
            text: 'TK 0011008899 -150,000 VND luc 10:00 21/10/2026. So du: 15,000,000 VND. ND: Mua sach Fahasa',
            idempotency_key: uniqueKey,
            device_id: 'TEST_DEVICE_43'
        });

        assert(ingestRes.status === 201, `Ingest API trả về 201 Created (status=${ingestRes.status})`);
        const eventId = ingestRes.data?.data?.id;
        assert(Boolean(eventId), `Nhận được event id: ${eventId}`);

        // Lấy chi tiết thông báo trong Inbox
        const inboxItemRes = await request({
            hostname: 'localhost',
            port: 5000,
            path: `/api/inbox/${eventId}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${jwtToken}`
            }
        });

        assert(inboxItemRes.status === 200, 'Lấy chi tiết inbox item thành công (200)');
        const parsedJson = typeof inboxItemRes.data?.data?.parsed_json === 'string'
            ? JSON.parse(inboxItemRes.data.data.parsed_json)
            : inboxItemRes.data?.data?.parsed_json;

        assert(inboxItemRes.data?.data?.parser_name === 'vcb_parser', `Parser name là vcb_parser (${inboxItemRes.data?.data?.parser_name})`);
        assert(parsedJson?.confidence === 'high', `Confidence là high (${parsedJson?.confidence})`);
        assert(parsedJson?.suggested_account_id === testAccount.id, `Tự động khớp đúng ví nguồn: suggested_account_id=${parsedJson?.suggested_account_id} == ${testAccount.id}`);
        assert(parsedJson?.suggested_account_name === testAccount.name, `Tên ví gợi ý khớp: ${parsedJson?.suggested_account_name}`);
        assert(parsedJson?.detected_date === '2026-10-21', `Ngày nhận diện: ${parsedJson?.detected_date}`);

        // --- PHẦN 3: DUYỆT GIAO DỊCH QUA DATABASE TRANSACTION (ACID) ---
        console.log('\n[4] Kiểm tra Duyệt thông báo qua ACID Transaction');
        
        const approveRes = await request({
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
                amount: parsedJson.detected_amount,
                type: parsedJson.detected_type,
                account_id: testAccount.id,
                category_id: testCategory.id,
                transaction_date: parsedJson.detected_date,
                note: parsedJson.note || 'Test approve note'
            }
        });

        assert(approveRes.status === 200, `Duyệt thành công qua transaction (status=${approveRes.status})`);
        const createdTxId = approveRes.data?.data?.transaction_id;
        assert(Boolean(createdTxId), `Giao dịch mới được tạo: #${createdTxId}`);

        // Xác minh bản ghi giao dịch trong cơ sở dữ liệu
        const [txRows] = await db.query('SELECT * FROM transactions WHERE id = ?', [createdTxId]);
        assert(txRows.length === 1, 'Giao dịch tồn tại trong bảng transactions');
        assert(Number(txRows[0].amount) === 150000, `Số tiền giao dịch chuẩn xác: ${txRows[0].amount}`);
        assert(txRows[0].account_id === testAccount.id, `Ví chuẩn xác: ${txRows[0].account_id}`);

        // Xác minh trạng thái bản ghi inbox sau duyệt
        const [eventRows] = await db.query('SELECT * FROM ingest_events WHERE id = ?', [eventId]);
        assert(eventRows[0].status === 'approved', `Trạng thái event đã chuyển thành 'approved' (${eventRows[0].status})`);
        assert(eventRows[0].transaction_id === createdTxId, `Event liên kết transaction_id #${createdTxId}`);

        // --- PHẦN 4: CHỐNG DUYỆT 2 LẦN (DOUBLE APPROVAL PREVENTION) ---
        console.log('\n[5] Kiểm tra Ngăn chặn Duyệt 2 lần (Double Approval Prevention)');

        const doubleApproveRes = await request({
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
                amount: 150000,
                type: 'expense',
                account_id: testAccount.id,
                category_id: testCategory.id,
                transaction_date: '2026-10-21'
            }
        });

        assert(doubleApproveRes.status === 400, `Lần duyệt thứ 2 bị từ chối với mã 400 (status=${doubleApproveRes.status})`);
        assert(doubleApproveRes.data?.message?.includes('đã được duyệt'), `Thông báo lỗi chống duyệt 2 lần: "${doubleApproveRes.data?.message}"`);

        // --- PHẦN 5: KIỂM TRA THỬ LẠI PHÂN TÍCH (REPARSE) ---
        console.log('\n[6] Kiểm tra Reparse cho thông báo');
        
        // Tạo một thông báo
        const unparsedKey = `test-reparse-${Date.now()}`;
        const rawRes = await request({
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
            title: 'VCB Digibank',
            text: 'TK 0011008899 -50,000 VND luc 12:00 21/10/2026. ND: Nap the dien thoai',
            idempotency_key: unparsedKey
        });

        const rawEventId = rawRes.data?.data?.id;
        assert(Boolean(rawEventId), `Tạo tin nhắn kiểm thử reparse ID: ${rawEventId}`);

        // Thử gọi API reparse
        const reparseRes = await request({
            hostname: 'localhost',
            port: 5000,
            path: `/api/inbox/${rawEventId}/reparse`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${jwtToken}`
            }
        });

        assert(reparseRes.status === 200, `Reparse trả về 200 OK (status=${reparseRes.status})`);
        assert(reparseRes.data?.data?.status === 'pending', `Status sau reparse là 'pending' (${reparseRes.data?.data?.status})`);

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
