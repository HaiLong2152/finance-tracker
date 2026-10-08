# Finance Tracker cá nhân - Spec chi tiết

Phiên bản 1.0 · Dự án cá nhân, một người dùng · Web (PWA) dùng được trên máy tính và điện thoại Android

## 1. Tổng quan

**Mục tiêu:** một website quản lý thu chi cá nhân, gom tiền mặt, tài khoản ngân hàng, ví điện tử và chi tiêu trên sàn thương mại điện tử về một chỗ, với mức nhập tay thấp nhất có thể. Mục tiêu thực tế là khoảng 70-80% giao dịch tự động vào sổ, phần còn lại nhập nhanh hoặc đối soát.

**Người dùng:** chỉ một người (chủ dự án). Vẫn giữ cột `user_id` trong schema để sau này mở rộng mà không phải làm lại.

**Cách dùng:**

- Xem và quản lý trên trình duyệt (máy tính hoặc điện thoại), cài thành PWA trên Android để mở một chạm.
- Điện thoại Android chạy thêm một app tự động hóa (MacroDroid hoặc Tasker) để bắt thông báo biến động số dư và gửi lên server.

## 2. Nguyên tắc thiết kế

1. **Nhập liệu phải nhanh hơn việc bỏ qua nó.** Thêm một khoản chi tiền mặt tối đa 3 thao tác chạm.
2. **Một sự thật duy nhất cho số dư.** Số dư mỗi ví = số dư ban đầu + tổng giao dịch, tính khi truy vấn, không lưu cứng.
3. **Không tính trùng.** Tiền chuyển giữa các ví của chính mình không phải thu hay chi.
4. **Tự động nhưng có kiểm soát.** Giao dịch tự đọc từ thông báo nếu không chắc chắn thì vào hộp chờ duyệt, không ghi thẳng vào sổ.
5. **Luôn giữ dữ liệu gốc.** Mọi tin nhắn/thông báo nhận được đều lưu nguyên văn để sửa parser và đọc lại khi ngân hàng đổi định dạng.
6. **Tiền là số nguyên.** Lưu VND bằng số nguyên (bigint), tuyệt đối không dùng float.

## 3. Phạm vi

**MVP (bắt buộc):**

- Đăng nhập một người dùng, phiên làm việc an toàn.
- Ví/tài khoản, danh mục, giao dịch (thu, chi, chuyển khoản nội bộ).
- Nhập nhanh (quick add) tối ưu cho điện thoại, PWA.
- Lọc, tìm kiếm, phân trang giao dịch.
- Ngân sách tháng theo danh mục, cảnh báo 80% và 100%.
- Dashboard và biểu đồ.
- Nhập CSV sao kê, quy tắc tự gán danh mục, chống trùng.
- Endpoint nhận thông báo, framework parser, hộp chờ duyệt.
- Đối soát số dư.
- Xuất CSV, backup.

**Phiên bản 2:**

- Giao dịch định kỳ (tiền nhà, subscription).
- Mục tiêu tiết kiệm.
- Đính kèm ảnh hóa đơn.
- Nhập offline khi mất mạng (hàng đợi trong trình duyệt).
- Tách chi tiết từng món cho đơn hàng sàn TMĐT.
- Đồng bộ ngân hàng qua bên trung gian (ví dụ SePay Bank Hub, cần kiểm tra điều kiện cho cá nhân).
- Báo cáo tháng qua email, dark mode.

**Ngoài phạm vi:**

- Đa người dùng, chia hóa đơn nhóm.
- Đa tiền tệ (chỉ VND).
- App Android native.
- Lưu mật khẩu internet banking hoặc scrape web ngân hàng (cấm, rủi ro mất tiền).

## 4. Nguồn tiền và quy tắc ghi sổ

Bạn dùng tiền mặt, chuyển khoản/QR, thẻ ngân hàng, ví điện tử liên kết với nhau và sàn TMĐT. Tiền đi qua nhiều lớp, nên cần quy tắc rõ để số liệu không nhân đôi.

**Mỗi nơi giữ tiền là một `account`:** Tiền mặt, mỗi tài khoản ngân hàng, mỗi ví điện tử.

**Ba loại giao dịch:**

