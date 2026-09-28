// routes/categoryRoutes.js
const express = require('express');
const router = express.Router();

// Import các hàm xử lý từ Controller
const categoryController = require('../controllers/categoryController');

// Định nghĩa API endpoint: GET /
// (Đường dẫn gốc sẽ được nối với /api/categories ở file server.js)
router.get('/', categoryController.getAllCategories);
router.post('/', categoryController.createCategory);
router.put('/:id', categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;
