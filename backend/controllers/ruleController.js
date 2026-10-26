const ruleService = require('../services/ruleService');

const getAllRules = async (req, res, next) => {
    try {
        const data = await ruleService.getAllRules(req.query);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const getRuleById = async (req, res, next) => {
    try {
        const data = await ruleService.getRuleById(req.params.id);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const createRule = async (req, res, next) => {
    try {
        const data = await ruleService.createRule(req.body);
        res.status(201).json({
            success: true,
            message: 'Đã tạo quy tắc tự gán danh mục thành công.',
            data
        });
    } catch (error) {
        next(error);
    }
};

const updateRule = async (req, res, next) => {
    try {
        const data = await ruleService.updateRule(req.params.id, req.body);
        res.json({
            success: true,
            message: 'Đã cập nhật quy tắc thành công.',
            data
        });
    } catch (error) {
        next(error);
    }
};

const deleteRule = async (req, res, next) => {
    try {
        const result = await ruleService.deleteRule(req.params.id);
        res.json({
            success: true,
            message: result.message
        });
    } catch (error) {
        next(error);
    }
};

const toggleRule = async (req, res, next) => {
    try {
        const result = await ruleService.toggleRule(req.params.id);
        res.json({
            success: true,
            message: result.message,
            is_active: result.is_active
        });
    } catch (error) {
        next(error);
    }
};

const reorderRules = async (req, res, next) => {
    try {
        const data = await ruleService.reorderRules(req.body.orders);
        res.json({
            success: true,
            message: 'Đã cập nhật thứ tự ưu tiên các quy tắc.',
            data
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllRules,
    getRuleById,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    reorderRules
};

