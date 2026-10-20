const crypto = require('crypto');
const ingestRepository = require('../repositories/ingestRepository');
const transactionRepository = require('../repositories/transactionRepository');
const accountRepository = require('../repositories/accountRepository');
const categoryRepository = require('../repositories/categoryRepository');
const AppError = require('../utils/AppError');
const { toBigInt, toSafeNumber } = require('../utils/money');

/**
 * Tính khóa chống nhận trùng (Idempotency Key) bằng SHA-256 từ thông tin thông báo gốc (SPEC 7)
 */
const computeIdempotencyKey = ({ package: pkg, title = '', text = '', posted_at = '' }) => {
    const rawString = `${String(pkg || '').trim()}|${String(title || '').trim()}|${String(text || '').trim()}|${String(posted_at || '').trim()}`;
    return crypto.createHash('sha256').update(rawString).digest('hex');
};

/**
 * Bóc tách sơ bộ các mẫu dữ liệu cơ bản (số tiền, dấu hiệu thu/chi) để hiển thị gợi ý (preview)
 * KHÔNG tạo giao dịch tự động ngay nếu chưa có parser chính xác (SPEC 7 & 8)
 */
const extractPreviewInfo = (text, title = '') => {
    const content = `${title} ${text}`.trim();
    if (!content) return null;

    let detectedType = null;
    let rawAmount = null;

    // 1. Nhận diện số tiền kèm dấu (+ / -) hoặc đơn vị tiền tệ rõ ràng (VND, đ...)
    // Mẫu 1: Có dấu rõ ràng trước số tiền: -120,000 VND hoặc +2,500,000 đ hoặc -50.000
    const signedAmountRegex = /([+\-])\s*([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,12})(?:\s*(?:VND|VNĐ|vnd|vnđ|d|đ|dong|đồng))?/i;
    // Mẫu 2: Số tiền có đơn vị tiền tệ đi kèm: 120,000 VND hoặc 50.000 đ
    const currencyAmountRegex = /([0-9]{1,3}(?:[.,][0-9]{3})+)\s*(?:VND|VNĐ|vnd|vnđ|d|đ|dong|đồng)/i;

    const signedMatch = content.match(signedAmountRegex);
    const currencyMatch = content.match(currencyAmountRegex);

    if (signedMatch && signedMatch[2]) {
        const sign = signedMatch[1];
        const cleanDigits = signedMatch[2].replace(/[.,]/g, '');
        const parsedNumber = Number(cleanDigits);
        if (Number.isSafeInteger(parsedNumber) && parsedNumber > 0) {
            rawAmount = parsedNumber;
            detectedType = sign === '+' ? 'income' : 'expense';
        }
    } else if (currencyMatch && currencyMatch[1]) {
        const cleanDigits = currencyMatch[1].replace(/[.,]/g, '');
        const parsedNumber = Number(cleanDigits);
        if (Number.isSafeInteger(parsedNumber) && parsedNumber > 0) {
            rawAmount = parsedNumber;
        }
    }

    // 2. Nhận diện loại giao dịch từ từ khóa nếu chưa xác định được từ dấu
    if (!detectedType) {
        const contentLower = content.toLowerCase();
        const incomeKeywords = ['nhan tien', 'nhận tiền', 'cong tien', 'cộng tiền', 'tien vao', 'tiền vào', 'hoan tien', 'hoàn tiền'];
        const expenseKeywords = ['thanh toan', 'thanh toán', 'chuyen tien', 'chuyển tiền', 'tru tien', 'trừ tiền', 'rut tien', 'rút tiền', 'phi duy tri', 'phí duy trì'];

        if (incomeKeywords.some((kw) => contentLower.includes(kw))) {
            detectedType = 'income';
        } else if (expenseKeywords.some((kw) => contentLower.includes(kw))) {
            detectedType = 'expense';
        }
    }

    // Chỉ khi nhận diện được số tiền hợp lệ mới tạo gợi ý xem trước
    if (rawAmount && rawAmount > 0) {
        return {
            detected_amount: rawAmount,
            detected_type: detectedType || 'expense',
            confidence: detectedType ? 'medium' : 'low'
        };
    }

    return null;
};

/**
 * Xử lý tiếp nhận thông báo gốc qua Ingest API (SPEC 7)
 * Đảm bảo:
 * 1. Chống nhận trùng Idempotent
 * 2. Lưu tin gốc đầy đủ vào ingest_events
 * 3. Chưa tạo giao dịch ngay từ tin chưa chắc chắn
 */
