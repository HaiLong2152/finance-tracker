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
*Mục tiêu: giảm nhập tay nhưng giữ được dữ liệu gốc, khả năng rà soát và chống ghi nhận giao dịch trùng.*

### 4.1 Nền tảng Inbox và dữ liệu nguồn
- Tạo migration có phiên bản cho bảng lưu thông báo/import gốc: nguồn, nội dung nguyên văn, thời điểm nhận, trạng thái, kết quả parse, lý do lỗi và mã chống trùng.
- Trạng thái tối thiểu: `pending`, `approved`, `ignored`, `failed`; không sửa nội dung gốc sau khi nhận.
- Lưu kết quả phân tích riêng với payload gốc để có thể parse lại khi nâng cấp parser.
- Tiêu chí hoàn tất: migration chạy lặp an toàn; dữ liệu nguồn không bị mất khi parser lỗi.

### 4.2 API Ingest
- Xây dựng `POST /api/ingest` nhận thông báo từ MacroDroid/Tasker; dùng ingest token riêng, không dùng cookie đăng nhập web.
- Kiểm tra token, kích thước payload, trường bắt buộc, thời gian và nguồn gửi; không ghi token hoặc nội dung nhạy cảm vào log.
- Tạo idempotency key từ mã nguồn nếu có; nếu không có thì dùng khóa ghép có kiểm soát để nhận diện gửi lặp.
- Lưu payload gốc trước khi parse; phản hồi rõ `accepted`, `duplicate` hoặc lỗi xác thực/dữ liệu.
- Tiêu chí hoàn tất: gửi lại cùng một thông báo không tạo thêm inbox item hay giao dịch.

### 4.3 Parser thông báo và Inbox duyệt
- Tách parser thuần khỏi route/controller; bắt đầu với một định dạng thông báo ngân hàng/ví cụ thể.
- Chuẩn hóa số tiền, ngày giờ, loại giao dịch, tài khoản và nội dung; parser không tự tạo giao dịch.
- Lưu kết quả parse, mức tin cậy và lỗi có thể khắc phục.
- Tạo API và giao diện Inbox để xem, tìm/lọc, sửa dữ liệu parse, duyệt hoặc bỏ qua.
- Duyệt phải tạo giao dịch và cập nhật trạng thái Inbox trong một transaction DB; lưu liên kết giao dịch đã tạo để chống duyệt hai lần.
- Tiêu chí hoàn tất: tin không parse được vẫn xem được nguyên văn; duyệt hai lần không nhân đôi giao dịch.

### 4.4 Quy tắc tự gán danh mục
- CRUD quy tắc theo từ khóa/chuỗi chuẩn hóa, loại giao dịch, tài khoản tùy chọn, danh mục và độ ưu tiên.
- Chỉ tự đề xuất danh mục cho Inbox; mặc định vẫn chờ người dùng duyệt.
- Hiển thị quy tắc khớp và cho phép tạo quy tắc từ một giao dịch đã được người dùng sửa.
- Tiêu chí hoàn tất: kết quả ổn định khi nhiều quy tắc cùng khớp; có thể bật/tắt và sắp xếp ưu tiên.

### 4.5 Nhập CSV sao kê
- Hỗ trợ trước một định dạng CSV mẫu; có bước tải lên, ánh xạ cột, xem trước và xác nhận.
- Xử lý UTF-8/BOM, dấu phân cách, định dạng ngày và cách biểu diễn số tiền; giới hạn kích thước và số dòng.
- Đánh dấu dòng hợp lệ, lỗi, nghi trùng; không ghi DB trước khi người dùng xác nhận.
- Lưu batch import và nguồn từng giao dịch; nhập batch theo transaction hoặc cơ chế báo kết quả từng dòng rõ ràng.
- Tiêu chí hoàn tất: chạy lại cùng batch không tạo bản ghi trùng; người dùng tải được báo cáo dòng lỗi.

