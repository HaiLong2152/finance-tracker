/**
 * Script kiểm thử tự động Bước 4.6: Đối soát số dư (Balance Reconciliation)
 * Chạy với: node scratch/test-step-4-6.cjs
 */
const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const db = require('../backend/config/db');
const reconciliationService = require('../backend/services/reconciliationService');
const reconciliationRepository = require('../backend/repositories/reconciliationRepository');
const accountRepository = require('../backend/repositories/accountRepository');

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
    console.log('=== BẮT ĐẦU KIỂM THỬ BƯỚC 4.6: ĐỐI SOÁT SỐ DƯ (BALANCE RECONCILIATION) ===\n');

    let testAccountId = null;
    let incomeCatId = null;
    let expenseCatId = null;

    try {
        // 0. Chuẩn bị dữ liệu kiểm thử độc lập
        console.log('--- 0. Chuẩn bị dữ liệu ví & danh mục test ---');
        const [accRes] = await db.query(
            `INSERT INTO accounts (name, type, initial_balance, start_date, sort_order)
             VALUES ('Ví Test Đối Soát 4.6', 'bank', 10000000, '2026-10-01', 99)`
        );
        testAccountId = accRes.insertId;
        assert(testAccountId > 0, 'Tạo ví test thành công (ID: ' + testAccountId + ')');

        // Tìm danh mục điều chỉnh mặc định
        const defaultIncomeCat = await reconciliationRepository.findAdjustmentCategory('income');
        const defaultExpenseCat = await reconciliationRepository.findAdjustmentCategory('expense');
        assert(defaultIncomeCat !== null && defaultIncomeCat.type === 'income', 'Có danh mục điều chỉnh Thu nhập mặc định');
        assert(defaultExpenseCat !== null && defaultExpenseCat.type === 'expense', 'Có danh mục điều chỉnh Chi tiêu mặc định');
        incomeCatId = defaultIncomeCat.id;
        expenseCatId = defaultExpenseCat.id;

        // Thêm 2 giao dịch ban đầu cho ví test
        // Thu: 2,000,000 vào ngày 2026-10-05
        await db.query(
            `INSERT INTO transactions (amount, type, account_id, category_id, transaction_date, note)
             VALUES (2000000, 'income', ?, ?, '2026-10-05', 'Thu test 1')`,
            [testAccountId, incomeCatId]
        );
        // Chi: 1,000,000 vào ngày 2026-10-10
        await db.query(
            `INSERT INTO transactions (amount, type, account_id, category_id, transaction_date, note)
             VALUES (1000000, 'expense', ?, ?, '2026-10-10', 'Chi test 1')`,
            [testAccountId, expenseCatId]
        );

        // Kỳ vọng tại 2026-10-15: 10,000,000 + 2,000,000 - 1,000,000 = 11,000,000 đ.
        console.log('\n--- 1. Kiểm thử Preview Đối soát (Tính toán số dư kỳ vọng & phân rã) ---');

        // 1.1 Preview khớp số dư (actual = 11,000,000)
        const previewExact = await reconciliationService.previewReconciliation({
            account_id: testAccountId,
            reconciliation_date: '2026-10-15',
            actual_balance: 11000000
        });
        assert(previewExact.expected_balance === 11000000, 'Preview: Số dư kỳ vọng chuẩn xác 11,000,000 đ');
        assert(previewExact.difference === 0, 'Preview: Chênh lệch = 0 đ');
        assert(previewExact.adjustment.type === 'none', 'Preview: adjustment.type là none');
        assert(previewExact.breakdown.initial_balance === 10000000, 'Breakdown: Số dư ban đầu = 10,000,000 đ');
        assert(previewExact.breakdown.total_income === 2000000, 'Breakdown: Tổng thu = 2,000,000 đ');
        assert(previewExact.breakdown.total_expense === 1000000, 'Breakdown: Tổng chi = 1,000,000 đ');
        assert(previewExact.breakdown.transaction_count === 2, 'Breakdown: Đếm đúng 2 giao dịch');

        // 1.2 Preview chênh lệch dương (actual = 11,500,000) -> Thừa 500,000 đ
        const previewOver = await reconciliationService.previewReconciliation({
            account_id: testAccountId,
            reconciliation_date: '2026-10-15',
            actual_balance: 11500000
        });
        assert(previewOver.difference === 500000, 'Preview Thừa tiền: difference = +500,000 đ');
        assert(previewOver.adjustment.type === 'income', 'Preview Thừa tiền: adjustment.type = income');
        assert(previewOver.adjustment.amount === 500000, 'Preview Thừa tiền: adjustment.amount = 500,000 đ');

        // 1.3 Preview chênh lệch âm (actual = 10,800,000) -> Thiếu 200,000 đ
        const previewUnder = await reconciliationService.previewReconciliation({
            account_id: testAccountId,
            reconciliation_date: '2026-10-15',
            actual_balance: 10800000
        });
        assert(previewUnder.difference === -200000, 'Preview Thiếu tiền: difference = -200,000 đ');
        assert(previewUnder.adjustment.type === 'expense', 'Preview Thiếu tiền: adjustment.type = expense');
        assert(previewUnder.adjustment.amount === 200000, 'Preview Thiếu tiền: adjustment.amount = 200,000 đ');

        // 1.4 Validate lỗi ngày đối soát trước start_date
        let dateErrorCaught = false;
        try {
            await reconciliationService.previewReconciliation({
                account_id: testAccountId,
                reconciliation_date: '2026-09-30', // Trước 2026-10-01
                actual_balance: 10000000
            });
        } catch (err) {
            dateErrorCaught = true;
            assert(err.statusCode === 400, 'Chặn chọn ngày đối soát trước ngày bắt đầu theo dõi của ví (HTTP 400)');
        }
        assert(dateErrorCaught, 'Bắt đúng exception khi reconciliation_date < start_date');

        console.log('\n--- 2. Kiểm thử Confirm Đối soát (Database Transaction ACID) ---');

        // 2.1 Kịch bản A: Confirm chênh lệch dương (+500,000 đ) -> Tạo giao dịch Thu điều chỉnh
        const confirmResultA = await reconciliationService.confirmReconciliation({
            account_id: testAccountId,
            reconciliation_date: '2026-10-15',
            actual_balance: 11500000,
            note: 'Kiểm thử chênh lệch dương 4.6'
        });
        assert(confirmResultA.success === true, 'Confirm A: Thực thi thành công');
        assert(confirmResultA.reconciliation.difference === 500000, 'Confirm A: Lưu difference = 500,000');
        assert(confirmResultA.reconciliation.transaction_id !== null, 'Confirm A: Có transaction_id điều chỉnh');
        assert(confirmResultA.reconciliation.transaction_type === 'income', 'Confirm A: Giao dịch điều chỉnh loại income');
        assert(confirmResultA.reconciliation.transaction_amount === 500000, 'Confirm A: Số tiền điều chỉnh đúng 500,000 đ');

        // Kiểm tra số dư tài khoản sau khi điều chỉnh A
        const updatedAccA = await accountRepository.findById(testAccountId);
        assert(updatedAccA.current_balance === 11500000, 'Sau Confirm A: Số dư tài khoản cập nhật đúng 11,500,000 đ');

        // 2.2 Kịch bản B: Confirm số dư khớp hoàn toàn (difference = 0)
        const confirmResultB = await reconciliationService.confirmReconciliation({
            account_id: testAccountId,
            reconciliation_date: '2026-10-16',
            actual_balance: 11500000,
            note: 'Kiểm thử số dư khớp 0 đ'
        });
        assert(confirmResultB.success === true, 'Confirm B: Thực thi thành công');
        assert(confirmResultB.reconciliation.difference === 0, 'Confirm B: difference = 0');
        assert(confirmResultB.reconciliation.transaction_id === null, 'Confirm B: Không tạo giao dịch thừa (transaction_id = null)');

        // 2.3 Kịch bản C: Confirm chênh lệch âm (-300,000 đ) -> Tạo giao dịch Chi điều chỉnh
        const confirmResultC = await reconciliationService.confirmReconciliation({
            account_id: testAccountId,
            reconciliation_date: '2026-10-20',
            actual_balance: 11200000, // 11,500,000 - 300,000
            note: 'Kiểm thử chênh lệch âm 4.6'
        });
        assert(confirmResultC.success === true, 'Confirm C: Thực thi thành công');
        assert(confirmResultC.reconciliation.difference === -300000, 'Confirm C: difference = -300,000');
        assert(confirmResultC.reconciliation.transaction_id !== null, 'Confirm C: Có transaction_id');
        assert(confirmResultC.reconciliation.transaction_type === 'expense', 'Confirm C: Giao dịch điều chỉnh loại expense');
        assert(confirmResultC.reconciliation.transaction_amount === 300000, 'Confirm C: Số tiền điều chỉnh 300,000 đ');

        // Kiểm tra số dư tài khoản sau khi điều chỉnh C
        const updatedAccC = await accountRepository.findById(testAccountId);
        assert(updatedAccC.current_balance === 11200000, 'Sau Confirm C: Số dư tài khoản cập nhật đúng 11,200,000 đ');

        console.log('\n--- 3. Kiểm thử API Lịch sử đối soát ---');
        const history = await reconciliationService.getReconciliations({ accountId: testAccountId });
        assert(Array.isArray(history) && history.length === 3, 'Lấy lịch sử đối soát của ví trả về đủ 3 bản ghi');
        assert(history[0].reconciliation_date >= history[1].reconciliation_date, 'Sắp xếp giảm dần theo ngày đối soát');

        const singleRecord = await reconciliationService.getReconciliationById(confirmResultA.reconciliation.id);
        assert(singleRecord !== null, 'Lấy chi tiết bản ghi đối soát theo ID thành công');
        assert(singleRecord.account_id === testAccountId, 'Bản ghi thuộc đúng ví test');

    } catch (error) {
        console.error('LỖI KHÔNG MONG MUỐN TRONG QUÁ TRÌNH TEST:', error);
        failedTests++;
    } finally {
        // Dọn dẹp dữ liệu test
        console.log('\n--- 4. Dọn dẹp dữ liệu kiểm thử ---');
        if (testAccountId) {
            try {
                await db.query('DELETE FROM reconciliations WHERE account_id = ?', [testAccountId]);
                await db.query('DELETE FROM transactions WHERE account_id = ?', [testAccountId]);
                await db.query('DELETE FROM accounts WHERE id = ?', [testAccountId]);
                console.log('  Đã dọn dẹp sạch ví test ID: ' + testAccountId);
            } catch (cleanupErr) {
                console.error('Lỗi dọn dẹp test data:', cleanupErr.message);
            }
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
