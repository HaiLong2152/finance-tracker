const db = require('../config/db');

const parseCategory = (body) => {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const type = body.type;
    if (name.length < 1 || name.length > 100) return { error: 'Tên danh mục phải có từ 1 đến 100 ký tự.' };
    if (!['income', 'expense'].includes(type)) return { error: 'Loại danh mục không hợp lệ.' };
    return { value: { name, type } };
};

const getAllCategories = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM categories ORDER BY type, name');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Lỗi lấy danh mục:', error);
        res.status(500).json({ success: false, message: 'Không thể tải danh mục.' });
    }
};

const createCategory = async (req, res) => {
    const parsed = parseCategory(req.body);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    try {
        const [result] = await db.query('INSERT INTO categories (name, type) VALUES (?, ?)', [parsed.value.name, parsed.value.type]);
        res.status(201).json({ success: true, message: 'Đã thêm danh mục.', data: { id: result.insertId, ...parsed.value } });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Danh mục này đã tồn tại.' });
        console.error('Lỗi thêm danh mục:', error);
        res.status(500).json({ success: false, message: 'Không thể thêm danh mục.' });
    }
};

const updateCategory = async (req, res) => {
    const categoryId = Number(req.params.id);
    const parsed = parseCategory(req.body);
    if (!Number.isInteger(categoryId) || categoryId <= 0) return res.status(400).json({ success: false, message: 'Mã danh mục không hợp lệ.' });
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    try {
        const [result] = await db.query('UPDATE categories SET name = ?, type = ? WHERE id = ?', [parsed.value.name, parsed.value.type, categoryId]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.' });
        res.json({ success: true, message: 'Đã cập nhật danh mục.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Danh mục này đã tồn tại.' });
        console.error('Lỗi cập nhật danh mục:', error);
        res.status(500).json({ success: false, message: 'Không thể cập nhật danh mục.' });
    }
};

const deleteCategory = async (req, res) => {
    const categoryId = Number(req.params.id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) return res.status(400).json({ success: false, message: 'Mã danh mục không hợp lệ.' });
    try {
        const [result] = await db.query('DELETE FROM categories WHERE id = ?', [categoryId]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.' });
        res.json({ success: true, message: 'Đã xóa danh mục.' });
    } catch (error) {
        if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
            return res.status(409).json({ success: false, message: 'Không thể xóa danh mục đang có giao dịch.' });
        }
        console.error('Lỗi xóa danh mục:', error);
        res.status(500).json({ success: false, message: 'Không thể xóa danh mục.' });
    }
};

module.exports = { getAllCategories, createCategory, updateCategory, deleteCategory };
