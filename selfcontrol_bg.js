// selfcontrol_bg.js
// Module kiểm tra SelfControl ở background service worker

const SC_SETTINGS_KEY = 'scCheckerSettings';

const SC_DEFAULTS = {
    scEnable: false,
    scSiteList: 'facebook.com\nyoutube.com\nvnexpress.net',
};

// Trạng thái runtime (không persist)
let scCheckTimer = null;
let scOverlayActive = false;

// ============================================================
// Kiểm tra 1 site: fetch với cache-bust để tránh DNS/HTTP cache
//   - SelfControl chặn ở hosts/DNS → fail gần như tức thì
//   - Site accessible → có response trong vòng 3s
// ============================================================
async function checkOneSite(hostname) {
    // Thêm timestamp + random để bypass mọi HTTP cache
    const bust = `_sc=${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const url = `https://${hostname}/?${bust}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

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
    } catch (e) {
        clearTimeout(timeoutId);
        return { hostname, blocked: true };
    }
}

async function runCheck() {
    const data = await chrome.storage.local.get(SC_SETTINGS_KEY);
    const settings = { ...SC_DEFAULTS, ...(data[SC_SETTINGS_KEY] || {}) };

    if (!settings.scEnable) {
        hideOverlayAllTabs();
        return;
    }

    const sites = settings.scSiteList
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('#'));

    if (sites.length === 0) {
        hideOverlayAllTabs();
        return;
    }

    console.log('[SC Checker] Đang kiểm tra:', sites);

    const results = await Promise.all(sites.map(checkOneSite));
    const unblockedSites = results.filter(r => !r.blocked).map(r => r.hostname);

    console.log('[SC Checker] Kết quả:', results);

    if (unblockedSites.length > 0) {
        scOverlayActive = true;
        showOverlayAllTabs(unblockedSites);
    } else {
        scOverlayActive = false;
        hideOverlayAllTabs();
    }
}

async function showOverlayAllTabs(unblockedSites) {
    const tabs = await chrome.tabs.query({});
    const SKIP = ['chrome://', 'chrome-extension://', 'about:', 'data:', 'edge://'];
    for (const tab of tabs) {
        if (!tab.url || SKIP.some(p => tab.url.startsWith(p))) continue;
        try {
            await chrome.tabs.sendMessage(tab.id, {
                action: 'scShowOverlay',
                unblockedSites,
            });
        } catch (_) {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['selfcontrol_checker.js'],
                });
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'scShowOverlay',
                    unblockedSites,
                });
            } catch (__) { }
        }
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

async function handleNewTab(tabId, tabUrl) {
    if (!scOverlayActive) return;

    const data = await chrome.storage.local.get(SC_SETTINGS_KEY);
    const settings = { ...SC_DEFAULTS, ...(data[SC_SETTINGS_KEY] || {}) };
    if (!settings.scEnable) return;

    const SKIP = ['chrome://', 'chrome-extension://', 'about:', 'data:', 'edge://'];
    if (SKIP.some(p => tabUrl.startsWith(p))) return;

    const sites = settings.scSiteList
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('#'));

    const results = await Promise.all(sites.map(checkOneSite));
    const unblockedSites = results.filter(r => !r.blocked).map(r => r.hostname);

    if (unblockedSites.length === 0) {
        scOverlayActive = false;
        return;
    }

    try {
        await chrome.tabs.sendMessage(tabId, { action: 'scShowOverlay', unblockedSites });
    } catch (_) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['selfcontrol_checker.js'],
            });
            await chrome.tabs.sendMessage(tabId, { action: 'scShowOverlay', unblockedSites });
        } catch (__) { }
    }
}

export function initSCChecker() {
    runCheck();

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes[SC_SETTINGS_KEY]) {
            runCheck();
        }
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete' && tab.url) {
            handleNewTab(tabId, tab.url);
        }
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'scCheckNow') {
            runCheck();
            sendResponse({ received: true });
            return true;
        }
    });
}