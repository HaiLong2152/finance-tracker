# Kế hoạch Phát triển Dự án Finance Tracker

*(Tài liệu này được cập nhật dựa trên cơ sở mã nguồn hiện tại (MVC, React+Express+MySQL) và tầm nhìn từ Spec tổng thể. Các giai đoạn xây dựng kiến trúc ban đầu (Giai đoạn 0) đã hoàn tất).*

## Giai đoạn 1: Bổ sung Nền tảng Dữ liệu (Ưu tiên hiện tại)
*Mục tiêu: Đưa cấu trúc dữ liệu về đúng Spec để phản ánh đúng dòng chảy của tiền.*
1. **Ví / Tài khoản (`accounts`)**: Tạo Table, API (CRUD) và Giao diện quản lý Ví (Tên, Loại, Số dư ban đầu).
2. **Nâng cấp Giao dịch (`transactions`)**: 
   - Thêm cột `account_id` (bắt buộc) và `transfer_account_id` (dành cho chuyển khoản).
   - Hỗ trợ giao dịch loại `transfer` (chuyển khoản nội bộ giữa các ví, không tính vào thu/chi).
3. **Cập nhật UI Giao dịch**: Sửa Form thêm/sửa giao dịch để chọn Ví nguồn (và Ví đích).

## Giai đoạn 2: Tính toán Số dư và Tối ưu Trải nghiệm Mobile
*Mục tiêu: Đảm bảo "Một sự thật duy nhất cho số dư" và làm app thân thiện với điện thoại.*
1. **Logic Số dư Động**: Tính số dư ví bằng công thức: *Số dư ban đầu + Thu - Chi + Chuyển đến - Chuyển đi*.
2. **Dashboard & Báo cáo**: Cập nhật lại Dashboard để hiển thị đúng số dư các ví và không cộng gộp giao dịch `transfer` vào tổng thu/chi.
3. **UI "Nhập nhanh" (Quick Add)**: Nâng cấp form thêm giao dịch thành dạng Bottom Sheet với bàn phím số lớn, thao tác tối đa 3 chạm trên điện thoại.
4. **PWA (Progressive Web App)**: Cấu hình `manifest.json` và Service Worker cơ bản để cài ứng dụng lên màn hình chính điện thoại.

## Giai đoạn 3: Tính năng Quản lý Nâng cao
*Mục tiêu: Thêm các công cụ giúp người dùng kiểm soát tài chính tốt hơn.*
1. **Thao tác hàng loạt**: Chọn nhiều giao dịch để đổi danh mục cùng lúc.
2. **Ngân sách (Budgets)**: Cho phép đặt hạn mức theo danh mục từng tháng; hiển thị thanh tiến độ và cảnh báo khi chi tiêu đạt 80% / 100%.
3. **Xác thực (Auth)**: Triển khai luồng đăng nhập cơ bản (JWT/Cookie) để bảo vệ dữ liệu khi deploy công khai.

## Giai đoạn 4: Tự động hóa & Nhập liệu (Advanced)
*Mục tiêu: Giảm thiểu thao tác nhập tay tối đa theo tầm nhìn của dự án.*
1. **API Ingest (`/api/ingest`)**: Xây dựng endpoint nhận thông báo biến động số dư từ điện thoại (qua MacroDroid/Tasker).
2. **Hộp chờ duyệt (Inbox)**: Xây dựng UI để kiểm tra, duyệt hoặc sửa các giao dịch được tạo tự động chưa chắc chắn.
3. **Quy tắc gán danh mục (Rules)**: Cơ chế tự động đọc tên người nhận/nội dung để gán danh mục tự động.
4. **Nhập CSV**: Tính năng upload file CSV sao kê từ ngân hàng, tự động ánh xạ và nhận diện trùng lặp.
5. **Đối soát (Reconcile)**: Chức năng chốt số dư thực tế và tạo giao dịch điều chỉnh.
