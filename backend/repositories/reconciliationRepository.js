const db = require('../config/db');
const { toBigInt, toSafeNumber } = require('../utils/money');

/**
 * Tính số dư kỳ vọng và phân rã các khoản phát sinh của một ví đến ngày đối soát
 * Công thức: initial_balance + Tổng thu - Tổng chi + Chuyển đến - Chuyển đi
 * (chỉ tính các giao dịch có transaction_date >= a.start_date và <= reconciliationDate)
 */
const calculateExpectedBalance = async (accountId, reconciliationDate, connection = null) => {
    const sql = `
        SELECT 
            a.id,
            a.name,
            a.type,
            a.initial_balance,
            DATE_FORMAT(a.start_date, '%Y-%m-%d') AS start_date,
            COALESCE(SUM(
                CASE WHEN t.type = 'income' AND t.account_id = a.id AND t.transaction_date >= a.start_date AND t.transaction_date <= ? THEN t.amount ELSE 0 END
            ), 0) AS total_income,
            COALESCE(SUM(
                CASE WHEN t.type = 'expense' AND t.account_id = a.id AND t.transaction_date >= a.start_date AND t.transaction_date <= ? THEN t.amount ELSE 0 END
            ), 0) AS total_expense,
            COALESCE(SUM(
                CASE WHEN t.type = 'transfer' AND t.transfer_account_id = a.id AND t.transaction_date >= a.start_date AND t.transaction_date <= ? THEN t.amount ELSE 0 END
            ), 0) AS total_transfer_in,
            COALESCE(SUM(
                CASE WHEN t.type = 'transfer' AND t.account_id = a.id AND t.transaction_date >= a.start_date AND t.transaction_date <= ? THEN t.amount ELSE 0 END
            ), 0) AS total_transfer_out,
            COUNT(DISTINCT CASE WHEN t.transaction_date >= a.start_date AND t.transaction_date <= ? THEN t.id ELSE NULL END) AS transaction_count
        FROM accounts a
        LEFT JOIN transactions t 
            ON (t.account_id = a.id OR t.transfer_account_id = a.id)
        WHERE a.id = ?
        GROUP BY a.id
    `;

    const executor = connection || db;
    const [rows] = await executor.query(sql, [
        reconciliationDate,
        reconciliationDate,
        reconciliationDate,
        reconciliationDate,
        reconciliationDate,
        accountId
    ]);

    if (!rows || rows.length === 0) return null;

    const row = rows[0];
    const initialBalance = toBigInt(row.initial_balance);
    const totalIncome = toBigInt(row.total_income);
    const totalExpense = toBigInt(row.total_expense);
    const totalTransferIn = toBigInt(row.total_transfer_in);
    const totalTransferOut = toBigInt(row.total_transfer_out);

    const expectedBalanceBigInt = initialBalance + totalIncome - totalExpense + totalTransferIn - totalTransferOut;

    return {
        account_id: row.id,
        account_name: row.name,
        account_type: row.type,
        start_date: row.start_date,
        initial_balance: toSafeNumber(initialBalance, 'Số dư ban đầu'),
        total_income: toSafeNumber(totalIncome, 'Tổng thu'),
        total_expense: toSafeNumber(totalExpense, 'Tổng chi'),
        total_transfer_in: toSafeNumber(totalTransferIn, 'Tổng chuyển đến'),
        total_transfer_out: toSafeNumber(totalTransferOut, 'Tổng chuyển đi'),
        transaction_count: Number(row.transaction_count) || 0,
        expected_balance: toSafeNumber(expectedBalanceBigInt, 'Số dư kỳ vọng')
    };
};

/**
 * Tạo bản ghi lịch sử đối soát trong reconciliations
 */
