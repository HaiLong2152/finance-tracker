const ingestService = require('../services/ingestService');

/**
 * Lấy danh sách thông báo trong Hộp chờ duyệt (GET /api/inbox)
 */
const list = async (req, res, next) => {
    try {
        const { status, search, page, limit } = req.query;
        const result = await ingestService.getInbox({ status, search, page, limit });
        res.json({
            success: true,
            data: result.items,
            pagination: result.pagination
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Lấy thống kê số lượng thông báo theo trạng thái (GET /api/inbox/stats)
 */
const stats = async (req, res, next) => {
    try {
        const result = await ingestService.getInboxStats();
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Lấy chi tiết thông báo theo ID (GET /api/inbox/:id)
 */
const getById = async (req, res, next) => {
    try {
        const item = await ingestService.getInboxById(req.params.id);
        res.json({
            success: true,
            data: item
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Xử lý hoặc bỏ qua thông báo trong Hộp chờ (POST /api/inbox/:id/resolve)
 */
const resolve = async (req, res, next) => {
    try {
        const result = await ingestService.resolveInboxItem(req.params.id, req.body);
        res.json({
            success: true,
            message: result.message,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    list,
    stats,
    getById,
    resolve
};

