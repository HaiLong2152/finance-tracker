const db = require('../config/db');

const findAll = async () => {
    const sql = `
        SELECT 
            c.id, 
            c.name, 
            c.type,
            (SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id) AS transaction_count,
            (SELECT COUNT(*) FROM budgets b WHERE b.category_id = c.id) AS budget_count
        FROM categories c 
        ORDER BY c.type, c.name
    `;
    const [rows] = await db.query(sql);
    return rows;
};

const findById = async (id) => {
    const [rows] = await db.query('SELECT id, name, type FROM categories WHERE id = ?', [id]);
    return rows[0];
};

const getUsageStats = async (id) => {
    const sql = `
        SELECT 
            (SELECT COUNT(*) FROM transactions t WHERE t.category_id = ?) AS transaction_count,
            (SELECT COUNT(*) FROM budgets b WHERE b.category_id = ?) AS budget_count
    `;
    const [[result]] = await db.query(sql, [id, id]);
    return {
        transactionCount: Number(result?.transaction_count || 0),
        budgetCount: Number(result?.budget_count || 0)
    };
};

const create = async (category) => {
    const [result] = await db.query('INSERT INTO categories (name, type) VALUES (?, ?)', [category.name, category.type]);
    return result;
};

const update = async (id, category) => {
    const [result] = await db.query('UPDATE categories SET name = ?, type = ? WHERE id = ?', [category.name, category.type, id]);
    return result;
};

const remove = async (id) => {
    const [result] = await db.query('DELETE FROM categories WHERE id = ?', [id]);
    return result;
};

const removeWithBudgets = async (id) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('DELETE FROM budgets WHERE category_id = ?', [id]);
        const [result] = await connection.query('DELETE FROM categories WHERE id = ?', [id]);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

module.exports = {
    findAll,
    findById,
    getUsageStats,
    create,
    update,
    remove,
    removeWithBudgets
};

