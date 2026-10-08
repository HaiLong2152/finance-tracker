const db = require('../config/db');

const findAll = async () => {
    const sql = `
        SELECT t.id, t.amount, t.category_id, t.transaction_date, t.note,
               c.name AS category_name, c.type
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        ORDER BY t.transaction_date DESC, t.id DESC
    `;
    const [rows] = await db.query(sql);
    return rows;
};

const findById = async (id) => {
    const [rows] = await db.query('SELECT id FROM transactions WHERE id = ?', [id]);
    return rows[0];
};

const create = async (transaction) => {
    const [result] = await db.query(
        'INSERT INTO transactions (amount, category_id, transaction_date, note) VALUES (?, ?, ?, ?)',
        [transaction.amount, transaction.categoryId, transaction.transactionDate, transaction.note]
    );
    return result;
};

const update = async (id, transaction) => {
    const [result] = await db.query(
        'UPDATE transactions SET amount = ?, category_id = ?, transaction_date = ?, note = ? WHERE id = ?',
        [transaction.amount, transaction.categoryId, transaction.transactionDate, transaction.note, id]
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

