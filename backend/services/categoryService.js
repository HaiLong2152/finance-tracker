const categoryRepository = require('../repositories/categoryRepository');
const AppError = require('../utils/AppError');

const parseCategory = (body) => {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const type = body.type;
    if (name.length < 1 || name.length > 100) throw new AppError('Tên danh mục phải có từ 1 đến 100 ký tự.', 400);
    if (!['income', 'expense'].includes(type)) throw new AppError('Loại danh mục không hợp lệ.', 400);
    return { name, type };
};

const getAllCategories = async () => {
    return await categoryRepository.findAll();
};

const createCategory = async (body) => {
    const parsed = parseCategory(body);
    try {
        const result = await categoryRepository.create(parsed);
        return { id: result.insertId, ...parsed };
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') throw new AppError('Danh mục này đã tồn tại.', 409);
        throw error;
    }
};

const updateCategory = async (id, body) => {
    if (!Number.isInteger(id) || id <= 0) throw new AppError('Mã danh mục không hợp lệ.', 400);
    const parsed = parseCategory(body);
    
    try {
        const result = await categoryRepository.update(id, parsed);
        if (result.affectedRows === 0) throw new AppError('Không tìm thấy danh mục.', 404);
        return true;
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') throw new AppError('Danh mục này đã tồn tại.', 409);
        throw error;
    }
};

const deleteCategory = async (id) => {
    if (!Number.isInteger(id) || id <= 0) throw new AppError('Mã danh mục không hợp lệ.', 400);
    
    try {
        const result = await categoryRepository.remove(id);
        if (result.affectedRows === 0) throw new AppError('Không tìm thấy danh mục.', 404);
        return true;
    } catch (error) {
        if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
            throw new AppError('Không thể xóa danh mục đang có giao dịch.', 409);
        }
        throw error;
    }
};

module.exports = {
    getAllCategories,
    createCategory,
    updateCategory,
    deleteCategory
};

