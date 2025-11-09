// Trong file background.js

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

  // 1. Kiểm tra hành động và dữ liệu
  if (request.action === "openVietGidoTab" && request.data) {

    // 2. TẠO URL VÀ PARAMETERS TẠI BACKGROUND SCRIPT
    const params = new URLSearchParams();

    // Lặp qua object data được gửi từ content script
    for (const [key, value] of Object.entries(request.data)) {
      params.append(key, value);
    }

    // Tạo URL đầy đủ. API này phải được gọi từ Service Worker.
    const url = chrome.runtime.getURL(`vietgido.html?${params.toString()}`);

    console.log("[Ext Background] Đang mở tab với URL:", url);

    // 3. Mở tab
    chrome.tabs.create({ url: url });

    // 4. Phản hồi
    sendResponse({ status: "success", openedUrl: url });

    return true;
  }

  // Handle media control commands from media_hub.html
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