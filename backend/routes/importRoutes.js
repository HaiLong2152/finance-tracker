const express = require('express');
const router = express.Router();
const importController = require('../controllers/importController');

// POST /api/import/preview: Xem trước và kiểm tra file CSV sao kê
router.post('/preview', importController.preview);

// POST /api/import/confirm: Xác nhận nhập dữ liệu vào CSDL
router.post('/confirm', importController.confirm);

// GET /api/import/batches: Lịch sử các đợt nhập
router.get('/batches', importController.getBatches);

// GET /api/import/batches/:id: Chi tiết một đợt nhập
router.get('/batches/:id', importController.getBatchById);

module.exports = router;

