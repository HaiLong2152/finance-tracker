const AppError = require('./AppError');

/**
 * Chuyển đổi an toàn giá trị số/chuỗi từ CSDL (BIGINT/DECIMAL/SUM) sang BigInt
 */
const toBigInt = (value) => {
    if (value === null || value === undefined || value === '') return 0n;
    if (typeof value === 'bigint') return value;
    const str = String(value).split('.')[0].trim();
    if (!str || str === '-' || str === '+') return 0n;
    try {
        return BigInt(str);
    } catch {
        return 0n;
    }
};

/**
 * Chuyển BigInt sang Number an toàn (kiểm tra MAX_SAFE_INTEGER / MIN_SAFE_INTEGER).
 * Chống làm tròn và sai số tài chính theo chuẩn IEEE 754 khi số tiền vượt quá giới hạn.
 */
const toSafeNumber = (value, fieldName = 'Số tiền') => {
    const b = typeof value === 'bigint' ? value : toBigInt(value);
    if (b > BigInt(Number.MAX_SAFE_INTEGER) || b < BigInt(Number.MIN_SAFE_INTEGER)) {
        throw new AppError(
            `${fieldName} (${b.toString()}) vượt quá giới hạn số nguyên an toàn của JavaScript (MAX_SAFE_INTEGER). Không thể biểu diễn dưới dạng Number mà không làm sai số tài chính.`,
            500
        );
    }
    return Number(b);
};

/**
 * Tính tỷ lệ phần trăm an toàn giữa 2 số tiền kiểu BigInt:
 * (numerator * 10000n) / denominator / 100
 * Tránh sai số dấu phẩy động và làm tròn số nguyên chuẩn xác.
 */
const calculatePercentage = (numerator, denominator) => {
    const num = typeof numerator === 'bigint' ? numerator : toBigInt(numerator);
    const den = typeof denominator === 'bigint' ? denominator : toBigInt(denominator);
    if (den <= 0n) return 0;
    const scaled = (num * 10000n) / den;
    return Math.round(Number(scaled) / 100);
};

module.exports = {
    toBigInt,
    toSafeNumber,
    calculatePercentage
};

