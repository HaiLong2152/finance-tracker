const db = require('../config/db');

/**
 * Lấy danh sách ví (có tính toán số dư hiện tại từ các giao dịch)
 */
const findAll = async (includeArchived = false) => {
    const whereClause = includeArchived ? '' : 'WHERE a.is_archived = 0';
    const sql = `
        SELECT 
            a.id, 
            a.name, 
            a.type, 
            a.initial_balance, 
            a.start_date, 
            a.identifier_hint, 
            a.is_archived, 
            a.sort_order, 
            a.created_at,
            (
                a.initial_balance 
                + COALESCE(SUM(
                    CASE 
                        WHEN t.type = 'income' AND t.account_id = a.id AND t.transaction_date >= a.start_date THEN t.amount
                        WHEN t.type = 'expense' AND t.account_id = a.id AND t.transaction_date >= a.start_date THEN -t.amount
                        WHEN t.type = 'transfer' AND t.account_id = a.id AND t.transaction_date >= a.start_date THEN -t.amount
                        WHEN t.type = 'transfer' AND t.transfer_account_id = a.id AND t.transaction_date >= a.start_date THEN t.amount
                        ELSE 0
                    END
                ), 0)
            ) AS current_balance,
            COUNT(DISTINCT t.id) AS transaction_count
        FROM accounts a
        LEFT JOIN transactions t 
            ON (t.account_id = a.id OR t.transfer_account_id = a.id)
        ${whereClause}
        GROUP BY a.id
        ORDER BY a.sort_order ASC, a.id ASC
    `;
    const [rows] = await db.query(sql);
    return rows;
};

/**
 * Tìm ví theo ID
 */
const findById = async (id) => {
    const sql = `
        SELECT 
            a.id, 
            a.name, 
            a.type, 
            a.initial_balance, 
            a.start_date, 
            a.identifier_hint, 
            a.is_archived, 
            a.sort_order, 
            a.created_at,
            (
                a.initial_balance 
                + COALESCE(SUM(
                    CASE 
                        WHEN t.type = 'income' AND t.account_id = a.id AND t.transaction_date >= a.start_date THEN t.amount
                        WHEN t.type = 'expense' AND t.account_id = a.id AND t.transaction_date >= a.start_date THEN -t.amount
                        WHEN t.type = 'transfer' AND t.account_id = a.id AND t.transaction_date >= a.start_date THEN -t.amount
                        WHEN t.type = 'transfer' AND t.transfer_account_id = a.id AND t.transaction_date >= a.start_date THEN t.amount
                        ELSE 0
                    END
                ), 0)
            ) AS current_balance,
            COUNT(DISTINCT t.id) AS transaction_count
        FROM accounts a
        LEFT JOIN transactions t 
            ON (t.account_id = a.id OR t.transfer_account_id = a.id)
        WHERE a.id = ?
        GROUP BY a.id
    `;
    const [rows] = await db.query(sql, [id]);
    return rows[0];
};

/**
 * Đếm số lượng giao dịch liên quan đến ví
 */
const countTransactions = async (accountId) => {
    const sql = `
        SELECT COUNT(*) AS total 
        FROM transactions 
        WHERE account_id = ? OR transfer_account_id = ?
    `;
    const [[result]] = await db.query(sql, [accountId, accountId]);
    return result.total;
};

/**
 * Tạo ví mới
 */
const create = async (account) => {
    const sql = `
        INSERT INTO accounts (name, type, initial_balance, start_date, identifier_hint, is_archived, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(sql, [
        account.name,
        account.type,
        account.initialBalance,
        account.startDate,
        account.identifierHint,
        account.isArchived ? 1 : 0,
        account.sortOrder || 0
    ]);
    return result;
};

/**
 * Cập nhật thông tin ví
 */
const update = async (id, account) => {
    const sql = `
        UPDATE accounts 
        SET name = ?, type = ?, initial_balance = ?, start_date = ?, identifier_hint = ?, is_archived = ?, sort_order = ?
        WHERE id = ?
    `;
    const [result] = await db.query(sql, [
        account.name,
        account.type,
        account.initialBalance,
        account.startDate,
        account.identifierHint,
        account.isArchived ? 1 : 0,
        account.sortOrder || 0,
        id
    ]);
    return result;
};

/**
 * Lưu trữ hoặc mở lại ví (Archive / Unarchive)
 */
const setArchiveStatus = async (id, isArchived) => {
    const sql = `UPDATE accounts SET is_archived = ? WHERE id = ?`;
    const [result] = await db.query(sql, [isArchived ? 1 : 0, id]);
    return result;
};

/**
 * Xóa ví khỏi database
 */
const remove = async (id) => {
    const [result] = await db.query('DELETE FROM accounts WHERE id = ?', [id]);
    return result;
};

module.exports = {
    findAll,
    findById,
    countTransactions,
    create,
    update,
    setArchiveStatus,
    remove
};

