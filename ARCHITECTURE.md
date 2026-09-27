# Kiến trúc Finance Tracker

## Nguyên tắc

- Frontend chỉ chịu trách nhiệm giao diện, trạng thái màn hình và gọi API.
- Backend chịu trách nhiệm xác thực dữ liệu, nghiệp vụ và truy cập MySQL.
- Controller nhận request và trả response; nghiệp vụ dùng chung đặt trong service.
- SQL schema và dữ liệu mẫu được quản lý riêng trong `database/`.
- Thông tin môi trường chỉ nằm trong `.env`, không đưa vào Git.

## Cấu trúc hiện tại

```text
finance-tracker-project/
├── backend/
│   ├── config/              # Kết nối MySQL
│   ├── controllers/         # Xử lý request/response
│   ├── routes/              # Khai báo endpoint
│   ├── docs/                # Tài liệu kế hoạch
│   ├── .env                 # Cấu hình local, không commit
│   ├── .env.example         # Mẫu cấu hình
│   └── server.js            # Khởi tạo Express
├── database/
│   ├── Database.sql         # Schema
│   └── test_data.sql        # Dữ liệu mẫu
├── frontend/
│   ├── src/
│   │   ├── features/         # Module theo nghiệp vụ
│   │   │   └── transactions/ # Form và bảng giao dịch
│   │   ├── services/         # HTTP client và API modules
│   │   ├── utils/            # Format tiền và ngày
│   │   ├── App.jsx           # Shell và state màn hình
│   │   ├── index.css         # Style toàn cục
│   │   └── main.jsx          # Entry point React
│   ├── .env.example         # VITE_API_URL
│   └── vite.config.js
└── README.md
```

## Cấu trúc mục tiêu

Khi tính năng tăng lên, mở rộng từng phần theo cấu trúc sau:

```text
backend/
├── config/                  # Database và cấu hình ứng dụng
├── controllers/             # Adapter HTTP, không chứa SQL phức tạp
├── middleware/              # Error handler, validation, logging
├── routes/                  # Route theo resource
├── services/                # Nghiệp vụ transaction, category, report
├── repositories/            # Truy vấn MySQL
└── server.js

frontend/src/
├── app/                     # App shell, router, provider
├── components/              # UI dùng chung
├── features/
│   ├── transactions/        # Form, bảng, API và state giao dịch
│   ├── categories/          # Danh mục
│   └── dashboard/           # Tổng quan và biểu đồ
├── services/                # HTTP client và API modules
├── utils/                   # Format tiền, ngày và helper
├── App.jsx
└── main.jsx
```

## Luồng dữ liệu

```text
React component
  → feature API/service
  → HTTP /api/*
  → route
  → controller
  → service
  → repository/SQL
  → MySQL
```

## Thứ tự triển khai

1. Tách HTTP client và API giao dịch/danh mục khỏi `App.jsx`.
2. Tách form và bảng giao dịch thành feature components.
3. Thêm validation và error handler dùng chung ở backend.
4. Đưa truy vấn giao dịch/danh mục vào services hoặc repositories.
5. Thêm dashboard, lọc dữ liệu và quản lý danh mục trên cấu trúc feature.

Mỗi bước chỉ nên thay đổi một lớp để dễ kiểm tra và dễ quay lại khi có lỗi.
