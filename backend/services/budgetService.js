const budgetRepository = require('../repositories/budgetRepository');
const categoryRepository = require('../repositories/categoryRepository');
const AppError = require('../utils/AppError');
const { parseInteger } = require('../utils/parsers');

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const getCurrentMonth = () => {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit'
    }).format(new Date()).slice(0, 7);
};

const validateMonth = (month) => {
    if (!month || typeof month !== 'string' || !MONTH_REGEX.test(month)) {
        throw new AppError('Định dạng tháng không hợp lệ (yêu cầu định dạng YYYY-MM, ví dụ: 2026-10).', 400);
    }
    return month;
};

const getBudgets = async (monthQuery) => {
    const month = monthQuery ? validateMonth(monthQuery) : getCurrentMonth();
    const items = await budgetRepository.findByMonth(month);

    const totalBudget = items.reduce((sum, item) => sum + item.limit_amount, 0);
    const totalSpent = items.reduce((sum, item) => sum + item.spent_amount, 0);
    const totalRemaining = totalBudget - totalSpent;
    const overallPercentage = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
    const warningCount = items.filter((item) => item.status === 'warning').length;
    const exceededCount = items.filter((item) => item.status === 'exceeded').length;

    return {
        month,
        total_budget: totalBudget,
        total_spent: totalSpent,
        total_remaining: totalRemaining,
        overall_percentage: overallPercentage,
        warning_count: warningCount,
        exceeded_count: exceededCount,
        items
    };
};

const getBudgetById = async (id) => {
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new AppError('Mã ngân sách không hợp lệ.', 400);
    }
    const budget = await budgetRepository.findById(id);
    if (!budget) {
        throw new AppError('Không tìm thấy ngân sách.', 404);
    }
    return budget;
};

const saveBudget = async (body) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new AppError('Dữ liệu yêu cầu không hợp lệ.', 400);
    }

    const categoryId = parseInteger(body.category_id, 'Mã danh mục');
    const category = await categoryRepository.findById(categoryId);
    if (!category) {
        throw new AppError('Không tìm thấy danh mục được chọn.', 404);
    }
    if (category.type !== 'expense') {
        throw new AppError('Chỉ có thể thiết lập hạn mức ngân sách cho danh mục chi tiêu.', 400);
    }

    const month = body.month ? validateMonth(body.month) : getCurrentMonth();
    const limitAmount = parseInteger(body.limit_amount, 'Hạn mức ngân sách');
    if (limitAmount <= 0) {
        throw new AppError('Hạn mức ngân sách phải lớn hơn 0.', 400);
    }

    await budgetRepository.upsert(categoryId, month, limitAmount);
    return await budgetRepository.findByCategoryAndMonth(categoryId, month);
};

const updateBudget = async (id, body) => {
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new AppError('Mã ngân sách không hợp lệ.', 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new AppError('Dữ liệu yêu cầu không hợp lệ.', 400);
    }

    const existing = await budgetRepository.findById(id);
    if (!existing) {
        throw new AppError('Không tìm thấy ngân sách.', 404);
    }

    const limitAmount = parseInteger(body.limit_amount, 'Hạn mức ngân sách');
    if (limitAmount <= 0) {
        throw new AppError('Hạn mức ngân sách phải lớn hơn 0.', 400);
    }

    await budgetRepository.update(id, limitAmount);
    return await budgetRepository.findById(id);
};

const deleteBudget = async (id) => {
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new AppError('Mã ngân sách không hợp lệ.', 400);
    }
    const existing = await budgetRepository.findById(id);
    if (!existing) {
        throw new AppError('Không tìm thấy ngân sách.', 404);
    }

    await budgetRepository.remove(id);
    return true;
};

const copyPreviousMonth = async (targetMonthQuery) => {
    const targetMonth = targetMonthQuery ? validateMonth(targetMonthQuery) : getCurrentMonth();

    const [year, monthNum] = targetMonth.split('-').map(Number);
    const prevDate = new Date(Date.UTC(year, monthNum - 2, 1));
    const sourceMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;

    const sourceCount = await budgetRepository.countByMonth(sourceMonth);
    if (sourceCount === 0) {
        throw new AppError(`Không có dữ liệu ngân sách ở tháng trước (${sourceMonth}) để sao chép.`, 400);
    }

    await budgetRepository.copyFromMonth(sourceMonth, targetMonth);
    const updatedData = await getBudgets(targetMonth);

    return {
        source_month: sourceMonth,
        target_month: targetMonth,
        copied_count: sourceCount,
        budgets: updatedData
    };
};

module.exports = {
    getCurrentMonth,
    validateMonth,
    getBudgets,
    getBudgetById,
    saveBudget,
    updateBudget,
    deleteBudget,
    copyPreviousMonth
};

