const db = require('../config/db');

/**
 * Lấy tổng hợp thu, chi, chênh lệch của một tháng
 */
const getMonthlySummary = async (month) => {
    const sql = `
        SELECT 
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense,
            COUNT(id) AS transaction_count
        FROM transactions
        WHERE transaction_date >= CONCAT(?, '-01')
          AND transaction_date <= LAST_DAY(CONCAT(?, '-01'))
          AND type IN ('income', 'expense')
    `;
    const [[row]] = await db.query(sql, [month, month]);
    const income = Number(row.income);
    const expense = Number(row.expense);
    return {
        income,
        expense,
        net: income - expense,
        transaction_count: Number(row.transaction_count)
    };
};

/**
 * Lấy phân bổ chi tiêu theo danh mục của một tháng
 */
const getCategoryBreakdown = async (month) => {
    const sql = `
        SELECT 
            c.id AS category_id,
            c.name AS category_name,
            c.type AS category_type,
            COALESCE(SUM(t.amount), 0) AS total_amount,
            COUNT(t.id) AS transaction_count
        FROM categories c
        JOIN transactions t ON t.category_id = c.id
        WHERE t.type = 'expense'
          AND t.transaction_date >= CONCAT(?, '-01')
          AND t.transaction_date <= LAST_DAY(CONCAT(?, '-01'))
        GROUP BY c.id, c.name, c.type
        ORDER BY total_amount DESC
    `;
    const [rows] = await db.query(sql, [month, month]);
    const totalExpense = rows.reduce((sum, r) => sum + Number(r.total_amount), 0);

    return rows.map(r => {
        const amount = Number(r.total_amount);
        const percentage = totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0;
        return {
            category_id: r.category_id,
            category_name: r.category_name,
            total_amount: amount,
            transaction_count: Number(r.transaction_count),
            percentage
        };
    });
};

/**
 * Lấy xu hướng thu chi trong khoảng từ startMonth đến endMonth
 */
const getTrendData = async (startMonth, endMonth) => {
    const sql = `
        SELECT 
            DATE_FORMAT(transaction_date, '%Y-%m') AS month,
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
        FROM transactions
        WHERE transaction_date >= CONCAT(?, '-01')
          AND transaction_date <= LAST_DAY(CONCAT(?, '-01'))
          AND type IN ('income', 'expense')
        GROUP BY DATE_FORMAT(transaction_date, '%Y-%m')
        ORDER BY month ASC
    `;
    const [rows] = await db.query(sql, [startMonth, endMonth]);
    return rows.map(r => ({
        month: r.month,
        income: Number(r.income),
        expense: Number(r.expense),
        net: Number(r.income) - Number(r.expense)
    }));
};

module.exports = {
    getMonthlySummary,
    getCategoryBreakdown,
    getTrendData
};

