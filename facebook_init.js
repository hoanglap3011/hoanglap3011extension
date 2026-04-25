// CSS để ẩn Story
const HIDE_STORY_CSS = `
    div[data-pagelet="Stories"],
    div[aria-label="Tin"],
    div[aria-label="Stories"] {
        display: none !important;
    }
`;


(function() {
    // Sử dụng API của extension
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      
        // SETTINGS_KEY và DEFAULT_SETTINGS chưa có ở document_start
        // → hardcode thẳng giá trị vào đây, không phụ thuộc config.js
        const SETTINGS_KEY = 'LapsExtensionSettings';
        const DEFAULT_SETTINGS = { fbEnableHideStories: true };

        chrome.storage.local.get(SETTINGS_KEY, (data) => {
            
            // THAY ĐỔI: Dùng DEFAULT_SETTINGS chung và data[SETTINGS_KEY] (từ config.js)
            const settings = { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };

            // THAY ĐỔI: Dùng key mới (fbEnableHideStories)
            if (settings.fbEnableHideStories) {
                const style = document.createElement('style');
                style.textContent = HIDE_STORY_CSS;
                // Tiêm vào <html> (document.documentElement)
                // vì nó có sẵn ngay tại document_start
                document.documentElement.appendChild(style);
            }
        });
    }
})();