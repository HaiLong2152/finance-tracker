const categoryService = require('../services/categoryService');

const getAllCategories = async (req, res, next) => {
    try {
        const data = await categoryService.getAllCategories();
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const createCategory = async (req, res, next) => {
    try {
        const data = await categoryService.createCategory(req.body);
        res.status(201).json({ success: true, message: 'Đã thêm danh mục.', data });
    } catch (error) {
        next(error);
    }
};

const updateCategory = async (req, res, next) => {
    try {
        await categoryService.updateCategory(Number(req.params.id), req.body);
        res.json({ success: true, message: 'Đã cập nhật danh mục.' });
    } catch (error) {
        next(error);
    }
};

const deleteCategory = async (req, res, next) => {
    try {
        await categoryService.deleteCategory(Number(req.params.id));
        res.json({ success: true, message: 'Đã xóa danh mục.' });
    } catch (error) {
        next(error);
    }
};

module.exports = { getAllCategories, createCategory, updateCategory, deleteCategory };
