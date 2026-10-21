/**
 * Generic Parser đa dụng cho các ngân hàng và ví điện tử khác
 * (MB Bank, Techcombank, ACB, BIDV, VPBank, MoMo, ZaloPay, VNPay...)
 */

const extractGenericDate = (content) => {
    // Mẫu: DD/MM/YYYY hoặc DD-MM-YYYY hoặc YYYY-MM-DD
    const isoMatch = content.match(/([0-9]{4})-([0-9]{2})-([0-9]{2})/);
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    const dmyMatch = content.match(/([0-9]{1,2})[/\-]([0-9]{1,2})[/\-]([0-9]{4})/);
    if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const year = dmyMatch[3];
        return `${year}-${month}-${day}`;
    }

    return null;
};

const parse = (text = '', title = '', pkg = '') => {
    const rawContent = `${title} ${text}`.trim();
    if (!rawContent) {
        return {
            success: false,
            parser_name: 'generic_parser',
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

    let detectedAmount = null;
    let detectedType = null;

    // 1. Nhận diện số tiền có dấu (+ / -) hoặc có đơn vị tiền tệ rõ ràng
    const signedAmountRegex = /([+\-])\s*([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,12})(?:\s*(?:VND|VNĐ|vnd|vnđ|d|đ|dong|đồng))?/i;
    const currencyAmountRegex = /([0-9]{1,3}(?:[.,][0-9]{3})+)\s*(?:VND|VNĐ|vnd|vnđ|d|đ|dong|đồng)/i;

    const signedMatch = rawContent.match(signedAmountRegex);
    const currencyMatch = rawContent.match(currencyAmountRegex);

    if (signedMatch && signedMatch[2]) {
        const sign = signedMatch[1];
        const cleanDigits = signedMatch[2].replace(/[.,]/g, '');
        const parsedNumber = Number(cleanDigits);
        if (Number.isSafeInteger(parsedNumber) && parsedNumber > 0) {
            detectedAmount = parsedNumber;
            detectedType = sign === '+' ? 'income' : 'expense';
        }
    } else if (currencyMatch && currencyMatch[1]) {
        const cleanDigits = currencyMatch[1].replace(/[.,]/g, '');
        const parsedNumber = Number(cleanDigits);
        if (Number.isSafeInteger(parsedNumber) && parsedNumber > 0) {
            detectedAmount = parsedNumber;
        }
    }

    // 2. Nhận diện loại giao dịch từ từ khóa tiếng Việt nếu chưa xác định được từ dấu
    if (!detectedType) {
        const contentLower = rawContent.toLowerCase();
        const incomeKeywords = ['nhan tien', 'nhận tiền', 'cong tien', 'cộng tiền', 'tien vao', 'tiền vào', 'hoan tien', 'hoàn tiền'];
        const expenseKeywords = ['thanh toan', 'thanh toán', 'chuyen tien', 'chuyển tiền', 'tru tien', 'trừ tiền', 'rut tien', 'rút tiền', 'phi duy tri', 'phí duy trì'];

        if (incomeKeywords.some((kw) => contentLower.includes(kw))) {
            detectedType = 'income';
        } else if (expenseKeywords.some((kw) => contentLower.includes(kw))) {
            detectedType = 'expense';
        }
    }

    // 3. Nhận diện số tài khoản / ví
    let accountIdentifier = null;
    const accountMatch = rawContent.match(/(?:TK|Tai khoan|Tài khoản|Vi|Ví)\s*([0-9xX*]{4,16})/i);
    if (accountMatch && accountMatch[1]) {
        accountIdentifier = accountMatch[1].trim();
    }

    // 4. Nhận diện ngày
    const detectedDate = extractGenericDate(rawContent);

    // 5. Ghi chú
    let note = null;
    const noteMatch = rawContent.match(/(?:ND|Nội dung|Noi dung|Ref|Lý do|GD):\s*([^.\n]+)/i);
    if (noteMatch && noteMatch[1]) {
        note = noteMatch[1].trim();
    } else {
        note = title ? title.trim() : rawContent.slice(0, 100);
    }

    const isSuccess = Boolean(detectedAmount && detectedAmount > 0);

    return {
        success: isSuccess,
        parser_name: 'generic_parser',
        confidence: isSuccess ? (detectedType ? 'medium' : 'low') : 'low',
        detected_amount: detectedAmount,
        detected_type: detectedType || 'expense',
        detected_date: detectedDate,
        account_identifier: accountIdentifier,
        note: note || null,
        is_recoverable: true,
        error: isSuccess ? null : 'Không tìm thấy số tiền biến động trong nội dung thông báo.'
    };
};

module.exports = {
    parse
};

