import { TuVungModule } from './tuvung.js';
const SETTINGS_KEY = 'LapsExtensionSettings';
const DEFAULT_SETTINGS = {
  tvEnableAutoPopup: true,
  // ... các key khác nếu background dùng đến
};


// xử lý tự động hiển thị popup từ vựng
chrome.storage.local.get(SETTINGS_KEY, (data) => {
    const settings = { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };
    if (settings.tvEnableAutoPopup) {
        TuVungModule.startRandomTimer();
    }
});

// Lắng nghe thay đổi từ màn hình Options
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes[SETTINGS_KEY]) {
        const newSettings = changes[SETTINGS_KEY].newValue;
        const oldSettings = changes[SETTINGS_KEY].oldValue;

        if (newSettings && oldSettings) {
            // Nếu người dùng vừa BẬT
            if (newSettings.tvEnableAutoPopup && !oldSettings.tvEnableAutoPopup) {
                TuVungModule.startRandomTimer();
                console.log("🚀 [Background] Đã bật timer từ vựng.");
            }
            // Nếu người dùng vừa TẮT
            else if (!newSettings.tvEnableAutoPopup && oldSettings.tvEnableAutoPopup) {
                chrome.alarms.clear('tuvung_random_popup'); // Tên alarm lấy từ tuvung.js
                console.log("🛑 [Background] Đã dừng timer từ vựng.");
            }
        }
    }
});

let cachedTokens = {
    at: null,
    bl: null,
    timestamp: 0
};

let vietgidoTabId = null;
let shouldAutoRunAll = false; 


