# ==============================================================================
# DOCKERFILE CHO FINANCE TRACKER BACKEND (PRODUCTION)
# ==============================================================================

FROM node:20-alpine AS base

# Cài đặt múi giờ Việt Nam (Asia/Ho_Chi_Minh)
RUN apk add --no-cache tzdata
ENV TZ=Asia/Ho_Chi_Minh

WORKDIR /app

# Sao chép file cấu hình dependency
COPY backend/package*.json ./backend/

# Cài đặt dependency production
WORKDIR /app/backend
RUN npm ci --omit=dev && npm cache clean --force

# Sao chép mã nguồn backend và database migrations
WORKDIR /app
COPY backend/ ./backend/
COPY database/ ./database/

# Tạo thư mục lưu backup nếu cần
RUN mkdir -p /app/database/backups && chown -R node:node /app

# Chạy dưới quyền user node không đặc quyền (Non-root user) vì an toàn
USER node

WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Health check định kỳ
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (res) => res.statusCode === 200 ? process.exit(0) : process.exit(1)).on('error', () => process.exit(1))"

# Tự động chạy migration trước khi khởi chạy server
CMD ["npm", "run", "start:prod"]

