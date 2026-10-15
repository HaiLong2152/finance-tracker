const express = require('express');
const router = express.Router();
const inboxController = require('../controllers/inboxController');

// GET /api/inbox: Danh sách thông báo trong Hộp chờ
router.get('/', inboxController.list);

// GET /api/inbox/stats: Thống kê số lượng theo trạng thái
router.get('/stats', inboxController.stats);

// GET /api/inbox/:id: Chi tiết một thông báo
router.get('/:id', inboxController.getById);

// POST /api/inbox/:id/resolve: Xử lý hoặc bỏ qua thông báo
router.post('/:id/resolve', inboxController.resolve);

module.exports = router;

