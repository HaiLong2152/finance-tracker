const importService = require('../services/importService');

/**
 * Xem trước và kiểm tra file CSV sao kê (POST /api/import/preview - SPEC 4.5)
 */
const preview = async (req, res, next) => {
    try {
        const result = await importService.previewCsv(req.body);
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Xác nhận nhập các giao dịch từ sao kê vào CSDL (POST /api/import/confirm - SPEC 4.5)
 */
const confirm = async (req, res, next) => {
    try {
        const result = await importService.confirmImport(req.body);
        res.status(201).json({
            success: true,
            data: result,
            message: result.message
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Lấy danh sách lịch sử các đợt nhập (GET /api/import/batches)
 */
const getBatches = async (req, res, next) => {
    try {
        const data = await importService.getBatches();
        res.json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Lấy chi tiết một đợt nhập theo ID (GET /api/import/batches/:id)
 */
const getBatchById = async (req, res, next) => {
    try {
        const data = await importService.getBatchById(req.params.id);
        res.json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    preview,
    confirm,
    getBatches,
    getBatchById
};

