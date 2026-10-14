const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const TOKEN_EXPIRY = '30d';

/**
 * Kiểm tra và xác thực cấu hình bảo mật bắt buộc.
 * Từ chối khởi động nếu thiếu JWT_SECRET hoặc mật khẩu đăng nhập.
 */
const validateAuthConfig = () => {
  const missing = [];
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || typeof jwtSecret !== 'string' || !jwtSecret.trim()) {
    missing.push('JWT_SECRET (khóa bí mật ký token)');
  } else if (jwtSecret === 'finance_tracker_default_jwt_secret_change_me') {
    missing.push('JWT_SECRET hợp lệ (đang dùng khóa mặc định không an toàn)');
  }

  const hasPassword = Boolean(process.env.AUTH_PASSWORD && process.env.AUTH_PASSWORD.trim());
  const hasPasswordHash = Boolean(process.env.AUTH_PASSWORD_HASH && process.env.AUTH_PASSWORD_HASH.trim());

  if (!hasPassword && !hasPasswordHash) {
    missing.push('AUTH_PASSWORD hoặc AUTH_PASSWORD_HASH (mật khẩu đăng nhập)');
  }

  if (missing.length > 0) {
    const message = `[LỖI BẢO MẬT] Từ chối khởi động hệ thống do cấu hình xác thực không an toàn hoặc bị thiếu:\n  - ${missing.join('\n  - ')}\nVui lòng cấu hình các biến môi trường trên trong file backend/.env trước khi khởi động.`;
    throw new Error(message);
  }
};

/**
 * Lấy JWT Secret từ biến môi trường (không dùng fallback mặc định)
 */
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || !secret.trim()) {
    throw new Error('Chưa cấu hình biến môi trường JWT_SECRET.');
  }
  return secret;
};

/**
 * So sánh mật khẩu an toàn chống timing attack
 */
const safeCompare = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Kiểm tra mật khẩu đăng nhập của người dùng
 * @param {string} inputPassword - Mật khẩu người dùng nhập
 * @returns {boolean}
 */
const verifyPassword = (inputPassword) => {
  if (!inputPassword || typeof inputPassword !== 'string') {
    return false;
  }

  // Nếu cấu hình mật khẩu băm bcrypt trong môi trường
  if (process.env.AUTH_PASSWORD_HASH) {
    try {
      return bcrypt.compareSync(inputPassword, process.env.AUTH_PASSWORD_HASH);
    } catch {
      return false;
    }
  }

  // Mật khẩu thiết lập trực tiếp trong biến môi trường AUTH_PASSWORD (không dùng fallback mặc định)
  const envPassword = process.env.AUTH_PASSWORD;
  if (!envPassword) {
    return false;
  }
  return safeCompare(inputPassword, envPassword);
};

/**
 * Tạo token JWT cho phiên đăng nhập (thời hạn 30 ngày theo SPEC)
 * @param {object} payload - Dữ liệu đính kèm phiên
 * @returns {string} token
 */
const generateToken = (payload = { role: 'owner' }) => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_EXPIRY });
};

/**
 * Xác thực và giải mã token JWT
 * @param {string} token - Token cần kiểm tra
 * @returns {object} decoded payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, getJwtSecret());
};

module.exports = {
  validateAuthConfig,
  getJwtSecret,
  verifyPassword,
  generateToken,
  verifyToken,
};

