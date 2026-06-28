import { initSCChecker } from './selfcontrol_bg.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.remove([
    'neoTasks', 'neoPhase', 'neoCurrentTask',
    'neoWorkEndsAt', 'neoBreakEndsAt', 'neoAnchorTabId', 'neoPipWindowId',
    'neoShutdownTime',
  ]);
  chrome.alarms.clear('neo-work-end');
  chrome.alarms.clear('neo-break-end');
  chrome.storage.sync.clear();
});

const SETTINGS_KEY = 'LapsExtensionSettings';
const DEFAULT_SETTINGS = {
  tvEnableAutoPopup: true,
  toeicEnableAutoPopup: false,
};

// ── Helper dùng chung ────────────────────────────────────────────

// Theo dõi cửa sổ popup đang mở (lưu winId vào storage để sống sót qua các lần
// service worker bị Chrome ngủ/đánh thức — không thể dựa vào biến trong RAM).
const _POPUP_WIN_KEY = (key) => `popup_win_${key}`;

async function _setPopupWin(key, winId)  { await chrome.storage.local.set({ [_POPUP_WIN_KEY(key)]: winId }); }
async function _clearPopupWin(key)       { await chrome.storage.local.remove(_POPUP_WIN_KEY(key)); }

// Popup của feature `key` có đang mở không? Xác minh thật bằng chrome.windows.get
async function _hasOpenPopup(key) {
    const data  = await chrome.storage.local.get([_POPUP_WIN_KEY(key)]);
    const winId = data[_POPUP_WIN_KEY(key)];
    if (winId == null) return false;
    try {
        await chrome.windows.get(winId);   // còn tồn tại → đang mở
        return true;
    } catch {
        await _clearPopupWin(key);          // id cũ đã đóng → dọn rác
        return false;
    }
}

// Chỉ đặt alarm nếu chưa có (tránh tạo alarm thừa mỗi lần SW thức dậy).
// Trả về true nếu alarm đã tồn tại sẵn.
async function _ensureAlarm(alarmName, scheduleFn) {
    const existing = await chrome.alarms.get(alarmName);
    if (!existing) scheduleFn();
    return !!existing;
}

// Mở popup window căn giữa màn hình tham chiếu.
// opts.popupKey: nếu có, lưu winId để chống mở popup chồng nhau.
function _openPopupWindow(url, opts = {}) {
    return new Promise((resolve) => {
        chrome.windows.getAll({ windowTypes: ['normal'] }, (windows) => {
            const focused = windows.find(w => w.focused);
            const largest = windows.reduce((a, b) => (b.width > a.width ? b : a), windows[0] || {});
            const ref     = focused || largest || { width: 1440, height: 900, left: 0, top: 0 };
            const screenW = ref.width  || 1440;
            const screenH = ref.height || 900;
            const w    = opts.w ?? Math.round(screenW * 2 / 3);
            const h    = opts.fullHeight ? screenH : (opts.h ?? Math.round(screenH / 2));
            const left = (ref.left || 0) + Math.round((screenW - w) / 2);
            const top  = opts.fullHeight ? (ref.top || 0) : ((ref.top || 0) + Math.round((screenH - h) / 2));
            chrome.windows.create({ url, type: 'popup', width: w, height: h, left, top },
                (win) => {
                    const id = win?.id ?? null;
                    if (id != null && opts.popupKey) {
                        chrome.storage.local.set({ [_POPUP_WIN_KEY(opts.popupKey)]: id });
                    }
                    resolve(id);
                });
        });
    });
}

// Kiểm tra setting bật/tắt
async function _isEnabled(key) {
    const data = await chrome.storage.local.get([SETTINGS_KEY]);
    return !!(data[SETTINGS_KEY]?.[key]);
}

// Schedule alarm với delay ngẫu nhiên trong khoảng [min, max]
async function _scheduleAlarm(alarmName, timerKey, defaults) {
    const data = await chrome.storage.local.get([timerKey]);
    const tv   = { ...defaults, ...(data[timerKey] || {}) };
    const delaySec = tv.timerMinSec + Math.random() * (tv.timerMaxSec - tv.timerMinSec);
    chrome.alarms.create(alarmName, { delayInMinutes: delaySec / 60 });
}

