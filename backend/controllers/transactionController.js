const transactionService = require('../services/transactionService');

const getAllTransactions = async (req, res, next) => {
    try {
        const data = await transactionService.getAllTransactions();
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const createTransaction = async (req, res, next) => {
    try {
        const data = await transactionService.createTransaction(req.body);
        res.status(201).json({ success: true, message: 'Đã thêm giao dịch.', data });
    } catch (error) {
        next(error);
    }
};

const updateTransaction = async (req, res, next) => {
    try {
        await transactionService.updateTransaction(Number(req.params.id), req.body);
        res.json({ success: true, message: 'Đã cập nhật giao dịch.' });
    } catch (error) {
        next(error);
    }
};

const deleteTransaction = async (req, res, next) => {
    try {
        await transactionService.deleteTransaction(Number(req.params.id));
        res.json({ success: true, message: 'Đã xóa giao dịch.' });
    } catch (error) {
        next(error);
    }
};

module.exports = { getAllTransactions, createTransaction, updateTransaction, deleteTransaction };
