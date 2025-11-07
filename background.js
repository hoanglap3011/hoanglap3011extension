chrome.commands.onCommand.addListener(function (command) {
  if (command === "open_hoanglap3011") {
    const fileUrl = chrome.runtime.getURL("hoanglap3011.html");
    chrome.tabs.create({ url: fileUrl });
    return;
  }

  if (command === "open_vietgido") {
    const fileUrl = chrome.runtime.getURL("vietgido.html");
    chrome.tabs.create({ url: fileUrl });
    return;
  }

  if (command === "open-extensions-page") {
    chrome.tabs.create({ url: 'chrome://extensions/' });
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

  return false;
});