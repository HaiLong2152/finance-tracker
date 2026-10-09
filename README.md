# Finance Tracker

Ứng dụng web theo dõi thu chi cá nhân, gồm frontend React/Vite, backend Express và MySQL.

**Tài liệu dự án:**
- Chi tiết nghiệp vụ và kiến trúc: Xem file `docs/SPEC.md`.
- Lộ trình thực hiện: Xem file `docs/PLAN.md`.
## Yêu cầu
- Node.js và npm
- MySQL Server

## Cài đặt cơ sở dữ liệu
1. Tạo schema và bảng bằng `database/Database.sql`.
2. Nạp danh mục mẫu bằng `database/test_data.sql`.

## Cấu hình backend
```powershell
cd backend
```
Điền thông tin MySQL vào `backend/.env`, sau đó cài và chạy backend:
```powershell
npm install
npm run dev
```
Mặc định API chạy tại `http://localhost:5000`.

## Cấu hình frontend
Mở terminal khác:
```powershell
cd frontend
npm install
npm run dev
```
Frontend mặc định gọi API tại `http://localhost:5000/api`. Có thể thay đổi bằng `VITE_API_URL` trong `frontend/.env`.

Không commit các file `.env`; chúng đã được loại khỏi Git bằng `.gitignore`.