| Loại | Ý nghĩa | Tính vào báo cáo thu/chi? |
| --- | --- | --- |
| `income` | Tiền vào từ bên ngoài (lương, được chuyển, hoàn tiền) | Có (thu) |
| `expense` | Tiền ra ngoài hệ thống của bạn (trả quán, trả Shopee, chuyển cho người khác) | Có (chi) |
| `transfer` | Tiền chuyển giữa hai account của chính bạn (nạp ví, rút tiền mặt, trả thẻ) | Không |

**Ví dụ chuỗi nạp ví rồi mua hàng:**

1. Ngân hàng chuyển 500.000 vào MoMo: giao dịch `transfer` (từ ngân hàng sang MoMo). Không tính chi.
2. MoMo thanh toán 200.000 cho Shopee: giao dịch `expense` trên account MoMo, danh mục Mua sắm online. Tính chi.

**Phí chuyển khoản/rút tiền** (nếu có) ghi thành một `expense` riêng, danh mục Phí dịch vụ.

**Nhận diện transfer tự động:** khi thông báo ngân hàng có nội dung nạp ví hoặc chuyển sang tài khoản đã khai báo của bạn, quy tắc gợi ý loại `transfer` và cặp account. Nếu không chắc, vào hộp chờ duyệt.

## 5. Yêu cầu chức năng chi tiết

### 5.1 Xác thực (một người dùng)

- Đăng nhập bằng mật khẩu (băm argon2 hoặc bcrypt, lưu trong biến môi trường hoặc bảng settings) hoặc Google OAuth giới hạn đúng email của bạn.
- Phiên bằng cookie httpOnly, secure, SameSite=Lax; thời hạn đủ dài để không phải đăng nhập lại mỗi ngày trên điện thoại (ví dụ 30 ngày, có thể thu hồi).
- Giới hạn số lần đăng nhập sai (rate-limit).
- Không có đăng ký, quên mật khẩu, quản lý người dùng.
- Token riêng cho endpoint nhận thông báo (xem mục 7), tách biệt với phiên đăng nhập.

### 5.2 Ví/tài khoản

- Tạo, sửa, lưu trữ (archive) ví. Loại: tiền mặt, ngân hàng, ví điện tử, khác.
- Có số dư ban đầu và ngày bắt đầu theo dõi.
- Có thể gắn nhận diện để parser biết thông báo thuộc ví nào: tên ngân hàng/ví, 4 số cuối tài khoản.
- Không cho xóa ví đã có giao dịch (chỉ archive).
- Hiển thị số dư hiện tại từng ví và tổng tài sản.

### 5.3 Danh mục

- Bộ mặc định: Ăn uống, Đi lại, Nhà ở, Hóa đơn, Mua sắm online, Mua sắm khác, Sức khỏe, Giải trí, Giáo dục, Phí dịch vụ, Khác (chi); Lương, Thưởng, Được cho, Hoàn tiền, Khác (thu).
- Tạo, sửa, ẩn danh mục; chọn biểu tượng và màu.
- Xóa danh mục đã dùng thì phải gộp sang danh mục khác (không làm mồ côi giao dịch).

### 5.4 Giao dịch

- Thêm, sửa, xóa giao dịch thu, chi, chuyển.
- Trường: số tiền, ngày giờ, ví, danh mục, ghi chú, nơi nhận/merchant, thẻ (tag) tùy chọn, ví đích (nếu chuyển).
- Mỗi giao dịch ghi nguồn: nhập tay, CSV, thông báo.
- Xóa mềm (có thể khôi phục trong 30 ngày).
- **Lọc:** khoảng ngày, danh mục, ví, loại, nguồn, trạng thái, khoảng số tiền. **Tìm kiếm:** theo ghi chú và merchant.
- Phân trang hoặc cuộn vô hạn; danh sách nhóm theo ngày kèm tổng ngày.
- Thao tác hàng loạt: đổi danh mục nhiều giao dịch cùng lúc.

### 5.5 Nhập nhanh (quick add)

