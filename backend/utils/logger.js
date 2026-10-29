/**
 * Hệ thống Logging chuẩn hóa cho Production & Development
 * Tự động che giấu (Sanitize/Redact) mật khẩu, token, cookie và nội dung tin nhắn nhạy cảm.
 */

const SENSITIVE_KEYS = new Set([
    'password',
    'passwordhash',
    'authpassword',
    'authpasswordhash',
    'token',
    'authtoken',
    'jwtsecret',
    'secret',
    'ingesttoken',
    'authorization',
    'cookie',
    'cookies',
    'setcookie',
    'rawmessage',
    'content',
    'smsbody',
    'cardnumber'
]);

/**
 * Che giấu giá trị nhạy cảm
 */
const maskValue = (val) => {
    if (typeof val !== 'string') return '[REDACTED]';
    if (val.length <= 6) return '******';
    return `${val.slice(0, 2)}***${val.slice(-2)}`;
};

/**
 * Đệ quy làm sạch object / array trước khi in ra log
 */
const sanitizeData = (data, depth = 0) => {
    if (depth > 6) return '[MAX_DEPTH]';
    if (data === null || data === undefined) return data;

    if (typeof data === 'string') {
        // Che giấu Bearer token trong chuỗi
        let cleaned = data.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
        // Che giấu token / key dạng JWT
        cleaned = cleaned.replace(/eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g, '[JWT_REDACTED]');
        return cleaned;
    }

    if (typeof data === 'number' || typeof data === 'boolean') {
        return data;
    }

    if (data instanceof Error) {
        return {
            name: data.name,
            message: sanitizeData(data.message, depth + 1),
            code: data.code,
            stack: process.env.NODE_ENV !== 'production' ? data.stack : undefined
        };
    }

    if (Array.isArray(data)) {
        return data.map(item => sanitizeData(item, depth + 1));
    }

    if (typeof data === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(data)) {
            const lowerKey = key.toLowerCase().replace(/[-_]/g, '');
            if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('secret') || lowerKey.includes('token') || lowerKey.includes('rawmessage')) {
                result[key] = maskValue(value);
            } else {
                result[key] = sanitizeData(value, depth + 1);
            }
        }
        return result;
    }

    return String(data);
};

const formatLog = (level, context, message, meta) => {
    const timestamp = new Date().toISOString();
    const ctx = context ? `[${context}]` : '';
    let metaStr = '';

    if (meta !== undefined && meta !== null) {
        try {
            const sanitized = sanitizeData(meta);
            metaStr = typeof sanitized === 'object' ? ` ${JSON.stringify(sanitized)}` : ` ${sanitized}`;
        } catch {
            metaStr = ' [Unserializable meta]';
        }
    }

    const cleanMsg = typeof message === 'string' ? sanitizeData(message) : JSON.stringify(sanitizeData(message));
    return `[${timestamp}] [${level}] ${ctx} ${cleanMsg}${metaStr}`;
};

const logger = {
    info: (message, meta, context = 'APP') => {
        console.log(formatLog('INFO', context, message, meta));
    },

    warn: (message, meta, context = 'APP') => {
        console.warn(formatLog('WARN', context, message, meta));
    },

    error: (message, errorOrMeta, context = 'APP') => {
        console.error(formatLog('ERROR', context, message, errorOrMeta));
    },

    debug: (message, meta, context = 'APP') => {
        if (process.env.NODE_ENV !== 'production') {
            console.debug(formatLog('DEBUG', context, message, meta));
        }
    },

    sanitize: sanitizeData
};

module.exports = logger;
