const AppError = require('./AppError');

/**
 * Chuyển đổi an toàn các giá trị boolean (xử lý đúng chuỗi 'false', '0', false, 0...)
 */
const parseBoolean = (value, defaultValue = false) => {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const lower = value.trim().toLowerCase();
        if (lower === 'true' || lower === '1') return true;
        if (lower === 'false' || lower === '0') return false;
    }
    return defaultValue;
};

/**
 * Parse và kiểm tra số nguyên an toàn nghiêm ngặt
 * - Từ chối boolean, null, object, array, chuỗi rỗng, float, chuỗi không hợp lệ
 * - Hỗ trợ giá trị mặc định khi undefined
 */
const parseInteger = (value, fieldName, defaultValue = undefined) => {
    if (value === undefined) {
        if (defaultValue !== undefined) return defaultValue;
        throw new AppError(`${fieldName} là bắt buộc.`, 400);
    }
    if (typeof value === 'boolean' || value === null || Array.isArray(value)) {
        throw new AppError(`${fieldName} phải là số nguyên hợp lệ.`, 400);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!/^-?\d+$/.test(trimmed)) {
            throw new AppError(`${fieldName} phải là số nguyên hợp lệ.`, 400);
        }
        const num = Number(trimmed);
        if (!Number.isSafeInteger(num)) {
            throw new AppError(`${fieldName} vượt quá giới hạn số nguyên an toàn.`, 400);
        }
        return num;
    }
    if (typeof value === 'number') {
        if (!Number.isSafeInteger(value)) {
            throw new AppError(`${fieldName} phải là số nguyên hợp lệ.`, 400);
        }
        return value;
    }
    throw new AppError(`${fieldName} phải là số nguyên hợp lệ.`, 400);
};

module.exports = {
    parseBoolean,
    parseInteger
};

