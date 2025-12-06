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