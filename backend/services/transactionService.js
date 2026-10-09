const transactionRepository = require('../repositories/transactionRepository');
const categoryRepository = require('../repositories/categoryRepository');
const AppError = require('../utils/AppError');

const isValidDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const parseTransaction = (body) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new AppError('Dữ liệu yêu cầu không hợp lệ.', 400);
    }
    const { amount, category_id, transaction_date, note = '' } = body;
    
    if (typeof amount !== 'number' && typeof amount !== 'string') {
        throw new AppError('Số tiền không hợp lệ.', 400);
    }

    const numericAmount = Number(amount);
    const numericCategoryId = Number(category_id);
    if (!Number.isSafeInteger(numericAmount) || numericAmount <= 0) {
        throw new AppError('Số tiền phải là số nguyên dương hợp lệ và không vượt quá giới hạn an toàn.', 400);
    }
    if (!Number.isSafeInteger(numericCategoryId) || numericCategoryId <= 0) {
        throw new AppError('Danh mục không hợp lệ.', 400);
    }
    if (!isValidDate(transaction_date)) throw new AppError('Ngày giao dịch không hợp lệ.', 400);
    if (typeof note !== 'string' || note.length > 500) throw new AppError('Ghi chú không được vượt quá 500 ký tự.', 400);
    return { amount: numericAmount, categoryId: numericCategoryId, transactionDate: transaction_date, note: note.trim() || null };
};

const getAllTransactions = async () => {
    return await transactionRepository.findAll();
};

const createTransaction = async (body) => {
    const parsed = parseTransaction(body);
    const categoryExists = await categoryRepository.findById(parsed.categoryId);
    if (!categoryExists) throw new AppError('Danh mục không tồn tại.', 400);
    
    const result = await transactionRepository.create(parsed);
    return { id: result.insertId };
};

const updateTransaction = async (id, body) => {
    if (!Number.isSafeInteger(id) || id <= 0) throw new AppError('Mã giao dịch không hợp lệ.', 400);
    const parsed = parseTransaction(body);
    
    const transactionExists = await transactionRepository.findById(id);
    if (!transactionExists) throw new AppError('Không tìm thấy giao dịch.', 404);
    
    const categoryExists = await categoryRepository.findById(parsed.categoryId);
    if (!categoryExists) throw new AppError('Danh mục không tồn tại.', 400);
    
    await transactionRepository.update(id, parsed);
    return true;
};

const deleteTransaction = async (id) => {
    if (!Number.isSafeInteger(id) || id <= 0) throw new AppError('Mã giao dịch không hợp lệ.', 400);
    
    const result = await transactionRepository.remove(id);
    if (result.affectedRows === 0) throw new AppError('Không tìm thấy giao dịch.', 404);
    return true;
};

module.exports = {
    getAllTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction
};

