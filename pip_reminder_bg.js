// pip_reminder_bg.js
// Module nhắc nhở mở PiP (Neo Anchor) ở background service worker.
// Cùng pattern với selfcontrol_bg.js: PiP chưa mở → overlay cảnh báo ở mọi tab.
// Bật/tắt bằng setting pipRemindOn (màn Cài đặt của neo_anchor, mặc định Bật).

const PIP_STATE_KEY   = 'pipReminderState'; // persist qua service worker restart
const PIP_ALARM_NAME  = 'pip_reminder_check';
const PIP_ALARM_PERIOD = 1; // phút

// ============================================================
// Helpers
// ============================================================
const NEO_SETTINGS_KEY = 'neoSettings';

async function isEnabled() {
    const data = await chrome.storage.local.get(NEO_SETTINGS_KEY);
    return data[NEO_SETTINGS_KEY]?.pipRemindOn ?? true; // mặc định Bật
}

async function getOverlayActive() {
    const data = await chrome.storage.local.get(PIP_STATE_KEY);
    return !!(data[PIP_STATE_KEY]?.overlayActive);
}

async function setOverlayActive(val) {
    await chrome.storage.local.set({ [PIP_STATE_KEY]: { overlayActive: val } });
}

// PiP đang mở không: neo_anchor lưu id cửa sổ PiP vào neoPipWindowId khi mở,
// xóa khi đóng — xác minh lại bằng chrome.windows.get vì id có thể là rác
// từ phiên trước (trình duyệt tắt làm PiP đóng mà không kịp dọn storage)
async function isPipOpen() {
    const { neoPipWindowId } = await chrome.storage.local.get('neoPipWindowId');
    if (!neoPipWindowId) return false;
    const win = await chrome.windows.get(neoPipWindowId).catch(() => null);
    return !!win;
}

// ============================================================
// Chạy kiểm tra
// ============================================================
async function runCheck() {
    if (!(await isEnabled())) {
        await setOverlayActive(false);
        hideOverlayAllTabs();
        stopAlarm();
        return;
    }
    if (await isPipOpen()) {
        await setOverlayActive(false);
        hideOverlayAllTabs();
    } else {
        await setOverlayActive(true);
        showOverlayAllTabs();
    }
}

// ============================================================
// Alarm định kỳ
// ============================================================
function startAlarm() {
    chrome.alarms.get(PIP_ALARM_NAME, (existing) => {
        if (!existing) {
            chrome.alarms.create(PIP_ALARM_NAME, { periodInMinutes: PIP_ALARM_PERIOD });
        }
    });
}

function stopAlarm() {
    chrome.alarms.clear(PIP_ALARM_NAME);
}

// ============================================================
// Gửi overlay đến tất cả tab
// ============================================================
const SKIP_URLS = ['chrome://', 'chrome-extension://', 'about:', 'data:', 'edge://'];

async function showOverlayAllTabs() {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        if (!tab.url || SKIP_URLS.some(p => tab.url.startsWith(p))) continue;
        await sendOrInject(tab.id, { action: 'pipShowOverlay' });
    }
}

async function hideOverlayAllTabs() {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        if (!tab.url || SKIP_URLS.some(p => tab.url.startsWith(p))) continue;
        try {
            await chrome.tabs.sendMessage(tab.id, { action: 'pipHideOverlay' });
        } catch (_) { }
    }
}

async function sendOrInject(tabId, message) {
    try {
        await chrome.tabs.sendMessage(tabId, message);
    } catch (_) {
        try {
            await chrome.scripting.executeScript({ target: { tabId }, files: ['pip_reminder_checker.js'] });
            await chrome.tabs.sendMessage(tabId, message);
        } catch (__) { }
    }
}

// ============================================================
// Đưa tab neo_anchor ra trước mặt (người dùng bấm "Mở Neo Anchor" trên overlay).
// PiP cần user gesture nên chỉ có thể dẫn người dùng đến tab — thao tác đầu
// tiên của họ trong đó sẽ tự bung PiP (auto-open trong neo_anchor.js)
// ============================================================
async function focusNeoAnchorTab() {
    const url = chrome.runtime.getURL('neo_anchor.html');
    const existing = await chrome.tabs.query({ url });
    if (existing.length > 0) {
        const tab = existing[0];
        chrome.tabs.update(tab.id, { active: true });
        chrome.windows.update(tab.windowId, { focused: true });
        return;
    }
    const tab = await chrome.tabs.create({ url, pinned: true, active: true });
    chrome.storage.local.set({ neoAnchorTabId: tab.id });
}

// ============================================================
// Xử lý tab mới mở khi overlay đang active
// ============================================================
async function handleNewTab(tabId, tabUrl) {
    if (SKIP_URLS.some(p => tabUrl.startsWith(p))) return;
    const overlayActive = await getOverlayActive();
    if (!overlayActive) return;
    // Check lại cho chính xác rồi mới hiện (PiP có thể vừa được mở)
    if (!(await isEnabled())) return;
    if (await isPipOpen()) {
        await setOverlayActive(false);
        return;
    }
    await sendOrInject(tabId, { action: 'pipShowOverlay' });
}

// ============================================================
// Export: khởi động module — gọi 1 lần từ background.js
// ============================================================
export function initPipReminder() {
    runCheck().then(async () => {
        if (await isEnabled()) startAlarm();
    });

    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === PIP_ALARM_NAME) runCheck();
    });

    // Setting đổi (màn Cài đặt neo_anchor) → áp dụng ngay
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes[NEO_SETTINGS_KEY]) {
            const before = changes[NEO_SETTINGS_KEY].oldValue?.pipRemindOn ?? true;
            const after  = changes[NEO_SETTINGS_KEY].newValue?.pipRemindOn ?? true;
            if (before !== after) {
                if (after) startAlarm();
                runCheck();
            }
        }
        // PiP vừa mở/đóng → phản ứng ngay không chờ alarm
        if (namespace === 'local' && changes.neoPipWindowId) {
            runCheck();
        }
    });

    // Cửa sổ PiP bị đóng bằng nút X của hệ thống → hiện lại cảnh báo ngay
    chrome.windows.onRemoved.addListener(async (windowId) => {
        const { neoPipWindowId } = await chrome.storage.local.get('neoPipWindowId');
        if (windowId === neoPipWindowId) runCheck();
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete' && tab.url) {
            handleNewTab(tabId, tab.url);
        }
    });

    // Message từ content script overlay
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'pipCheckNow') {
            runCheck().then(() => sendResponse({ received: true }));
            return true; // giữ channel async — chỉ với action này
        }
        if (request.action === 'pipOpenAnchor') {
            focusNeoAnchorTab();
            return; // không cần response
        }
    });
}
