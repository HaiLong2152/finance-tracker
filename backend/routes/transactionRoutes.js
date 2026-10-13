// routes/transactionRoutes.js
const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

// GET /api/transactions -> Lấy danh sách
router.get('/', transactionController.getAllTransactions);

// POST /api/transactions -> Thêm mới
router.post('/', transactionController.createTransaction);

// POST /api/transactions/bulk -> Thao tác hàng loạt (đổi danh mục, xóa)
router.post('/bulk', transactionController.handleBulk);

router.put('/:id', transactionController.updateTransaction);

router.delete('/:id', transactionController.deleteTransaction);

module.exports = router;
