document.addEventListener('DOMContentLoaded', () => {

    // Defaults từ config.js
    const FB_KEYWORDS_DEFAULT      = DEFAULT_FB_KEYWORDS.join('\n');
    const WEBSITE_BLOCKLIST_DEFAULT = DEFAULT_WEBSITE_BLOCKLIST;

    // Storage keys cho cài đặt timer từ vựng (lưu riêng, không nhét vào SETTINGS_KEY)
    const TV_TIMER_KEY = 'tvTimerSettings';
    const TV_TIMER_DEFAULTS = {
        autoCloseMs:  10,   // giây
        timerMinSec:  30,   // giây
        timerMaxSec:  60,   // giây
    };

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
        // Box tóm tắt toàn cầu
        sbEnable:    document.getElementById('sbEnable'),       
        // TỪ VỰNG
        tvEnableAutoPopup: document.getElementById('tvEnableAutoPopup'), 
    };

    // === TV TIMER INPUTS ===
    const tvAutoCloseInput  = document.getElementById('tvAutoCloseMs');
    const tvTimerMinInput   = document.getElementById('tvTimerMinSec');
    const tvTimerMaxInput   = document.getElementById('tvTimerMaxSec');

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
        // Box Tóm Tắt Toàn Cầu
        updateBadge('badge-summary-box', settings.sbEnable ?? true);
        // Từ Vựng
        updateBadge('badge-tuvung', settings.tvEnableAutoPopup ?? true);
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

        // Đọc + validate giá trị timer từ vựng
        const autoCloseMs  = Math.max(3,  Math.min(120,  parseInt(tvAutoCloseInput.value)  || TV_TIMER_DEFAULTS.autoCloseMs));
        const timerMinSec  = Math.max(10, Math.min(3600, parseInt(tvTimerMinInput.value)   || TV_TIMER_DEFAULTS.timerMinSec));
        const timerMaxSec  = Math.max(10, Math.min(3600, parseInt(tvTimerMaxInput.value)   || TV_TIMER_DEFAULTS.timerMaxSec));
        // Đảm bảo max >= min
        const validMaxSec  = Math.max(timerMinSec, timerMaxSec);

        // Ghi lại giá trị đã validate vào input (phòng trường hợp người dùng nhập sai)
        tvAutoCloseInput.value  = autoCloseMs;
        tvTimerMinInput.value   = timerMinSec;
        tvTimerMaxInput.value   = validMaxSec;

        const tvTimerSettings = { autoCloseMs, timerMinSec, timerMaxSec: validMaxSec };

        chrome.storage.local.set({
            [SETTINGS_KEY]: currentSettings,
            [FB_KEYWORDS_KEY]: fbKeywordsTextarea.value,
            [WEBSITE_BLOCKLIST_KEY]: websiteBlocklistTextarea.value,
            [TV_TIMER_KEY]: tvTimerSettings,
        }, () => {
            refreshBadges(currentSettings);
            showSaved();
        });
    }

    // === LOAD ===
    function loadSettings() {
        chrome.storage.local.get([SETTINGS_KEY, FB_KEYWORDS_KEY, WEBSITE_BLOCKLIST_KEY, TV_TIMER_KEY], (data) => {
            const settings = { ...DEFAULT_SETTINGS, enableWebsiteBlocker: true, ...(data[SETTINGS_KEY] || {}) };

            for (const key in switches) {
                if (switches[key] && settings[key] !== undefined) {
                    switches[key].checked = settings[key];
                }
            }

            fbKeywordsTextarea.value       = data[FB_KEYWORDS_KEY]       ?? FB_KEYWORDS_DEFAULT;
            websiteBlocklistTextarea.value = data[WEBSITE_BLOCKLIST_KEY] ?? WEBSITE_BLOCKLIST_DEFAULT;

            // Load TV timer settings
            const tv = { ...TV_TIMER_DEFAULTS, ...(data[TV_TIMER_KEY] || {}) };
            tvAutoCloseInput.value = tv.autoCloseMs;
            tvTimerMinInput.value  = tv.timerMinSec;
            tvTimerMaxInput.value  = tv.timerMaxSec;

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

    // TV number inputs — debounce 800ms (người dùng đang gõ số)
    const onNumberInput = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(saveSettings, 800);
    };
    tvAutoCloseInput.addEventListener('input', onNumberInput);
    tvTimerMinInput.addEventListener('input',  onNumberInput);
    tvTimerMaxInput.addEventListener('input',  onNumberInput);
});