// ── TỪ VỰNG ──────────────────────────────────────────────────────
const TV_STORAGE_KEY = 'tuvung_list';
const TV_PENDING_KEY = 'tuvung_pending';
const TV_TIMER_KEY   = 'tvTimerSettings';
const TV_ALARM_NAME  = 'tuvung_random_popup';
const TV_TIMER_DEFS  = { timerMinSec: 300, timerMaxSec: 600 };

async function showTuvungPopup(source = 'auto') {
    const data = await chrome.storage.local.get([TV_STORAGE_KEY]);
    const list = (data[TV_STORAGE_KEY] || []).filter(e => e.isActive !== false);
    if (!list.length) {return null; }
    const entry = list[Math.floor(Math.random() * list.length)];
    await chrome.storage.local.set({ [TV_PENDING_KEY]: entry });
    return _openPopupWindow(chrome.runtime.getURL(`tuvung.html?mode=popup&source=${source}`),
        { popupKey: 'tv' });
}

const scheduleTvAlarm    = () => _scheduleAlarm(TV_ALARM_NAME, TV_TIMER_KEY, TV_TIMER_DEFS);
const _isTvEnabled       = () => _isEnabled('tvEnableAutoPopup');

// ── TOEIC ─────────────────────────────────────────────────────────
const TOEIC_PENDING_KEY = 'toeic_pending_question';
const TOEIC_TIMER_KEY   = 'toeicTimerSettings';
const TOEIC_ALARM_NAME  = 'toeic_random_popup';
const TOEIC_TIMER_DEFS  = { timerMinSec: 10, timerMaxSec: 60 };

// ── IndexedDB: đọc câu hỏi TOEIC (cùng DB với toeic.js) ──────────
const TOEIC_DB_NAME    = 'toeic_db';
const TOEIC_DB_VERSION = 1;
const TOEIC_STORE      = 'questions';

function _openToeicDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(TOEIC_DB_NAME, TOEIC_DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(TOEIC_STORE)) {
                db.createObjectStore(TOEIC_STORE, { keyPath: '_id', autoIncrement: true });
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror   = (e) => reject(e.target.error);
    });
}

async function _toeicGetAll() {
    const db = await _openToeicDB();
    return new Promise((resolve, reject) => {
        const req = db.transaction(TOEIC_STORE, 'readonly').objectStore(TOEIC_STORE).getAll();
        req.onsuccess = (e) => resolve(e.target.result || []);
        req.onerror   = (e) => reject(e.target.error);
    });
}

async function showToeicPopup(source = 'auto') {
    const list = await _toeicGetAll();   // ← đọc IndexedDB thay vì chrome.storage.local
    if (!list.length) {return null; }

    const partsData = await chrome.storage.local.get(['toeicPopupParts']);
    const parts = partsData.toeicPopupParts;
    const pool  = (Array.isArray(parts) && parts.length)
        ? list.filter(q => parts.includes(String(q.part || '').trim()))
        : list;
    const safePool = pool.length ? pool : list;   // ← lọc Part ra rỗng thì fallback toàn bộ
    const q = safePool[Math.floor(Math.random() * safePool.length)];
    await chrome.storage.local.set({ [TOEIC_PENDING_KEY]: q });

    return _openPopupWindow(chrome.runtime.getURL(`toeic.html?mode=popup&source=${source}`),
        { fullHeight: true, popupKey: 'toeic' }); // TOEIC dùng full height
}

const scheduleToeicAlarm = () => _scheduleAlarm(TOEIC_ALARM_NAME, TOEIC_TIMER_KEY, TOEIC_TIMER_DEFS);
const _isToeicEnabled    = () => _isEnabled('toeicEnableAutoPopup');

// ── Khởi động ─────────────────────────────────────────────────────
chrome.storage.local.get(SETTINGS_KEY, async (data) => {
    const settings = { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };
    if (settings.tvEnableAutoPopup) {
        const had = await _ensureAlarm(TV_ALARM_NAME, scheduleTvAlarm);
    }
    if (settings.toeicEnableAutoPopup) {
        const had = await _ensureAlarm(TOEIC_ALARM_NAME, scheduleToeicAlarm);
    }
});