const processIngest = async (body) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new AppError('Dữ liệu thông báo (JSON payload) không hợp lệ.', 400);
    }

    const pkg = typeof body.package === 'string' ? body.package.trim() : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const deviceId = typeof body.device_id === 'string' ? body.device_id.trim() : null;

    if (!pkg) {
        throw new AppError('Thiếu tên gói ứng dụng gửi thông báo (package).', 400);
    }
    if (!text) {
        throw new AppError('Thiếu nội dung thông báo (text).', 400);
    }
    if (pkg.length > 255) {
        throw new AppError('Tên gói ứng dụng (package) vượt quá 255 ký tự.', 400);
    }

    let postedAt = null;
    if (body.posted_at !== undefined && body.posted_at !== null && body.posted_at !== '') {
        const num = Number(body.posted_at);
        if (Number.isSafeInteger(num) && num > 0) {
            postedAt = num;
        }
    }

    // 1. Tính toán khóa chống trùng (Idempotency Key)
    const idempotencyKey = typeof body.idempotency_key === 'string' && body.idempotency_key.trim().length > 0
        ? body.idempotency_key.trim().slice(0, 64)
        : computeIdempotencyKey({ package: pkg, title, text, posted_at: postedAt });

    // 2. Kiểm tra trùng lặp
    const existing = await ingestRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) {
        return {
            duplicate: true,
            event: existing,
            message: 'Thông báo đã được nhận trước đó (Idempotent: giữ nguyên bản ghi gốc).'
        };
    }

    // 3. Phân tích gợi ý sơ bộ (không tạo giao dịch tự động ngay)
    // Đảm bảo dữ liệu nguồn không bị mất ngay cả khi parser gặp lỗi (SPEC 4.1)
    let previewInfo = null;
    let initialStatus = 'unparsed';
    let parserName = null;
    let errorMessage = null;

    try {
        previewInfo = extractPreviewInfo(text, title);
        if (previewInfo) {
            initialStatus = 'pending';
            parserName = 'generic_preview';
        } else {
            initialStatus = 'unparsed';
        }
    } catch (parseErr) {
        initialStatus = 'failed';
        errorMessage = parseErr.message || 'Lỗi khi phân tích nội dung thông báo.';
    }

    const newEventData = {
        package: pkg,
        title: title || null,
        text,
        raw_payload: body,
        posted_at: postedAt,
        device_id: deviceId || null,
        idempotency_key: idempotencyKey,
        status: initialStatus,
        parser_name: parserName,
        parsed_json: previewInfo,
        error_message: errorMessage,
        transaction_id: null
    };

    // 4. Lưu tin gốc vào CSDL (nguyên vẹn nội dung nguồn và payload gốc)
    const insertResult = await ingestRepository.create(newEventData);
    const savedEvent = await ingestRepository.findById(insertResult.insertId);

    return {
        duplicate: false,
        event: savedEvent,
        message: initialStatus === 'failed'
            ? 'Đã lưu thông báo gốc an toàn vào Hộp chờ duyệt (parser gặp lỗi và được ghi nhận để phân tích lại sau).'
            : 'Đã nhận và lưu thông báo gốc thành công vào Hộp chờ duyệt.'
    };
};

/**
 * Lấy danh sách thông báo cho Hộp chờ duyệt (Inbox)
 */
const getInbox = async (params = {}) => {
    return await ingestRepository.findInbox(params);
};

/**
 * Lấy số lượng thống kê theo trạng thái trong Inbox
 */
const getInboxStats = async () => {
    return await ingestRepository.getStats();
};

/**
 * Lấy chi tiết một thông báo theo ID
 */
const getInboxById = async (id) => {
    const numId = Number(id);
    if (!Number.isSafeInteger(numId) || numId <= 0) {
        throw new AppError('Mã thông báo không hợp lệ.', 400);
    }
    const item = await ingestRepository.findById(numId);
    if (!item) {
        throw new AppError('Không tìm thấy thông báo trong Hộp chờ.', 404);
    }
    return item;
};

/**
 * Giải quyết một mục trong Hộp chờ (Resolve Inbox Item - SPEC 10)
 * Hỗ trợ 2 thao tác:
 * - action = 'ignore': Đánh dấu bỏ qua thông báo
 * - action = 'confirm' hoặc 'create_transaction': Tạo giao dịch chính thức và liên kết ID
 */
