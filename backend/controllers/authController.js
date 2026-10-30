const authService = require('../services/authService');
const AppError = require('../utils/AppError');
const { env } = require('../config/env');

const getCookieOptions = () => ({
  httpOnly: true,
  secure: env.cookie.secure,
  sameSite: env.cookie.sameSite,
  maxAge: env.cookie.maxAge,
  path: '/',
});

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

    res.cookie('auth_token', token, getCookieOptions());

    res.json({
      success: true,
      message: 'Đăng nhập thành công.',
      data: { authenticated: true, token },
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: env.cookie.secure,
      sameSite: env.cookie.sameSite,
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

