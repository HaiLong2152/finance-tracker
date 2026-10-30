const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

const parseNumber = (val, defaultVal) => {
    const num = Number(val);
    return Number.isSafeInteger(num) && num > 0 ? num : defaultVal;
};

const parseOrigins = (val) => {
    return (val || 'http://localhost:5173')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
};

const env = {
    NODE_ENV,
    isProduction,
    isTest,
    PORT: parseNumber(process.env.PORT, 5000),
    
    // MySQL
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseNumber(process.env.DB_PORT, 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        name: process.env.DB_NAME || 'finance_tracker',
        ssl: process.env.DB_SSL === 'true',
        sslCa: process.env.DB_SSL_CA || null,
        sslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        backupRetentionDays: parseNumber(process.env.BACKUP_RETENTION_DAYS, 7)
    },

    // Security & Auth
    auth: {
        jwtSecret: process.env.JWT_SECRET || '',
        password: process.env.AUTH_PASSWORD || '',
        passwordHash: process.env.AUTH_PASSWORD_HASH || '',
        ingestToken: process.env.INGEST_TOKEN || ''
    },

    // Network & Proxy
    cors: {
        origins: parseOrigins(process.env.CORS_ORIGIN)
    },
    trustProxy: process.env.TRUST_PROXY === 'true' 
        ? true 
        : (process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || 1 : 1),
    rateLimitMax: parseNumber(process.env.RATE_LIMIT_MAX, 100),

    // Cookie Configuration (SPEC 5.1 & 5.3)
    cookie: {
        secure: process.env.COOKIE_SECURE !== undefined
            ? process.env.COOKIE_SECURE === 'true'
            : isProduction,
        sameSite: process.env.COOKIE_SAME_SITE || 'lax', // 'lax' | 'none' | 'strict'
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 ngày (SPEC 5.1)
    }
};

/**
 * Kiểm tra xác thực tính hợp lệ của biến môi trường trước khi khởi động server
 */
const validateEnvironment = () => {
    const errors = [];
    const warnings = [];

    // 1. Kiểm tra JWT Secret
    if (!env.auth.jwtSecret || typeof env.auth.jwtSecret !== 'string' || !env.auth.jwtSecret.trim()) {
        errors.push('JWT_SECRET: Khóa bí mật ký token không được để trống.');
    } else if (env.auth.jwtSecret.length < 32) {
        errors.push(`JWT_SECRET: Độ dài khóa quá ngắn (${env.auth.jwtSecret.length} ký tự). Yêu cầu tối thiểu 32 ký tự.`);
    } else if (env.auth.jwtSecret.includes('change_me') || env.auth.jwtSecret === 'default_secret') {
        errors.push('JWT_SECRET: Đang sử dụng khóa mặc định không an toàn.');
    }

    // 2. Kiểm tra Mật khẩu ứng dụng
    const hasPassword = Boolean(env.auth.password && env.auth.password.trim());
    const hasHash = Boolean(env.auth.passwordHash && env.auth.passwordHash.trim());
    if (!hasPassword && !hasHash) {
        errors.push('AUTH_PASSWORD hoặc AUTH_PASSWORD_HASH: Chưa cấu hình mật khẩu đăng nhập.');
    } else if (hasPassword && ['123456', 'password', 'admin', 'finance'].includes(env.auth.password)) {
        if (isProduction) {
            errors.push('AUTH_PASSWORD: Mật khẩu quá đơn giản, không được phép sử dụng trong môi trường Production.');
        } else {
            warnings.push('AUTH_PASSWORD: Mật khẩu đăng nhập đang đặt khá đơn giản.');
        }
    }

    // 3. Kiểm tra Ingest Token
    if (!env.auth.ingestToken || typeof env.auth.ingestToken !== 'string' || !env.auth.ingestToken.trim()) {
        errors.push('INGEST_TOKEN: Khóa xác thực Ingest API không được để trống.');
    } else if (env.auth.ingestToken.length < 16) {
        errors.push(`INGEST_TOKEN: Độ dài token quá ngắn (${env.auth.ingestToken.length} ký tự). Yêu cầu tối thiểu 16 ký tự.`);
    }

    // 4. Kiểm tra Database
    if (!env.db.name) {
        errors.push('DB_NAME: Chưa cấu hình tên cơ sở dữ liệu MySQL.');
    }

    // 5. Kiểm tra cấu hình Cookie (SPEC 5.3)
    if (env.cookie.sameSite === 'none' && !env.cookie.secure) {
        errors.push('COOKIE_SAME_SITE: Khi đặt sameSite="none", bắt buộc COOKIE_SECURE phải là true (yêu cầu của trình duyệt để gửi cookie cross-site).');
    }

    // 6. Kiểm tra cấu hình Production riêng biệt
    if (isProduction) {
        const hasLocalOrigin = env.cors.origins.some(o => o.includes('localhost') || o.includes('127.0.0.1'));
        if (hasLocalOrigin) {
            warnings.push('CORS_ORIGIN đang chứa địa chỉ localhost/127.0.0.1 trên môi trường Production.');
        }
        if (!hasHash && hasPassword) {
            warnings.push('Khuyến nghị sử dụng AUTH_PASSWORD_HASH (bcrypt) thay cho AUTH_PASSWORD dạng văn bản trong môi trường Production.');
        }
    }

    if (errors.length > 0) {
        const errorMsg = `[LỖI CẤU HÌNH BẢO MẬT] Không thể khởi động ứng dụng do các biến môi trường không an toàn:\n  - ${errors.join('\n  - ')}`;
        throw new Error(errorMsg);
    }

    return { valid: true, warnings };
};

module.exports = {
    env,
    validateEnvironment
};

