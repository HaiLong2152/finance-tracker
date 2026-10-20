const db = require('../config/db');

/**
 * Tìm bản ghi nhận tin theo khóa chống trùng (idempotency_key)
 */
const findByIdempotencyKey = async (idempotencyKey) => {
    const sql = `
        SELECT 
            id, 
            package, 
            title, 
            text, 
            raw_payload,
            posted_at, 
            device_id, 
            received_at, 
            idempotency_key, 
            status, 
            parser_name, 
            parsed_json, 
            error_message,
            transaction_id, 
            created_at, 
            updated_at
        FROM ingest_events 
        WHERE idempotency_key = ? 
        LIMIT 1
    `;
    const [rows] = await db.query(sql, [idempotencyKey]);
    return rows[0] || null;
};

/**
 * Lưu thông báo gốc vào bảng ingest_events
 */
const create = async (eventData) => {
    const sql = `
        INSERT INTO ingest_events (
            package, 
            title, 
            text, 
            raw_payload,
            posted_at, 
            device_id, 
            idempotency_key, 
            status, 
            parser_name, 
            parsed_json, 
            error_message,
            transaction_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(sql, [
        eventData.package,
        eventData.title || null,
        eventData.text,
        eventData.raw_payload ? JSON.stringify(eventData.raw_payload) : null,
        eventData.posted_at || null,
        eventData.device_id || null,
        eventData.idempotency_key,
        eventData.status || 'pending',
        eventData.parser_name || null,
        eventData.parsed_json ? JSON.stringify(eventData.parsed_json) : null,
        eventData.error_message || null,
        eventData.transaction_id || null
    ]);
    return result;
};

/**
 * Tìm bản ghi theo ID
 */
const findById = async (id) => {
    const sql = `
        SELECT 
            ie.id, 
            ie.package, 
            ie.title, 
            ie.text, 
            ie.raw_payload,
            ie.posted_at, 
            ie.device_id, 
            ie.received_at, 
            ie.idempotency_key, 
            ie.status, 
            ie.parser_name, 
            ie.parsed_json, 
            ie.error_message,
            ie.transaction_id, 
            ie.created_at, 
            ie.updated_at,
            t.amount AS transaction_amount,
            t.type AS transaction_type
        FROM ingest_events ie
        LEFT JOIN transactions t ON ie.transaction_id = t.id
        WHERE ie.id = ?
        LIMIT 1
    `;
    const [rows] = await db.query(sql, [id]);
    return rows[0] || null;
};

/**
 * Lấy danh sách thông báo trong Hộp chờ (Inbox) có phân trang và lọc trạng thái
 */
const findInbox = async ({ status, search, page = 1, limit = 20 }) => {
    const conditions = [];
    const values = [];

    if (status && status !== 'all') {
        conditions.push('ie.status = ?');
        values.push(status);
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
        const term = `%${search.trim()}%`;
        conditions.push('(ie.title LIKE ? OR ie.text LIKE ? OR ie.package LIKE ?)');
        values.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(ie.id) AS total FROM ingest_events ie ${whereClause}`;
    const [[countRow]] = await db.query(countSql, values);
    const total = Number(countRow.total || 0);

    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const safePage = Math.max(1, Number(page) || 1);
    const offset = (safePage - 1) * safeLimit;

    const selectSql = `
        SELECT 
            ie.id, 
            ie.package, 
            ie.title, 
            ie.text, 
            ie.raw_payload,
            ie.posted_at, 
            ie.device_id, 
            ie.received_at, 
            ie.idempotency_key, 
            ie.status, 
            ie.parser_name, 
            ie.parsed_json, 
            ie.error_message,
            ie.transaction_id, 
            ie.created_at, 
            ie.updated_at,
            t.amount AS transaction_amount,
            t.type AS transaction_type
        FROM ingest_events ie
        LEFT JOIN transactions t ON ie.transaction_id = t.id
        ${whereClause}
        ORDER BY ie.received_at DESC, ie.id DESC
        LIMIT ? OFFSET ?
    `;

    const [rows] = await db.query(selectSql, [...values, safeLimit, offset]);
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    return {
        items: rows,
        pagination: {
            page: safePage,
            limit: safeLimit,
            totalItems: total,
            totalPages
        }
    };
};

/**
 * Thống kê số lượng tin theo trạng thái cho Inbox
 */
const getStats = async () => {
    const sql = `
        SELECT 
            status, 
            COUNT(id) AS count
        FROM ingest_events
        GROUP BY status
    `;
    const [rows] = await db.query(sql);
    const stats = {
        pending: 0,
        approved: 0,
        processed: 0,
        ignored: 0,
        failed: 0,
        unparsed: 0,
        duplicate: 0,
        error: 0,
        total: 0
    };

    rows.forEach((r) => {
        const count = Number(r.count || 0);
        if (stats[r.status] !== undefined) {
            stats[r.status] = count;
        }
        stats.total += count;
    });

    return stats;
};

/**
 * Cập nhật trạng thái và thông tin liên kết của một tin thông báo
 * Đảm bảo tính bất biến của nội dung nguồn: không sửa text, title, package, posted_at, raw_payload (SPEC 4.1)
 */
const updateStatus = async (id, status, updates = {}) => {
    const sets = ['status = ?'];
    const values = [status];

    if (updates.transaction_id !== undefined) {
        sets.push('transaction_id = ?');
        values.push(updates.transaction_id);
    }
    if (updates.parser_name !== undefined) {
        sets.push('parser_name = ?');
        values.push(updates.parser_name);
    }
    if (updates.parsed_json !== undefined) {
        sets.push('parsed_json = ?');
        values.push(updates.parsed_json ? JSON.stringify(updates.parsed_json) : null);
    }
    if (updates.error_message !== undefined) {
        sets.push('error_message = ?');
        values.push(updates.error_message);
    }

    values.push(id);
    const sql = `UPDATE ingest_events SET ${sets.join(', ')} WHERE id = ?`;
    const [result] = await db.query(sql, values);
    return result;
};

/**
 * Xóa một thông báo trong hộp thư
 */
const remove = async (id) => {
    const sql = 'DELETE FROM ingest_events WHERE id = ?';
    const [result] = await db.query(sql, [id]);
    return result;
};

module.exports = {
    findByIdempotencyKey,
    create,
    findById,
    findInbox,
    getStats,
    updateStatus,
    remove
};