chrome.commands.onCommand.addListener((command) => {
  if (command === "open_command_hub") {

    // Kích thước của popup
    const width = 600;
    const height = 400;

    // Tính toán để mở popup ở giữa màn hình
    chrome.windows.getLastFocused((lastWindow) => {
      const left = lastWindow.left + Math.round((lastWindow.width - width) / 2);
      const top = lastWindow.top + Math.round((lastWindow.height - height) / 2);

      // Tạo một cửa sổ "popup" thay vì một "tab"
      chrome.windows.create({
        url: chrome.runtime.getURL('hub.html'),
        type: 'popup', // Đây là chìa khoá
        width: width,
        height: height,
        left: left,
        top: top,
        focused: true // Tự động focus vào cửa sổ này
      });
    });
  }


  if (command === "open_option") {
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
    return;
  }

  if (command === "open-extensions-page") {
    chrome.tabs.create({ url: 'chrome://extensions/' });
    return;
  }

  if (command === "open_media_hub") {
    const fileUrl = chrome.runtime.getURL("media_hub.html");
    chrome.windows.create({
      url: fileUrl,
      type: 'popup',
      width: 630,
      height: 600
    });
    return;
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "create_notebook_from_youtube") {
        console.log("[Background] Nhận yêu cầu tạo NotebookLM cho:", request.url);
        
        handleNotebookFlow(request.url)
            .then((notebookId) => {
                // Mở tab mới
                chrome.tabs.create({ url: `https://notebooklm.google.com/notebook/${notebookId}` });
                sendResponse({ success: true, notebookId: notebookId });
            })
            .catch((err) => {
                console.error("[Background] Lỗi quy trình:", err);
                sendResponse({ success: false, error: err.message });
            });

        return true; // Keep channel open
    }

  // 1. Nhận tín hiệu từ YouTube: "Chuẩn bị chạy auto nha!"
  if (request.action === "expectAutoFeatures") {
    shouldAutoRunAll = true;
    console.log("🚩 [Background] Đã bật chế độ: Chạy tất cả tính năng (Mindmap + Briefing).");

    // Tự động tắt sau 60s phòng hờ
    setTimeout(() => { shouldAutoRunAll = false; }, 60000);

    sendResponse({ received: true });
    return true;
  }

  if (request.action === "closeThisTab") {
    // Kiểm tra xem tin nhắn có đến từ một tab hợp lệ không
    if (sender.tab && sender.tab.id) {
      console.log(`🗑 [Background] Đã xong nhiệm vụ. Đang đóng tab ID: ${sender.tab.id}`);
      chrome.tabs.remove(sender.tab.id);
    }
    return true;
  }

  if (request.action === "openVietGidoTab" && request.data) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(request.data)) {
      params.append(key, value);
    }
    const url = chrome.runtime.getURL(`vietgido.html?${params.toString()}`);

    // Cập nhật: Lưu lại tabId khi tạo
    chrome.tabs.create({ url: url }, (tab) => {
      vietgidoTabId = tab.id; // <--- QUAN TRỌNG: Lưu ID lại để lát gửi tin nhắn
      console.log("[Background] Đã mở Vietgido tại Tab ID:", vietgidoTabId);
    });

    sendResponse({ status: "success", openedUrl: url });
    return true;
  }

  if (request.action === "getMediaInfo") {
    // Query all tabs to get media information
    chrome.tabs.query({}, async (tabs) => {
      const mediaInfoPromises = tabs.map(tab => {
        return new Promise((resolve) => {
          // Skip chrome:// and extension pages
          if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) {
            resolve(null);
            return;
          }

          chrome.tabs.sendMessage(tab.id, { action: "getMediaState" }, (response) => {
            if (chrome.runtime.lastError) {
              console.log(`Tab ${tab.id} error:`, chrome.runtime.lastError.message);
              resolve(null);
            } else if (!response) {
              resolve(null);
            } else {
              resolve({ ...response, tabId: tab.id, tabTitle: tab.title, tabUrl: tab.url, favIconUrl: tab.favIconUrl });
            }
          });
        });
      });

      const mediaInfos = await Promise.all(mediaInfoPromises);
      const validMediaInfos = mediaInfos.filter(info => info !== null && info.hasMedia);

      console.log('[Media Hub] Found media:', validMediaInfos.length);
      sendResponse({ mediaInfos: validMediaInfos });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === "controlMedia") {
    const { tabId, command, value } = request;
    chrome.tabs.sendMessage(tabId, { action: "mediaControl", command, value }, (response) => {
      sendResponse(response || { success: false });
    });
    return true;
  }

  if (request.action === "focusTab") {
    const { tabId } = request;
    chrome.tabs.update(tabId, { active: true }, () => {
      chrome.windows.getCurrent((window) => {
        chrome.windows.update(window.id, { focused: true });
      });
      sendResponse({ success: true });
    });
    return true;
  }

  return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes("notebooklm.google.com/notebook/")) {
    console.log("🎯 [Background] Bắt được link NotebookLM:", tab.url);

    // Logic gửi link sang Vietgido (giữ nguyên)
    if (vietgidoTabId) {
      chrome.tabs.sendMessage(vietgidoTabId, {
        action: "autofillNotebookLink",
        notebookUrl: tab.url
      }).catch(() => { vietgidoTabId = null; });
    }

    // 2. Kiểm tra cờ và Gửi lệnh tổng lực "activateAll"
    if (shouldAutoRunAll) {
      console.log("🚀 [Background] Tab đã load. Gửi lệnh kích hoạt TOÀN BỘ.");

      chrome.tabs.sendMessage(tabId, { action: "activateAll" }, (response) => {
        if (chrome.runtime.lastError) {
          // Retry nếu script chưa load
          setTimeout(() => chrome.tabs.sendMessage(tabId, { action: "activateAll" }), 1000);
        }
      });

      shouldAutoRunAll = false; // Tắt cờ ngay
    }
  }

});


// ===================================================================
// LOGIC CHÍNH (Sử dụng Token động)
// ===================================================================

async function handleNotebookFlow(targetUrl) {
    // BƯỚC 0: Lấy chìa khóa vạn năng (Token)
    const tokens = await getFreshGoogleTokens();
    
    // BƯỚC 1: Tạo sổ tay
    const newId = await buoc1_TaoSoTay(tokens);
    
    // BƯỚC 2: Thêm nguồn
    await buoc2_ThemNguon(newId, targetUrl, tokens);
    
    return newId;
}