- Mở từ nút nổi hoặc biểu tượng PWA, hiện dạng bottom sheet.
- Bàn phím số lớn; hỗ trợ gõ tắt 50 hiểu là 50.000 (tùy chọn bật trong cài đặt), 1tr là 1.000.000.
- Chip danh mục: 6 danh mục dùng gần nhất lên đầu; ví mặc định là ví dùng lần trước.
- Ngày mặc định là bây giờ, sửa được.
- Gợi ý danh mục theo ghi chú đã dùng trước đó.
- Nút lặp lại giao dịch gần nhất.
- **Tiêu chí:** từ lúc mở app đến lúc lưu xong tối đa 3 chạm với trường hợp phổ biến.

### 5.6 Ngân sách

- Đặt hạn mức theo danh mục theo tháng; sao chép ngân sách từ tháng trước.
- Thanh tiến độ: đã chi / hạn mức; đổi màu ở 80% và 100%.
- Cảnh báo hiển thị trong app (và có thể thêm thông báo đẩy ở v2).
- Chỉ tính giao dịch `expense` đã xác nhận, bỏ qua `transfer` và giao dịch chờ duyệt.

### 5.7 Dashboard

- Tổng thu, tổng chi, chênh lệch của tháng đang chọn; so với tháng trước.
- Biểu đồ tròn chi theo danh mục; biểu đồ cột/đường xu hướng 6-12 tháng.
- Số dư từng ví và tổng tài sản.
- Ngân sách sắp vượt.
- Số giao dịch đang chờ duyệt (bấm vào mở hộp chờ).
- **Tiêu chí:** tổng trên dashboard khớp với tổng giao dịch (có test); tải dưới 2 giây với khoảng 10.000 giao dịch.

### 5.8 Nhập CSV sao kê

Luồng: tải file lên, chọn ví, ánh xạ cột, xem trước, xác nhận.

- Hỗ trợ CSV và Excel (.xlsx); tự đoán dấu phân cách, mã hóa (UTF-8), định dạng ngày (dd/mm/yyyy) và số (dấu chấm hoặc phẩy ngăn nghìn).
- Ánh xạ cột: ngày, số tiền (một cột có dấu hoặc hai cột ghi nợ/ghi có), nội dung, mã giao dịch nếu có.
- Lưu **mẫu ánh xạ** theo từng ngân hàng để lần sau không phải chọn lại.
- Màn xem trước hiển thị từng dòng với trạng thái: mới, trùng, lỗi; áp dụng quy tắc gán danh mục.
- **Chống trùng:** nếu có mã giao dịch thì dùng khóa (ví, mã). Nếu không thì so (ví, số tiền, hướng, ngày) và nội dung gần giống; dòng nghi trùng được đánh dấu để bạn quyết định.
- Mỗi lần nhập là một lô (batch) có thể hoàn tác nguyên lô.

### 5.9 Quy tắc tự gán danh mục

- Quy tắc dạng: nếu trường (ghi chú hoặc merchant) chứa/khớp biểu thức X thì gán danh mục Y (và tùy chọn ví, loại giao dịch).
- Có độ ưu tiên; quy tắc đầu tiên khớp thắng.
- Ví dụ: chứa SHOPEE hoặc LAZADA thì Mua sắm online; chứa GRAB thì Đi lại.
- Khi bạn sửa danh mục một giao dịch, app gợi ý tạo quy tắc từ giao dịch đó.
- Có nút áp dụng quy tắc cho giao dịch cũ chưa phân loại.

### 5.10 Hộp chờ duyệt (Inbox)

Chứa giao dịch từ thông báo/CSV chưa chắc chắn:

- **Chờ duyệt:** đã đọc được số tiền nhưng thiếu danh mục hoặc nghi trùng; xác nhận bằng một chạm hoặc sửa rồi xác nhận.
- **Chưa đọc được:** thông báo parser không nhận ra, hiện nguyên văn để bạn tạo giao dịch thủ công hoặc bỏ qua.
- Cài đặt chế độ: tự xác nhận khi parser chắc chắn và quy tắc khớp, hoặc luôn chờ duyệt.
- Giao dịch chờ duyệt không tính vào dashboard và ngân sách cho đến khi xác nhận.

### 5.11 Đối soát số dư

