const transactionRepository = require('../repositories/transactionRepository');
const categoryRepository = require('../repositories/categoryRepository');
const accountRepository = require('../repositories/accountRepository');
const AppError = require('../utils/AppError');

const VALID_TYPES = ['income', 'expense', 'transfer'];

const isValidDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const parseTransaction = async (body) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new AppError('Dữ liệu yêu cầu không hợp lệ.', 400);
    }
    const { 
        amount, 
        type, 
        account_id, 
        transfer_account_id, 
        category_id, 
        transaction_date, 
        note = '' 
    } = body;
    
    // 1. Kiểm tra số tiền
    if (typeof amount !== 'number' && typeof amount !== 'string') {
        throw new AppError('Số tiền không hợp lệ.', 400);
    }
    const numericAmount = Number(amount);
    if (!Number.isSafeInteger(numericAmount) || numericAmount <= 0) {
        throw new AppError('Số tiền phải là số nguyên dương hợp lệ và không vượt quá giới hạn an toàn.', 400);
    }

    // 2. Kiểm tra ví nguồn (account_id)
    const numericAccountId = Number(account_id);
    if (!Number.isSafeInteger(numericAccountId) || numericAccountId <= 0) {
        throw new AppError('Vui lòng chọn ví nguồn hợp lệ.', 400);
    }
    const sourceAccount = await accountRepository.findById(numericAccountId);
    if (!sourceAccount) {
        throw new AppError('Ví nguồn không tồn tại.', 404);
    }
    if (sourceAccount.is_archived) {
        throw new AppError('Ví nguồn đã được lưu trữ, không thể thực hiện giao dịch.', 400);
    }

    // 3. Xác định và kiểm tra loại giao dịch và danh mục
    let resolvedType = type;
    const numericCategoryId = category_id !== undefined && category_id !== null && category_id !== '' 
        ? Number(category_id) 
        : null;

    let category = null;
    if (numericCategoryId !== null) {
        if (!Number.isSafeInteger(numericCategoryId) || numericCategoryId <= 0) {
            throw new AppError('Danh mục không hợp lệ.', 400);
        }
        category = await categoryRepository.findById(numericCategoryId);
        if (!category) {
            throw new AppError('Danh mục không tồn tại.', 404);
        }
    }

    if (!resolvedType) {
        if (category) {
            resolvedType = category.type;
        } else {
            throw new AppError('Vui lòng chọn loại giao dịch hoặc danh mục.', 400);
        }
    }

    if (!VALID_TYPES.includes(resolvedType)) {
        throw new AppError('Loại giao dịch không hợp lệ (hỗ trợ: income, expense, transfer).', 400);
    }

    // 4. Xử lý ví đích và danh mục theo loại giao dịch
    let resolvedTransferAccountId = null;
    let resolvedCategoryId = null;

    if (resolvedType === 'transfer') {
        // Chuyển tiền nội bộ: KHÔNG được gắn danh mục thu/chi
        if (numericCategoryId !== null) {
            throw new AppError('Giao dịch chuyển tiền nội bộ không được gắn danh mục thu/chi.', 400);
        }

        const numericTransferAccountId = Number(transfer_account_id);
        if (!Number.isSafeInteger(numericTransferAccountId) || numericTransferAccountId <= 0) {
            throw new AppError('Vui lòng chọn ví đích khi chuyển tiền.', 400);
        }
        if (numericTransferAccountId === numericAccountId) {
            throw new AppError('Ví đích phải khác ví nguồn khi chuyển tiền.', 400);
        }
        const targetAccount = await accountRepository.findById(numericTransferAccountId);
        if (!targetAccount) {
            throw new AppError('Ví đích không tồn tại.', 404);
        }
        if (targetAccount.is_archived) {
            throw new AppError('Ví đích đã được lưu trữ, không thể chuyển tiền vào ví này.', 400);
        }
        resolvedTransferAccountId = numericTransferAccountId;
    } else {
        // Giao dịch thu hoặc chi: BẮT BUỘC có danh mục, và KHÔNG được có transfer_account_id
        if (transfer_account_id !== undefined && transfer_account_id !== null && transfer_account_id !== '') {
            throw new AppError('Chỉ giao dịch chuyển tiền (transfer) mới được chọn ví đích.', 400);
        }

        if (numericCategoryId === null || !category) {
            throw new AppError('Giao dịch thu/chi bắt buộc phải chọn danh mục.', 400);
        }

        if (category.type !== resolvedType) {
            const catTypeLabel = category.type === 'income' ? 'Thu' : 'Chi';
            const txTypeLabel = resolvedType === 'income' ? 'Thu' : 'Chi';
            throw new AppError(`Danh mục '${category.name}' là danh mục ${catTypeLabel}, không khớp với loại giao dịch ${txTypeLabel}.`, 400);
        }

        resolvedCategoryId = numericCategoryId;
    }

    // 5. Kiểm tra ngày giao dịch
    if (!isValidDate(transaction_date)) {
        throw new AppError('Ngày giao dịch không hợp lệ.', 400);
    }

    // 6. Kiểm tra ghi chú
    if (typeof note !== 'string' || note.length > 500) {
        throw new AppError('Ghi chú không được vượt quá 500 ký tự.', 400);
    }

    return { 
        amount: numericAmount, 
        type: resolvedType,
        accountId: numericAccountId,
        transferAccountId: resolvedTransferAccountId,
        categoryId: resolvedCategoryId, 
        transactionDate: transaction_date, 
        note: note.trim() || null 
    };
};

const getAllTransactions = async () => {
    return await transactionRepository.findAll();
};

const createTransaction = async (body) => {
    const parsed = await parseTransaction(body);
    const result = await transactionRepository.create(parsed);
    return { id: result.insertId, ...parsed };
};

const updateTransaction = async (id, body) => {
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new AppError('Mã giao dịch không hợp lệ.', 400);
    }
    const transactionExists = await transactionRepository.findById(id);
    if (!transactionExists) {
        throw new AppError('Không tìm thấy giao dịch.', 404);
    }
    
    const parsed = await parseTransaction(body);
    await transactionRepository.update(id, parsed);
    return true;
};

const deleteTransaction = async (id) => {
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new AppError('Mã giao dịch không hợp lệ.', 400);
    }
    const result = await transactionRepository.remove(id);
    if (result.affectedRows === 0) {
        throw new AppError('Không tìm thấy giao dịch.', 404);
    }
    return true;
};

module.exports = {
    getAllTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction
};
