-- ==============================================================================
-- SCRIPT THIẾT LẬP CƠ SỞ DỮ LIỆU VÀ TÀI KHOẢN QUYỀN TỐI THIỂU CHO PRODUCTION (SPEC 5.2)
-- Chạy script này bằng tài khoản quản trị (root hoặc admin) trên máy chủ MySQL
-- ==============================================================================

-- 1. Khởi tạo Cơ sở dữ liệu Production (hoặc Staging) với chuẩn utf8mb4 đầy đủ
CREATE DATABASE IF NOT EXISTS finance_tracker_prod
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 2. Tạo tài khoản riêng biệt cho ứng dụng Backend (KHÔNG dùng root cho ứng dụng)
-- Lưu ý: Thay đổi 'STRONG_RANDOM_PASSWORD_HERE' bằng mật khẩu ngẫu nhiên an toàn dài ít nhất 24 ký tự
CREATE USER IF NOT EXISTS 'finance_app_user'@'%'
  IDENTIFIED BY 'STRONG_RANDOM_PASSWORD_HERE';

-- 3. Cấp quyền tối thiểu (Least Privilege) cho tài khoản ứng dụng
-- Chỉ cấp quyền thao tác dữ liệu (DML) và quản lý bảng (DDL để chạy migrations) trên đúng DB ứng dụng
-- TUYỆT ĐỐI KHÔNG cấp quyền GRANT OPTION hoặc quyền truy cập vào các schema hệ thống (mysql, sys...)
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP, LOCK TABLES
  ON finance_tracker_prod.*
  TO 'finance_app_user'@'%';

-- 4. Bắt buộc kết nối qua đường truyền mã hóa SSL/TLS (nếu MySQL hỗ trợ chứng chỉ)
-- Đảm bảo an toàn chống nghe lén thông tin giao dịch tài chính trên đường truyền mạng
ALTER USER 'finance_app_user'@'%' REQUIRE SSL;

-- 5. Áp dụng ngay lập tức các thay đổi phân quyền
FLUSH PRIVILEGES;

-- ==============================================================================
-- KIỂM TRA PHÂN QUYỀN VÀ TRẠNG THÁI
-- ==============================================================================
-- Xem danh sách quyền đã cấp cho tài khoản:
-- SHOW GRANTS FOR 'finance_app_user'@'%';

-- Sau khi chạy script này, cập nhật các biến môi trường trong file backend/.env trên server:
-- DB_HOST=your_mysql_host
-- DB_USER=finance_app_user
-- DB_PASSWORD=STRONG_RANDOM_PASSWORD_HERE
-- DB_NAME=finance_tracker_prod
-- DB_SSL=true

