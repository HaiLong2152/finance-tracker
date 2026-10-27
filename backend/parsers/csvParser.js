/**
 * Bộ phân tích cú pháp CSV thuần (Pure CSV Parser) cho sao kê ngân hàng và ví điện tử (SPEC 4.5)
 * Hỗ trợ:
 * - Xử lý UTF-8, loại bỏ UTF-8 BOM (\uFEFF)
 * - Tự động nhận diện dấu phân cách: phẩy (,), chấm phẩy (;), tab (\t)
 * - Xử lý chuỗi trong dấu ngoặc kép ("..."), dấu ngoặc kép lồng ("")
 * - Chuẩn hóa định dạng ngày đa dạng (DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, DD/MM/YY)
 * - Chuẩn hóa số tiền Việt Nam (120.000, 120,000, số âm -120.000 hoặc (120.000))
 * - Tự động gợi ý ánh xạ cột theo tiêu đề (date, amount, inflow/outflow, note)
 */

/**
 * Loại bỏ ký tự BOM và chuẩn hóa ngắt dòng
 */
const cleanRawCsv = (rawText = '') => {
    if (typeof rawText !== 'string') return '';
    return rawText
        .replace(/^\uFEFF/, '') // Bỏ BOM
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
};

/**
 * Tự động phát hiện dấu phân cách phù hợp nhất (, ; hoặc \t)
 */
const detectDelimiter = (text = '') => {
    const sampleLines = text.split('\n').filter(l => l.trim().length > 0).slice(0, 5);
    if (sampleLines.length === 0) return ',';

    const delimiters = [',', ';', '\t'];
    const scores = { ',': 0, ';': 0, '\t': 0 };

    for (const delimiter of delimiters) {
        let prevCount = -1;
        let consistent = true;
        for (const line of sampleLines) {
            // Đếm số lần xuất hiện của delimiter không nằm trong dấu ngoặc kép
            let count = 0;
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                if (line[i] === '"') inQuotes = !inQuotes;
                else if (line[i] === delimiter && !inQuotes) count++;
            }
            if (prevCount === -1) {
                prevCount = count;
            } else if (prevCount !== count || count === 0) {
                consistent = false;
            }
            scores[delimiter] += count;
        }
        if (consistent && prevCount > 0) {
            scores[delimiter] += 1000; // Thưởng điểm cao cho tính nhất quán giữa các dòng
        }
    }

    let bestDelimiter = ',';
    let maxScore = -1;
    for (const [delim, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            bestDelimiter = delim;
        }
    }
    return bestDelimiter;
};

/**
 * Tách một chuỗi CSV thành mảng các dòng và các ô giá trị (cells)
 */
const parseCsvToGrid = (rawText = '', customDelimiter = null) => {
    const text = cleanRawCsv(rawText);
    if (!text.trim()) return [];

    const delimiter = customDelimiter || detectDelimiter(text);
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentCell += '"';
                i++; // Bỏ qua ký tự " thoát
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === delimiter && !inQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if (char === '\n' && !inQuotes) {
            currentRow.push(currentCell.trim());
            // Chỉ thêm dòng nếu có ít nhất một ô có dữ liệu
            if (currentRow.some(c => c !== '')) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }

    if (currentCell !== '' || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c !== '')) {
            rows.push(currentRow);
        }
    }

    return { rows, delimiter };
};

/**
 * Chuẩn hóa chuỗi ngày tháng sang dạng YYYY-MM-DD
 */
const parseDate = (dateStr = '') => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const clean = dateStr.trim();

    // 1. Dạng YYYY-MM-DD hoặc YYYY/MM/DD
    const isoMatch = clean.match(/^([0-9]{4})[/\-.]([0-9]{1,2})[/\-.]([0-9]{1,2})/);
    if (isoMatch) {
        const year = isoMatch[1];
        const month = isoMatch[2].padStart(2, '0');
        const day = isoMatch[3].padStart(2, '0');
        if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
            return `${year}-${month}-${day}`;
        }
    }

    // 2. Dạng DD/MM/YYYY hoặc DD-MM-YYYY hoặc DD.MM.YYYY
    const dmyMatch = clean.match(/^([0-9]{1,2})[/\-.]([0-9]{1,2})[/\-.]([0-9]{4})/);
    if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const year = dmyMatch[3];
        if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
            return `${year}-${month}-${day}`;
        }
    }

    // 3. Dạng DD/MM/YY (năm 2 chữ số: 26 -> 2026)
    const shortYearMatch = clean.match(/^([0-9]{1,2})[/\-.]([0-9]{1,2})[/\-.]([0-9]{2})$/);
    if (shortYearMatch) {
        const day = shortYearMatch[1].padStart(2, '0');
        const month = shortYearMatch[2].padStart(2, '0');
        const rawYear = Number(shortYearMatch[3]);
        const year = rawYear < 70 ? `20${shortYearMatch[3]}` : `19${shortYearMatch[3]}`;
        if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
            return `${year}-${month}-${day}`;
        }
    }

    return null;
};

