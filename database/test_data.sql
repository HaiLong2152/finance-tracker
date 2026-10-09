USE finance_tracker;

SET NAMES utf8mb4;

-- Dữ liệu tài khoản / ví mẫu
INSERT IGNORE INTO accounts (id, name, type, initial_balance, identifier_hint) VALUES
(1, 'Tiền mặt', 'cash', 500000, 'Tiền mặt trong ví'),
(2, 'Tài khoản Ngân hàng (MB Bank)', 'bank', 5000000, 'MBBank - 9999'),
(3, 'Ví điện tử (MoMo)', 'ewallet', 200000, 'MoMo');

-- Dữ liệu danh mục mẫu
INSERT IGNORE INTO categories (name, type) VALUES
('Lương tháng', 'income'),
('Tiền thưởng', 'income'),
('Ăn uống', 'expense'),
('Tiền nhà', 'expense'),
('Đi lại', 'expense'),
('Mua sắm online', 'expense');
