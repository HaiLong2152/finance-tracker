const db = require('../config/db');
const { toBigInt, toSafeNumber, calculatePercentage } = require('../utils/money');

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
    const incomeBig = toBigInt(row.income);
    const expenseBig = toBigInt(row.expense);
    const netBig = incomeBig - expenseBig;
    return {
        income: toSafeNumber(incomeBig, 'Tổng thu nhập'),
        expense: toSafeNumber(expenseBig, 'Tổng chi tiêu'),
        net: toSafeNumber(netBig, 'Chênh lệch thu chi'),
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
    const totalExpenseBig = rows.reduce((sum, r) => sum + toBigInt(r.total_amount), 0n);

    return rows.map(r => {
        const amountBig = toBigInt(r.total_amount);
        const percentage = calculatePercentage(amountBig, totalExpenseBig);
        return {
            category_id: r.category_id,
            category_name: r.category_name,
            total_amount: toSafeNumber(amountBig, 'Tổng chi tiêu danh mục'),
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
    return rows.map(r => {
        const incomeBig = toBigInt(r.income);
        const expenseBig = toBigInt(r.expense);
        const netBig = incomeBig - expenseBig;
        return {
            month: r.month,
            income: toSafeNumber(incomeBig, 'Thu nhập xu hướng'),
            expense: toSafeNumber(expenseBig, 'Chi tiêu xu hướng'),
            net: toSafeNumber(netBig, 'Chênh lệch xu hướng')
        };
    });
};

/**
 * Lấy tổng hợp thu chi toàn bộ thời gian
 */
const getAllTimeSummary = async () => {
    const sql = `
        SELECT 
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense,
            COUNT(id) AS transaction_count
        FROM transactions
        WHERE type IN ('income', 'expense')
    `;
    const [[row]] = await db.query(sql);
    const incomeBig = toBigInt(row.income);
    const expenseBig = toBigInt(row.expense);
    const netBig = incomeBig - expenseBig;
    return {
        income: toSafeNumber(incomeBig, 'Tổng thu nhập toàn thời gian'),
        expense: toSafeNumber(expenseBig, 'Tổng chi tiêu toàn thời gian'),
        net: toSafeNumber(netBig, 'Chênh lệch toàn thời gian'),
        transaction_count: Number(row.transaction_count)
    };
};

/**
 * Lấy phân bổ chi tiêu toàn bộ thời gian
 */
const getAllTimeCategoryBreakdown = async () => {
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
        GROUP BY c.id, c.name, c.type
        ORDER BY total_amount DESC
    `;
    const [rows] = await db.query(sql);
    const totalExpenseBig = rows.reduce((sum, r) => sum + toBigInt(r.total_amount), 0n);

    return rows.map(r => {
        const amountBig = toBigInt(r.total_amount);
        const percentage = calculatePercentage(amountBig, totalExpenseBig);
        return {
            category_id: r.category_id,
            category_name: r.category_name,
            total_amount: toSafeNumber(amountBig, 'Tổng chi tiêu danh mục toàn thời gian'),
            transaction_count: Number(r.transaction_count),
            percentage
        };
    });
};

/**
 * Lấy danh sách các tháng có dữ liệu giao dịch
 */
const getAvailableMonths = async () => {
    const sql = `
        SELECT DISTINCT DATE_FORMAT(transaction_date, '%Y-%m') AS month
        FROM transactions
        ORDER BY month DESC
    `;
    const [rows] = await db.query(sql);
    return rows.map(r => r.month);
};

module.exports = {
    getMonthlySummary,
    getCategoryBreakdown,
    getTrendData,
    getAllTimeSummary,
    getAllTimeCategoryBreakdown,
    getAvailableMonths
};

