const db = require('../config/db');

/**
 * Lấy danh sách tất cả các quy tắc, kèm thông tin danh mục và tài khoản liên kết
 * Sắp xếp theo priority giảm dần (ưu tiên cao nhất lên đầu), sau đó theo id giảm dần
 */
const findAll = async ({ activeOnly = false } = {}) => {
    let sql = `
        SELECT 
            r.id,
            r.keyword,
            r.match_type,
            r.transaction_type,
            r.account_id,
            r.category_id,
            r.priority,
            r.is_active,
            r.created_at,
            r.updated_at,
            c.name AS category_name,
            c.type AS category_type,
            a.name AS account_name
        FROM category_rules r
        INNER JOIN categories c ON r.category_id = c.id
        LEFT JOIN accounts a ON r.account_id = a.id
    `;

    const params = [];
    if (activeOnly) {
        sql += ' WHERE r.is_active = 1';
    }

    sql += ' ORDER BY r.priority DESC, r.id DESC';

    const [rows] = await db.query(sql, params);
    return rows;
};

/**
 * Tìm một quy tắc theo ID
 */
const findById = async (id) => {
    const sql = `
        SELECT 
            r.id,
            r.keyword,
            r.match_type,
            r.transaction_type,
            r.account_id,
            r.category_id,
            r.priority,
            r.is_active,
            r.created_at,
            r.updated_at,
            c.name AS category_name,
            c.type AS category_type,
            a.name AS account_name
        FROM category_rules r
        INNER JOIN categories c ON r.category_id = c.id
        LEFT JOIN accounts a ON r.account_id = a.id
        WHERE r.id = ?
    `;
    const [rows] = await db.query(sql, [id]);
    return rows[0] || null;
};

/**
 * Tạo mới một quy tắc
 */
const create = async (ruleData) => {
    const {
        keyword,
        match_type = 'contains',
        transaction_type = 'expense',
        account_id = null,
        category_id,
        priority = 0,
        is_active = 1
    } = ruleData;

    const sql = `
        INSERT INTO category_rules (keyword, match_type, transaction_type, account_id, category_id, priority, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(sql, [
        keyword,
        match_type,
        transaction_type,
        account_id || null,
        category_id,
        priority,
        is_active ? 1 : 0
    ]);
    return result;
};

/**
 * Cập nhật một quy tắc
 */
const update = async (id, ruleData) => {
    const {
        keyword,
        match_type = 'contains',
        transaction_type = 'expense',
        account_id = null,
        category_id,
        priority = 0,
        is_active = 1
    } = ruleData;

    const sql = `
        UPDATE category_rules 
        SET 
            keyword = ?,
            match_type = ?,
            transaction_type = ?,
            account_id = ?,
            category_id = ?,
            priority = ?,
            is_active = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;
    const [result] = await db.query(sql, [
        keyword,
        match_type,
        transaction_type,
        account_id || null,
        category_id,
        priority,
        is_active ? 1 : 0,
        id
    ]);
    return result;
};

/**
 * Xóa một quy tắc
 */
const remove = async (id) => {
    const [result] = await db.query('DELETE FROM category_rules WHERE id = ?', [id]);
    return result;
};

/**
 * Bật/tắt trạng thái hoạt động của quy tắc
 */
const toggleActive = async (id) => {
    const sql = `
        UPDATE category_rules 
        SET is_active = IF(is_active = 1, 0, 1), updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `;
    const [result] = await db.query(sql, [id]);
    return result;
};

/**
 * Cập nhật độ ưu tiên cho danh sách quy tắc (Reorder)
 */
const reorder = async (ruleOrders = []) => {
    if (!Array.isArray(ruleOrders) || ruleOrders.length === 0) return;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        for (const item of ruleOrders) {
            if (item.id && Number.isInteger(item.priority)) {
                await connection.query(
                    'UPDATE category_rules SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [item.priority, item.id]
                );
            }
        }
        await connection.commit();
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
};

module.exports = {
    findAll,
    findById,
    create,
    update,
    remove,
    toggleActive,
    reorder
};