### 4.6 Đối soát số dư
- Cho người dùng chọn tài khoản và ngày đối soát, nhập số dư thực tế.
- Tính số dư kỳ vọng đến ngày đó và chênh lệch; hiển thị phép tính trước khi xác nhận.
- Lưu lịch sử đối soát gồm số dư kỳ vọng/thực tế, chênh lệch, ngày và giao dịch điều chỉnh liên kết.
- Khi xác nhận, tạo giao dịch thu/chi điều chỉnh có danh mục riêng trong transaction DB.
- Tiêu chí hoàn tất: đối soát không sửa/xóa lịch sử giao dịch cũ; có thể tra lại lần đối soát và giao dịch điều chỉnh.

### Thứ tự triển khai giai đoạn 4
1. Migration và mô hình Inbox/idempotency.
2. Ingest endpoint và lưu payload gốc.
3. Parser đầu tiên, Inbox API/UI và luồng duyệt.
4. Rules và gợi ý phân loại.
5. CSV preview/import.
6. Đối soát số dư.

## Giai đoạn 5: Hoàn thiện và Deploy
*Mục tiêu: đưa ứng dụng lên môi trường có HTTPS, dữ liệu được bảo vệ và có thể vận hành/khôi phục.*

### 5.1 Sẵn sàng production
- Tách cấu hình development/production; kiểm tra bắt buộc secret, CORS, URL API, cookie secure và giới hạn request.
- Đảm bảo frontend không lưu cache cho API/auth; cấu hình Service Worker cập nhật phiên bản asset an toàn.
- Chuẩn hóa log lỗi, bỏ mật khẩu/token/nội dung thông báo khỏi log; thêm health check backend và database.
- Chốt migrations có thứ tự, có thể kiểm tra phiên bản schema; chuẩn bị hướng rollback cho mỗi lần deploy.

### 5.2 Database production và bảo vệ dữ liệu
- Tạo database/user riêng cho ứng dụng với quyền tối thiểu; bật kết nối mã hóa nếu nhà cung cấp hỗ trợ.
- Chạy migration trên môi trường staging trước production; không dùng test data trên dữ liệu thật.
- Thiết lập backup tự động, thời gian lưu backup và quy trình restore thử nghiệm.
- Tiêu chí hoàn tất: phục hồi được một bản backup vào môi trường riêng và kiểm tra dữ liệu sau phục hồi.

### 5.3 Deploy backend
- Cấu hình biến môi trường production bằng secret manager của nền tảng; không đưa `.env` hoặc secret vào repository.
- Deploy sau HTTPS/reverse proxy; cấu hình trust proxy đúng để rate limit và cookie Secure hoạt động chính xác.
- Nếu frontend/backend khác origin, xác minh CORS credentials, cookie SameSite/Secure và CSRF; ưu tiên cùng site/reverse proxy để giữ cookie SameSite=Lax.
- Kiểm tra health endpoint, log, kết nối DB, migration và hành vi khởi động khi thiếu cấu hình.

### 5.4 Deploy frontend/PWA
- Build frontend với API URL production; cấu hình fallback cho client-side routes.
- Phát hành HTTPS, kiểm tra manifest, icon, cài PWA, cập nhật Service Worker và phiên bản cache.
- Xác minh frontend không cache API response hoặc trang đăng nhập.

### 5.5 Nghiệm thu và vận hành
- Kiểm tra đăng nhập/đăng xuất, CRUD, giao dịch transfer, ngân sách, báo cáo, ingest, duyệt Inbox, CSV và đối soát trên production/staging.
- Thử quyền truy cập API khi chưa đăng nhập, rate limit, CORS, session hết hạn và lỗi database.
- Kiểm tra backup/restore, quy trình cập nhật phiên bản và rollback.
- Ghi lại URL môi trường, cách cập nhật secrets, chạy migration, xem log và khôi phục backup trong README.
