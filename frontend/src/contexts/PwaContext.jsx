import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const PwaContext = createContext();

const checkStandalone = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator?.standalone
  );
};

export function PwaProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(checkStandalone);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);

  useEffect(() => {
    // 1. Lắng nghe thay đổi display-mode (chế độ cài đặt)
    const mediaQuery = window.matchMedia?.('(display-mode: standalone)');
    const handleDisplayModeChange = (e) => {
      setIsInstalled(e.matches);
    };
    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener('change', handleDisplayModeChange);
    }

    // 2. Lắng nghe sự kiện beforeinstallprompt để kích hoạt nút cài đặt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    // 3. Lắng nghe sự kiện khi app đã được cài đặt thành công
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstallable(false);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // 4. Quản lý Service Worker và cập nhật phiên bản cache mới
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        // Nếu đã có worker đang chờ kích hoạt
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setHasUpdate(true);
        }

        // Lắng nghe bản cập nhật mới được tải về
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker);
                setHasUpdate(true);
              }
            });
          }
        });
      }).catch((err) => {
        console.warn('Đăng ký Service Worker thất bại:', err);
      });

      // Tự động tải lại trang khi Service Worker mới đã nắm quyền điều khiển (controllerchange)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    return () => {
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener('change', handleDisplayModeChange);
      }
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Kích hoạt hộp thoại cài đặt PWA của trình duyệt
  const installPwa = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  // Cập nhật lên phiên bản Service Worker mới nhất
  const updatePwa = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [waitingWorker]);

  return (
    <PwaContext.Provider
      value={{
        isInstallable,
        isInstalled,
        hasUpdate,
        installPwa,
        updatePwa
      }}
    >
      {children}
    </PwaContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePwa = () => {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error('usePwa phải được sử dụng bên trong PwaProvider');
  }
  return context;
};
