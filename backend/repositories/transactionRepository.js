const db = require('../config/db');

const buildFilterConditions = (params = {}) => {
    const conditions = [];
    const values = [];

    const { type, accountId, categoryId, from, to, search } = params;

    if (type && ['income', 'expense', 'transfer'].includes(type)) {
        conditions.push('t.type = ?');
        values.push(type);
    }

    if (accountId !== undefined && accountId !== null && accountId !== '') {
        const numAccountId = Number(accountId);
        if (Number.isSafeInteger(numAccountId) && numAccountId > 0) {
            conditions.push('(t.account_id = ? OR t.transfer_account_id = ?)');
            values.push(numAccountId, numAccountId);
        }
    }

    if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
        const numCategoryId = Number(categoryId);
        if (Number.isSafeInteger(numCategoryId) && numCategoryId > 0) {
            conditions.push('t.category_id = ?');
            values.push(numCategoryId);
        }
    }

    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
        conditions.push('t.transaction_date >= ?');
        values.push(from);
    }

    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
        conditions.push('t.transaction_date <= ?');
        values.push(to);
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
        const term = `%${search.trim()}%`;
        conditions.push('(t.note LIKE ? OR c.name LIKE ? OR a.name LIKE ? OR ta.name LIKE ?)');
        values.push(term, term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, values };
};

const findWithPaginationAndFilters = async (params = {}) => {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
    const offset = (page - 1) * limit;

    const { whereClause, values } = buildFilterConditions(params);

    const countSql = `
        SELECT COUNT(t.id) AS total
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        LEFT JOIN accounts ta ON t.transfer_account_id = ta.id
        LEFT JOIN categories c ON t.category_id = c.id
        ${whereClause}
    `;
    const [[countRow]] = await db.query(countSql, values);
    const total = Number(countRow.total || 0);

    const selectSql = `
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
        ${whereClause}
        ORDER BY t.transaction_date DESC, t.id DESC
        LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(selectSql, [...values, limit, offset]);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
        items: rows,
        pagination: {
            page,
            limit,
            totalItems: total,
            totalPages
        }
    };
};

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
            transaction.accountId ?? transaction.account_id, 
            transaction.transferAccountId ?? transaction.transfer_account_id ?? null, 
            transaction.categoryId ?? transaction.category_id ?? null, 
            transaction.transactionDate ?? transaction.transaction_date, 
            transaction.note ?? null
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

const findByIds = async (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const [rows] = await db.query('SELECT * FROM transactions WHERE id IN (?)', [ids]);
    return rows;
};

const updateCategoryBulk = async (ids, categoryId) => {
    if (!Array.isArray(ids) || ids.length === 0) return { affectedRows: 0 };
    const [result] = await db.query(
        'UPDATE transactions SET category_id = ? WHERE id IN (?) AND type IN (\'income\', \'expense\')',
        [categoryId, ids]
    );
    return result;
};

const removeBulk = async (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return { affectedRows: 0 };
    const [result] = await db.query('DELETE FROM transactions WHERE id IN (?)', [ids]);
    return result;
};

module.exports = {
    findWithPaginationAndFilters,
    findAll,
    findById,
    findByIds,
    create,
    update,
    remove,
    updateCategoryBulk,
    removeBulk
};