// ── Lắng nghe thay đổi settings ──────────────────────────────────
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes[SETTINGS_KEY]) {
        const newS = changes[SETTINGS_KEY].newValue;
        const oldS = changes[SETTINGS_KEY].oldValue;
        if (!newS || !oldS) return;

        if (newS.tvEnableAutoPopup && !oldS.tvEnableAutoPopup)    { scheduleTvAlarm();}
        else if (!newS.tvEnableAutoPopup && oldS.tvEnableAutoPopup) { chrome.alarms.clear(TV_ALARM_NAME);}

        if (newS.toeicEnableAutoPopup && !oldS.toeicEnableAutoPopup)    { scheduleToeicAlarm();}
        else if (!newS.toeicEnableAutoPopup && oldS.toeicEnableAutoPopup) { chrome.alarms.clear(TOEIC_ALARM_NAME);}
    }
});

// ── Alarm listener ────────────────────────────────────────────────
// Xử lý alarm chung: nếu popup cũ còn mở thì bỏ qua (hẹn lại); ngược lại
// show popup → chờ đóng → schedule tiếp (đếm khoảng cách TỪ LÚC ĐÓNG).
async function _handleAlarm(isEnabledFn, showFn, scheduleFn, popupKey) {
    if (!(await isEnabledFn())) return;

    // Popup trước còn mở → không mở chồng, chỉ hẹn lại lần sau
    if (await _hasOpenPopup(popupKey)) {
        if (await isEnabledFn()) scheduleFn();
        return;
    }

    const winId = await showFn();   // showFn đã tự lưu winId qua popupKey
    if (winId) {
        const onRemoved = async (id) => {
            if (id !== winId) return;
            chrome.windows.onRemoved.removeListener(onRemoved);
            await _clearPopupWin(popupKey);
            if (await isEnabledFn()) scheduleFn();
        };
        chrome.windows.onRemoved.addListener(onRemoved);
    } else {
        if (await isEnabledFn()) scheduleFn();
    }
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === TV_ALARM_NAME)    _handleAlarm(_isTvEnabled,    showTuvungPopup, scheduleTvAlarm,    'TV');
    if (alarm.name === TOEIC_ALARM_NAME) _handleAlarm(_isToeicEnabled, showToeicPopup,  scheduleToeicAlarm, 'TOEIC');
    if (alarm.name === 'standup-sitting') handleStandupAlarm();
    if (alarm.name === 'neo-work-end')  handleNeoAlarm('neo-work-end');
    if (alarm.name === 'neo-break-end') handleNeoAlarm('neo-break-end');
});

async function handleNeoAlarm(type) {
    const { neoAnchorTabId } = await chrome.storage.local.get('neoAnchorTabId');
    if (neoAnchorTabId) {
        chrome.tabs.sendMessage(neoAnchorTabId, { type }).catch(() => {});
    }
}

async function handleStandupAlarm() {
    chrome.notifications.create('standup-alert', {
        type: 'basic',
        iconUrl: 'image/icon.png',
        title: 'Đứng dậy đi!',
        message: 'Bạn đã ngồi quá lâu rồi. Di chuyển một chút nhé.',
        priority: 2,
        requireInteraction: true,
    });
    // Báo cho standup tab cập nhật UI
    const { standupTabId } = await chrome.storage.local.get('standupTabId');
    if (standupTabId) {
        chrome.tabs.sendMessage(standupTabId, { type: 'standup-alert' }).catch(() => {});
    }
}

async function openOrFocusStandupTab() {
    const { standupTabId } = await chrome.storage.local.get('standupTabId');
    let opened = false;
    if (standupTabId) {
        const tab = await chrome.tabs.get(standupTabId).catch(() => null);
        if (tab) {
            chrome.windows.update(tab.windowId, { focused: true });
            chrome.tabs.update(standupTabId, { active: true });
            opened = true;
        }
    }
    if (!opened) {
        const tab = await chrome.tabs.create({ url: chrome.runtime.getURL('neo_anchor.html') });
        chrome.storage.local.set({ standupTabId: tab.id });
    }
}