// --- HÀM 1: TẠO SỔ TAY ---
async function buoc1_TaoSoTay(tokens) {
    console.log("1️⃣ [Background] Đang tạo sổ tay mới (Dynamic Token)...");

    // Xây dựng URL với tham số 'bl' động
    // f.sid thường không bắt buộc phải chính xác trong URL nếu đã có cookie, 
    // nhưng nếu lỗi ta có thể scrape thêm f.sid sau.
    const apiUrl = `https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute?rpcids=CCqFvf&source-path=%2F&bl=${tokens.bl}&hl=vi&_reqid=${Math.floor(Math.random() * 999999)}&rt=c`;

    const response = await fetch(apiUrl, {
        "headers": {
            "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
            "x-same-domain": "1"
        },
        // SỬ DỤNG TOKEN 'at' ĐỘNG Ở ĐÂY
        "body": `f.req=%5B%5B%5B%22CCqFvf%22%2C%22%5B%5C%22%5C%22%2Cnull%2Cnull%2C%5B2%5D%2C%5B1%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B1%5D%5D%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&at=${tokens.at}&`,
        "method": "POST"
    });

    const text = await response.text();
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
    const match = text.match(uuidPattern);

    if (match) {
        console.log("✅ [Background] ID sổ tay:", match[0]);
        return match[0];
    } else {
        console.error("Debug Text:", text.substring(0, 500)); // Log để soi nếu lỗi
        throw new Error("Không tìm thấy ID sổ tay (Token có thể không hợp lệ?)");
    }
}

// --- HÀM 2: THÊM NGUỒN ---
async function buoc2_ThemNguon(notebookId, url, tokens) {
    console.log(`2️⃣ [Background] Đang thêm nguồn...`);
    
    const apiUrl = `https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute?rpcids=izAoDd&source-path=%2Fnotebook%2F${notebookId}&bl=${tokens.bl}&hl=vi&_reqid=${Math.floor(Math.random() * 999999)}&rt=c`;

    // Encode URL để tránh lỗi ký tự đặc biệt
    // Google Batchexecute format hơi dị, ta cần cẩn thận các dấu ngoặc
    // Body gốc: f.req=[[["izAoDd","[[[null,null,null,null,null,null,null,[\"URL_HERE\"]...
    
    // Mẹo: Dùng encodeURIComponent cho URL Youtube để an toàn
    // Nhưng vì cấu trúc JSON string bên trong của Google đã escape, ta cứ chèn raw string vào template
    // chỉ cần cẩn thận dấu ngoặc kép.
    
    const reqBody = `f.req=%5B%5B%5B%22izAoDd%22%2C%22%5B%5B%5Bnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B%5C%22${url}%5C%22%5D%2Cnull%2Cnull%2C1%5D%5D%2C%5C%22${notebookId}%5C%22%2C%5B2%5D%2C%5B1%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B1%5D%5D%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&at=${tokens.at}&`;

    const response = await fetch(apiUrl, {
        "headers": {
            "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
            "x-same-domain": "1",
            "x-goog-ext-353267353-jspb": "[null,null,null,276544]"
        },
        "body": reqBody,
        "method": "POST"
    });

    if (response.ok) {
        console.log("✅ [Background] Thêm nguồn thành công!");
    } else {
        throw new Error("API thêm nguồn thất bại: " + response.status);
    }
}

// Hàm lấy Token tươi từ trang chủ Google
async function getFreshGoogleTokens() {
    // Nếu token còn mới (dưới 10 phút) thì dùng lại
    if (cachedTokens.at && (Date.now() - cachedTokens.timestamp < 10 * 60 * 1000)) {
        console.log("♻️ [Token] Dùng lại token từ cache.");
        return cachedTokens;
    }

    console.log("Gởi request lấy token mới...");
    try {
        const response = await fetch("https://notebooklm.google.com/");
        const html = await response.text();

        // 1. Tìm 'at' (SNlM0e) - Quan trọng nhất
        // Pattern: "SNlM0e":"<TOKEN_O_DAY>"
        const atMatch = html.match(/"SNlM0e":"([^"]+)"/);
        
        // 2. Tìm 'bl' (cfb2h) - Phiên bản build
        // Pattern: "cfb2h":"<VERSION_O_DAY>"
        const blMatch = html.match(/"cfb2h":"([^"]+)"/);

        if (!atMatch || !blMatch) {
            throw new Error("Không tìm thấy token bảo mật (SNlM0e/cfb2h) trong HTML.");
        }

        cachedTokens = {
            at: atMatch[1],
            bl: blMatch[1],
            timestamp: Date.now()
        };

        console.log("✅ [Token] Đã cập nhật token mới:", cachedTokens);
        return cachedTokens;

    } catch (e) {
        console.error("❌ [Token] Lỗi lấy token:", e);
        throw e;
    }
}