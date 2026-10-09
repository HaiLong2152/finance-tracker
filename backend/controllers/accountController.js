const accountService = require('../services/accountService');
const { parseBoolean } = require('../utils/parsers');

const getAllAccounts = async (req, res, next) => {
    try {
        const includeArchived = parseBoolean(req.query.include_archived, false);
        const data = await accountService.getAllAccounts(includeArchived);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const getAccountById = async (req, res, next) => {
    try {
        const data = await accountService.getAccountById(Number(req.params.id));
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const createAccount = async (req, res, next) => {
    try {
        const data = await accountService.createAccount(req.body);
        res.status(201).json({ success: true, message: 'Đã thêm ví mới.', data });
    } catch (error) {
        next(error);
    }
};

const updateAccount = async (req, res, next) => {
    try {
        await accountService.updateAccount(Number(req.params.id), req.body);
        res.json({ success: true, message: 'Đã cập nhật thông tin ví.' });
    } catch (error) {
        next(error);
    }
};

const archiveAccount = async (req, res, next) => {
    try {
        const hasBody = req.body && typeof req.body === 'object' && !Array.isArray(req.body);
        const rawValue = hasBody && req.body.is_archived !== undefined ? req.body.is_archived : true;
        const isArchived = parseBoolean(rawValue, true);

        await accountService.archiveAccount(Number(req.params.id), isArchived);
        res.json({ 
            success: true, 
            message: isArchived ? 'Đã chuyển ví vào lưu trữ.' : 'Đã khôi phục ví từ lưu trữ.' 
        });
    } catch (error) {
        next(error);
    }
};

const deleteAccount = async (req, res, next) => {
    try {
        await accountService.deleteAccount(Number(req.params.id));
        res.json({ success: true, message: 'Đã xóa ví.' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllAccounts,
    getAccountById,
    createAccount,
    updateAccount,
    archiveAccount,
    deleteAccount
};
