/**
 * Parser chuyên dụng cho ngân hàng Vietcombank (VCB)
 * Hỗ trợ cả SMS Banking và VCB Digibank Push Notification
 * 
 * Các mẫu tin nhắn thực tế của Vietcombank:
 * 1. "TK 0011008899 -120,000 VND luc 15:30 15/10/2026. So du: 15,400,000 VND. ND: Thanh toan ca phe Phuc Long"
 * 2. "TK 0011008899 +2,500,000 VND luc 09:15 21/10/2026. So du: 17,900,000 VND. ND: Nhan tien tu NGUYEN VAN A"
 * 3. "Biến động số dư: TK 0011008899 -50.000 VND lúc 12:00 20/10/2026. Số dư cuối: 1.200.000 VND. Nội dung: GRABFOOD"
 * 4. "So du TK VCB 0011008899 thay doi -200,000 VND ngay 20/10/2026. Ref: SHOPEEPAY"
 */

const VCB_PACKAGES = [
    'com.vcb.vietcombank',
    'com.vcb',
    'com.vietcombank.digibank',
    'vn.com.vcb'
];

/**
 * Kiểm tra xem thông báo có thuộc định dạng Vietcombank không
 */
const canHandle = (text = '', title = '', pkg = '') => {
    const pkgLower = (pkg || '').toLowerCase();
    if (VCB_PACKAGES.some((p) => pkgLower.includes(p))) {
        return true;
    }
    const content = `${title} ${text}`.toLowerCase();
    return content.includes('vcb') || content.includes('vietcombank');
};

/**
 * Trích xuất ngày tháng theo định dạng YYYY-MM-DD từ chuỗi ngày giờ
 */
const extractVcbDate = (content) => {
    // Mẫu 1: "luc HH:mm DD/MM/YYYY" hoặc "ngày DD/MM/YYYY" hoặc "lúc HH:mm DD-MM-YYYY"
    const dateMatch = content.match(/(?:luc|lúc|ngay|ngày)?\s*(?:[0-9]{1,2}:[0-9]{2})?\s*([0-9]{1,2})[/\-]([0-9]{1,2})[/\-]([0-9]{4})/i);
    if (dateMatch) {
        const day = dateMatch[1].padStart(2, '0');
        const month = dateMatch[2].padStart(2, '0');
        const year = dateMatch[3];
        return `${year}-${month}-${day}`;
    }
    return null;
};

/**
 * Parser thuần bóc tách thông báo Vietcombank
 */
const parse = (text = '', title = '', pkg = '') => {
    const rawContent = `${title} ${text}`.trim();
    if (!rawContent) {
        return {
            success: false,
            parser_name: 'vcb_parser',
            confidence: 'low',
            detected_amount: null,
            detected_type: null,
            detected_date: null,
            account_identifier: null,
            note: null,
            is_recoverable: false,
            error: 'Nội dung thông báo rỗng.'
        };
    }

    // 1. Nhận diện số tài khoản sau "TK" hoặc "TK VCB" (VD: "TK 0011008899" hoặc "TK VCB 0011008899")
    let accountIdentifier = null;
    const accountMatch = rawContent.match(/(?:TK(?:\s+VCB)?|Tai khoan)\s*([0-9xX*]{6,16})/i);
    if (accountMatch && accountMatch[1]) {
        accountIdentifier = accountMatch[1].trim();
    }

    // 2. Nhận diện số tiền và chiều biến động (dấu + hoặc - trước số tiền và đơn vị VND/đ)
    // Mẫu VCB: "-120,000 VND" hoặc "+2,500,000 VND" hoặc "thay doi -50.000 VND"
    let detectedAmount = null;
    let detectedType = null;

    const amountMatch = rawContent.match(/([+\-])\s*([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,12})\s*(?:VND|VNĐ|vnd|vnđ|d|đ|dong|đồng)?/i);
    if (amountMatch) {
        const sign = amountMatch[1];
        const cleanDigits = amountMatch[2].replace(/[.,]/g, '');
        const num = Number(cleanDigits);
        if (Number.isSafeInteger(num) && num > 0) {
            detectedAmount = num;
            detectedType = sign === '+' ? 'income' : 'expense';
        }
    }

    // 3. Nhận diện ngày giao dịch
    const detectedDate = extractVcbDate(rawContent);

    // 4. Nhận diện nội dung / ghi chú giao dịch
    // Thường nằm sau "ND:" hoặc "Nội dung:" hoặc "Ref:"
    let note = null;
    const noteMatch = rawContent.match(/(?:ND|Nội dung|Noi dung|Ref|Lý do):\s*([^.\n]+)/i);
    if (noteMatch && noteMatch[1]) {
        note = noteMatch[1].trim();
    } else {
        // Fallback: Lấy title hoặc phần text tóm tắt
        note = title ? title.trim() : rawContent.slice(0, 100);
    }

    const isSuccess = Boolean(detectedAmount && detectedAmount > 0);

    return {
        success: isSuccess,
        parser_name: 'vcb_parser',
        confidence: isSuccess ? 'high' : 'low',
        detected_amount: detectedAmount,
        detected_type: detectedType || 'expense',
        detected_date: detectedDate,
        account_identifier: accountIdentifier,
        note: note || null,
        is_recoverable: true,
        error: isSuccess ? null : 'Không tìm thấy thông tin biến động số tiền theo định dạng Vietcombank.'
    };
};

module.exports = {
    canHandle,
    parse
};

