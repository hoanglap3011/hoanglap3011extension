

/**
 * Tạo popup nổi sử dụng Shadow DOM, có thể kéo/thay đổi kích thước, lưu trạng thái
 */
function createPopupShadow(x = 0, y = 0, w = null, h = null) {
  const existing = document.getElementById("popup-host");
  if (existing) return;

  const host = document.createElement("div");
  host.id = "popup-host";
  Object.assign(host.style, {
    position: "fixed",
    left: "0",
    top: "0",
    zIndex: "999999"
  });

  const shadow = host.attachShadow({ mode: "open" });
  const styleURL = chrome.runtime.getURL("popup.css");

  const width = w || Math.round(window.innerWidth / 2);
  const height = h || Math.round(window.innerHeight / 2);

  shadow.innerHTML = `
    <link rel="stylesheet" href="${styleURL}">
    <div id="popup-box" style="
      width: ${width}px;
      height: ${height}px;
      transform: translate(${x}px, ${y}px);
      resize: both;
      overflow: auto;
      border: 1px solid #ccc;
      border-radius: 8px;
      background: white;
      box-shadow: 0 0 10px rgba(0,0,0,0.2);
      position: fixed;
    ">
      <div class="header" id="popup-drag-header">
        <span>🌟 Floating Shadow Popup</span>
        <button id="popup-close-btn">×</button>
      </div>
      <div class="content">
        <p>This popup is completely isolated using Shadow DOM.</p>
      </div>
    </div>
  `;

  document.body.appendChild(host);

  const popup = shadow.getElementById("popup-box");
  const header = shadow.getElementById("popup-drag-header");
  const closeBtn = shadow.getElementById("popup-close-btn");

  // Resize observer
  const ro = new ResizeObserver(() => {
    chrome.storage.local.set({
      popupWidth: popup.offsetWidth,
      popupHeight: popup.offsetHeight
    });
  });
  ro.observe(popup);

  // Drag
  let isDragging = false;
  let offsetX = 0, offsetY = 0;

  header.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX;
    offsetY = e.clientY;
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      const dx = e.clientX - offsetX;
      const dy = e.clientY - offsetY;
      offsetX = e.clientX;
      offsetY = e.clientY;
      x += dx;
      y += dy;
      popup.style.transform = `translate(${x}px, ${y}px)`;
      chrome.storage.local.set({ popupTranslateX: x, popupTranslateY: y });
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });

  // Close button
  closeBtn.addEventListener("click", () => {
    host.remove();
    chrome.storage.local.set({ popupHidden: true });
    createRestoreButton();
  });
}

/**
 * Tạo nút khôi phục popup khi popup bị đóng
 */
function createRestoreButton() {
  if (document.getElementById("popup-restore-button")) return;

  const btn = document.createElement("button");
  btn.id = "popup-restore-button";
  btn.textContent = "🔄";
  Object.assign(btn.style, {
    position: "fixed",
    bottom: "20px",
    left: "20px",
    zIndex: "999999",
    fontSize: "20px",
    border: "none",
    background: "#2196F3",
    color: "white",
    borderRadius: "50%",
    width: "40px",
    height: "40px",
    cursor: "pointer",
    boxShadow: "0 0 8px rgba(0,0,0,0.2)"
  });

  btn.onclick = () => {
    chrome.storage.local.set({ popupHidden: false });
    btn.remove();
    createPopupShadow(lastX, lastY, lastW, lastH);
  };

  document.body.appendChild(btn);
}

let lastX = 0, lastY = 0, lastW = null, lastH = null;

// Lấy trạng thái popup từ storage và khởi tạo popup hoặc nút khôi phục
chrome.storage.local.get(["popupTranslateX", "popupTranslateY", "popupWidth", "popupHeight", "popupHidden"], (result) => {
  lastX = result.popupTranslateX || 0;
  lastY = result.popupTranslateY || 0;
  lastW = result.popupWidth;
  lastH = result.popupHeight;

  const hidden = result.popupHidden || false;
  if (!hidden) {
    createPopupShadow(lastX, lastY, lastW, lastH);
  } else {
    createRestoreButton();
  }
});