// Lắng nghe sự kiện khi một lệnh (command) được kích hoạt
chrome.commands.onCommand.addListener(function(command) {
  
  // In ra console để kiểm tra (bạn có thể xem trong "Inspect views: service worker")
  console.log('Lệnh được nhấn:', command); 

  // Kiểm tra xem có đúng là lệnh 'open_hoanglap3011' (đã định nghĩa trong manifest.json) không
  if (command === "open_hoanglap3011") {    
    // Lấy URL đầy đủ của file 'hoanglap3011.html' bên trong extension
    const fileUrl = chrome.runtime.getURL("hoanglap3011.html");
    // Tạo một tab mới và mở URL đó
    chrome.tabs.create({ url: fileUrl });
    return;
  }

  if (command === "open_vietgido") {
    const fileUrl = chrome.runtime.getURL("vietgido.html");
    chrome.tabs.create({ url: fileUrl });
    return;
  }  
});

// Thêm vào file background.js (hoặc service-worker.js)

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