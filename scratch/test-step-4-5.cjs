const http = require('http');
const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const db = require('../backend/config/db');
const authService = require('../backend/services/authService');
const csvParser = require('../backend/parsers/csvParser');
const importService = require('../backend/services/importService');
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
    console.log('=== BẮT ĐẦU KIỂM THỬ BƯỚC 4.5 (NHẬP CSV SAO KÊ & CHỐNG TRÙNG) ===\n');
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

        // --- PHẦN 1: UNIT TEST CHO CSV PARSER ---
        console.log('[1] Kiểm tra Parser CSV thuần (csvParser)');

        // 1.1 BOM stripping & Delimiter detection
        const csvWithBom = '\uFEFFNgày;Số tiền;Nội dung\n15/10/2026;-50000;Grab';
        const detectedDelim = csvParser.detectDelimiter(csvWithBom);
        assert(detectedDelim === ';', `Phát hiện đúng dấu chấm phẩy (;): '${detectedDelim}'`);

        const grid = csvParser.parseCsvToGrid(csvWithBom);
        assert(grid.rows.length === 2, `Bóc tách đúng 2 dòng (header + 1 dòng): ${grid.rows.length}`);
        assert(grid.rows[0][0] === 'Ngày', `Bỏ BOM thành công: "${grid.rows[0][0]}" == "Ngày"`);

        // 1.2 Quote handling with commas inside cell
        const quotedCsv = 'Date,Amount,Note\n2026-10-15,"-120,000","Mua banh, ca phe Phuc Long"';
        const quotedGrid = csvParser.parseCsvToGrid(quotedCsv);
        assert(quotedGrid.rows[1][1] === '-120,000', `Ô trong ngoặc kép giữ nguyên: "${quotedGrid.rows[1][1]}"`);
        assert(quotedGrid.rows[1][2] === 'Mua banh, ca phe Phuc Long', `Dấu phẩy trong ô không bị tách dòng: "${quotedGrid.rows[1][2]}"`);

        // 1.3 Date normalization
        assert(csvParser.parseDate('15/10/2026') === '2026-10-15', 'DD/MM/YYYY -> 2026-10-15');
        assert(csvParser.parseDate('2026-10-15') === '2026-10-15', 'YYYY-MM-DD -> 2026-10-15');
        assert(csvParser.parseDate('15-10-2026') === '2026-10-15', 'DD-MM-YYYY -> 2026-10-15');
        assert(csvParser.parseDate('15/10/26') === '2026-10-15', 'DD/MM/YY -> 2026-10-15');
        assert(csvParser.parseDate('99/99/2026') === null, 'Ngày sai -> null');

        // 1.4 Money normalization
        const m1 = csvParser.parseMoney('150.000 VND');
        assert(m1?.amount === 150000 && m1?.type === 'income', `150.000 VND -> income 150000 (${m1?.amount}, ${m1?.type})`);

        const m2 = csvParser.parseMoney('-250,000');
        assert(m2?.amount === 250000 && m2?.type === 'expense', `-250,000 -> expense 250000`);

        const m3 = csvParser.parseMoney('(85.000 đ)');
        assert(m3?.amount === 85000 && m3?.type === 'expense', `(85.000 đ) -> expense 85000`);

        // 1.5 Auto column detection
        const sampleHeaders = ['Ngày GD', 'Số tiền phát sinh', 'Nội dung thanh toán'];
        const mapping = csvParser.detectColumnMapping(sampleHeaders);
        assert(mapping.dateCol === 0, `Nhận diện cột Ngày: ${mapping.dateCol} == 0`);
        assert(mapping.amountCol === 1, `Nhận diện cột Số tiền: ${mapping.amountCol} == 1`);
        assert(mapping.noteCol === 2, `Nhận diện cột Ghi chú: ${mapping.noteCol} == 2`);

        // --- PHẦN 2: CHUẨN BỊ DỮ LIỆU & TEST PREVIEW API ---
        console.log('\n[2] Kiểm tra API Xem trước Sao kê (/api/import/preview)');

        const [accounts] = await db.query('SELECT * FROM accounts WHERE is_archived = 0 LIMIT 1');
        const testAccount = accounts[0];

        const [categories] = await db.query('SELECT * FROM categories');
        const expenseCat = categories.find(c => c.type === 'expense') || categories[0];

        // Tạo sẵn một quy tắc tự gán danh mục để test auto-category: "PHUC LONG" -> expenseCat
        await ruleService.createRule({
            keyword: 'CSV_PHUCLONG',
            match_type: 'contains',
            transaction_type: 'expense',
            category_id: expenseCat.id,
            priority: 50
        });

        // Tạo nội dung CSV kiểm thử có:
        // - Dòng 1: Hợp lệ, khớp rule "CSV_PHUCLONG"
        // - Dòng 2: Hợp lệ thu nhập
        // - Dòng 3: Lỗi ngày
        // - Dòng 4: Lỗi số tiền
        const sampleCsv = `Ngày,Số tiền,Nội dung
20/10/2026,-120000,Thanh toan tai CSV_PHUCLONG
21/10/2026,3500000,Nhan tien chuyen khoan
99/99/9999,-50000,Loi ngay
22/10/2026,0,Loi so tien bang 0`;

        const previewRes = await request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/import/preview',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            }
        }, {
            file_name: 'test_statement.csv',
            file_content: sampleCsv,
            account_id: testAccount.id
        });

        assert(previewRes.status === 200, `Preview API trả về 200 (status=${previewRes.status})`);
        const pData = previewRes.data?.data;
        assert(pData?.total_rows === 4, `Tổng số dòng: ${pData?.total_rows} == 4`);
        assert(pData?.valid_count === 2, `Số dòng hợp lệ: ${pData?.valid_count} == 2`);
        assert(pData?.error_count === 2, `Số dòng lỗi: ${pData?.error_count} == 2`);
        assert(Boolean(pData?.file_hash), `Có mã băm file_hash: ${pData?.file_hash?.slice(0, 10)}...`);

        // Kiểm tra tự gán danh mục từ Rule Engine cho Dòng 1
        const row1 = pData?.rows[0];
        assert(row1?.category_id === expenseCat.id, `Tự động gán đúng danh mục từ Rule: category_id=${row1?.category_id}`);
        assert(row1?.matched_rule?.keyword === 'CSV_PHUCLONG', `Ghi nhận quy tắc khớp: ${row1?.matched_rule?.keyword}`);

        // --- PHẦN 3: XÁC NHẬN NHẬP & DATABASE TRANSACTION (ACID) ---
        console.log('\n[3] Kiểm tra Xác nhận Nhập Sao kê (/api/import/confirm)');

        // Người dùng chọn 2 dòng hợp lệ (bỏ qua dòng lỗi)
        const rowsToImport = pData.rows.map(r => ({
            ...r,
            selected: r.status === 'valid'
        }));

        const confirmRes = await request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/import/confirm',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            }
        }, {
            file_name: 'test_statement.csv',
            file_hash: pData.file_hash,
            account_id: testAccount.id,
            rows: rowsToImport
        });

        assert(confirmRes.status === 201, `Confirm API trả về 201 Created (status=${confirmRes.status})`);
        const cData = confirmRes.data?.data;
        assert(cData?.imported_count === 2, `Đã nhập 2 dòng: ${cData?.imported_count}`);
        assert(cData?.skipped_count === 2, `Đã bỏ qua 2 dòng lỗi: ${cData?.skipped_count}`);
        assert(Boolean(cData?.batch_id), `Mã đợt nhập mới: #${cData?.batch_id}`);

        // Kiểm tra trong CSDL bảng import_batches
        const [batchRows] = await db.query('SELECT * FROM import_batches WHERE id = ?', [cData.batch_id]);
        assert(batchRows.length === 1, 'Bản ghi import_batches được tạo thành công');
        assert(batchRows[0].imported_rows === 2, `imported_rows = 2`);
        assert(batchRows[0].file_hash === pData.file_hash, `file_hash khớp`);

        // Kiểm tra các giao dịch trong bảng transactions được gắn import_batch_id và import_row_hash
        const [importedTxRows] = await db.query('SELECT * FROM transactions WHERE import_batch_id = ?', [cData.batch_id]);
        assert(importedTxRows.length === 2, `Tìm thấy 2 giao dịch liên kết với batch #${cData.batch_id}`);
        assert(Boolean(importedTxRows[0].import_row_hash), `import_row_hash được lưu trữ`);

        // --- PHẦN 4: CHỐNG NHẬP TRÙNG LẶP (DUPLICATE DETECTION) ---
        console.log('\n[4] Kiểm tra Phát hiện & Chống Nhập Trùng lặp');

        // Thử preview lại cùng file này
        const rePreviewRes = await request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/import/preview',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            }
        }, {
            file_name: 'test_statement.csv',
            file_content: sampleCsv,
            account_id: testAccount.id
        });

        const reData = rePreviewRes.data?.data;
        assert(reData?.is_file_duplicate === true, 'Hệ thống cảnh báo file đã từng được nhập trước đó (is_file_duplicate = true)');
        assert(reData?.duplicate_count === 2, `Cả 2 dòng hợp lệ trước đó giờ được đánh dấu nghi trùng (duplicate_count = 2)`);
        assert(reData?.rows[0]?.status === 'duplicate', `Dòng 1 chuyển trạng thái thành 'duplicate'`);

        // --- PHẦN 5: LỊCH SỬ ĐỢT NHẬP & BÁO CÁO LỖI ---
        console.log('\n[5] Kiểm tra Lịch sử Đợt Nhập (/api/import/batches)');

        const batchesRes = await request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/import/batches',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        assert(batchesRes.status === 200, `Lấy lịch sử đợt nhập thành công (status=${batchesRes.status})`);
        assert(Array.isArray(batchesRes.data?.data), 'Data là danh sách các batch');

        const batchDetailRes = await request({
            hostname: 'localhost',
            port: 5000,
            path: `/api/import/batches/${cData.batch_id}`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        assert(batchDetailRes.status === 200, `Lấy chi tiết batch thành công`);
        const errLog = typeof batchDetailRes.data?.data?.error_log === 'string'
            ? JSON.parse(batchDetailRes.data.data.error_log)
            : batchDetailRes.data?.data?.error_log;
        assert(Array.isArray(errLog) && errLog.length === 2, `error_log lưu chi tiết 2 dòng bị bỏ qua: ${errLog?.length}`);

        // Dọn dẹp dữ liệu kiểm thử
        await db.query('DELETE FROM transactions WHERE import_batch_id = ?', [cData.batch_id]);
        await db.query('DELETE FROM import_batches WHERE id = ?', [cData.batch_id]);
        await db.query('DELETE FROM category_rules WHERE keyword = ?', ['CSV_PHUCLONG']);

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