chrome.notifications.onClicked.addListener(async (id) => {
    if (id === 'standup-alert') {
        chrome.notifications.clear('standup-alert');
        openOrFocusStandupTab();
        return;
    }
    if (id === 'neo-work-done' || id === 'neo-break-done') {
        chrome.notifications.clear(id);
        const data = await chrome.storage.local.get('neoAnchorTabId');
        const tabId = data.neoAnchorTabId;
        if (!tabId) return;
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        if (tab) {
            chrome.windows.update(tab.windowId, { focused: true });
            chrome.tabs.update(tabId, { active: true });
        }
    }
});

chrome.notifications.onClosed.addListener((id, byUser) => {
    if (id !== 'standup-alert' || !byUser) return;
    openOrFocusStandupTab();
});

let cachedTokens = { at: null, bl: null, timestamp: 0 };
let vietgidoTabId = null;

const WATCHED_TABS_KEY = 'watchedNotebookTabs';

async function getWatchedTabs() {
    const r = await chrome.storage.session.get(WATCHED_TABS_KEY);
    return r[WATCHED_TABS_KEY] || {};
}
async function setWatchedTabs(map) {
    await chrome.storage.session.set({ [WATCHED_TABS_KEY]: map });
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    const watched = await getWatchedTabs();
    if (!watched[tabId]) return;
    const url = tab.url || '';
    if (url.startsWith('https://notebooklm.google.com/notebook/')) {
        watched[tabId].seenNotebookAt = Date.now();
        await setWatchedTabs(watched);
    } else if (url === 'https://notebooklm.google.com/' || url === 'https://notebooklm.google.com') {
        const entry = watched[tabId];
        delete watched[tabId];
        await setWatchedTabs(watched);
        // Nếu notebook đã load > 5 giây trước → user tự navigate, không phải redirect tự động
        if (entry.seenNotebookAt && Date.now() - entry.seenNotebookAt > 5000) return;
        handleNotebookFlow(entry.sourceUrl, true)
            .then(newNotebookId => {
                const newUrl = `https://notebooklm.google.com/notebook/${newNotebookId}`;
                chrome.tabs.update(tabId, { url: newUrl });
                chrome.storage.local.set({ notebookRecreated: { sourceUrl: entry.sourceUrl, newNotebookId, ts: Date.now() } });
            })
            .catch(() => {});
    }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
    const watched = await getWatchedTabs();
    if (!watched[tabId]) return;
    delete watched[tabId];
    await setWatchedTabs(watched);
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "open_command_hub") {
    const width = 600; const height = 400;
    chrome.windows.getLastFocused((lastWindow) => {
      const left = lastWindow.left + Math.round((lastWindow.width - width) / 2);
      const top  = lastWindow.top  + Math.round((lastWindow.height - height) / 2);
      chrome.windows.create({ url: chrome.runtime.getURL('hub.html'), type: 'popup', width, height, left, top, focused: true });
    });
  }
  if (command === "open_option")         { chrome.tabs.create({ url: chrome.runtime.getURL("options.html") }); return; }
  if (command === "open-extensions-page") { chrome.tabs.create({ url: 'chrome://extensions/' }); return; }
  if (command === "open_media_hub") {
    chrome.windows.create({ url: chrome.runtime.getURL("media_hub.html"), type: 'popup', width: 630, height: 600 });
    return;
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (request.type === 'neo-notify') {
        chrome.notifications.create(request.id, {
            type: 'basic', iconUrl: 'image/icon.png',
            title: request.title, message: request.message, priority: 2,
        });
        return;
    }

    // ── Popup bất kỳ từ Hub (tránh gọi chrome.windows từ hub context) ──
    if (request.action === "showTuvungPopup") {
        showTuvungPopup('manual')
            .then(() => sendResponse({ ok: true }))
            .catch(err => sendResponse({ ok: false, error: err.message }));
        return true;
    }

    if (request.action === "showTuvungPopupEntry") {
        // Pending đã được set từ tuvung.js; chỉ cần mở cửa sổ
        _openPopupWindow(chrome.runtime.getURL('tuvung.html?mode=popup&source=manual'), { popupKey: 'tv' })
            .then(() => sendResponse({ ok: true }));
        return true;
    }

    if (request.action === "showToeicPopup") {
        showToeicPopup('manual')
            .then(() => sendResponse({ ok: true }))
            .catch(err => sendResponse({ ok: false, error: err.message }));
        return true;
    }

    if (request.action === "showToeicPopupEntry") {
        // Pending đã được set từ toeic.js; chỉ cần mở cửa sổ
        _openPopupWindow(chrome.runtime.getURL('toeic.html?mode=popup&source=entry'), { fullHeight: true, popupKey: 'toeic' })
            .then(() => sendResponse({ ok: true }));
        return true;
    }

    if (request.action === "open_notebook") {
        chrome.tabs.create({ url: request.notebookUrl }, async (tab) => {
            const watched = await getWatchedTabs();
            watched[tab.id] = { sourceUrl: request.sourceUrl, seenNotebook: false };
            await setWatchedTabs(watched);
        });
        return;
    }

    if (request.action === "create_notebook" || request.action === "create_notebook_from_youtube") {
        handleNotebookFlow(request.url)
            .then((notebookId) => {
                sendResponse({ success: true, notebookId });
            })
            .catch((err) => { sendResponse({ success: false, error: err.message }); });
        return true;
    }


    if (request.action === "openVietGidoTab" && request.data) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(request.data)) params.append(key, value);
        const url = chrome.runtime.getURL(`vietgido.html?${params.toString()}`);
        chrome.tabs.create({ url }, (tab) => { vietgidoTabId = tab.id; });
        sendResponse({ status: "success", openedUrl: url });
        return true;
    }

    if (request.action === "getMediaInfo") {
        chrome.tabs.query({}, async (tabs) => {
            const SKIPPED = ['chrome://', 'chrome-extension://', 'about:', 'data:'];
            async function queryTab(tab) {
                if (!tab.url || SKIPPED.some(p => tab.url.startsWith(p))) return null;
                const firstTry = await new Promise((resolve) => {
                    chrome.tabs.sendMessage(tab.id, { action: "getMediaState" }, (r) => {
                        if (chrome.runtime.lastError || !r) resolve(null); else resolve(r);
                    });
                });
                if (firstTry) return { ...firstTry, tabId: tab.id, tabTitle: tab.title, tabUrl: tab.url, favIconUrl: tab.favIconUrl };
                try {
                    const isSpotify = tab.url.includes('open.spotify.com');
                    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [isSpotify ? 'spotify_detector.js' : 'media_detector.js'] });
                } catch (e) { return null; }
                await new Promise(r => setTimeout(r, 1200));
                const secondTry = await new Promise((resolve) => {
                    chrome.tabs.sendMessage(tab.id, { action: "getMediaState" }, (r) => {
                        if (chrome.runtime.lastError || !r) resolve(null); else resolve(r);
                    });
                });
                return secondTry ? { ...secondTry, tabId: tab.id, tabTitle: tab.title, tabUrl: tab.url, favIconUrl: tab.favIconUrl } : null;
            }
            const mediaInfos = (await Promise.all(tabs.map(queryTab))).filter(i => i !== null && i.hasMedia);
            sendResponse({ mediaInfos });
        });
        return true;
    }

    if (request.action === "controlMedia") {
        const { tabId, command, value } = request;
        chrome.tabs.sendMessage(tabId, { action: "mediaControl", command, value }, (r) => sendResponse(r || { success: false }));
        return true;
    }

    if (request.action === "focusTab") {
        chrome.tabs.get(request.tabId, (tab) => {
            if (chrome.runtime.lastError || !tab) {
                sendResponse({ success: false, error: chrome.runtime.lastError?.message });
                return;
            }
            // Đưa cửa sổ chứa tab lên trước...
            chrome.windows.update(tab.windowId, { focused: true }, () => {
                // ...rồi chọn đúng tab trong cửa sổ đó
                chrome.tabs.update(request.tabId, { active: true }, () => {
                    sendResponse({ success: true });
                });
            });
        });
        return true;
    }

    if (request.action === "tvTimerUpdated") {
        request.enabled ? scheduleTvAlarm() : chrome.alarms.clear(TV_ALARM_NAME);
        sendResponse({ ok: true }); return true;
    }

    if (request.action === "toeicTimerUpdated") {
        request.enabled ? scheduleToeicAlarm() : chrome.alarms.clear(TOEIC_ALARM_NAME);
        sendResponse({ ok: true }); return true;
    }

    return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.includes("notebooklm.google.com/notebook/")) {
        if (vietgidoTabId) {
            chrome.tabs.sendMessage(vietgidoTabId, { action: "autofillNotebookLink", notebookUrl: tab.url })
                .catch(() => { vietgidoTabId = null; });
        }

    }
});

