import { TuVungModule } from './tuvung.js';
import { initSCChecker } from './selfcontrol_bg.js';

const SETTINGS_KEY = 'LapsExtensionSettings';
const DEFAULT_SETTINGS = {
  tvEnableAutoPopup: true,
  toeicEnableAutoPopup: false,
};

// ── TOEIC: tự xử lý trong background, không import toeic.js (UI module) ──
const TOEIC_STORAGE_KEY = 'toeic_questions';
const TOEIC_PENDING_KEY = 'toeic_pending_question';
const TOEIC_TIMER_KEY   = 'toeicTimerSettings';
const TOEIC_ALARM_NAME  = 'toeic_random_popup';

// Trả về Promise resolve(windowId) khi popup đã được tạo
function showToeicPopup(source = 'auto') {
    return new Promise(async (resolve) => {
        const data = await chrome.storage.local.get([TOEIC_STORAGE_KEY]);
        const list = data[TOEIC_STORAGE_KEY] || [];
        if (!list.length) { console.log('⚠️ [TOEIC] Chưa có dữ liệu câu hỏi.'); return resolve(null); }

        // Lọc theo parts nếu có cài đặt
        const partsData = await chrome.storage.local.get(['toeicPopupParts']);
        const selectedParts = Array.isArray(partsData.toeicPopupParts) && partsData.toeicPopupParts.length
            ? partsData.toeicPopupParts : null;
        const pool = selectedParts
            ? list.filter(q => selectedParts.includes(String(q.part || '').trim()))
            : list;
        const finalPool = pool.length ? pool : list;
        const q = finalPool[Math.floor(Math.random() * finalPool.length)];
        await chrome.storage.local.set({ [TOEIC_PENDING_KEY]: q });

        const url = chrome.runtime.getURL(`toeic.html?mode=popup&source=${source}`);

        // Lấy tất cả cửa sổ type "normal" để tránh lấy nhầm cửa sổ popup nhỏ
        chrome.windows.getAll({ windowTypes: ['normal'] }, (windows) => {
            // Ưu tiên cửa sổ đang focused, fallback về cửa sổ lớn nhất
            const focused = windows.find(w => w.focused);
            const largest = windows.reduce((a, b) => (b.width > a.width ? b : a), windows[0] || {});
            const ref = focused || largest || { width: 1440, height: 900, left: 0, top: 0 };

            const screenW = ref.width  || 1440;
            const screenH = ref.height || 900;
            const w    = Math.round(screenW * 2 / 3);
            const h    = screenH;
            const left = (ref.left || 0) + Math.round((screenW - w) / 2);
            const top  = ref.top || 0;
            chrome.windows.create({ url, type: 'popup', width: w, height: h, left, top }, (win) => {
                resolve(win?.id ?? null);
            });
        });
    });
}

async function scheduleToeicAlarm() {
    const data = await chrome.storage.local.get([TOEIC_TIMER_KEY]);
    const tv   = { timerMinSec: 10, timerMaxSec: 60, ...(data[TOEIC_TIMER_KEY] || {}) };
    const delaySec = tv.timerMinSec + Math.random() * (tv.timerMaxSec - tv.timerMinSec);
    chrome.alarms.create(TOEIC_ALARM_NAME, { delayInMinutes: delaySec / 60 });
    console.log(`⏱ [TOEIC] Alarm tiếp theo sau ${Math.round(delaySec)}s`);
}

// ── Khởi động ─────────────────────────────────────────────────────
chrome.storage.local.get(SETTINGS_KEY, (data) => {
    const settings = { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };
    if (settings.tvEnableAutoPopup)    TuVungModule.startRandomTimer();
    if (settings.toeicEnableAutoPopup) { scheduleToeicAlarm(); console.log('🚀 [Background] Đã bật timer TOEIC.'); }
});

