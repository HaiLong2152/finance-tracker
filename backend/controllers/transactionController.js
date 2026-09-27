const db = require('../config/db');

const isValidDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const getAllTransactions = async (req, res) => {
    try {
        const sql = `
            SELECT t.id, t.amount, t.transaction_date, t.note,
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
    const { amount, category_id, transaction_date, note = '' } = req.body;
    const numericAmount = Number(amount);
    const numericCategoryId = Number(category_id);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Số tiền phải lớn hơn 0.' });
    }
    if (!Number.isInteger(numericCategoryId) || numericCategoryId <= 0) {
        return res.status(400).json({ success: false, message: 'Danh mục không hợp lệ.' });
    }
    if (!isValidDate(transaction_date)) {
        return res.status(400).json({ success: false, message: 'Ngày giao dịch không hợp lệ.' });
    }
    if (typeof note !== 'string' || note.length > 500) {
        return res.status(400).json({ success: false, message: 'Ghi chú không được vượt quá 500 ký tự.' });
    }

    try {
        const [categories] = await db.query('SELECT id FROM categories WHERE id = ?', [numericCategoryId]);
        if (categories.length === 0) {
            return res.status(400).json({ success: false, message: 'Danh mục không tồn tại.' });
        }

        const sql = 'INSERT INTO transactions (amount, category_id, transaction_date, note) VALUES (?, ?, ?, ?)';
        const [result] = await db.query(sql, [numericAmount, numericCategoryId, transaction_date, note.trim() || null]);
        res.status(201).json({
            success: true,
            message: 'Đã thêm giao dịch.',
            data: { id: result.insertId, amount: numericAmount, category_id: numericCategoryId, transaction_date, note: note.trim() || null },
        });
    } catch (error) {
        console.error('Lỗi thêm giao dịch:', error);
        res.status(500).json({ success: false, message: 'Không thể lưu giao dịch.' });
    }
};

module.exports = { getAllTransactions, createTransaction };
