const express = require('express');
const router = express.Router();
const ruleController = require('../controllers/ruleController');

// GET /api/rules: Danh sách quy tắc
router.get('/', ruleController.getAllRules);

// POST /api/rules: Tạo mới quy tắc
router.post('/', ruleController.createRule);

// POST /api/rules/reorder: Sắp xếp lại thứ tự ưu tiên
router.post('/reorder', ruleController.reorderRules);

// GET /api/rules/:id: Chi tiết quy tắc
router.get('/:id', ruleController.getRuleById);

// PUT /api/rules/:id: Cập nhật quy tắc
router.put('/:id', ruleController.updateRule);

// PATCH /api/rules/:id/toggle: Bật / tắt quy tắc nhanh
router.patch('/:id/toggle', ruleController.toggleRule);

// DELETE /api/rules/:id: Xóa quy tắc
router.delete('/:id', ruleController.deleteRule);

module.exports = router;

