/**
 * Thông báo ở mức trình duyệt (đang ở tab nào cũng thấy).
 * - Trong extension: chrome.notifications
 * - Bản web (GitHub Pages): Web Notification API
 */
export const SystemNotifyModule = {
  show(title, message, id = null) {
    try {
      if (typeof chrome !== 'undefined' && chrome.notifications?.create) {
        chrome.notifications.create(id || `notify-${Date.now()}`, {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('image/icon.png'),
          title,
          message,
          priority: 2,
        });
        return;
      }

      if (typeof Notification === 'undefined') return;
      const push = () => {
        if (Notification.permission === 'granted') {
          new Notification(title, { body: message, icon: 'image/icon.png' });
        }
      };
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(push).catch(() => {});
      } else {
        push();
      }
    } catch (_) {
      // Không để lỗi thông báo làm hỏng luồng chính
    }
  },
};
