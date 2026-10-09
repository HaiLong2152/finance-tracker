USE finance_tracker;

SET NAMES utf8mb4;

-- Dữ liệu tài khoản / ví mẫu (chỉ dùng cho môi trường test/demo)
INSERT IGNORE INTO accounts (name, type, initial_balance, identifier_hint) VALUES
('Tiền mặt', 'cash', 500000, 'Tiền mặt trong ví'),
('Tài khoản Ngân hàng (MB Bank)', 'bank', 5000000, 'MBBank - 9999'),
('Ví điện tử (MoMo)', 'ewallet', 200000, 'MoMo');

-- Dữ liệu danh mục mẫu
INSERT IGNORE INTO categories (name, type) VALUES
('Lương tháng', 'income'),
('Tiền thưởng', 'income'),
('Ăn uống', 'expense'),
('Tiền nhà', 'expense'),
('Đi lại', 'expense'),
('Mua sắm online', 'expense');
