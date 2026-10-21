const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const AppError = require('../utils/AppError');

/**
 * Middleware xác thực riêng cho Ingest API (SPEC 7 & 10)
 * Kiểm tra header Authorization: Bearer <token> hoặc x-ingest-token
 */
const requireIngestToken = (req, res, next) => {
    const configuredToken = process.env.INGEST_TOKEN;
    if (!configuredToken) {
        return next(new AppError('Máy chủ chưa được cấu hình INGEST_TOKEN.', 500));
    }

    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && (authHeader.startsWith('Bearer ') || authHeader.startsWith('bearer '))) {
        token = authHeader.slice(7).trim();
    } else if (req.headers['x-ingest-token']) {
        token = String(req.headers['x-ingest-token']).trim();
    }

    if (!token) {
        return next(new AppError('Yêu cầu Ingest thiếu token xác thực (cần header Authorization: Bearer <token>).', 401));
    }

    // So sánh chuỗi an toàn chống timing attack
    const tokenBuffer = Buffer.from(token);
    const configuredBuffer = Buffer.from(configuredToken);

    if (tokenBuffer.length !== configuredBuffer.length || !crypto.timingSafeEqual(tokenBuffer, configuredBuffer)) {
        return next(new AppError('Ingest token không hợp lệ.', 401));
    }

    next();
};

/**
 * Kiểm tra kích thước payload gửi đến Ingest API (tối đa 64KB - SPEC 4.2)
 */
const checkIngestPayloadSize = (maxBytes = 64 * 1024) => (req, res, next) => {
    const contentLength = Number(req.headers['content-length'] || 0);
    if (contentLength > maxBytes) {
        return next(new AppError('Kích thước dữ liệu thông báo vượt quá giới hạn cho phép (tối đa 64KB).', 413));
    }
    next();
};

/**
 * Rate-limiter riêng cho Ingest API (tối đa 60 thông báo / phút)
 */
const ingestRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Tần suất gửi thông báo quá nhanh. Vui lòng thử lại sau.'
    }
});

module.exports = {
    requireIngestToken,
    checkIngestPayloadSize,
    ingestRateLimiter
};

