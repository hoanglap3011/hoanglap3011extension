document.addEventListener('DOMContentLoaded', () => {

    // Defaults từ config.js
    const FB_KEYWORDS_DEFAULT      = DEFAULT_FB_KEYWORDS.join('\n');
    const WEBSITE_BLOCKLIST_DEFAULT = DEFAULT_WEBSITE_BLOCKLIST;

    // === SWITCHES ===
    const switches = {
        // Website blocker
        enableWebsiteBlocker:      document.getElementById('enableWebsiteBlocker'),
        // Facebook
        fbEnableSummarize:         document.getElementById('fbEnableSummarize'),
        fbEnableBlockByKeyword:    document.getElementById('fbEnableBlockByKeyword'),
        fbEnableHideStories:       document.getElementById('fbEnableHideStories'),
        // YouTube
        ytEnableHomepageHider:     document.getElementById('ytEnableHomepageHider'),
        ytEnableSummaryBox:        document.getElementById('ytEnableSummaryBox'),
        ytEnableAutoSummarize:     document.getElementById('ytEnableAutoSummarize'),
        ytEnableAutoCloseNotebook: document.getElementById('ytEnableAutoCloseNotebook'),
        ytEnableHideRelated:       document.getElementById('ytEnableHideRelated'),
    };

    const fbKeywordsTextarea       = document.getElementById('fbBlockKeywords');
    const fbKeywordSection         = document.getElementById('blockKeywordSection');
    const websiteBlocklistTextarea = document.getElementById('websiteBlocklist');
    const saveStatus               = document.getElementById('saveStatus');

    // === COLLAPSE / EXPAND ===
    const COLLAPSE_KEY = 'optionsCollapseState';

    function saveCollapseState() {
        const state = {};
        document.querySelectorAll('.section-header').forEach(header => {
            const targetId = header.getAttribute('data-target');
            state[targetId] = document.getElementById(targetId).classList.contains('open');
        });
        chrome.storage.local.set({ [COLLAPSE_KEY]: state });
    }

    function loadCollapseState() {
        chrome.storage.local.get(COLLAPSE_KEY, (data) => {
            const state = data[COLLAPSE_KEY] || {}; // mặc định: tất cả thu gọn
            document.querySelectorAll('.section-header').forEach(header => {
                const targetId = header.getAttribute('data-target');
                const isOpen = state[targetId] === true;
                document.getElementById(targetId).classList.toggle('open', isOpen);
                header.classList.toggle('open', isOpen);
            });
        });
    }

    document.querySelectorAll('.section-header').forEach(header => {
        header.addEventListener('click', (e) => {
            if (e.target.closest('.switch')) return;

            const targetId = header.getAttribute('data-target');
            const body = document.getElementById(targetId);
            const isOpen = body.classList.contains('open');

            body.classList.toggle('open', !isOpen);
            header.classList.toggle('open', !isOpen);
            saveCollapseState();
        });
    });

    loadCollapseState();

    // === BADGE helpers ===
    function updateBadge(badgeId, isOn) {
        const badge = document.getElementById(badgeId);
        if (!badge) return;
        badge.textContent = isOn ? 'Bật' : 'Tắt';
        badge.classList.toggle('off', !isOn);
    }

    function refreshBadges(settings) {
        // Website blocker badge
        updateBadge('badge-blocker', settings.enableWebsiteBlocker ?? true);
        // Facebook: bật nếu ít nhất 1 tính năng FB đang bật
        const fbOn = settings.fbEnableSummarize || settings.fbEnableBlockByKeyword || settings.fbEnableHideStories;
        updateBadge('badge-facebook', fbOn);
        // YouTube: bật nếu ít nhất 1 tính năng YT đang bật
        const ytOn = settings.ytEnableHomepageHider || settings.ytEnableSummaryBox ||
                     settings.ytEnableAutoSummarize || settings.ytEnableHideRelated;
        updateBadge('badge-youtube', ytOn);
    }

    // === VISIBILITY helpers ===
    function updateKeywordSectionVisibility() {
        fbKeywordSection.classList.toggle('hidden', !switches.fbEnableBlockByKeyword.checked);
    }

    // === SAVE ===
    function showSaved() {
        saveStatus.textContent = 'Đã lưu cài đặt!';
        saveStatus.style.opacity = '1';
        setTimeout(() => { saveStatus.style.opacity = '0'; }, 2000);
    }

    function saveSettings() {
        const currentSettings = {};
        for (const key in switches) {
            if (switches[key]) currentSettings[key] = switches[key].checked;
        }
        chrome.storage.local.set({
            [SETTINGS_KEY]: currentSettings,
            [FB_KEYWORDS_KEY]: fbKeywordsTextarea.value,
            [WEBSITE_BLOCKLIST_KEY]: websiteBlocklistTextarea.value,
        }, () => {
            refreshBadges(currentSettings);
            showSaved();
        });
    }

    // === LOAD ===
    function loadSettings() {
        chrome.storage.local.get([SETTINGS_KEY, FB_KEYWORDS_KEY, WEBSITE_BLOCKLIST_KEY], (data) => {
            const settings = { ...DEFAULT_SETTINGS, enableWebsiteBlocker: true, ...(data[SETTINGS_KEY] || {}) };

            for (const key in switches) {
                if (switches[key] && settings[key] !== undefined) {
                    switches[key].checked = settings[key];
                }
            }

            fbKeywordsTextarea.value       = data[FB_KEYWORDS_KEY]       ?? FB_KEYWORDS_DEFAULT;
            websiteBlocklistTextarea.value = data[WEBSITE_BLOCKLIST_KEY] ?? WEBSITE_BLOCKLIST_DEFAULT;

            updateKeywordSectionVisibility();
            refreshBadges(settings);
        });
    }

    loadSettings();

    // === LISTENERS ===
    Object.values(switches).forEach(el => {
        if (el) el.addEventListener('change', saveSettings);
    });

    // Toggle visibility keyword section
    switches.fbEnableBlockByKeyword.addEventListener('change', updateKeywordSectionVisibility);

    // Textareas — debounce 600ms
    let debounceTimer;
    const onTextareaInput = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(saveSettings, 600);
    };
    fbKeywordsTextarea.addEventListener('input', onTextareaInput);
    websiteBlocklistTextarea.addEventListener('input', onTextareaInput);
});