// ── Lắng nghe thay đổi settings ──────────────────────────────────
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes[SETTINGS_KEY]) {
        const newS = changes[SETTINGS_KEY].newValue;
        const oldS = changes[SETTINGS_KEY].oldValue;
        if (!newS || !oldS) return;

        if (newS.tvEnableAutoPopup && !oldS.tvEnableAutoPopup)    { TuVungModule.startRandomTimer(); console.log('🚀 [Background] Bật timer từ vựng.'); }
        else if (!newS.tvEnableAutoPopup && oldS.tvEnableAutoPopup) { TuVungModule.stopRandomTimer();  console.log('🛑 [Background] Tắt timer từ vựng.'); }

        if (newS.toeicEnableAutoPopup && !oldS.toeicEnableAutoPopup)    { scheduleToeicAlarm(); console.log('🚀 [Background] Bật timer TOEIC.'); }
        else if (!newS.toeicEnableAutoPopup && oldS.toeicEnableAutoPopup) { chrome.alarms.clear(TOEIC_ALARM_NAME); console.log('🛑 [Background] Tắt timer TOEIC.'); }
    }
});

// ── Alarm listener ────────────────────────────────────────────────
// Helper: kiểm tra setting có còn bật không trước khi schedule
async function _isToeicEnabled() {
    const data = await chrome.storage.local.get([SETTINGS_KEY]);
    return !!(data[SETTINGS_KEY]?.toeicEnableAutoPopup);
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === TOEIC_ALARM_NAME) {
        console.log('⏰ [Background] TOEIC alarm fired');

        // Kiểm tra setting ngay tại thời điểm alarm fire
        if (!(await _isToeicEnabled())) {
            console.log('🛑 [TOEIC] Setting đã tắt, bỏ qua alarm.');
            return;
        }

        const winId = await showToeicPopup();

        if (winId) {
            // Chờ popup đóng rồi mới lên lịch — nhưng kiểm tra setting lại lần nữa
            const onRemoved = async (removedId) => {
                if (removedId === winId) {
                    chrome.windows.onRemoved.removeListener(onRemoved);
                    if (await _isToeicEnabled()) {
                        console.log('🚪 [TOEIC] Popup đã đóng, lên lịch alarm tiếp theo...');
                        scheduleToeicAlarm();
                    } else {
                        console.log('🛑 [TOEIC] Setting đã tắt khi popup đóng, không schedule tiếp.');
                    }
                }
            };
            chrome.windows.onRemoved.addListener(onRemoved);
        } else {
            // Không có data / lỗi tạo window — kiểm tra setting trước khi schedule
            if (await _isToeicEnabled()) await scheduleToeicAlarm();
        }
    }
});

let cachedTokens = { at: null, bl: null, timestamp: 0 };
let vietgidoTabId = null;
let shouldAutoRunAll = false;

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

    // ── Popup bất kỳ từ Hub (tránh gọi chrome.windows từ hub context) ──
    if (request.action === "showTuvungPopup") {
        TuVungModule.show()
            .then(() => sendResponse({ ok: true }))
            .catch(err => sendResponse({ ok: false, error: err.message }));
        return true;
    }

    if (request.action === "showToeicPopup") {
        showToeicPopup('manual')
            .then(() => sendResponse({ ok: true }))
            .catch(err => sendResponse({ ok: false, error: err.message }));
        return true;
    }

    if (request.action === "create_notebook_from_youtube") {
        console.log("[Background] Nhận yêu cầu tạo NotebookLM cho:", request.url);
        handleNotebookFlow(request.url)
            .then((notebookId) => {
                chrome.tabs.create({ url: `https://notebooklm.google.com/notebook/${notebookId}` });
                sendResponse({ success: true, notebookId });
            })
            .catch((err) => { console.error("[Background] Lỗi:", err); sendResponse({ success: false, error: err.message }); });
        return true;
    }

    if (request.action === "expectAutoFeatures") {
        shouldAutoRunAll = true;
        setTimeout(() => { shouldAutoRunAll = false; }, 60000);
        sendResponse({ received: true });
        return true;
    }

    if (request.action === "closeThisTab") {
        if (sender.tab?.id) chrome.tabs.remove(sender.tab.id);
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
        chrome.tabs.update(request.tabId, { active: true }, () => {
            chrome.windows.getCurrent((window) => chrome.windows.update(window.id, { focused: true }));
            sendResponse({ success: true });
        });
        return true;
    }

    if (request.action === "toeicTimerUpdated") {
        if (request.enabled) { scheduleToeicAlarm(); console.log('🚀 [Background] Bật timer TOEIC.'); }
        else { chrome.alarms.clear(TOEIC_ALARM_NAME); console.log('🛑 [Background] Tắt timer TOEIC.'); }
        sendResponse({ ok: true });
        return true;
    }

    return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.includes("notebooklm.google.com/notebook/")) {
        if (vietgidoTabId) {
            chrome.tabs.sendMessage(vietgidoTabId, { action: "autofillNotebookLink", notebookUrl: tab.url })
                .catch(() => { vietgidoTabId = null; });
        }
        if (shouldAutoRunAll) {
            chrome.tabs.sendMessage(tabId, { action: "activateAll" }, (response) => {
                if (chrome.runtime.lastError) setTimeout(() => chrome.tabs.sendMessage(tabId, { action: "activateAll" }), 1000);
            });
            shouldAutoRunAll = false;
        }
    }
});

