const budgetService = require('../services/budgetService');

const getBudgets = async (req, res, next) => {
    try {
        const data = await budgetService.getBudgets(req.query.month);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const getBudgetById = async (req, res, next) => {
    try {
        const data = await budgetService.getBudgetById(Number(req.params.id));
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const saveBudget = async (req, res, next) => {
    try {
        const data = await budgetService.saveBudget(req.body);
        res.status(200).json({ success: true, message: 'Đã lưu ngân sách danh mục.', data });
    } catch (error) {
        next(error);
    }
};

const updateBudget = async (req, res, next) => {
    try {
        const data = await budgetService.updateBudget(Number(req.params.id), req.body);
        res.json({ success: true, message: 'Đã cập nhật hạn mức ngân sách.', data });
    } catch (error) {
        next(error);
    }
};

const deleteBudget = async (req, res, next) => {
    try {
        await budgetService.deleteBudget(Number(req.params.id));
        res.json({ success: true, message: 'Đã xóa hạn mức ngân sách.' });
    } catch (error) {
        next(error);
    }
};

const copyPreviousMonth = async (req, res, next) => {
    try {
        const result = await budgetService.copyPreviousMonth(req.body?.month);
        res.json({
            success: true,
            message: `Đã sao chép thành công ${result.copied_count} hạn mức từ tháng ${result.source_month}.`,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getBudgets,
    getBudgetById,
    saveBudget,
    updateBudget,
    deleteBudget,
    copyPreviousMonth
};

