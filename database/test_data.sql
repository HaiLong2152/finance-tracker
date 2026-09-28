USE finance_tracker;

SET NAMES utf8mb4;

INSERT IGNORE INTO categories (name, type) VALUES
('Lương tháng', 'income'),
('Tiền thưởng', 'income'),
('Ăn uống', 'expense'),
('Tiền nhà', 'expense');
