const AppError = require('./AppError');

/**
 * Chuyển đổi và kiểm tra nghiêm ngặt các giá trị boolean:
 * - Khi value === undefined: trả về defaultValue (nếu có), hoặc ném lỗi nếu bắt buộc.
 * - Hợp lệ: true/false, 1/0, chuỗi 'true'/'false'/'1'/'0'.
 * - Các giá trị không hợp lệ (chuỗi lạ, null, số khác 0/1, object, array...): Ném lỗi AppError 400.
 */
const parseBoolean = (value, defaultValue = undefined, fieldName = 'Trường dữ liệu') => {
    if (value === undefined) {
        if (defaultValue !== undefined) return defaultValue;
        throw new AppError(`${fieldName} là bắt buộc.`, 400);
    }
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === 0) return value === 1;
    if (typeof value === 'string') {
        const lower = value.trim().toLowerCase();
        if (lower === 'true' || lower === '1') return true;
        if (lower === 'false' || lower === '0') return false;
    }
    throw new AppError(`${fieldName} phải là giá trị boolean hợp lệ (true/false, 1/0).`, 400);
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

