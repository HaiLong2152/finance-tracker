const rateLimit = require('express-rate-limit');
const authService = require('../services/authService');
const AppError = require('../utils/AppError');

/**
 * Middleware kiểm tra phiên đăng nhập qua cookie httpOnly hoặc Bearer token
 */
const requireAuth = (req, res, next) => {
  // 1. Tìm token trong cookie auth_token hoặc Authorization header
  let token = req.cookies?.auth_token;

  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ') || authHeader.startsWith('bearer ')) {
      token = authHeader.slice(7).trim();
    }
  }

  if (!token) {
    return next(new AppError('Chưa đăng nhập hoặc phiên làm việc đã hết hạn.', 401));
  }

  try {
    const decoded = authService.verifyToken(token);
    req.user = decoded;
    return next();
  } catch (error) {
    return next(new AppError('Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.', 401));
  }
};

/**
 * Rate-limit chống brute-force đăng nhập (tối đa 5 lần thử trong 15 phút)
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bạn đã thử đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.',
  },
});

module.exports = {
  requireAuth,
  loginRateLimiter,
};

