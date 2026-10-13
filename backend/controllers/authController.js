const authService = require('../services/authService');
const AppError = require('../utils/AppError');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 ngày theo SPEC 5.1
  path: '/',
};

const login = async (req, res, next) => {
  try {
    const { password } = req.body || {};

    if (!password || typeof password !== 'string') {
      throw new AppError('Vui lòng nhập mật khẩu.', 400);
    }

    const isValid = authService.verifyPassword(password);
    if (!isValid) {
      throw new AppError('Mật khẩu không chính xác.', 401);
    }

    const token = authService.generateToken({ role: 'owner' });

    res.cookie('auth_token', token, COOKIE_OPTIONS);

    res.json({
      success: true,
      message: 'Đăng nhập thành công.',
      data: { authenticated: true },
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    res.json({
      success: true,
      message: 'Đã đăng xuất thành công.',
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res) => {
  let token = req.cookies?.auth_token;

  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ') || authHeader.startsWith('bearer ')) {
      token = authHeader.slice(7).trim();
    }
  }

  if (!token) {
    return res.json({ success: true, data: { authenticated: false } });
  }

  try {
    authService.verifyToken(token);
    return res.json({ success: true, data: { authenticated: true } });
  } catch {
    return res.json({ success: true, data: { authenticated: false } });
  }
};

module.exports = {
  login,
  logout,
  getMe,
};

