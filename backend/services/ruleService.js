const ruleRepository = require('../repositories/ruleRepository');
const categoryRepository = require('../repositories/categoryRepository');
const accountRepository = require('../repositories/accountRepository');
const AppError = require('../utils/AppError');

/**
 * Chuẩn hóa chuỗi văn bản:
 * - Chuyển sang chữ thường
 * - Loại bỏ dấu tiếng Việt (NFD)
 * - Đổi ký tự đ/Đ thành d/D
 * - Rút gọn khoảng trắng thừa
 */
const normalizeText = (str = '') => {
    if (typeof str !== 'string') return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/\s+/g, ' ')
        .trim();
};

const escapeRegex = (string = '') => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Kiểm tra và chuẩn hóa dữ liệu đầu vào của một quy tắc
 */
const validateRuleData = async (body, isUpdate = false) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new AppError('Dữ liệu quy tắc không hợp lệ.', 400);
    }

    const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : '';
    if (!keyword || keyword.length < 1 || keyword.length > 100) {
        throw new AppError('Từ khóa quy tắc phải có từ 1 đến 100 ký tự.', 400);
    }

    const matchType = body.match_type || 'contains';
    if (!['contains', 'exact'].includes(matchType)) {
        throw new AppError("Kiểu so khớp không hợp lệ (chỉ chấp nhận 'contains' hoặc 'exact').", 400);
    }

    const transactionType = body.transaction_type || 'expense';
    if (!['income', 'expense'].includes(transactionType)) {
        throw new AppError("Loại giao dịch không hợp lệ (chỉ chấp nhận 'income' hoặc 'expense').", 400);
    }

    const categoryId = Number(body.category_id);
    if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
        throw new AppError('Vui lòng chọn danh mục hợp lệ.', 400);
    }

    // Kiểm tra danh mục có tồn tại và đúng loại không
    const category = await categoryRepository.findById(categoryId);
    if (!category) {
        throw new AppError('Danh mục được chọn không tồn tại.', 404);
    }
    if (category.type !== transactionType) {
        throw new AppError(`Danh mục "${category.name}" là loại ${category.type === 'income' ? 'Thu' : 'Chi'}, không khớp với loại giao dịch của quy tắc (${transactionType === 'income' ? 'Thu' : 'Chi'}).`, 400);
    }

    let accountId = null;
    if (body.account_id !== undefined && body.account_id !== null && body.account_id !== '') {
        accountId = Number(body.account_id);
        if (!Number.isSafeInteger(accountId) || accountId <= 0) {
            throw new AppError('Mã ví không hợp lệ.', 400);
        }
        const account = await accountRepository.findById(accountId);
        if (!account) {
            throw new AppError('Ví được chỉ định không tồn tại.', 404);
        }
    }

    let priority = 0;
    if (body.priority !== undefined && body.priority !== null) {
        const numPrio = Number(body.priority);
        if (!Number.isSafeInteger(numPrio) || numPrio < 0 || numPrio > 999999) {
            throw new AppError('Độ ưu tiên (priority) phải là số nguyên từ 0 đến 999,999.', 400);
        }
        priority = numPrio;
    }

    const isActive = body.is_active !== undefined ? Boolean(body.is_active) : true;

    return {
        keyword,
        match_type: matchType,
        transaction_type: transactionType,
        account_id: accountId,
        category_id: categoryId,
        priority,
        is_active: isActive
    };
};

/**
 * Lấy danh sách quy tắc
 */
const getAllRules = async (query = {}) => {
    const activeOnly = query.active_only === 'true' || query.active_only === true;
    return await ruleRepository.findAll({ activeOnly });
};

/**
 * Lấy chi tiết quy tắc theo ID
 */
const getRuleById = async (id) => {
    const numId = Number(id);
    if (!Number.isSafeInteger(numId) || numId <= 0) {
        throw new AppError('Mã quy tắc không hợp lệ.', 400);
    }
    const rule = await ruleRepository.findById(numId);
    if (!rule) {
        throw new AppError('Không tìm thấy quy tắc danh mục.', 404);
    }
    return rule;
};

/**
 * Tạo mới một quy tắc
 */
const createRule = async (body) => {
    const ruleData = await validateRuleData(body, false);
    const result = await ruleRepository.create(ruleData);
    return await ruleRepository.findById(result.insertId);
};

/**
 * Cập nhật một quy tắc
 */