const createReconciliation = async (data, connection = null) => {
    const {
        account_id,
        reconciliation_date,
        expected_balance,
        actual_balance,
        difference,
        transaction_id = null,
        note = null
    } = data;

    const sql = `
        INSERT INTO reconciliations 
        (account_id, reconciliation_date, expected_balance, actual_balance, difference, transaction_id, note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const executor = connection || db;
    const [result] = await executor.query(sql, [
        account_id,
        reconciliation_date,
        expected_balance,
        actual_balance,
        difference,
        transaction_id,
        note
    ]);
    return result;
};

/**
 * Lấy danh sách lịch sử các lần đối soát (có thể lọc theo accountId)
 */
const findAll = async ({ accountId = null } = {}) => {
    let sql = `
        SELECT 
            r.id,
            r.account_id,
            DATE_FORMAT(r.reconciliation_date, '%Y-%m-%d') AS reconciliation_date,
            r.expected_balance,
            r.actual_balance,
            r.difference,
            r.transaction_id,
            r.note,
            r.created_at,
            a.name AS account_name,
            a.type AS account_type,
            t.amount AS transaction_amount,
            t.type AS transaction_type,
            c.name AS category_name
        FROM reconciliations r
        INNER JOIN accounts a ON r.account_id = a.id
        LEFT JOIN transactions t ON r.transaction_id = t.id
        LEFT JOIN categories c ON t.category_id = c.id
    `;

    const params = [];
    if (accountId) {
        sql += ' WHERE r.account_id = ?';
        params.push(accountId);
    }

    sql += ' ORDER BY r.reconciliation_date DESC, r.created_at DESC';

    const [rows] = await db.query(sql, params);
    return rows.map(r => ({
        ...r,
        expected_balance: toSafeNumber(toBigInt(r.expected_balance), 'Số dư kỳ vọng'),
        actual_balance: toSafeNumber(toBigInt(r.actual_balance), 'Số dư thực tế'),
        difference: toSafeNumber(toBigInt(r.difference), 'Chênh lệch'),
        transaction_amount: r.transaction_amount ? toSafeNumber(toBigInt(r.transaction_amount), 'Số tiền điều chỉnh') : null
    }));
};

/**
 * Tìm bản ghi đối soát theo ID
 */
const findById = async (id) => {
    const sql = `
        SELECT 
            r.id,
            r.account_id,
            DATE_FORMAT(r.reconciliation_date, '%Y-%m-%d') AS reconciliation_date,
            r.expected_balance,
            r.actual_balance,
            r.difference,
            r.transaction_id,
            r.note,
            r.created_at,
            a.name AS account_name,
            a.type AS account_type,
            t.amount AS transaction_amount,
            t.type AS transaction_type,
            c.name AS category_name
        FROM reconciliations r
        INNER JOIN accounts a ON r.account_id = a.id
        LEFT JOIN transactions t ON r.transaction_id = t.id
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE r.id = ?
    `;

    const [rows] = await db.query(sql, [id]);
    if (!rows || rows.length === 0) return null;

    const r = rows[0];
    return {
        ...r,
        expected_balance: toSafeNumber(toBigInt(r.expected_balance), 'Số dư kỳ vọng'),
        actual_balance: toSafeNumber(toBigInt(r.actual_balance), 'Số dư thực tế'),
        difference: toSafeNumber(toBigInt(r.difference), 'Chênh lệch'),
        transaction_amount: r.transaction_amount ? toSafeNumber(toBigInt(r.transaction_amount), 'Số tiền điều chỉnh') : null
    };
};

/**
 * Tìm danh mục điều chỉnh số dư mặc định ('Điều chỉnh số dư' theo loại income/expense)
 */
const findAdjustmentCategory = async (type = 'income') => {
    const [rows] = await db.query(
        'SELECT id, name, type FROM categories WHERE name = ? AND type = ? LIMIT 1',
        ['Điều chỉnh số dư', type]
    );
    if (rows && rows.length > 0) return rows[0];

    // Fallback: Lấy danh mục đầu tiên của loại đó nếu chưa có danh mục 'Điều chỉnh số dư'
    const [fallback] = await db.query('SELECT id, name, type FROM categories WHERE type = ? LIMIT 1', [type]);
    return fallback[0] || null;
};

module.exports = {
    calculateExpectedBalance,
    createReconciliation,
    findAll,
    findById,
    findAdjustmentCategory
};

