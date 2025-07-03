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
});


/**
 * Khi một tab mới được tạo, nếu số tab trong cửa sổ vượt quá 5 thì chuyển tab đó sang cửa sổ mới
 * Giúp hạn chế số tab trong mỗi cửa sổ, tránh quá tải giao diện
 */
async function handleTabCreated(tab) {
  if (!tab.windowId || !tab.id) return;
  const tabs = await chrome.tabs.query({ windowId: tab.windowId });
  if (tabs.length > 5) {
    chrome.windows.create({ tabId: tab.id });
  }
}


/**
 * Kiểm tra số lượng cửa sổ trình duyệt đang mở, nếu vượt quá 2 thì đóng cửa sổ mới tạo
 * Giới hạn số cửa sổ để tránh phân tán công việc
 */
async function checkMaxWindows(newWindow) {
  const windows = await chrome.windows.getAll();
  if (windows.length > 2 && newWindow.type === "normal") {
    chrome.windows.remove(newWindow.id);
    alertMaxWindows();
  }
}


/**
 * Hiển thị cảnh báo khi vượt quá số lượng cửa sổ cho phép
 */
function alertMaxWindows() {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png", // đảm bảo bạn có icon.png trong extension
    title: "Giới hạn cửa sổ",
    message: "Bạn chỉ được mở tối đa 2 cửa sổ trình duyệt."
  });
}


// Đăng ký các listener cho sự kiện tạo cửa sổ và tab mới
chrome.windows.onCreated.addListener(checkMaxWindows);
chrome.tabs.onCreated.addListener(handleTabCreated);