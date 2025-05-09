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

    // Nếu số lượng tab trong cửa sổ vượt quá 3, chuyển tab này sang cửa sổ mới
    if (tabs.length > 3) {
        chrome.windows.create({ tabId: tab.id });
    }
}

// Lắng nghe sự kiện khi một tab mới được tạo và gọi hàm xử lý
chrome.tabs.onCreated.addListener(handleTabCreated);