/**
 * Chuẩn hóa số tiền và xác định chiều biến động thu/chi
 * Hỗ trợ các kiểu định dạng:
 * - Dấu âm: "-150,000", "(150.000)", "+200.000"
 * - Số nguyên VND: loại bỏ dấu chấm/phẩy phân tách hàng nghìn
 */
const parseMoney = (moneyStr = '') => {
    if (!moneyStr || typeof moneyStr !== 'string') return null;
    let clean = moneyStr.trim();
    if (!clean) return null;

    let isNegative = false;

    // Kiểm tra định dạng số âm trong ngoặc đơn ví dụ (150,000)
    if (clean.startsWith('(') && clean.endsWith(')')) {
        isNegative = true;
        clean = clean.slice(1, -1).trim();
    } else if (clean.startsWith('-')) {
        isNegative = true;
        clean = clean.slice(1).trim();
    } else if (clean.startsWith('+')) {
        clean = clean.slice(1).trim();
    }

    // Loại bỏ các ký tự đơn vị tiền tệ và khoảng trắng
    clean = clean.replace(/[VND|VNĐ|vnd|vnđ|d|đ|dong|đồng|$|€|¥|\s]/gi, '');

    // Nếu rỗng sau khi loại bỏ ký tự
    if (!clean) return null;

    // Chuẩn hóa dấu chấm phẩy
    // Nếu có cả . và , (VD: 1,500.00 hoặc 1.500,00)
    if (clean.includes('.') && clean.includes(',')) {
        if (clean.lastIndexOf('.') > clean.lastIndexOf(',')) {
            // Định dạng US: 1,500.00 -> bỏ dấu phẩy
            clean = clean.replace(/,/g, '');
        } else {
            // Định dạng VN/EU: 1.500,00 -> bỏ dấu chấm, đổi phẩy thành chấm
            clean = clean.replace(/\./g, '').replace(',', '.');
        }
    } else if (clean.includes('.')) {
        // Chỉ có dấu chấm: nếu là tiền tệ VND thường là dấu phân cách hàng nghìn (150.000)
        // Nếu sau dấu chấm có đúng 3 chữ số -> phân cách hàng nghìn
        const parts = clean.split('.');
        if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
            clean = clean.replace(/\./g, '');
        }
    } else if (clean.includes(',')) {
        // Chỉ có dấu phẩy: (150,000) -> phân cách hàng nghìn
        const parts = clean.split(',');
        if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
            clean = clean.replace(/,/g, '');
        } else {
            clean = clean.replace(',', '.');
        }
    }

    const num = Math.round(Number(clean));
    if (!Number.isSafeInteger(num) || isNaN(num) || num <= 0) {
        return null;
    }

    return {
        amount: num,
        type: isNegative ? 'expense' : 'income'
    };
};

/**
 * Tự động nhận diện ánh xạ các cột từ danh sách tiêu đề (Headers)
 */
const detectColumnMapping = (headers = []) => {
    const mapping = {
        dateCol: null,
        amountCol: null,
        inflowCol: null,
        outflowCol: null,
        noteCol: null,
        categoryCol: null
    };

    const normalizeHeader = (h = '') => {
        return h
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/[^a-z0-9]/g, '');
    };

    headers.forEach((rawHeader, idx) => {
        const h = normalizeHeader(rawHeader);

        // Ngày giao dịch
        if (!mapping.dateCol) {
            if (['ngay', 'ngaygd', 'ngaygiaodich', 'date', 'txdate', 'thoigian', 'time'].includes(h)) {
                mapping.dateCol = idx;
                return;
            }
        }

        // Cột tiền thu (inflow / credit / có)
        if (['thu', 'ghico', 'co', 'sotienco', 'inflow', 'credit', 'tienden'].includes(h)) {
            mapping.inflowCol = idx;
            return;
        }

        // Cột tiền chi (outflow / debit / nợ)
        if (['chi', 'ghino', 'no', 'sotienno', 'outflow', 'debit', 'tiendi'].includes(h)) {
            mapping.outflowCol = idx;
            return;
        }

        // Cột số tiền chung (amount / số tiền / phát sinh)
        if (!mapping.amountCol) {
            if (['sotien', 'amount', 'phatsinh', 'sotienphatsinh', 'giatri', 'value'].includes(h)) {
                mapping.amountCol = idx;
                return;
            }
        }

        // Nội dung / Ghi chú
        if (!mapping.noteCol) {
            if (['noidung', 'ghichu', 'diengiai', 'mota', 'description', 'note', 'noidungthanhtoan', 'remark'].includes(h)) {
                mapping.noteCol = idx;
                return;
            }
        }

        // Danh mục (nếu có sẵn trong file xuất từ app khác)
        if (!mapping.categoryCol) {
            if (['danhmuc', 'category', 'nhom', 'phanloai'].includes(h)) {
                mapping.categoryCol = idx;
                return;
            }
        }
    });

    return mapping;
};

module.exports = {
    cleanRawCsv,
    detectDelimiter,
    parseCsvToGrid,
    parseDate,
    parseMoney,
    detectColumnMapping
};