// ── NotebookLM ────────────────────────────────────────────────────
async function handleNotebookFlow(targetUrl, awaitSource = false) {
    const tokens = await getFreshGoogleTokens();
    const newId  = await buoc1_TaoSoTay(tokens);
    if (awaitSource) await buoc2_ThemNguon(newId, targetUrl, tokens);
    else buoc2_ThemNguon(newId, targetUrl, tokens);
    return newId;
}

async function buoc1_TaoSoTay(tokens) {
    console.log("[buoc1] tokens:", { at: tokens.at?.slice(0,10)+'...', bl: tokens.bl?.slice(0,10)+'...' });
    const apiUrl = `https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute?rpcids=CCqFvf&source-path=%2F&bl=${tokens.bl}&hl=vi&_reqid=${Math.floor(Math.random()*999999)}&rt=c`;
    const response = await fetch(apiUrl, {
        headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8", "x-same-domain": "1" },
        body: `f.req=%5B%5B%5B%22CCqFvf%22%2C%22%5B%5C%22%5C%22%2Cnull%2Cnull%2C%5B2%5D%2C%5B1%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B1%5D%5D%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&at=${tokens.at}&`,
        method: "POST"
    });
    const text  = await response.text();
    const match = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    if (match) return match[0];
    throw new Error("Không tạo được sổ tay. Có thể đã đạt giới hạn số lượng — hãy xoá bớt sổ cũ trên NotebookLM rồi thử lại.");
}

