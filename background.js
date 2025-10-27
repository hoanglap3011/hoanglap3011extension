// Lắng nghe sự kiện khi một lệnh (command) được kích hoạt
chrome.commands.onCommand.addListener(function(command) {
  
  // In ra console để kiểm tra (bạn có thể xem trong "Inspect views: service worker")
  console.log('Lệnh được nhấn:', command); 

  // Kiểm tra xem có đúng là lệnh 'open_my_page' (đã định nghĩa trong manifest.json) không
  if (command === "open_my_page") {
    
    // Lấy URL đầy đủ của file 'hoanglap3011.html' bên trong extension
    const fileUrl = chrome.runtime.getURL("hoanglap3011.html");

    // Tạo một tab mới và mở URL đó
    chrome.tabs.create({ url: fileUrl });
  }
});