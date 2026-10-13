const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'finance_tracker_default_jwt_secret_change_me';
const TOKEN_EXPIRY = '30d';

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

  // Mật khẩu thiết lập trực tiếp trong biến môi trường AUTH_PASSWORD
  const envPassword = process.env.AUTH_PASSWORD || 'finance123';
  return safeCompare(inputPassword, envPassword);
};

/**
 * Tạo token JWT cho phiên đăng nhập (thời hạn 30 ngày theo SPEC)
 * @param {object} payload - Dữ liệu đính kèm phiên
 * @returns {string} token
 */
const generateToken = (payload = { role: 'owner' }) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
};

/**
 * Xác thực và giải mã token JWT
 * @param {string} token - Token cần kiểm tra
 * @returns {object} decoded payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

module.exports = {
  verifyPassword,
  generateToken,
  verifyToken,
};

