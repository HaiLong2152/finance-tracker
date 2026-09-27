const db = require('../config/db');

const getAllCategories = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM categories ORDER BY type, name');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Lỗi lấy danh mục:', error);
        res.status(500).json({ success: false, message: 'Không thể tải danh mục.' });
    }
};

module.exports = { getAllCategories };