- Với mỗi ví, nhập số dư thật (xem trên app ngân hàng) tại một thời điểm.
- App so với số dư tính được và hiển thị chênh lệch.
- Một chạm để tạo giao dịch điều chỉnh (loại thu hoặc chi, danh mục Điều chỉnh) bù phần chênh.
- Lưu lịch sử đối soát. Nên nhắc đối soát mỗi tháng.

### 5.12 Xuất dữ liệu và backup

- Xuất toàn bộ giao dịch ra CSV theo bộ lọc hiện tại.
- Backup toàn bộ dữ liệu ra file (JSON hoặc SQL) bằng một nút.
- Bật backup tự động của nhà cung cấp database (Neon/Supabase), kiểm tra khôi phục ít nhất một lần.

### 5.13 Giao dịch định kỳ (v2)

- Mẫu giao dịch lặp theo tháng/tuần (tiền nhà, subscription).
- Tạo giao dịch ở trạng thái chờ duyệt khi đến hạn, hoặc tự động nếu bạn bật.

## 6. PWA và trải nghiệm trên điện thoại

- File manifest (tên, biểu tượng, màu, `display: standalone`) và service worker cơ bản; cài bằng Thêm vào màn hình chính trên Chrome Android.
- Thiết kế mobile-first: thanh điều hướng dưới (Tổng quan, Giao dịch, nút Thêm, Chờ duyệt, Thêm), vùng chạm tối thiểu 44px.
- Phím tắt trên biểu tượng app (shortcut) tới Thêm chi tiêu.
- Trạng thái loading, trống và lỗi ở mọi màn hình.
- v2: nhập khi offline lưu vào IndexedDB rồi đồng bộ lại khi có mạng.

## 7. Thu thập tự động từ thông báo Android

**Luồng:**

1. App ngân hàng/ví hiện thông báo biến động số dư (hoặc có SMS).
2. MacroDroid/Tasker bắt thông báo từ các app đã chọn.
3. Gửi HTTPS POST lên `/api/ingest` của server.
4. Server lưu tin gốc, chạy parser, tạo giao dịch hoặc đưa vào hộp chờ.

**Cấu hình trên điện thoại (hướng dẫn trong README):**

- Cấp quyền truy cập thông báo cho app tự động hóa.
- Tắt tối ưu pin cho app đó và cho phép chạy nền (Xiaomi, Oppo, Samsung hay tự tắt tiến trình).
- Trigger: thông báo từ danh sách app ngân hàng/ví bạn dùng. Có thể thêm trigger SMS cho ngân hàng chỉ nhắn tin.
- Action: HTTP POST gửi tên gói app, tiêu đề, nội dung và thời gian của thông báo.
- Bật thử lại khi gửi thất bại (mất mạng).

**Payload (JSON):**

- `package`: tên gói app gửi thông báo
- `title`, `text`: nội dung thông báo
- `posted_at`: thời gian (epoch ms)
- `device_id`: nhận diện máy (tùy chọn)

**Xác thực:** header `Authorization: Bearer <token>`. Token sinh ngẫu nhiên dài, lưu dạng băm trong DB, xoay vòng được trong Cài đặt.

**Xử lý ở server:**

1. Kiểm tra token; sai thì 401.
2. Tính khóa idempotency = băm của (package, title, text, posted\_at). Nếu đã có, trả 200 với kết quả cũ (không tạo thêm).
3. Lưu bản ghi `ingest_events` với tin gốc.
4. Chọn parser theo `package` (và từ khóa trong nội dung).
5. Parser thành công: lọc trùng, áp quy tắc, tạo giao dịch (xác nhận hoặc chờ duyệt theo chế độ).
6. Parser thất bại: đánh dấu chưa đọc được, vào hộp chờ.
7. Luôn trả 200 kèm trạng thái xử lý, để app tự động hóa không thử lại vô hạn.

**Lưu ý dữ liệu:** thông báo chứa số dư, tên và nội dung chuyển khoản. Bắt buộc HTTPS, token mạnh, không ghi tin gốc vào log công khai. Có thể đặt thời hạn xóa tin gốc đã xử lý (ví dụ 12 tháng).

## 8. Parser thông báo

**Giao diện chung:** mỗi parser nhận tin thô và trả về cấu trúc: hướng (vào/ra), số tiền, nội dung/merchant, số dư sau giao dịch (nếu có), 4 số cuối tài khoản (nếu có), mã giao dịch (nếu có), thời gian (nếu có trong tin), và mức độ tin cậy.

