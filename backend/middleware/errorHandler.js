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

    console.error('Unhandled server error:', error);
    return res.status(error.statusCode || error.status || 500).json({
        success: false,
        message: error.statusCode || error.status ? error.message : 'Đã xảy ra lỗi máy chủ.',
    });
};

module.exports = { notFoundHandler, errorHandler };