const updateRule = async (id, body) => {
    const numId = Number(id);
    if (!Number.isSafeInteger(numId) || numId <= 0) {
        throw new AppError('Mã quy tắc không hợp lệ.', 400);
    }
    const existing = await ruleRepository.findById(numId);
    if (!existing) {
        throw new AppError('Không tìm thấy quy tắc để cập nhật.', 404);
    }

    const ruleData = await validateRuleData(body, true);
    await ruleRepository.update(numId, ruleData);
    return await ruleRepository.findById(numId);
};

/**
 * Xóa một quy tắc
 */
const deleteRule = async (id) => {
    const numId = Number(id);
    if (!Number.isSafeInteger(numId) || numId <= 0) {
        throw new AppError('Mã quy tắc không hợp lệ.', 400);
    }
    const existing = await ruleRepository.findById(numId);
    if (!existing) {
        throw new AppError('Không tìm thấy quy tắc để xóa.', 404);
    }
    await ruleRepository.remove(numId);
    return { success: true, message: `Đã xóa quy tắc "${existing.keyword}".` };
};

/**
 * Bật/tắt trạng thái hoạt động của quy tắc
 */
const toggleRule = async (id) => {
    const numId = Number(id);
    if (!Number.isSafeInteger(numId) || numId <= 0) {
        throw new AppError('Mã quy tắc không hợp lệ.', 400);
    }
    const existing = await ruleRepository.findById(numId);
    if (!existing) {
        throw new AppError('Không tìm thấy quy tắc.', 404);
    }
    await ruleRepository.toggleActive(numId);
    const updated = await ruleRepository.findById(numId);
    return {
        success: true,
        is_active: Boolean(updated.is_active),
        message: `Đã ${updated.is_active ? 'bật' : 'tắt'} quy tắc "${updated.keyword}".`
    };
};

/**
 * Sắp xếp lại thứ tự ưu tiên của danh sách quy tắc
 */
const reorderRules = async (orders = []) => {
    if (!Array.isArray(orders)) {
        throw new AppError('Danh sách sắp xếp không hợp lệ.', 400);
    }
    await ruleRepository.reorder(orders);
    return await ruleRepository.findAll();
};

/**
 * Tìm kiếm quy tắc phù hợp nhất cho một nội dung thông báo (Rule Matching Engine)
 * Đảm bảo tính ổn định (Deterministic):
 * - Sắp xếp theo priority DESC, id DESC
 * - Quy tắc đầu tiên thỏa mãn sẽ được chọn
 * - Hỗ trợ chuẩn hóa tiếng Việt không dấu
 * 
 * @param {string} rawContent - Chuỗi nội dung/ghi chú cần so khớp
 * @param {string} transactionType - 'income' hoặc 'expense'
 * @param {number|null} accountId - ID ví nguồn (nếu có)
 * @returns {object|null} Quy tắc khớp hoặc null
 */
const matchRule = async (rawContent = '', transactionType = 'expense', accountId = null) => {
    const normalizedContent = normalizeText(rawContent);
    if (!normalizedContent) return null;

    // Lấy tất cả quy tắc đang kích hoạt, đã được sắp theo priority DESC
    const activeRules = await ruleRepository.findAll({ activeOnly: true });

    for (const rule of activeRules) {
        // 1. Kiểm tra loại giao dịch (income / expense)
        if (rule.transaction_type !== transactionType) {
            continue;
        }

        // 2. Kiểm tra ví (nếu rule có chỉ định ví cụ thể)
        if (rule.account_id && accountId && Number(rule.account_id) !== Number(accountId)) {
            continue;
        }

        // 3. Chuẩn hóa từ khóa của rule
        const normalizedKeyword = normalizeText(rule.keyword);
        if (!normalizedKeyword) continue;

        // 4. So khớp theo kiểu match_type
        let isMatched = false;
        if (rule.match_type === 'exact') {
            // Khớp nguyên từ hoàn chỉnh (word boundary)
            const regex = new RegExp(`(^|\\b|\\s)${escapeRegex(normalizedKeyword)}(\\b|\\s|$)`, 'i');
            isMatched = regex.test(normalizedContent);
        } else {
            // Mặc định 'contains': chuỗi chứa từ khóa
            isMatched = normalizedContent.includes(normalizedKeyword);
        }

        if (isMatched) {
            return {
                id: rule.id,
                keyword: rule.keyword,
                category_id: rule.category_id,
                category_name: rule.category_name,
                priority: rule.priority,
                match_type: rule.match_type
            };
        }
    }

    return null;
};

module.exports = {
    normalizeText,
    getAllRules,
    getRuleById,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    reorderRules,
    matchRule
};

