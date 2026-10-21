const ingestService = require('../services/ingestService');

/**
 * Xử lý tiếp nhận thông báo biến động số dư từ điện thoại qua /api/ingest (SPEC 4.2 & 7)
 */
const handleIngest = async (req, res, next) => {
    try {
        const result = await ingestService.processIngest(req.body);
        // Trả HTTP 200 (hoặc 201 cho tin mới) với cờ rõ ràng 'accepted' hoặc 'duplicate' (SPEC 4.2)
        const httpStatus = result.duplicate ? 200 : 201;
        res.status(httpStatus).json({
            success: true,
            status: result.status || (result.duplicate ? 'duplicate' : 'accepted'),
            duplicate: Boolean(result.duplicate),
            message: result.message,
            data: result.event
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    handleIngest
};

