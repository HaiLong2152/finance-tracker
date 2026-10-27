const db = require('../config/db');

/**
 * Tạo một đợt nhập mới trong import_batches
 */
const createBatch = async (batchData, connection = null) => {
    const {
        file_name,
        file_hash,
        account_id,
        total_rows = 0,
        imported_rows = 0,
        skipped_rows = 0,
        status = 'completed',
        error_log = null
    } = batchData;

    const sql = `
        INSERT INTO import_batches (file_name, file_hash, account_id, total_rows, imported_rows, skipped_rows, status, error_log)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
        file_name,
        file_hash,
        account_id,
        total_rows,
        imported_rows,
        skipped_rows,
        status,
        error_log ? JSON.stringify(error_log) : null
    ];

    const executor = connection || db;
    const [result] = await executor.query(sql, params);
    return result;
};

/**
 * Cập nhật thông tin đợt nhập
 */
const updateBatch = async (id, updateData, connection = null) => {
    const { imported_rows, skipped_rows, status, error_log } = updateData;
    const sql = `
        UPDATE import_batches
        SET imported_rows = ?, skipped_rows = ?, status = ?, error_log = ?
        WHERE id = ?
    `;
    const executor = connection || db;
    const [result] = await executor.query(sql, [
        imported_rows,
        skipped_rows,
        status,
        error_log ? JSON.stringify(error_log) : null,
        id
    ]);
    return result;
};

/**
 * Tìm đợt nhập theo mã băm file_hash
 */
const findBatchByHash = async (fileHash) => {
    const sql = `
        SELECT b.*, a.name AS account_name
        FROM import_batches b
        LEFT JOIN accounts a ON b.account_id = a.id
        WHERE b.file_hash = ? AND b.status = 'completed'
        ORDER BY b.created_at DESC
        LIMIT 1
    `;
    const [rows] = await db.query(sql, [fileHash]);
    return rows[0] || null;
};

/**
 * Lấy lịch sử tất cả các đợt nhập sao kê
 */
const findAllBatches = async () => {
    const sql = `
        SELECT b.*, a.name AS account_name
        FROM import_batches b
        LEFT JOIN accounts a ON b.account_id = a.id
        ORDER BY b.created_at DESC
    `;
    const [rows] = await db.query(sql);
    return rows;
};

/**
 * Lấy chi tiết một đợt nhập theo ID
 */
const findBatchById = async (id) => {
    const sql = `
        SELECT b.*, a.name AS account_name
        FROM import_batches b
        LEFT JOIN accounts a ON b.account_id = a.id
        WHERE b.id = ?
    `;
    const [rows] = await db.query(sql, [id]);
    return rows[0] || null;
};

/**
 * Lấy danh sách mã băm dòng (import_row_hash) đã tồn tại trong bảng transactions của một ví
 */
const findExistingRowHashes = async (accountId, rowHashes = []) => {
    if (!Array.isArray(rowHashes) || rowHashes.length === 0) return new Set();

    // Để tránh vượt quá giới hạn câu lệnh IN, chia thành các batch nhỏ
    const existingSet = new Set();
    const batchSize = 500;

    for (let i = 0; i < rowHashes.length; i += batchSize) {
        const chunk = rowHashes.slice(i, i + batchSize);
        const placeholders = chunk.map(() => '?').join(',');
        const sql = `
            SELECT import_row_hash 
            FROM transactions 
            WHERE account_id = ? AND import_row_hash IN (${placeholders})
        `;
        const [rows] = await db.query(sql, [accountId, ...chunk]);
        rows.forEach(r => existingSet.add(r.import_row_hash));
    }

    return existingSet;
};

/**
 * Tìm các giao dịch nghi trùng dựa trên (account_id, transaction_date, amount, type)
 */
const findPotentialDuplicates = async (accountId, dateRange = {}) => {
    const { startDate, endDate } = dateRange;
    if (!startDate || !endDate) return [];

    const sql = `
        SELECT id, amount, type, transaction_date, note, import_row_hash
        FROM transactions
        WHERE account_id = ? AND transaction_date BETWEEN ? AND ?
    `;
    const [rows] = await db.query(sql, [accountId, startDate, endDate]);
    return rows;
};

module.exports = {
    createBatch,
    updateBatch,
    findBatchByHash,
    findAllBatches,
    findBatchById,
    findExistingRowHashes,
    findPotentialDuplicates
};