**Cấu trúc:**

- Một parser cho mỗi ngân hàng/ví, đăng ký theo tên gói app.
- Một parser dự phòng chung: tìm số tiền theo mẫu số có dấu ngăn nghìn kèm đơn vị VND/đ/VNĐ, và từ khóa hướng như nhận, cộng, +, chuyển đi, thanh toán, trừ, -.
- Parser dự phòng luôn cho độ tin cậy thấp nên đi vào hộp chờ duyệt.

**Cách phát triển:**

- Thu thập 10-20 thông báo thật của từng ngân hàng/ví (che tên và số tài khoản), lưu làm fixture test.
- Mỗi parser phải có unit test trên các fixture: tiền vào, tiền ra, thanh toán QR, chuyển khoản có nội dung dài, tin có số dư.
- Ngân hàng đổi định dạng thì thêm fixture mới và sửa parser; tin gốc đã lưu cho phép xử lý lại (reprocess) các tin chưa đọc được.
- Một số ngân hàng không hiện số tiền trong thông báo: dùng SMS hoặc nhập sao kê cho nguồn đó.

**Khớp ví:** dùng nhận diện đã khai báo trên account (tên ngân hàng/ví, 4 số cuối) để chọn ví; không khớp được thì để trống và chờ duyệt.

**Chống trùng giữa nhiều kênh:** cùng một giao dịch có thể đến từ thông báo app, SMS và sao kê CSV. Quy tắc: ưu tiên mã giao dịch; nếu không có thì coi là trùng khi cùng ví, cùng số tiền, cùng hướng và cách nhau không quá vài phút (hoặc cùng ngày với CSV); hai bản gộp thành một, giữ nguồn đầu tiên và ghi nhận nguồn đã đối chiếu.

## 9. Mô hình dữ liệu

Tất cả bảng có `id`, `user_id`, `created_at`, `updated_at`. Tiền là bigint (VND).

| Bảng | Trường chính |
| --- | --- |
| **accounts** | name, type (cash/bank/ewallet/other), initial\_balance, start\_date, identifier\_hint (tên ngân hàng/ví, 4 số cuối), is\_archived, sort\_order |
| **categories** | name, type (income/expense), icon, color, is\_hidden, sort\_order |
| **transactions** | account\_id, transfer\_account\_id (null nếu không phải chuyển), category\_id (null được), type (income/expense/transfer), amount (luôn dương), occurred\_at, note, merchant, status (confirmed/pending), source (manual/csv/notification), external\_id (null được), ingest\_event\_id, import\_batch\_id, deleted\_at |
| **tags**, **transaction\_tags** | thẻ tự do gắn vào giao dịch |
| **rules** | field (note/merchant), match\_type (contains/regex), pattern, category\_id, type\_override, account\_id (tùy chọn), priority, is\_active |
| **budgets** | category\_id, month (YYYY-MM), limit\_amount; duy nhất theo (category\_id, month) |
| **ingest\_events** | received\_at, package, title, text, posted\_at, idempotency\_key (duy nhất), parser\_name, parsed\_json, result (created/pending/duplicate/unparsed/error), transaction\_id |
| **import\_batches** | account\_id, file\_name, mapping\_json, row\_counts, created\_at, undone\_at |
| **import\_mappings** | tên mẫu theo ngân hàng, mapping\_json |
| **reconciliations** | account\_id, at, actual\_balance, computed\_balance, adjustment\_transaction\_id |
| **recurring\_templates** (v2) | template\_json, schedule, next\_due, auto\_confirm |
| **settings** | khóa-giá trị: băm token ingest, chế độ tự xác nhận, định dạng nhập nhanh... |

**Công thức số dư ví:** số dư = initial\_balance + tổng income vào ví - tổng expense từ ví - tổng transfer đi từ ví + tổng transfer đến ví (chỉ tính giao dịch confirmed, chưa xóa mềm).

**Ràng buộc và chỉ mục:**