const resolveInboxItem = async (id, body = {}) => {
    const numId = Number(id);
    if (!Number.isSafeInteger(numId) || numId <= 0) {
        throw new AppError('Mã thông báo không hợp lệ.', 400);
    }

    const item = await ingestRepository.findById(numId);
    if (!item) {
        throw new AppError('Không tìm thấy thông báo trong Hộp chờ.', 404);
    }

    const { action = 'ignore', transaction = {} } = body;

    // 1. Thao tác bỏ qua (Ignore)
    if (action === 'ignore') {
        await ingestRepository.updateStatus(numId, 'ignored');
        return {
            success: true,
            status: 'ignored',
            message: 'Đã đánh dấu bỏ qua thông báo.'
        };
    }

    // 2. Thao tác xác nhận tạo giao dịch (Confirm / Create Transaction / Approve - SPEC 4.1)
    if (action === 'confirm' || action === 'create_transaction' || action === 'approve') {
        if (item.transaction_id) {
            throw new AppError('Thông báo này đã được liên kết với một giao dịch trước đó.', 400);
        }

        const {
            amount,
            type = 'expense',
            account_id,
            transfer_account_id,
            category_id,
            transaction_date,
            note
        } = transaction;

        const numAmount = Number(amount);
        if (!Number.isSafeInteger(numAmount) || numAmount <= 0) {
            throw new AppError('Số tiền giao dịch không hợp lệ.', 400);
        }

        const numAccountId = Number(account_id);
        if (!Number.isSafeInteger(numAccountId) || numAccountId <= 0) {
            throw new AppError('Vui lòng chọn ví hợp lệ.', 400);
        }

        const account = await accountRepository.findById(numAccountId);
        if (!account) {
            throw new AppError('Ví được chọn không tồn tại.', 404);
        }

        const dateStr = transaction_date
            ? String(transaction_date).slice(0, 10)
            : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

        const txPayload = {
            amount: numAmount,
            type: ['income', 'expense', 'transfer'].includes(type) ? type : 'expense',
            accountId: numAccountId,
            account_id: numAccountId,
            transferAccountId: type === 'transfer' ? Number(transfer_account_id) : null,
            transfer_account_id: type === 'transfer' ? Number(transfer_account_id) : null,
            categoryId: type !== 'transfer' ? Number(category_id) : null,
            category_id: type !== 'transfer' ? Number(category_id) : null,
            transactionDate: dateStr,
            transaction_date: dateStr,
            note: typeof note === 'string' && note.trim() ? note.trim() : (item.title || item.text.slice(0, 100))
        };

        const createResult = await transactionRepository.create(txPayload);
        const newTransactionId = createResult.insertId;

        // Cập nhật trạng thái thông báo thành 'approved' (hoặc 'processed') và liên kết transaction_id
        await ingestRepository.updateStatus(numId, 'approved', {
            transaction_id: newTransactionId,
            error_message: null
        });

        return {
            success: true,
            status: 'approved',
            transaction_id: newTransactionId,
            message: 'Đã duyệt và tạo giao dịch từ thông báo thành công.'
        };
    }

    throw new AppError("Hành động không hợp lệ (hỗ trợ: 'ignore', 'confirm', 'approve').", 400);
};

/**
 * Phân tích lại thông báo từ dữ liệu nguồn gốc khi parser được nâng cấp (SPEC 4.1)
 * Giữ nguyên vẹn tuyệt đối nội dung nguồn (text, title, package, posted_at, raw_payload)
 */
const reparseInboxItem = async (id) => {
    const numId = Number(id);
    if (!Number.isSafeInteger(numId) || numId <= 0) {
        throw new AppError('Mã thông báo không hợp lệ.', 400);
    }

    const item = await ingestRepository.findById(numId);
    if (!item) {
        throw new AppError('Không tìm thấy thông báo trong Hộp chờ.', 404);
    }

    if (item.transaction_id || item.status === 'processed' || item.status === 'approved') {
        throw new AppError('Không thể phân tích lại thông báo đã được duyệt thành giao dịch.', 400);
    }

    let previewInfo = null;
    let newStatus = 'unparsed';
    let parserName = null;
    let errorMessage = null;

    try {
        previewInfo = extractPreviewInfo(item.text, item.title);
        if (previewInfo) {
            newStatus = 'pending';
            parserName = 'generic_preview';
        } else {
            newStatus = 'unparsed';
        }
    } catch (parseErr) {
        newStatus = 'failed';
        errorMessage = parseErr.message || 'Lỗi khi phân tích lại thông báo.';
    }

    await ingestRepository.updateStatus(numId, newStatus, {
        parser_name: parserName,
        parsed_json: previewInfo,
        error_message: errorMessage
    });

    const updated = await ingestRepository.findById(numId);
    return {
        success: true,
        data: updated,
        message: newStatus === 'pending'
            ? 'Đã phân tích lại thành công và nhận diện được gợi ý giao dịch.'
            : (newStatus === 'failed' ? `Phân tích lại thất bại: ${errorMessage}` : 'Không tìm thấy dữ liệu số tiền trong thông báo.')
    };
};

module.exports = {
    computeIdempotencyKey,
    extractPreviewInfo,
    processIngest,
    getInbox,
    getInboxStats,
    getInboxById,
    resolveInboxItem,
    reparseInboxItem
};
