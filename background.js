chrome.commands.onCommand.addListener((command) => {
  if (command === "open_hoanglap3011") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("hoanglap3011.html")
    });
  }
});

// Hàm xử lý khi một tab mới được tạo
async function handleTabCreated(tab) {
    // Nếu tab không có windowId hoặc id thì bỏ qua
    if (!tab.windowId || !tab.id) return;

    // Lấy tất cả các tab trong cùng cửa sổ với tab vừa được tạo
    const tabs = await chrome.tabs.query({ windowId: tab.windowId });

    // Nếu số lượng tab trong cửa sổ vượt quá 5, chuyển tab này sang cửa sổ mới
    if (tabs.length > 5) {
        chrome.windows.create({ tabId: tab.id });
    }
}

// Hàm kiểm tra số lượng cửa sổ đang mở và đóng cửa sổ nếu vượt quá 3
async function checkMaxWindows(newWindow) {
    const windows = await chrome.windows.getAll();

    if (windows.length > 2 && newWindow.type === "normal") {
        chrome.windows.remove(newWindow.id);
        alertMaxWindows();
    }
}

// Hàm hiển thị cảnh báo (bằng notification hoặc alert)
function alertMaxWindows() {
    chrome.notifications.create({
        type: "basic",
        iconUrl: "icon.png", // đảm bảo bạn có icon.png trong extension
        title: "Giới hạn cửa sổ",
        message: "Bạn chỉ được mở tối đa 2 cửa sổ trình duyệt."
    });
}

// Lắng nghe sự kiện tạo cửa sổ mới
chrome.windows.onCreated.addListener(checkMaxWindows);

// Lắng nghe sự kiện khi một tab mới được tạo và gọi hàm xử lý
chrome.tabs.onCreated.addListener(handleTabCreated);