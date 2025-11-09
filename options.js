document.addEventListener('DOMContentLoaded', () => {
    // Lấy biến từ config.js (đã được nạp trước)
    // SETTINGS_KEY = 'LapsExtensionSettings'
    // DEFAULT_SETTINGS = { fbEnableSummarize: true, ..., ytEnableHomepageHider: true, ... }

    // DOM Elements
    const switches = {
        // Facebook
        fbEnableSummarize: document.getElementById('fbEnableSummarize'),
        fbEnableBlockByKeyword: document.getElementById('fbEnableBlockByKeyword'),
        fbEnableHideStories: document.getElementById('fbEnableHideStories'),
        
        // YouTube (MỚI)
        ytEnableHomepageHider: document.getElementById('ytEnableHomepageHider'),
        ytEnableSummaryBox: document.getElementById('ytEnableSummaryBox')
    };
    const saveStatus = document.getElementById('saveStatus');

    /**
     * Lưu cài đặt hiện tại vào chrome.storage
     */
    function saveSettings() {
        let currentSettings = {};
        
        // Lấy giá trị từ TẤT CẢ các switch
        for (const key in switches) {
            if (switches[key]) {
                currentSettings[key] = switches[key].checked;
            }
        }

        // DÙNG HẰNG SỐ TỪ CONFIG.JS
        chrome.storage.local.set({ [SETTINGS_KEY]: currentSettings }, () => {
            saveStatus.textContent = 'Đã lưu cài đặt!';
            saveStatus.style.opacity = '1';
            setTimeout(() => {
                saveStatus.style.opacity = '0';
            }, 2000);
        });
    }

    /**
     * Tải cài đặt từ chrome.storage và cập nhật UI
     */
    function loadSettings() {
        // DÙNG HẰNG SỐ TỪ CONFIG.JS
        chrome.storage.local.get(SETTINGS_KEY, (data) => {
            // Gộp cài đặt mặc định với cài đặt đã lưu
            // DÙNG HẰNG SỐ TỪ CONFIG.JS
            const settings = { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };
            
            // Cập nhật TẤT CẢ các switch
            for (const key in switches) {
                if (switches[key] && settings[key] !== undefined) {
                    switches[key].checked = settings[key];
                }
            }
        });
    }

    // Khi trang được tải, tải cài đặt
    loadSettings();

    // Thêm listener cho mỗi switch, khi thay đổi thì lưu lại
    Object.values(switches).forEach(element => {
        if (element) {
            element.addEventListener('change', saveSettings);
        }
    });
});