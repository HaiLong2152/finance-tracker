# Hướng Dẫn Triển Khai Backend & Vận Hành Production (SPEC 5.3)

Tài liệu này hướng dẫn chi tiết quy trình đưa ứng dụng **Finance Tracker** lên môi trường Production an toàn, bảo mật cao và vận hành ổn định.

---

## 1. Hai Mô Hình Kiến Trúc Triển Khai

| Đặc điểm | Mô hình 1: Reverse Proxy Cùng Tên Miền *(Khuyến nghị)* | Mô hình 2: Tách Rời Tên Miền (Cross-Origin) |
| :--- | :--- | :--- |
| **Cấu trúc URL** | `https://finance.example.com` (Frontend) & `/api/*` (Backend) | `https://finance.example.com` & `https://api-finance.example.com` |
| **CORS** | Không cần xử lý cross-origin (cùng site) | Cần cấu hình `CORS_ORIGIN` chính xác |
| **Cookie Auth** | `SameSite=Lax`, `Secure=true`, chống CSRF tự nhiên | `SameSite=None`, `Secure=true`, hoặc dùng Bearer Token |
| **Trình duyệt Safari/iOS** | Không bao giờ bị chặn cookie bên thứ ba | Có thể bị chặn third-party cookie nếu không dùng Bearer Token |
| **Phù hợp với** | Docker Compose, VPS + Nginx, Cloudflare Tunnel | Vercel (Frontend) + Render/Railway (Backend) |

---

## 2. Quản Lý Biến Môi Trường (Secret Manager)

> [!IMPORTANT]
> **Tuyệt đối không đưa file `.env` hoặc các giá trị mật vào git repository.**
> Mọi nền tảng cloud (Render, Railway, Fly.io, Heroku) đều có giao diện **Environment Variables / Secrets** riêng.

### 2.1 Bảng biến môi trường bắt buộc

| Biến môi trường | Bắt buộc | Mô tả | Giá trị mẫu |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Có | Chế độ môi trường | `production` |
| `PORT` | Có | Cổng lắng nghe HTTP | `5000` (hoặc do nền tảng tự cấp) |
| `DB_HOST` | Có | Địa chỉ máy chủ MySQL | `localhost` hoặc URL cloud |
| `DB_PORT` | Không | Cổng MySQL | `3306` |
| `DB_NAME` | Có | Tên cơ sở dữ liệu | `finance_tracker_prod` |
| `DB_USER` | Có | Tài khoản MySQL (quyền tối thiểu) | `finance_app_user` |
| `DB_PASSWORD` | Có | Mật khẩu tài khoản MySQL | *Chuỗi ngẫu nhiên dài* |
| `DB_SSL` | Tùy chọn | Bật kết nối mã hóa TLS đến MySQL | `true` |
| `JWT_SECRET` | Có | Khóa bí mật ký token JWT (tối thiểu 32 ký tự) | *Chuỗi hex 64 ký tự* |
| `INGEST_TOKEN` | Có | Khóa Bearer token cho Ingest API từ điện thoại | *Chuỗi ngẫu nhiên 32 ký tự* |
| `AUTH_PASSWORD_HASH` | Khuyến nghị | Mật khẩu hash bcrypt của người dùng | `$2a$10$...` |
| `AUTH_PASSWORD` | Thay thế | Mật khẩu văn bản thô (nếu không dùng hash) | *Mật khẩu phức tạp* |
| `CORS_ORIGIN` | Có | URL của frontend được phép truy cập | `https://finance.example.com` |
| `TRUST_PROXY` | Có | Số lớp reverse proxy hoặc `true` | `1` (khi đứng sau Nginx/Cloudflare) |
| `COOKIE_SECURE` | Có | Bật cờ Secure cho cookie (HTTPS) | `true` |
| `COOKIE_SAME_SITE` | Có | Chính sách SameSite cho cookie | `lax` (Mô hình 1) hoặc `none` (Mô hình 2) |
| `RATE_LIMIT_MAX` | Không | Giới hạn request mỗi 15 phút | `100` |

### 2.2 Các câu lệnh tạo Secret an toàn nhanh chóng

```bash
# 1. Tạo JWT_SECRET ngẫu nhiên 64 ký tự:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Tạo INGEST_TOKEN ngẫu nhiên 32 ký tự:
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# 3. Tạo AUTH_PASSWORD_HASH (Bcrypt) từ mật khẩu của bạn:
node -e "console.log(require('bcryptjs').hashSync('MatKhauCuaBan123@#', 10))"
```

---

## 3. Triển Khai Bằng Docker & Nginx Reverse Proxy (Mô hình 1 - Khuyến nghị)

Cấu hình mẫu đã được chuẩn bị sẵn trong repository:
- [Dockerfile](file:///d:/finance-tracker-project/Dockerfile): Node.js 20 Alpine, chạy non-root user `node`, tích hợp healthcheck.
- [docker-compose.yml](file:///d:/finance-tracker-project/docker-compose.yml): Cụm hoàn chỉnh gồm MySQL 8.4, Backend Node.js và Nginx.
- [deploy/nginx/conf.d/default.conf](file:///d:/finance-tracker-project/deploy/nginx/conf.d/default.conf): Cấu hình reverse proxy, SSL termination, gzip, bảo mật headers và routing SPA `/index.html`.

### Quy trình kích hoạt:
1. Sao chép và cấu hình file `.env` trên máy chủ từ `.env.example`.
2. Chạy lệnh:
   ```bash
   docker compose up -d --build
   ```
3. Xem log kiểm tra:
   ```bash
   docker compose logs -f backend
   ```

---

## 4. Triển Khai Trên Nền Tảng Cloud (Render / Railway / Fly.io)

### 4.1 Cấu hình Build & Start Command
- **Build Command**: `cd backend && npm ci --omit=dev`
- **Start Command**: `cd backend && npm run start:prod`
  *(Lệnh `start:prod` sẽ tự động chạy `database/migrate.js` để cập nhật schema CSDL trước khi mở cổng server)*.

### 4.2 Cấu hình Health Check Path
- **Liveness probe**: `/health` (Trả về HTTP 200 `{ status: "UP" }`).
- **Readiness probe**: `/health/ready` (Kiểm tra ping và độ trễ MySQL `{ status: "READY", database: "connected" }`).

---

## 5. Danh Sách Kiểm Tra An Toàn Trước Khi Go-Live (Checklist)

- [x] Không lưu `.env` trong repository (đã có trong `.gitignore`).
- [x] Biến `JWT_SECRET` đủ độ dài $\ge 32$ ký tự và không dùng chuỗi mặc định.
- [x] Biến `INGEST_TOKEN` đủ độ dài $\ge 16$ ký tự.
- [x] Sử dụng `AUTH_PASSWORD_HASH` (bcrypt) thay vì mật khẩu thô.
- [x] Cấu hình `TRUST_PROXY=1` để `express-rate-limit` và `req.ip` nhận diện đúng IP thật sau reverse proxy.
- [x] Bật `COOKIE_SECURE=true` khi chạy trên domain có HTTPS.
- [x] Nếu frontend/backend khác origin: cấu hình đúng `CORS_ORIGIN`, `COOKIE_SAME_SITE=none`, `COOKIE_SECURE=true`.
- [x] Hệ thống log tự động che giấu token, mật khẩu, nội dung SMS/banking.
- [x] Tự động chạy migrations lúc khởi động (`npm run start:prod`).
- [x] Đã thử nghiệm sao lưu (`npm run db:backup`) và phục hồi (`npm run db:restore`).

