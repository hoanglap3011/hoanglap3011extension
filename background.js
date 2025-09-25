// Inject handleLichThiDau.js vào tab nếu url phù hợp
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const lichThiDauKeywords = [
      'lich-thi-dau',
      'lich+thi+dau',
      'man+city',
      'man+utd',
      'real+madrid',
      'barca',
      'barcelona',
      'chelsea',
      'arsenal',
      'liverpool',
      'tottenham',
      'newcastle',
      'aston+villa',
      'premier+league',
      'juventus',
      'inter',
      'inter+milan',
      'milan',
      'ac+milan',
      'bayern',
      'psg',
      'laliga',
      'ligue+1',
      'al+nassr',
    ];
    const isLichThiDauPage = lichThiDauKeywords.some(keyword => tab.url.includes(keyword));
    if (isLichThiDauPage) {
      // Inject teams.js first, then handleLichThiDau.js
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['football-team.js']
      }, () => {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['handleLichThiDau.js']
        });
      });
    }

    if (tab.url.includes('calendar.google') && tab.url.includes('ofe=true')) {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['handleAddGoogleCalendar.js']
      });
    }
  }
});

// Lắng nghe phím tắt extension, mở trang hoanglap3011.html khi nhận đúng command
chrome.commands.onCommand.addListener((command) => {
  if (command === "open_hoanglap3011") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("hoanglap3011.html")
    });
  }
  if (command === "open_panel") {
    chrome.tabs.create({
      url: "https://hoanglap3011.github.io/hoanglap3011extension/panel.html"
    });
  }
});


/**
 * Khi một tab mới được tạo, nếu số tab trong cửa sổ vượt quá số tab tối đa thì chuyển tab đó sang cửa sổ mới
 * Giúp hạn chế số tab trong mỗi cửa sổ, tránh quá tải giao diện
 */
async function handleTabCreated(tab) {
  const MAX_TABS_PER_WINDOW = 5;
  if (!tab.windowId || !tab.id) return;

  const currentTabs = await chrome.tabs.query({ windowId: tab.windowId });
  if (currentTabs.length <= MAX_TABS_PER_WINDOW) return;

  // Lấy tất cả cửa sổ bình thường (loại "normal")
  const allWindows = await chrome.windows.getAll({ populate: true });
  const otherWindows = allWindows.filter(w => w.id !== tab.windowId && w.type === "normal" && w.alwaysOnTop === false);

  if (otherWindows.length === 0) {
    // Chỉ có cửa sổ hiện tại, tạo cửa sổ mới và chuyển tab sang đó
    chrome.windows.create({ tabId: tab.id });
  } else {
    // Tìm cửa sổ khác chưa đạt max tab
    const targetWindow = otherWindows.find(w => w.tabs.length < MAX_TABS_PER_WINDOW);
    if (targetWindow) {
      chrome.tabs.move(tab.id, { windowId: targetWindow.id, index: -1 });
      chrome.windows.update(targetWindow.id, { focused: true });
    } else {
      // Tất cả cửa sổ đều đầy, chặn và cảnh báo
      chrome.tabs.remove(tab.id);
      alertMaxWindows(MAX_TABS_PER_WINDOW);
    }
  }
}


/**
 * Kiểm tra số lượng cửa sổ trình duyệt đang mở, nếu vượt quá số lượng tối đa thì đóng cửa sổ mới tạo
 * Giới hạn số cửa sổ để tránh phân tán công việc
 */
async function checkMaxWindows(newWindow) {
  const MAX_WINDOWS = 3; // Giới hạn số cửa sổ tối đa
  const windows = await chrome.windows.getAll();
  if (windows.length > MAX_WINDOWS && newWindow.type === "normal") {
    chrome.windows.remove(newWindow.id);
    alertMaxWindows(MAX_WINDOWS);
  }
}


/**
 * Hiển thị cảnh báo khi vượt quá số lượng cửa sổ cho phép
 */
function alertMaxWindows(numWindows) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png", // đảm bảo bạn có icon.png trong extension
    title: "Giới hạn cửa sổ",
    message: "Bạn chỉ được mở tối đa " + numWindows + " cửa sổ trình duyệt."
  });
}


// Đăng ký các listener cho sự kiện tạo cửa sổ và tab mới
chrome.windows.onCreated.addListener(checkMaxWindows);
chrome.tabs.onCreated.addListener(handleTabCreated);
// Injects pip.js into the active tab when you click the extension icon.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["pip.js"],
    });
  } catch (e) {
    console.error("Inject failed:", e);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "call_api_and_open_tab") {
    try {
      const response = await fetch("https://your-api-endpoint.com/data");
      const data = await response.json();

      // Giả sử API trả về { "url": "https://example.com" }
      const targetUrl = data.url;

      if (targetUrl) {
        chrome.tabs.create({ url: targetUrl });
      } else {
        console.error("Không tìm thấy giá trị url trong JSON:", data);
      }
    } catch (error) {
      console.error("Lỗi khi gọi API:", error);
    }
  }
});