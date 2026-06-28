// selfcontrol_bg.js
// Module kiểm tra SelfControl ở background service worker

const SC_SETTINGS_KEY = 'scCheckerSettings';
const SC_STATE_KEY    = 'scCheckerState'; // persist qua service worker restart
const SC_ALARM_NAME   = 'sc_periodic_check';
const SC_ALARM_PERIOD = 1; // phút — check định kỳ mỗi 1 phút

const SC_DEFAULTS = {
    scEnable: false,
    scSiteList: 'facebook.com\nyoutube.com\nvnexpress.net',
};

// ============================================================
// Helpers persist state (tránh mất khi SW bị kill)
// ============================================================
async function getOverlayActive() {
    const data = await chrome.storage.local.get(SC_STATE_KEY);
    return !!(data[SC_STATE_KEY]?.overlayActive);
}

async function setOverlayActive(val) {
    await chrome.storage.local.set({ [SC_STATE_KEY]: { overlayActive: val } });
}

// ============================================================
// Kiểm tra 1 site — cache-bust để bypass DNS/HTTP cache
// ============================================================
async function checkOneSite(hostname) {
    const bust = `_sc=${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const url  = `https://${hostname}/?${bust}`;

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 3000);

    try {
        await fetch(url, {
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-store',
            credentials: 'omit',
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return { hostname, blocked: false };
    } catch (_) {
        clearTimeout(timeoutId);
        return { hostname, blocked: true };
    }
}

// ============================================================
// Chạy kiểm tra toàn bộ danh sách
// ============================================================
async function runCheck() {
    const data     = await chrome.storage.local.get(SC_SETTINGS_KEY);
    const settings = { ...SC_DEFAULTS, ...(data[SC_SETTINGS_KEY] || {}) };

    if (!settings.scEnable) {
        await setOverlayActive(false);
        hideOverlayAllTabs();
        stopAlarm();
        return;
    }

    const sites = settings.scSiteList
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('#'));

    if (sites.length === 0) {
        await setOverlayActive(false);
        hideOverlayAllTabs();
        return;
    }

    const results       = await Promise.all(sites.map(checkOneSite));
    const unblockedSites = results.filter(r => !r.blocked).map(r => r.hostname);

    if (unblockedSites.length > 0) {
        // Còn site chưa bị chặn → hiện overlay
        await setOverlayActive(true);
        showOverlayAllTabs(unblockedSites);
    } else {
        // Tất cả đã bị chặn → ẩn overlay
        await setOverlayActive(false);
        hideOverlayAllTabs();
    }
}

// ============================================================
// Alarm định kỳ
// ============================================================
function startAlarm() {
    chrome.alarms.get(SC_ALARM_NAME, (existing) => {
        if (!existing) {
            chrome.alarms.create(SC_ALARM_NAME, { periodInMinutes: SC_ALARM_PERIOD });
        }
    });
}

function stopAlarm() {
    chrome.alarms.clear(SC_ALARM_NAME);
}

// ============================================================
// Gửi overlay đến tất cả tab
// ============================================================
async function showOverlayAllTabs(unblockedSites) {
    const tabs = await chrome.tabs.query({});
    const SKIP = ['chrome://', 'chrome-extension://', 'about:', 'data:', 'edge://'];
    for (const tab of tabs) {
        if (!tab.url || SKIP.some(p => tab.url.startsWith(p))) continue;
        await sendOrInject(tab.id, { action: 'scShowOverlay', unblockedSites });
    }
}

async function hideOverlayAllTabs() {
    const tabs = await chrome.tabs.query({});
    const SKIP = ['chrome://', 'chrome-extension://', 'about:', 'data:', 'edge://'];
    for (const tab of tabs) {
        if (!tab.url || SKIP.some(p => tab.url.startsWith(p))) continue;
        try {
            await chrome.tabs.sendMessage(tab.id, { action: 'scHideOverlay' });
        } catch (_) { }
    }
}

async function sendOrInject(tabId, message) {
    try {
        await chrome.tabs.sendMessage(tabId, message);
    } catch (_) {
        try {
            await chrome.scripting.executeScript({ target: { tabId }, files: ['selfcontrol_checker.js'] });
            await chrome.tabs.sendMessage(tabId, message);
        } catch (__) { }
    }
}

// ============================================================
// Xử lý tab mới mở
// ============================================================
async function handleNewTab(tabId, tabUrl) {
    const SKIP = ['chrome://', 'chrome-extension://', 'about:', 'data:', 'edge://'];
    if (SKIP.some(p => tabUrl.startsWith(p))) return;

    // Đọc state persist (không dùng biến runtime để tránh bị reset)
    const overlayActive = await getOverlayActive();
    if (!overlayActive) return;

    // Khi tab mới mở và overlay đang active → check lại luôn cho chính xác
    const data     = await chrome.storage.local.get(SC_SETTINGS_KEY);
    const settings = { ...SC_DEFAULTS, ...(data[SC_SETTINGS_KEY] || {}) };
    if (!settings.scEnable) return;

    const sites = settings.scSiteList
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('#'));

    const results        = await Promise.all(sites.map(checkOneSite));
    const unblockedSites = results.filter(r => !r.blocked).map(r => r.hostname);

    if (unblockedSites.length === 0) {
        await setOverlayActive(false);
        return;
    }

    await sendOrInject(tabId, { action: 'scShowOverlay', unblockedSites });
}

// ============================================================
// Export: khởi động module — gọi 1 lần từ background.js
// ============================================================
export function initSCChecker() {
    // Check ngay khi SW khởi động (kể cả khi bị kill rồi restart)
    runCheck().then(() => {
        // Chỉ bật alarm nếu feature đang enabled
        chrome.storage.local.get(SC_SETTINGS_KEY, (data) => {
            const settings = { ...SC_DEFAULTS, ...(data[SC_SETTINGS_KEY] || {}) };
            if (settings.scEnable) startAlarm();
        });
    });

    // Alarm định kỳ → trigger runCheck
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === SC_ALARM_NAME) {
            runCheck();
        }
    });

    // Settings thay đổi → check lại + bật/tắt alarm
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes[SC_SETTINGS_KEY]) {
            const newSettings = changes[SC_SETTINGS_KEY].newValue || {};
            if (newSettings.scEnable) {
                startAlarm();
            } else {
                stopAlarm();
            }
            runCheck();
        }
    });

    // Tab mới load xong
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete' && tab.url) {
            handleNewTab(tabId, tab.url);
        }
    });

    // Message từ content script (người dùng bấm "kiểm tra lại")
    // KHÔNG return true toàn cục — chỉ xử lý đúng action của mình
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'scCheckNow') {
            runCheck().then(() => sendResponse({ received: true }));
            return true; // giữ channel async — chỉ với action này
        }
        // Trả về false/undefined cho các action khác để không block listener khác
    });
}