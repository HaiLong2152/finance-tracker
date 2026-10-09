const db = require('../config/db');

const findAll = async () => {
    const sql = `
        SELECT 
            t.id, 
            t.amount, 
            t.type, 
            t.account_id, 
            a.name AS account_name,
            t.transfer_account_id,
            ta.name AS transfer_account_name,
            t.category_id, 
            COALESCE(c.name, CASE WHEN t.type = 'transfer' THEN 'Chuyển khoản' ELSE 'Không có danh mục' END) AS category_name,
            t.transaction_date, 
            t.note
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        LEFT JOIN accounts ta ON t.transfer_account_id = ta.id
        LEFT JOIN categories c ON t.category_id = c.id
        ORDER BY t.transaction_date DESC, t.id DESC
    `;
    const [rows] = await db.query(sql);
    return rows;
};

const findById = async (id) => {
    const sql = `
        SELECT 
            t.id, 
            t.amount, 
            t.type, 
            t.account_id, 
            a.name AS account_name,
            t.transfer_account_id,
            ta.name AS transfer_account_name,
            t.category_id, 
            c.name AS category_name,
            t.transaction_date, 
            t.note
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        LEFT JOIN accounts ta ON t.transfer_account_id = ta.id
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.id = ?
    `;
    const [rows] = await db.query(sql, [id]);
    return rows[0];
};

const create = async (transaction) => {
    const [result] = await db.query(
        'INSERT INTO transactions (amount, type, account_id, transfer_account_id, category_id, transaction_date, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
            transaction.amount, 
            transaction.type, 
            transaction.accountId, 
            transaction.transferAccountId, 
            transaction.categoryId, 
            transaction.transactionDate, 
            transaction.note
        ]
    );
    return result;
};

const update = async (id, transaction) => {
    const [result] = await db.query(
        'UPDATE transactions SET amount = ?, type = ?, account_id = ?, transfer_account_id = ?, category_id = ?, transaction_date = ?, note = ? WHERE id = ?',
        [
            transaction.amount, 
            transaction.type, 
            transaction.accountId, 
            transaction.transferAccountId, 
            transaction.categoryId, 
            transaction.transactionDate, 
            transaction.note, 
            id
        ]
    );
    return result;
};

const remove = async (id) => {
    const [result] = await db.query('DELETE FROM transactions WHERE id = ?', [id]);
    return result;
};

module.exports = {
    findAll,
    findById,
    create,
    update,
    remove
};