async function buoc2_ThemNguon(notebookId, url, tokens) {
    const apiUrl = `https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute?rpcids=izAoDd&source-path=%2Fnotebook%2F${notebookId}&bl=${tokens.bl}&hl=vi&_reqid=${Math.floor(Math.random()*999999)}&rt=c`;

    const isYoutube = url.includes('youtu.be') || url.includes('youtube.com');

    let innerPayload;
    if (isYoutube) {
        // YouTube: URL ở index 7, options tách 2 phần tử riêng
        const sourceArr = [null, null, null, null, null, null, null, [url], null, null, 1];
        innerPayload = [[sourceArr], notebookId, [2], [1, null, null, null, null, null, null, null, null, null, [1]]];
    } else {
        // Web URL: URL ở index 2, options gộp vào 1 phần tử
        const sourceArr = [null, null, [url], null, null, null, null, null, null, null, 1];
        innerPayload = [[sourceArr], notebookId, [2, null, null, [1, null, null, null, null, null, null, null, null, null, [1]]]];
    }

    const outerPayload = [[["izAoDd", JSON.stringify(innerPayload), null, "generic"]]];
    const reqBody = `f.req=${encodeURIComponent(JSON.stringify(outerPayload))}&at=${tokens.at}&`;

    const response = await fetch(apiUrl, {
        headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8", "x-same-domain": "1", "x-goog-ext-353267353-jspb": "[null,null,null,276544]" },
        body: reqBody, method: "POST"
    });
    if (!response.ok) throw new Error("API thêm nguồn thất bại: " + response.status);
}

async function getFreshGoogleTokens() {
    if (cachedTokens.at && (Date.now() - cachedTokens.timestamp < 10 * 60 * 1000)) {
        return cachedTokens;
    }
    try {
        const html     = await (await fetch("https://notebooklm.google.com/")).text();
        const atMatch  = html.match(/"SNlM0e":"([^"]+)"/);
        const blMatch  = html.match(/"cfb2h":"([^"]+)"/);
        if (!atMatch || !blMatch) throw new Error("Không tìm thấy token bảo mật.");
        cachedTokens = { at: atMatch[1], bl: blMatch[1], timestamp: Date.now() };
        return cachedTokens;
    } catch (e) {throw e; }
}

initSCChecker();