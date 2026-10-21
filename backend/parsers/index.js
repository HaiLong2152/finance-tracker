/**
 * Parser Engine Dispatcher (SPEC 4.3)
 * Điều phối thông báo đến parser chuyên dụng phù hợp nhất hoặc fallback về generic parser
 */

const vcbParser = require('./vcbParser');
const genericParser = require('./genericParser');

/**
 * Phân tích thông báo thô từ nguồn (pure function, không tác dụng phụ)
 * @param {string} text - Nội dung thông báo
 * @param {string} title - Tiêu đề thông báo
 * @param {string} pkg - Tên package hoặc nguồn gửi
 * @returns {object} Kết quả phân tích chuẩn hóa
 */
const parseNotification = (text = '', title = '', pkg = '') => {
    // 1. Kiểm tra parser Vietcombank
    if (vcbParser.canHandle(text, title, pkg)) {
        const vcbResult = vcbParser.parse(text, title, pkg);
        if (vcbResult.success) {
            return vcbResult;
        }
    }

    // 2. Fallback về Generic Parser
    return genericParser.parse(text, title, pkg);
};

module.exports = {
    parseNotification,
    vcbParser,
    genericParser
};

