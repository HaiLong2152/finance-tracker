const db = require('../config/db');
const reconciliationRepository = require('../repositories/reconciliationRepository');
const accountRepository = require('../repositories/accountRepository');
const categoryRepository = require('../repositories/categoryRepository');
const AppError = require('../utils/AppError');
const { toBigInt, toSafeNumber } = require('../utils/money');

const isValidDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const formatDateStr = (dateVal) => {
    if (!dateVal) return '';
    if (typeof dateVal === 'string') return dateVal.slice(0, 10);
    if (dateVal instanceof Date) {
        const y = dateVal.getFullYear();
        const m = String(dateVal.getMonth() + 1).padStart(2, '0');
        const d = String(dateVal.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return String(dateVal).slice(0, 10);
};

/**
 * Validate thông tin đầu vào cho thao tác đối soát
 */
const validateInput = async (body, connection = null) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new AppError('Dữ liệu yêu cầu không hợp lệ.', 400);
    }

    const { account_id, reconciliation_date, actual_balance } = body;

    // 1. Kiểm tra account_id
    const numericAccountId = Number(account_id);
    if (!Number.isSafeInteger(numericAccountId) || numericAccountId <= 0) {
        throw new AppError('Vui lòng chọn tài khoản hợp lệ.', 400);
    }

    const executor = connection || db;
    const [accRows] = await executor.query(
        'SELECT id, name, type, initial_balance, DATE_FORMAT(start_date, \'%Y-%m-%d\') AS start_date, is_archived FROM accounts WHERE id = ?',
        [numericAccountId]
    );
    const account = accRows[0];
    if (!account) {
        throw new AppError('Tài khoản không tồn tại.', 404);
    }
    if (account.is_archived) {
        throw new AppError(`Tài khoản '${account.name}' đã bị lưu trữ, không thể thực hiện đối soát.`, 400);
    }

    // 2. Kiểm tra reconciliation_date
    if (!isValidDate(reconciliation_date)) {
        throw new AppError('Ngày đối soát không hợp lệ (định dạng YYYY-MM-DD).', 400);
    }

    const accountStartDate = formatDateStr(account.start_date);
    if (accountStartDate && reconciliation_date < accountStartDate) {
        throw new AppError(
            `Ngày đối soát (${reconciliation_date}) không được trước ngày bắt đầu theo dõi của ví '${account.name}' (${accountStartDate}).`,
            400
        );
    }

    // 3. Kiểm tra actual_balance
    if (actual_balance === undefined || actual_balance === null || actual_balance === '') {
        throw new AppError('Vui lòng nhập số dư thực tế.', 400);
    }
    const numericActualBalance = Number(actual_balance);
    if (!Number.isSafeInteger(numericActualBalance)) {
        throw new AppError('Số dư thực tế phải là một số nguyên an toàn hợp lệ.', 400);
    }

    return {
        account,
        accountId: numericAccountId,
        reconciliationDate: reconciliation_date,
        actualBalance: numericActualBalance
    };
};

/**
 * Tính toán số dư kỳ vọng và chênh lệch (Preview - không ghi DB)
 */
const previewReconciliation = async (body) => {
    const { account, accountId, reconciliationDate, actualBalance } = await validateInput(body);

    const calcResult = await reconciliationRepository.calculateExpectedBalance(accountId, reconciliationDate);
    if (!calcResult) {
        throw new AppError('Không tìm thấy thông tin tài khoản để tính toán số dư.', 404);
    }

    const actualBig = BigInt(actualBalance);
    const expectedBig = BigInt(calcResult.expected_balance);
    const diffBig = actualBig - expectedBig;
    const difference = toSafeNumber(diffBig, 'Chênh lệch');

    let adjustmentType = 'none';
    let adjustmentAmount = 0;
    let defaultCategory = null;

    if (difference > 0) {
        adjustmentType = 'income';
        adjustmentAmount = difference;
        defaultCategory = await reconciliationRepository.findAdjustmentCategory('income');
    } else if (difference < 0) {
        adjustmentType = 'expense';
        adjustmentAmount = Math.abs(difference);
        defaultCategory = await reconciliationRepository.findAdjustmentCategory('expense');
    }

    return {
        account: {
            id: account.id,
            name: account.name,
            type: account.type,
            start_date: account.start_date
        },
        reconciliation_date: reconciliationDate,
        actual_balance: actualBalance,
        expected_balance: calcResult.expected_balance,
        difference,
        breakdown: {
            initial_balance: calcResult.initial_balance,
            total_income: calcResult.total_income,
            total_expense: calcResult.total_expense,
            total_transfer_in: calcResult.total_transfer_in,
            total_transfer_out: calcResult.total_transfer_out,
            transaction_count: calcResult.transaction_count
        },
        adjustment: {
            type: adjustmentType,
            amount: adjustmentAmount,
            default_category: defaultCategory
        }
    };
};

/**
 * Xác nhận thực hiện đối soát trong MySQL Database Transaction (ACID)
 */
