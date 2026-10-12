const db = require('../config/db');

/**
 * Lấy danh sách ngân sách trong một tháng (kèm số tiền chi tiêu thực tế)
 */
const findByMonth = async (month) => {
    const sql = `
        SELECT 
            b.id,
            b.category_id,
            c.name AS category_name,
            c.type AS category_type,
            b.month,
            b.limit_amount,
            COALESCE(spent.total_spent, 0) AS spent_amount,
            b.created_at,
            b.updated_at
        FROM budgets b
        JOIN categories c ON b.category_id = c.id
        LEFT JOIN (
            SELECT 
                t.category_id,
                SUM(t.amount) AS total_spent
            FROM transactions t
            WHERE t.type = 'expense'
              AND t.transaction_date >= CONCAT(?, '-01')
              AND t.transaction_date <= LAST_DAY(CONCAT(?, '-01'))
            GROUP BY t.category_id
        ) spent ON spent.category_id = b.category_id
        WHERE b.month = ?
        ORDER BY b.limit_amount DESC, c.name ASC
    `;
    const [rows] = await db.query(sql, [month, month, month]);
    return rows.map((row) => {
        const limit = Number(row.limit_amount);
        const spent = Number(row.spent_amount);
        const remaining = limit - spent;
        const percentage = limit > 0 ? Math.round((spent / limit) * 100) : 0;
        let status = 'safe';
        if (spent >= limit) {
            status = 'exceeded';
        } else if (percentage >= 80) {
            status = 'warning';
        }

        return {
            id: row.id,
            category_id: row.category_id,
            category_name: row.category_name,
            category_type: row.category_type,
            month: row.month,
            limit_amount: limit,
            spent_amount: spent,
            remaining_amount: remaining,
            percentage,
            status,
            created_at: row.created_at,
            updated_at: row.updated_at
        };
    });
};

/**
 * Tìm ngân sách theo ID
 */
const findById = async (id) => {
    const [budgetRows] = await db.query('SELECT * FROM budgets WHERE id = ?', [id]);
    const budget = budgetRows[0];
    if (!budget) return null;

    const sql = `
        SELECT 
            b.id,
            b.category_id,
            c.name AS category_name,
            c.type AS category_type,
            b.month,
            b.limit_amount,
            COALESCE(spent.total_spent, 0) AS spent_amount,
            b.created_at,
            b.updated_at
        FROM budgets b
        JOIN categories c ON b.category_id = c.id
        LEFT JOIN (
            SELECT 
                t.category_id,
                SUM(t.amount) AS total_spent
            FROM transactions t
            WHERE t.type = 'expense'
              AND t.transaction_date >= CONCAT(?, '-01')
              AND t.transaction_date <= LAST_DAY(CONCAT(?, '-01'))
            GROUP BY t.category_id
        ) spent ON spent.category_id = b.category_id
        WHERE b.id = ?
    `;
    const [rows] = await db.query(sql, [budget.month, budget.month, id]);
    if (!rows[0]) return null;

    const row = rows[0];
    const limit = Number(row.limit_amount);
    const spent = Number(row.spent_amount);
    const remaining = limit - spent;
    const percentage = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    let status = 'safe';
    if (spent >= limit) {
        status = 'exceeded';
    } else if (percentage >= 80) {
        status = 'warning';
    }

    return {
        id: row.id,
        category_id: row.category_id,
        category_name: row.category_name,
        category_type: row.category_type,
        month: row.month,
        limit_amount: limit,
        spent_amount: spent,
        remaining_amount: remaining,
        percentage,
        status,
        created_at: row.created_at,
        updated_at: row.updated_at
    };
};

/**
 * Tìm ngân sách theo danh mục và tháng
 */
const findByCategoryAndMonth = async (categoryId, month) => {
    const [rows] = await db.query(
        'SELECT * FROM budgets WHERE category_id = ? AND month = ?',
        [categoryId, month]
    );
    return rows[0] || null;
};

/**
 * Tạo mới hoặc cập nhật ngân sách cho một danh mục trong tháng (Upsert)
 */
const upsert = async (categoryId, month, limitAmount) => {
    const sql = `
        INSERT INTO budgets (category_id, month, limit_amount)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE limit_amount = VALUES(limit_amount)
    `;
    const [result] = await db.query(sql, [categoryId, month, limitAmount]);
    return result;
};

/**
 * Cập nhật hạn mức theo ID
 */
const update = async (id, limitAmount) => {
    const sql = 'UPDATE budgets SET limit_amount = ? WHERE id = ?';
    const [result] = await db.query(sql, [limitAmount, id]);
    return result;
};

/**
 * Xóa ngân sách theo ID
 */
const remove = async (id) => {
    const [result] = await db.query('DELETE FROM budgets WHERE id = ?', [id]);
    return result;
};

/**
 * Đếm số lượng ngân sách trong một tháng
 */
const countByMonth = async (month) => {
    const [[result]] = await db.query(
        'SELECT COUNT(*) AS total FROM budgets WHERE month = ?',
        [month]
    );
    return result.total;
};

/**
 * Sao chép tất cả ngân sách từ tháng nguồn sang tháng đích
 */
const copyFromMonth = async (sourceMonth, targetMonth) => {
    const sql = `
        INSERT INTO budgets (category_id, month, limit_amount)
        SELECT category_id, ?, limit_amount
        FROM budgets
        WHERE month = ?
        ON DUPLICATE KEY UPDATE limit_amount = VALUES(limit_amount)
    `;
    const [result] = await db.query(sql, [targetMonth, sourceMonth]);
    return result;
};

module.exports = {
    findByMonth,
    findById,
    findByCategoryAndMonth,
    upsert,
    update,
    remove,
    countByMonth,
    copyFromMonth
};

