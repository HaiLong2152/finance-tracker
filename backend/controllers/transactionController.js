const db = require('../config/db');

const isValidDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const parseTransaction = (body) => {
    const { amount, category_id, transaction_date, note = '' } = body;
    const numericAmount = Number(amount);
    const numericCategoryId = Number(category_id);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return { error: 'Số tiền phải lớn hơn 0.' };
    if (!Number.isInteger(numericCategoryId) || numericCategoryId <= 0) return { error: 'Danh mục không hợp lệ.' };
    if (!isValidDate(transaction_date)) return { error: 'Ngày giao dịch không hợp lệ.' };
    if (typeof note !== 'string' || note.length > 500) return { error: 'Ghi chú không được vượt quá 500 ký tự.' };
    return { value: { amount: numericAmount, categoryId: numericCategoryId, transactionDate: transaction_date, note: note.trim() || null } };
};

const categoryExists = async (categoryId) => {
    const [rows] = await db.query('SELECT id FROM categories WHERE id = ?', [categoryId]);
    return rows.length > 0;
};

const getAllTransactions = async (req, res) => {
    try {
        const sql = `
            SELECT t.id, t.amount, t.category_id, t.transaction_date, t.note,
                   c.name AS category_name, c.type
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            ORDER BY t.transaction_date DESC, t.id DESC
        `;
        const [rows] = await db.query(sql);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Lỗi lấy giao dịch:', error);
        res.status(500).json({ success: false, message: 'Không thể tải giao dịch.' });
    }
};

const createTransaction = async (req, res) => {
    const parsed = parseTransaction(req.body);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    try {
        const { amount, categoryId, transactionDate, note } = parsed.value;
        if (!(await categoryExists(categoryId))) return res.status(400).json({ success: false, message: 'Danh mục không tồn tại.' });
        const [result] = await db.query(
            'INSERT INTO transactions (amount, category_id, transaction_date, note) VALUES (?, ?, ?, ?)',
            [amount, categoryId, transactionDate, note],
        );
        res.status(201).json({ success: true, message: 'Đã thêm giao dịch.', data: { id: result.insertId } });
    } catch (error) {
        console.error('Lỗi thêm giao dịch:', error);
        res.status(500).json({ success: false, message: 'Không thể lưu giao dịch.' });
    }
};

const updateTransaction = async (req, res) => {
    const transactionId = Number(req.params.id);
    const parsed = parseTransaction(req.body);
    if (!Number.isInteger(transactionId) || transactionId <= 0) return res.status(400).json({ success: false, message: 'Mã giao dịch không hợp lệ.' });
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    try {
        const [transactions] = await db.query('SELECT id FROM transactions WHERE id = ?', [transactionId]);
        if (transactions.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch.' });
        const { amount, categoryId, transactionDate, note } = parsed.value;
        if (!(await categoryExists(categoryId))) return res.status(400).json({ success: false, message: 'Danh mục không tồn tại.' });
        await db.query(
            'UPDATE transactions SET amount = ?, category_id = ?, transaction_date = ?, note = ? WHERE id = ?',
            [amount, categoryId, transactionDate, note, transactionId],
        );
        res.json({ success: true, message: 'Đã cập nhật giao dịch.' });
    } catch (error) {
        console.error('Lỗi cập nhật giao dịch:', error);
        res.status(500).json({ success: false, message: 'Không thể cập nhật giao dịch.' });
    }
};

const deleteTransaction = async (req, res) => {
    const transactionId = Number(req.params.id);
    if (!Number.isInteger(transactionId) || transactionId <= 0) return res.status(400).json({ success: false, message: 'Mã giao dịch không hợp lệ.' });
    try {
        const [result] = await db.query('DELETE FROM transactions WHERE id = ?', [transactionId]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch.' });
        res.json({ success: true, message: 'Đã xóa giao dịch.' });
    } catch (error) {
        console.error('Lỗi xóa giao dịch:', error);
        res.status(500).json({ success: false, message: 'Không thể xóa giao dịch.' });
    }
};

module.exports = { getAllTransactions, createTransaction, updateTransaction, deleteTransaction };