const confirmReconciliation = async (body) => {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
        const { accountId, reconciliationDate, actualBalance } = await validateInput(body, connection);

        // Khóa hàng tài khoản với FOR UPDATE để ngăn ngừa race condition
        const [lockedAccounts] = await connection.query(
            'SELECT id, name, type, start_date, is_archived FROM accounts WHERE id = ? FOR UPDATE',
            [accountId]
        );
        const lockedAccount = lockedAccounts[0];
        if (!lockedAccount || lockedAccount.is_archived) {
            throw new AppError('Tài khoản không khả dụng hoặc đã bị thay đổi.', 400);
        }

        // Tính toán số dư kỳ vọng chính xác tại thời điểm khóa
        const calcResult = await reconciliationRepository.calculateExpectedBalance(accountId, reconciliationDate, connection);
        if (!calcResult) {
            throw new AppError('Không thể tính toán số dư kỳ vọng.', 404);
        }

        const actualBig = BigInt(actualBalance);
        const expectedBig = BigInt(calcResult.expected_balance);
        const diffBig = actualBig - expectedBig;
        const difference = toSafeNumber(diffBig, 'Chênh lệch');

        let transactionId = null;

        // Nếu có chênh lệch, tạo giao dịch điều chỉnh
        if (difference !== 0) {
            const txType = difference > 0 ? 'income' : 'expense';
            const txAmount = Math.abs(difference);

            let categoryId = null;
            if (body.category_id) {
                const numericCatId = Number(body.category_id);
                if (Number.isSafeInteger(numericCatId) && numericCatId > 0) {
                    const [catRows] = await connection.query(
                        'SELECT id, name, type FROM categories WHERE id = ?',
                        [numericCatId]
                    );
                    const cat = catRows[0];
                    if (!cat) {
                        throw new AppError('Danh mục điều chỉnh không tồn tại.', 404);
                    }
                    if (cat.type !== txType) {
                        throw new AppError(
                            `Danh mục '${cat.name}' là danh mục ${cat.type === 'income' ? 'Thu' : 'Chi'}, không khớp với loại điều chỉnh ${txType === 'income' ? 'Thu' : 'Chi'}.`,
                            400
                        );
                    }
                    categoryId = cat.id;
                }
            }

            // Nếu không chỉ định hoặc không tìm thấy, lấy danh mục mặc định 'Điều chỉnh số dư'
            if (!categoryId) {
                const defaultCat = await reconciliationRepository.findAdjustmentCategory(txType);
                if (!defaultCat) {
                    throw new AppError(`Không tìm thấy danh mục điều chỉnh mặc định cho loại '${txType}'.`, 500);
                }
                categoryId = defaultCat.id;
            }

            const txNote = (typeof body.note === 'string' && body.note.trim())
                ? body.note.trim()
                : `Điều chỉnh số dư chênh lệch đối soát ngày ${reconciliationDate}`;

            const [txResult] = await connection.query(
                `INSERT INTO transactions (amount, type, account_id, category_id, transaction_date, note)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [txAmount, txType, accountId, categoryId, reconciliationDate, txNote]
            );
            transactionId = txResult.insertId;
        }

        // Lưu bản ghi lịch sử vào bảng reconciliations
        const recNote = (typeof body.note === 'string' && body.note.trim()) ? body.note.trim() : null;
        const recResult = await reconciliationRepository.createReconciliation(
            {
                account_id: accountId,
                reconciliation_date: reconciliationDate,
                expected_balance: calcResult.expected_balance,
                actual_balance: actualBalance,
                difference,
                transaction_id: transactionId,
                note: recNote
            },
            connection
        );

        await connection.commit();

        const createdRecord = await reconciliationRepository.findById(recResult.insertId);
        return {
            success: true,
            message: difference === 0
                ? 'Đối soát hoàn tất: Số dư thực tế hoàn toàn khớp với số dư kỳ vọng!'
                : `Đối soát hoàn tất: Đã tạo giao dịch điều chỉnh ${difference > 0 ? 'Thu' : 'Chi'} ${Math.abs(difference).toLocaleString('vi-VN')} đ để cân bằng số dư.`,
            reconciliation: createdRecord
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

/**
 * Lấy lịch sử các lần đối soát
 */
const getReconciliations = async (query = {}) => {
    let accountId = null;
    if (query.accountId) {
        const num = Number(query.accountId);
        if (Number.isSafeInteger(num) && num > 0) {
            accountId = num;
        }
    }
    return await reconciliationRepository.findAll({ accountId });
};

/**
 * Lấy chi tiết một lần đối soát
 */
const getReconciliationById = async (id) => {
    const numId = Number(id);
    if (!Number.isSafeInteger(numId) || numId <= 0) {
        throw new AppError('Mã đối soát không hợp lệ.', 400);
    }
    const item = await reconciliationRepository.findById(numId);
    if (!item) {
        throw new AppError('Không tìm thấy lịch sử đối soát.', 404);
    }
    return item;
};

module.exports = {
    previewReconciliation,
    confirmReconciliation,
    getReconciliations,
    getReconciliationById
};