- Duy nhất (account\_id, external\_id) khi external\_id không rỗng.
- Duy nhất idempotency\_key trên ingest\_events.
- Chỉ mục: (user\_id, occurred\_at), (user\_id, category\_id, occurred\_at), (user\_id, account\_id, occurred\_at), (user\_id, status).
- Giao dịch `transfer` bắt buộc có transfer\_account\_id khác account\_id; loại khác thì phải để trống.

## 10. API (REST, JSON)

Tất cả yêu cầu (trừ ingest) cần phiên đăng nhập. Số tiền trong JSON là số nguyên (hoặc chuỗi nếu bigint vượt giới hạn của JS).

```
POST   /api/auth/login | /api/auth/logout
GET    /api/accounts            POST /api/accounts        PATCH/DELETE /api/accounts/:id
GET    /api/categories          POST /api/categories      PATCH/DELETE /api/categories/:id
GET    /api/transactions?from=&to=&category=&account=&type=&status=&q=&cursor=
POST   /api/transactions        PATCH/DELETE /api/transactions/:id
POST   /api/transactions/bulk   (đổi danh mục hàng loạt)
POST   /api/transactions/:id/confirm
GET    /api/inbox               (chờ duyệt + chưa đọc được)
POST   /api/inbox/:id/resolve   (tạo giao dịch hoặc bỏ qua)
GET    /api/rules   POST /api/rules   PATCH/DELETE /api/rules/:id   POST /api/rules/apply
GET    /api/budgets?month=      PUT /api/budgets/:id
GET    /api/reports/summary?month=
GET    /api/reports/by-category?month=
GET    /api/reports/trend?months=6
POST   /api/import/preview      POST /api/import/commit   POST /api/import/:batch/undo
POST   /api/reconcile           GET /api/reconcile?account=
GET    /api/export/transactions.csv
GET    /api/export/backup
POST   /api/ingest              (xác thực bằng bearer token riêng)
```

## 11. Kiến trúc và tech stack

- **Frontend:** React (Vite) + Context API, CSS thuần/Tailwind, Recharts.
- **Backend:** Node.js + Express.js. Tổ chức theo mô hình Controller -> Service -> Repository.
- **Database:** MySQL.
- **Auth:** Phiên cookie (JWT hoặc session), mật khẩu băm argon2/bcrypt.
- **Xử lý tệp:** papaparse cho CSV, chạy ở server hoặc client.
- **Deploy:** Vercel (Frontend) + VPS/Render (Backend) + MySQL host.
- **Công cụ:** Git, ESLint/Prettier.
- **Giám sát:** log lỗi cơ bản.

## 12. Màn hình

1. **Đăng nhập.**
2. **Tổng quan:** thẻ thu/chi/chênh lệch, biểu đồ tròn và xu hướng, số dư ví, ngân sách sắp vượt, chip số giao dịch chờ duyệt.
3. **Giao dịch:** danh sách nhóm theo ngày, thanh lọc/tìm kiếm, chọn nhiều để thao tác hàng loạt.
4. **Thêm nhanh:** bottom sheet bàn phím số, chip danh mục và ví.
5. **Chờ duyệt:** hai tab (Chờ duyệt, Chưa đọc được), thao tác xác nhận một chạm.
6. **Ví:** danh sách ví và số dư, đối soát.
7. **Ngân sách:** thanh tiến độ theo danh mục, chọn tháng.
8. **Nhập CSV:** tải lên, ánh xạ cột, xem trước, xác nhận.
9. **Danh mục và quy tắc.**
10. **Cài đặt:** token ingest và hướng dẫn cấu hình điện thoại, chế độ tự xác nhận, xuất dữ liệu, backup, đổi mật khẩu.

## 13. Bảo mật

- HTTPS bắt buộc; cookie httpOnly, secure.
- Mọi API kiểm tra phiên (trừ ingest kiểm tra token); mọi truy vấn lọc theo `user_id`.
- Validate đầu vào bằng Zod ở server; ORM tham số hóa để chống SQL injection; escape đầu ra chống XSS; CSRF bảo vệ cho các request thay đổi dữ liệu.
- Rate-limit đăng nhập và ingest.
- Bí mật (mật khẩu băm, khóa phiên, chuỗi kết nối DB) nằm trong biến môi trường, không commit.
- Không bao giờ lưu mật khẩu internet banking, mã OTP hay thông tin thẻ đầy đủ.
- Tin gốc từ thông báo là dữ liệu nhạy cảm: giới hạn thời gian lưu, không đưa vào log công khai.
- Backup được bảo vệ và thử khôi phục định kỳ.

