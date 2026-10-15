const ingestService = require('../services/ingestService');

/**
 * Xử lý tiếp nhận thông báo biến động số dư từ điện thoại qua /api/ingest (SPEC 7 & 10)
 */
const handleIngest = async (req, res, next) => {
    try {
        const result = await ingestService.processIngest(req.body);
        // Luôn trả 200 kèm trạng thái để ứng dụng tự động hóa (MacroDroid/Tasker) không thử lại vô hạn (SPEC 7)
        res.status(200).json({
            success: true,
            duplicate: result.duplicate,
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