// ── NotebookLM ────────────────────────────────────────────────────
async function handleNotebookFlow(targetUrl) {
    const tokens = await getFreshGoogleTokens();
    const newId  = await buoc1_TaoSoTay(tokens);
    await buoc2_ThemNguon(newId, targetUrl, tokens);
    return newId;
}

async function buoc1_TaoSoTay(tokens) {
    console.log("1️⃣ [Background] Đang tạo sổ tay mới...");
    const apiUrl = `https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute?rpcids=CCqFvf&source-path=%2F&bl=${tokens.bl}&hl=vi&_reqid=${Math.floor(Math.random()*999999)}&rt=c`;
    const response = await fetch(apiUrl, {
        headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8", "x-same-domain": "1" },
        body: `f.req=%5B%5B%5B%22CCqFvf%22%2C%22%5B%5C%22%5C%22%2Cnull%2Cnull%2C%5B2%5D%2C%5B1%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B1%5D%5D%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&at=${tokens.at}&`,
        method: "POST"
    });
    const text  = await response.text();
    const match = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    if (match) { console.log("✅ [Background] ID sổ tay:", match[0]); return match[0]; }
    console.error("Debug Text:", text.substring(0, 500));
    throw new Error("Không tìm thấy ID sổ tay");
}

async function buoc2_ThemNguon(notebookId, url, tokens) {
    console.log("2️⃣ [Background] Đang thêm nguồn...");
    const apiUrl  = `https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute?rpcids=izAoDd&source-path=%2Fnotebook%2F${notebookId}&bl=${tokens.bl}&hl=vi&_reqid=${Math.floor(Math.random()*999999)}&rt=c`;
    const reqBody = `f.req=%5B%5B%5B%22izAoDd%22%2C%22%5B%5B%5Bnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B%5C%22${url}%5C%22%5D%2Cnull%2Cnull%2C1%5D%5D%2C%5C%22${notebookId}%5C%22%2C%5B2%5D%2C%5B1%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B1%5D%5D%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&at=${tokens.at}&`;
    const response = await fetch(apiUrl, {
        headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8", "x-same-domain": "1", "x-goog-ext-353267353-jspb": "[null,null,null,276544]" },
        body: reqBody, method: "POST"
    });
    if (response.ok) console.log("✅ [Background] Thêm nguồn thành công!");
    else throw new Error("API thêm nguồn thất bại: " + response.status);
}

async function getFreshGoogleTokens() {
    if (cachedTokens.at && (Date.now() - cachedTokens.timestamp < 10 * 60 * 1000)) {
        console.log("♻️ [Token] Dùng lại token từ cache.");
        return cachedTokens;
    }
    try {
        const html     = await (await fetch("https://notebooklm.google.com/")).text();
        const atMatch  = html.match(/"SNlM0e":"([^"]+)"/);
        const blMatch  = html.match(/"cfb2h":"([^"]+)"/);
        if (!atMatch || !blMatch) throw new Error("Không tìm thấy token bảo mật.");
        cachedTokens = { at: atMatch[1], bl: blMatch[1], timestamp: Date.now() };
        console.log("✅ [Token] Đã cập nhật token mới.");
        return cachedTokens;
    } catch (e) { console.error("❌ [Token] Lỗi:", e); throw e; }
}

initSCChecker();