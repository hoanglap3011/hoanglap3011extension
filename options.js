document.addEventListener('DOMContentLoaded', () => {

    // Từ khóa mặc định (thay thế facebook_blocklist.json)
    const DEFAULT_KEYWORDS = [
        "Những người bạn có thể biết",
        "People You May Know",
        "Reels",
        "Phòng họp mặt và Reels",
        "Được đề xuất cho bạn",
        "Suggested for you",
        "Bí Mật Showbiz"
    ].join('\n');

    const KEYWORDS_KEY = 'fbBlockKeywordsList';

    // DOM Elements — switches
    const switches = {
        fbEnableSummarize:        document.getElementById('fbEnableSummarize'),
        fbEnableBlockByKeyword:   document.getElementById('fbEnableBlockByKeyword'),
        fbEnableHideStories:      document.getElementById('fbEnableHideStories'),
        ytEnableHomepageHider:    document.getElementById('ytEnableHomepageHider'),
        ytEnableSummaryBox:       document.getElementById('ytEnableSummaryBox'),
        ytEnableAutoSummarize:    document.getElementById('ytEnableAutoSummarize'),
        ytEnableAutoCloseNotebook:document.getElementById('ytEnableAutoCloseNotebook'),
        ytEnableHideRelated:      document.getElementById('ytEnableHideRelated'),
    };

    const keywordsTextarea  = document.getElementById('fbBlockKeywords');
    const keywordSection    = document.getElementById('blockKeywordSection');
    const saveStatus        = document.getElementById('saveStatus');

    // Hiện/ẩn textarea theo trạng thái toggle
    function updateKeywordSectionVisibility() {
        if (switches.fbEnableBlockByKeyword.checked) {
            keywordSection.classList.remove('hidden');
        } else {
            keywordSection.classList.add('hidden');
        }
    }

    function saveSettings() {
        const currentSettings = {};
        for (const key in switches) {
            if (switches[key]) currentSettings[key] = switches[key].checked;
        }

        // Lưu keywords riêng (không nằm trong SETTINGS_KEY để dễ quản lý)
        const keywords = keywordsTextarea.value;

        chrome.storage.local.set(
            { [SETTINGS_KEY]: currentSettings, [KEYWORDS_KEY]: keywords },
            () => {
                saveStatus.textContent = 'Đã lưu cài đặt!';
                saveStatus.style.opacity = '1';
                setTimeout(() => { saveStatus.style.opacity = '0'; }, 2000);
            }
        );
    }

    function loadSettings() {
        chrome.storage.local.get([SETTINGS_KEY, KEYWORDS_KEY], (data) => {
            // Load switches
            const settings = { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };
            for (const key in switches) {
                if (switches[key] && settings[key] !== undefined) {
                    switches[key].checked = settings[key];
                }
            }

            // Load keywords — dùng default nếu chưa có
            keywordsTextarea.value = data[KEYWORDS_KEY] ?? DEFAULT_KEYWORDS;

            // Cập nhật visibility sau khi load
            updateKeywordSectionVisibility();
        });
    }

    loadSettings();

    // Listeners cho switches
    Object.values(switches).forEach(el => {
        if (el) el.addEventListener('change', saveSettings);
    });

    // Toggle visibility khi bật/tắt tính năng block
    switches.fbEnableBlockByKeyword.addEventListener('change', updateKeywordSectionVisibility);

    // Lưu khi textarea thay đổi (debounce nhẹ)
    let keywordTimer;
    keywordsTextarea.addEventListener('input', () => {
        clearTimeout(keywordTimer);
        keywordTimer = setTimeout(saveSettings, 600);
    });
});
