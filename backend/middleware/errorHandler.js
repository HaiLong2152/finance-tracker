const AppError = require('../utils/AppError');

const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        message: `Không tìm thấy endpoint ${req.method} ${req.originalUrl}.`,
    });
};

const errorHandler = (error, req, res, next) => {
    if (res.headersSent) return next(error);

    if (error instanceof SyntaxError && error.status === 400 && error.type === 'entity.parse.failed') {
        return res.status(400).json({
            success: false,
            message: 'Dữ liệu JSON không hợp lệ.',
        });
    }

    if (error.type === 'entity.too.large' || error.status === 413) {
        return res.status(413).json({
            success: false,
            message: 'Kích thước dữ liệu gửi lên vượt quá giới hạn cho phép.',
        });
    }

    if (error instanceof AppError || error.isOperational) {
        return res.status(error.statusCode || 400).json({
            success: false,
            message: error.message,
        });
    }

    // Vệ sinh log: không in token, mật khẩu hoặc nội dung nhạy cảm ra log máy chủ (SPEC 4.2 & 5.1)
    const sanitizedMsg = error.message
        ? error.message.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
        : 'Unknown error';
    console.error('Unhandled server error:', `${error.name || 'Error'}: ${sanitizedMsg}`);
    if (error.code) {
        console.error('Error Code:', error.code);
    }
    return res.status(500).json({
        success: false,
        message: 'Đã xảy ra lỗi máy chủ.',
    });
};

module.exports = { notFoundHandler, errorHandler };
