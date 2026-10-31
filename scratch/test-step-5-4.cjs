/**
 * Script kiểm thử tự động Bước 5.4: Deploy frontend / PWA
 * Chạy với: node scratch/test-step-5-4.cjs
 */
const fs = require('fs');
const path = require('path');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, detail = '') {
    if (condition) {
        console.log(`  [PASS] ${testName}`);
        passedTests++;
    } else {
        console.error(`  [FAIL] ${testName}${detail ? ' -> ' + detail : ''}`);
        failedTests++;
    }
}

async function runTests() {
    console.log('=== BẮT ĐẦU KIỂM THỬ BƯỚC 5.4: DEPLOY FRONTEND / PWA ===\n');

    try {
        // =========================================================================
        // 1. KIỂM THỬ MANIFEST VÀ CÁC BIỂU TƯỢNG (PWA MANIFEST & ICONS)
        // =========================================================================
        console.log('--- 1. Kiểm thử Web Manifest và Biểu tượng PWA ---');

        const manifestPath = path.resolve(__dirname, '../frontend/public/manifest.webmanifest');
        assert(fs.existsSync(manifestPath), 'File public/manifest.webmanifest tồn tại');

        const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        assert(Boolean(manifestContent.name && manifestContent.short_name), 'Manifest có đầy đủ name và short_name');
        assert(manifestContent.display === 'standalone', 'Manifest cấu hình display: standalone (chạy độc lập như App)');
        assert(manifestContent.start_url === '/', 'Manifest start_url là "/"');
        assert(Boolean(manifestContent.theme_color && manifestContent.background_color), 'Manifest có theme_color và background_color');

        // Kiểm tra danh sách icons
        assert(Array.isArray(manifestContent.icons) && manifestContent.icons.length >= 2, 'Manifest có ít nhất 2 icon kích thước khác nhau');
        for (const icon of manifestContent.icons) {
            const iconPath = path.resolve(__dirname, '../frontend/public', icon.src.replace(/^\//, ''));
            const exists = fs.existsSync(iconPath);
            assert(exists, `Icon '${icon.src}' tồn tại trong thư mục public`);
            if (exists) {
                const stat = fs.statSync(iconPath);
                assert(stat.size > 0, `Icon '${icon.src}' có kích thước hợp lệ (${stat.size} bytes)`);
            }
        }

        // =========================================================================
        // 2. KIỂM THỬ METATAGS VÀ APPLE TOUCH ICON (HTML HEADER)
        // =========================================================================
        console.log('\n--- 2. Kiểm thử HTML Headers và Apple Touch Icon ---');

        const htmlPath = path.resolve(__dirname, '../frontend/index.html');
        assert(fs.existsSync(htmlPath), 'index.html tồn tại');
        const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

        assert(htmlContent.includes('rel="manifest" href="/manifest.webmanifest"'), 'HTML liên kết tới manifest.webmanifest');
        assert(htmlContent.includes('rel="apple-touch-icon" href="/icon-192.png"'), 'HTML sử dụng apple-touch-icon định dạng PNG hợp lệ cho iOS');
        assert(htmlContent.includes('name="theme-color"'), 'HTML có thẻ meta theme-color');
        assert(htmlContent.includes('name="apple-mobile-web-app-capable" content="yes"'), 'HTML có thẻ meta apple-mobile-web-app-capable');
        assert(htmlContent.includes('name="viewport"'), 'HTML có thẻ meta viewport tối ưu di động');

        // =========================================================================
        // 3. KIỂM THỬ SERVICE WORKER & CHÍNH SÁCH CACHING AN TOÀN (SPEC 5.4)
        // =========================================================================
        console.log('\n--- 3. Kiểm thử Service Worker & Caching Policy ---');

        const swPath = path.resolve(__dirname, '../frontend/public/sw.js');
        assert(fs.existsSync(swPath), 'public/sw.js tồn tại');
        const swContent = fs.readFileSync(swPath, 'utf-8');

        assert(swContent.includes('CACHE_NAME'), 'SW có định danh phiên bản cache');
        assert(swContent.includes('SKIP_WAITING'), 'SW hỗ trợ lệnh SKIP_WAITING để kích hoạt cập nhật ngay');
        assert(swContent.includes("url.pathname.startsWith('/api/')"), 'SW TUYỆT ĐỐI không cache các API endpoints');
        assert(swContent.includes("url.pathname.startsWith('/health')"), 'SW TUYỆT ĐỐI không cache health check probes');
        assert(swContent.includes('/auth'), 'SW TUYỆT ĐỐI không cache các route xác thực / đăng nhập');
        assert(swContent.includes('no-store'), 'SW tôn trọng chỉ thị Cache-Control: no-store từ server');
        assert(swContent.includes('caches.delete'), 'SW dọn dẹp các cache phiên bản cũ khi activate');

        // =========================================================================
        // 4. KIỂM THỬ SPA ROUTING FALLBACKS CHO CÁC NỀN TẢNG CLOUD / REVERSE PROXY
        // =========================================================================
        console.log('\n--- 4. Kiểm thử SPA Routing Fallbacks & Cache Directives ---');

        // 4.1 Netlify / Cloudflare Pages (_redirects)
        const redirectsPath = path.resolve(__dirname, '../frontend/public/_redirects');
        assert(fs.existsSync(redirectsPath), 'File public/_redirects tồn tại');
        const redirectsContent = fs.readFileSync(redirectsPath, 'utf-8');
        assert(redirectsContent.includes('/*    /index.html   200'), '_redirects cấu hình fallback SPA 200 chính xác');

        // 4.2 Vercel (vercel.json)
        const vercelPath = path.resolve(__dirname, '../frontend/vercel.json');
        assert(fs.existsSync(vercelPath), 'File frontend/vercel.json tồn tại');
        const vercelContent = JSON.parse(fs.readFileSync(vercelPath, 'utf-8'));
        assert(Array.isArray(vercelContent.rewrites) && vercelContent.rewrites.some(r => r.destination === '/index.html'), 'vercel.json có rewrite fallback về /index.html');
        assert(Array.isArray(vercelContent.headers) && vercelContent.headers.some(h => h.source === '/sw.js'), 'vercel.json cấu hình no-cache cho sw.js');

        // 4.3 Nginx Reverse Proxy Config
        const nginxPath = path.resolve(__dirname, '../deploy/nginx/conf.d/default.conf');
        assert(fs.existsSync(nginxPath), 'File deploy/nginx/conf.d/default.conf tồn tại');
        const nginxContent = fs.readFileSync(nginxPath, 'utf-8');
        assert(nginxContent.includes('try_files $uri $uri/ /index.html;'), 'Nginx cấu hình try_files SPA fallback');
        assert((nginxContent.includes('sw.js') || nginxContent.includes('sw\\.js')) && nginxContent.includes('no-cache'), 'Nginx cấu hình chặn cache cho Service Worker');

        // =========================================================================
        // 5. KIỂM THỬ PWA INTEGRATION TRONG GIAO DIỆN REACT
        // =========================================================================
        console.log('\n--- 5. Kiểm thử React PWA Lifecycle & UI Components ---');

        const pwaContextPath = path.resolve(__dirname, '../frontend/src/contexts/PwaContext.jsx');
        assert(fs.existsSync(pwaContextPath), 'PwaContext.jsx tồn tại');
        const pwaContextContent = fs.readFileSync(pwaContextPath, 'utf-8');

        assert(pwaContextContent.includes('beforeinstallprompt'), 'PwaContext lắng nghe sự kiện beforeinstallprompt');
        assert(pwaContextContent.includes('appinstalled'), 'PwaContext lắng nghe sự kiện appinstalled');
        assert(pwaContextContent.includes('updatefound'), 'PwaContext lắng nghe sự kiện updatefound khi có bản mới');
        assert(pwaContextContent.includes('controllerchange'), 'PwaContext tự động làm mới trang khi SW mới tiếp quản');
        assert(pwaContextContent.includes('installPwa'), 'PwaContext cung cấp hàm installPwa');
        assert(pwaContextContent.includes('updatePwa'), 'PwaContext cung cấp hàm updatePwa');

        const appPath = path.resolve(__dirname, '../frontend/src/App.jsx');
        const appContent = fs.readFileSync(appPath, 'utf-8');
        assert(appContent.includes('<PwaProvider>'), 'App.jsx đã bọc PwaProvider toàn cục');

        const layoutPath = path.resolve(__dirname, '../frontend/src/app/DashboardLayout.jsx');
        const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
        assert(layoutContent.includes('pwa-update-banner'), 'DashboardLayout có banner thông báo cập nhật phiên bản mới');
        assert(layoutContent.includes('installPwa'), 'DashboardLayout có nút kích hoạt cài đặt ứng dụng (PWA)');

        // =========================================================================
        // 6. KIỂM THỬ CẤU HÌNH BIẾN MÔI TRƯỜNG VÀ API_URL
        // =========================================================================
        console.log('\n--- 6. Kiểm thử Cấu hình Biến môi trường Frontend ---');

        const envExPath = path.resolve(__dirname, '../frontend/.env.example');
        assert(fs.existsSync(envExPath), 'frontend/.env.example tồn tại');
        const envExContent = fs.readFileSync(envExPath, 'utf-8');
        assert(envExContent.includes('VITE_API_URL'), '.env.example hướng dẫn cấu hình VITE_API_URL');

        const apiPath = path.resolve(__dirname, '../frontend/src/services/api.js');
        const apiContent = fs.readFileSync(apiPath, 'utf-8');
        assert(apiContent.includes('import.meta.env.VITE_API_URL || "/api"'), 'api.js hỗ trợ cả VITE_API_URL và mặc định /api');

    } catch (error) {
        console.error('LỖI KHÔNG MONG MUỐN TRONG QUÁ TRÌNH KIỂM THỬ:', error);
        failedTests++;
    }

    console.log(`\n======================================================`);
    console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests} PASS, ${failedTests} FAIL`);
    console.log(`======================================================\n`);

    if (failedTests > 0) {
        process.exit(1);
    }
}

runTests();
