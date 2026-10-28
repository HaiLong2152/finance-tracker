const express = require('express');
const router = express.Router();
const reconciliationController = require('../controllers/reconciliationController');

// Lấy lịch sử các lần đối soát
router.get('/', reconciliationController.getReconciliations);

// Tính toán số dư kỳ vọng và chênh lệch trước khi xác nhận (Preview)
router.post('/preview', reconciliationController.previewReconciliation);

// Xác nhận đối soát và tạo giao dịch điều chỉnh nếu có chênh lệch
router.post('/confirm', reconciliationController.confirmReconciliation);

// Xem chi tiết một lần đối soát
router.get('/:id', reconciliationController.getReconciliationById);

module.exports = router;