## 14. Yêu cầu phi chức năng

- **Hiệu năng:** dashboard dưới 2 giây với 10.000 giao dịch; thêm giao dịch phản hồi tức thì (optimistic update).
- **Độ tin cậy:** ingest idempotent, không mất tin khi parser lỗi (tin luôn được lưu trước khi xử lý).
- **Khả dụng:** responsive, dùng tốt từ màn 360px, vùng chạm lớn, độ tương phản đủ.
- **Khả năng bảo trì:** parser tách module có fixture; migration database có phiên bản.

## 15. Chiến lược kiểm thử

- **Unit test (ưu tiên cao nhất):** tính số dư ví, loại trừ transfer khỏi thu/chi, tính ngân sách, chống trùng, áp quy tắc, từng parser trên fixture thật.
- **Integration test:** API giao dịch, ingest từ đầu đến cuối (tin thô thành giao dịch), nhập CSV.
- **E2E (Playwright):** đăng nhập, thêm giao dịch nhanh, duyệt giao dịch chờ, nhập CSV.
- **Kiểm thử thủ công trên Android thật:** thông báo thật từ ngân hàng/ví, mất mạng, tắt pin nền.

## 16. Kế hoạch phát triển
Vui lòng tham khảo tài liệu [PLAN.md](./PLAN.md) để xem chi tiết lộ trình phát triển và các giai đoạn triển khai (Roadmap) được cập nhật mới nhất.

## 17. Rủi ro và cách giảm

| Rủi ro | Giảm thiểu |
| --- | --- |
| Ngân hàng đổi định dạng thông báo | Lưu tin gốc, fixture test, reprocess được, parser dự phòng đưa vào hộp chờ |
| Android giết app tự động hóa, bỏ sót thông báo | Tắt tối ưu pin, đối soát cuối tháng để vá chỗ thiếu |
| Ngân hàng không hiện số tiền trong thông báo | Dùng SMS hoặc sao kê CSV cho nguồn đó |
| Tính trùng tiền khi qua nhiều ví | Loại giao dịch transfer, test loại trừ khỏi thu/chi |
| Giao dịch trùng giữa thông báo, SMS, CSV | Khóa mã giao dịch, so khớp gần đúng, gộp bản ghi |
| Lộ dữ liệu hoặc token | HTTPS, token băm và xoay vòng được, rate-limit, giới hạn lưu tin gốc |
| Mất dữ liệu | Backup tự động của DB, nút backup thủ công, thử khôi phục |
| Scope phình ra | Bám danh sách MVP, ý mới ghi vào backlog v2 |
| Sai số tiền | Số nguyên bigint, unit test phần tính toán |

## 18. Tiêu chí hoàn thành MVP

- Thêm một khoản chi tiền mặt trong tối đa 3 chạm trên điện thoại.
- Thông báo của ít nhất các ngân hàng/ví chính của bạn tự vào sổ, hoặc vào hộp chờ duyệt nếu không chắc.
- Chuyển nạp ví không bị tính là chi; số liệu dashboard khớp tổng giao dịch (có test).
- Nhập được sao kê CSV mà không tạo giao dịch trùng.
- Đối soát số dư từng ví khớp với số thật sau khi điều chỉnh.
- Cài được PWA trên Android, đã deploy có URL riêng, có backup và README.

## 19. Câu hỏi mở cần chốt

1. Danh sách ngân hàng và ví điện tử bạn dùng (quyết định parser nào làm trước) và mỗi nơi cho thông báo hay SMS có hiện số tiền không.
2. Đăng nhập bằng mật khẩu hay Google OAuth.
3. Deploy trên Vercel + Neon hay tự host (VPS/máy riêng).
4. Có cần ghi chi tiết từng món hàng cho đơn sàn TMĐT, hay chỉ cần tổng theo danh mục.
5. Có muốn đưa dự án vào portfolio không (nếu có, nên giữ auth bài bản và viết README kỹ hơn).
