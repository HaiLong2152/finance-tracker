const accountRepository = require('../repositories/accountRepository');
const AppError = require('../utils/AppError');
const { parseBoolean, parseInteger } = require('../utils/parsers');

const VALID_ACCOUNT_TYPES = ['cash', 'bank', 'ewallet', 'other'];

const isValidDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const parseAccount = (body, existing = null) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new AppError('Dữ liệu yêu cầu không hợp lệ.', 400);
    }

    const {
        name,
        type = existing ? existing.type : 'cash',
        initial_balance,
        start_date,
        identifier_hint,
        is_archived,
        sort_order
    } = body;

    const trimmedName = typeof name === 'string' ? name.trim() : (existing ? existing.name : '');
    if (trimmedName.length < 1 || trimmedName.length > 100) {
        throw new AppError('Tên ví phải có từ 1 đến 100 ký tự.', 400);
    }

    if (!VALID_ACCOUNT_TYPES.includes(type)) {
        throw new AppError('Loại ví không hợp lệ (hỗ trợ: cash, bank, ewallet, other).', 400);
    }

    const numericInitialBalance = initial_balance !== undefined && initial_balance !== null && initial_balance !== ''
        ? parseInteger(initial_balance, 'Số dư ban đầu', 0)
        : (existing ? Number(existing.initial_balance || 0) : 0);

    // Mặc định ngày của existing (khi update) hoặc ngày hiện tại theo múi giờ Việt Nam (UTC+7)
    let resolvedStartDate = existing?.start_date
        ? String(existing.start_date).slice(0, 10)
        : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

    if (start_date !== undefined && start_date !== null && start_date !== '') {
        if (!isValidDate(start_date)) {
            throw new AppError('Ngày bắt đầu theo dõi không hợp lệ.', 400);
        }
        resolvedStartDate = start_date;
    }

    let resolvedHint = existing ? (existing.identifier_hint || null) : null;
    if (typeof identifier_hint === 'string') {
        const hintTrimmed = identifier_hint.trim();
        if (hintTrimmed.length > 100) {
            throw new AppError('Gợi ý nhận diện không được vượt quá 100 ký tự.', 400);
        }
        resolvedHint = hintTrimmed || null;
    }

    const resolvedSortOrder = sort_order !== undefined && sort_order !== null && sort_order !== ''
        ? parseInteger(sort_order, 'Thứ tự sắp xếp', 0)
        : (existing ? Number(existing.sort_order || 0) : 0);

    let resolvedIsArchived = false;
    if (is_archived !== undefined) {
        resolvedIsArchived = parseBoolean(is_archived, false, 'is_archived');
    } else if (existing) {
        resolvedIsArchived = parseBoolean(existing.is_archived, false, 'is_archived');
    }

    return {
        name: trimmedName,
        type,
        initialBalance: numericInitialBalance,
        startDate: resolvedStartDate,
        identifierHint: resolvedHint,
        isArchived: resolvedIsArchived,
        sortOrder: resolvedSortOrder
    };
};

const getAllAccounts = async (includeArchived = false) => {
    return await accountRepository.findAll(parseBoolean(includeArchived, false));
};

const getAccountById = async (id) => {
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new AppError('Mã ví không hợp lệ.', 400);
    }
    const account = await accountRepository.findById(id);
    if (!account) {
        throw new AppError('Không tìm thấy ví.', 404);
    }
    return account;
};

const createAccount = async (body) => {
    const parsed = parseAccount(body);
    try {
        const result = await accountRepository.create(parsed);
        return { id: result.insertId, ...parsed };
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            throw new AppError('Ví với tên này đã tồn tại.', 409);
        }
        throw error;
    }
};

const updateAccount = async (id, body) => {
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new AppError('Mã ví không hợp lệ.', 400);
    }
    const existing = await accountRepository.findById(id);
    if (!existing) {
        throw new AppError('Không tìm thấy ví.', 404);
    }

    const txCount = await accountRepository.countTransactions(id);
    const existingStartDate = existing.start_date ? String(existing.start_date).slice(0, 10) : null;
    const parsed = parseAccount(body, existing);

    // Kiểm tra tính toàn vẹn số dư:
    // 1. Không cho phép sửa đổi ngày bắt đầu theo dõi nếu ví đã có giao dịch phát sinh
    if (txCount > 0 && parsed.startDate !== existingStartDate) {
        throw new AppError(
            `Ví '${existing.name}' đã có ${txCount} giao dịch. Không thể thay đổi ngày bắt đầu theo dõi để tránh làm thay đổi số dư hồi tố.`,
            400
        );
    }

    // 2. Phòng vệ bổ sung: Ngày bắt đầu không thể muộn hơn ngày giao dịch sớm nhất của ví
    const earliestTxDate = await accountRepository.getEarliestTransactionDate(id);
    if (earliestTxDate && parsed.startDate > earliestTxDate) {
        throw new AppError(
            `Không thể dời ngày bắt đầu theo dõi sang ${parsed.startDate} vì ví '${existing.name}' đã có giao dịch vào ngày ${earliestTxDate}. Ngày bắt đầu theo dõi phải trước hoặc bằng ngày giao dịch sớm nhất để đảm bảo tính toàn vẹn số dư.`,
            400
        );
    }

    try {
        await accountRepository.update(id, parsed);
        return true;
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            throw new AppError('Ví với tên này đã tồn tại.', 409);
        }
        throw error;
    }
};

const archiveAccount = async (id, isArchived = true) => {
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new AppError('Mã ví không hợp lệ.', 400);
    }
    const existing = await accountRepository.findById(id);
    if (!existing) {
        throw new AppError('Không tìm thấy ví.', 404);
    }

    await accountRepository.setArchiveStatus(id, parseBoolean(isArchived, true));
    return true;
};

const deleteAccount = async (id) => {
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new AppError('Mã ví không hợp lệ.', 400);
    }
    const existing = await accountRepository.findById(id);
    if (!existing) {
        throw new AppError('Không tìm thấy ví.', 404);
    }

    const transactionCount = await accountRepository.countTransactions(id);
    if (transactionCount > 0) {
        throw new AppError('Không thể xóa ví đã phát sinh giao dịch. Hãy chuyển sang chế độ lưu trữ (archive).', 400);
    }

    await accountRepository.remove(id);
    return true;
};

module.exports = {
    getAllAccounts,
    getAccountById,
    createAccount,
    updateAccount,
    archiveAccount,
    deleteAccount
};

