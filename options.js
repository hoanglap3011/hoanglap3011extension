document.addEventListener('DOMContentLoaded', () => {

    // Defaults từ config.js
    const FB_KEYWORDS_DEFAULT       = DEFAULT_FB_KEYWORDS.join('\n');
    const WEBSITE_BLOCKLIST_DEFAULT = DEFAULT_WEBSITE_BLOCKLIST;

    // Storage keys cho SelfControl Checker
    const SC_SETTINGS_KEY = 'scCheckerSettings';
    const SC_DEFAULTS = {
        scEnable: false,
        scSiteList: 'facebook.com\nyoutube.com\nvnexpress.net',
    };

    // === SWITCHES ===
    const switches = {
        // Facebook
        fbEnableSummarize:         document.getElementById('fbEnableSummarize'),
        fbEnableBlockByKeyword:    document.getElementById('fbEnableBlockByKeyword'),
        fbEnableHideStories:       document.getElementById('fbEnableHideStories'),
        // YouTube
        ytEnableHomepageHider:     document.getElementById('ytEnableHomepageHider'),
        ytEnableHideRelated:       document.getElementById('ytEnableHideRelated'),
        // Box tóm tắt toàn cầu
        sbEnable: document.getElementById('sbEnable'),
        // SelfControl Checker
        scEnable: document.getElementById('scEnable'),
    };

    const scSiteListTextarea       = document.getElementById('scSiteList');
    const summarySitesTextarea     = document.getElementById('summarySitesList');
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
            const state = data[COLLAPSE_KEY] || {};
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

    function refreshBadges(settings, scSettings) {
        // Website blocker: luôn bật
        updateBadge('badge-blocker', true);
        // Facebook: bật nếu ít nhất 1 tính năng FB đang bật
        const fbOn = settings.fbEnableSummarize || settings.fbEnableBlockByKeyword || settings.fbEnableHideStories;
        updateBadge('badge-facebook', fbOn);
        // YouTube: bật nếu ít nhất 1 tính năng YT đang bật
        const ytOn = settings.ytEnableHomepageHider || settings.ytEnableHideRelated;
        updateBadge('badge-youtube', ytOn);
        // Box Tóm Tắt Toàn Cầu
        updateBadge('badge-summary-box', settings.sbEnable ?? false);
        // SelfControl Checker
        updateBadge('badge-sc-checker', scSettings ? (scSettings.scEnable ?? false) : false);
    }

    // === VISIBILITY helpers ===
    function updateKeywordSectionVisibility() {
        fbKeywordSection.classList.toggle('hidden', !switches.fbEnableBlockByKeyword.checked);
    }

    function updateSummarySitesState() {
        summarySitesTextarea.disabled = !switches.sbEnable.checked;
        summarySitesTextarea.style.opacity = switches.sbEnable.checked ? '' : '0.4';
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
            if (key === 'scEnable') continue;
            if (switches[key]) currentSettings[key] = switches[key].checked;
        }

        const scSettings = {
            scEnable: switches.scEnable ? switches.scEnable.checked : false,
            scSiteList: scSiteListTextarea.value,
        };

        chrome.storage.local.set({
            [SETTINGS_KEY]: currentSettings,
            [FB_KEYWORDS_KEY]: fbKeywordsTextarea.value,
            [WEBSITE_BLOCKLIST_KEY]: websiteBlocklistTextarea.value,
            [SUMMARY_SITES_KEY]: summarySitesTextarea.value,
            [SC_SETTINGS_KEY]: scSettings,
        }, () => {
            refreshBadges(currentSettings, scSettings);
            showSaved();
        });
    }

    // === LOAD ===
    function loadSettings() {
        chrome.storage.local.get(
            [SETTINGS_KEY, FB_KEYWORDS_KEY, WEBSITE_BLOCKLIST_KEY, SUMMARY_SITES_KEY, SC_SETTINGS_KEY],
            (data) => {
                const settings = { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };

                for (const key in switches) {
                    if (key === 'scEnable') continue;
                    if (switches[key] && settings[key] !== undefined) {
                        switches[key].checked = settings[key];
                    }
                }

                fbKeywordsTextarea.value       = data[FB_KEYWORDS_KEY]       ?? FB_KEYWORDS_DEFAULT;
                websiteBlocklistTextarea.value = data[WEBSITE_BLOCKLIST_KEY] ?? WEBSITE_BLOCKLIST_DEFAULT;
                summarySitesTextarea.value     = data[SUMMARY_SITES_KEY]     ?? DEFAULT_SUMMARY_SITES;

                const sc = { ...SC_DEFAULTS, ...(data[SC_SETTINGS_KEY] || {}) };
                if (switches.scEnable) switches.scEnable.checked = sc.scEnable;
                scSiteListTextarea.value = sc.scSiteList;

                updateKeywordSectionVisibility();
                updateSummarySitesState();
                refreshBadges(settings, sc);
            }
        );
    }

    loadSettings();

    // === ĐỒNG BỘ DỮ LIỆU TÓM TẮT ===
    const btnSync   = document.getElementById('btn-sync-summary');
    const syncStatus = document.getElementById('sync-summary-status');

    if (btnSync) {
        btnSync.addEventListener('click', async () => {
            btnSync.disabled = true;
            btnSync.textContent = 'Đang đồng bộ...';
            syncStatus.textContent = '';
            try {
                const passResult = await new Promise(resolve => chrome.storage.local.get(CACHE_PASS, resolve));
                const pass = passResult[CACHE_PASS] || null;
                if (!pass) {
                    btnSync.disabled = false;
                    btnSync.textContent = 'Đồng bộ';
                    PasswordModule.openPasswordPopup(() => btnSync.click());
                    return;
                }
                const res = await fetch(API, {
                    method: 'POST',
                    body: JSON.stringify({ action: API_ACTION_GET_ALL_SUMMARY, pass })
                });
                const json = await res.json();
                if (json.code === 1) {
                    const data = typeof json.data === 'string' ? JSON.parse(json.data) : json.data;
                    await new Promise(resolve => chrome.storage.local.set({ [CACHE_SUMMARY_DATA]: data }, resolve));
                    const count = Object.keys(data).length;
                    syncStatus.textContent = `Đã đồng bộ ${count} mục.`;
                    syncStatus.style.color = '#2e7d32';
                } else {
                    syncStatus.textContent = 'Lỗi: ' + (json.message || 'Không xác định');
                    syncStatus.style.color = '#c62828';
                }
            } catch (e) {
                syncStatus.textContent = 'Lỗi kết nối: ' + e.message;
                syncStatus.style.color = '#c62828';
            } finally {
                btnSync.disabled = false;
                btnSync.textContent = 'Đồng bộ';
            }
        });
    }

    // === LISTENERS ===
    Object.values(switches).forEach(el => {
        if (el) el.addEventListener('change', saveSettings);
    });

    switches.fbEnableBlockByKeyword.addEventListener('change', updateKeywordSectionVisibility);
    switches.sbEnable.addEventListener('change', updateSummarySitesState);

    let debounceTimer;
    const onTextareaInput = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(saveSettings, 600);
    };
    fbKeywordsTextarea.addEventListener('input', onTextareaInput);
    websiteBlocklistTextarea.addEventListener('input', onTextareaInput);
    summarySitesTextarea.addEventListener('input', onTextareaInput);
    scSiteListTextarea.addEventListener('input', onTextareaInput);

});