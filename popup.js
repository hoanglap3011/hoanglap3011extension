
// Đăng ký sự kiện cho popup trong iframe: đóng và kéo popup

// Khi bấm nút đóng, gửi message ra ngoài để parent xử lý đóng popup
document.getElementById("close-btn").addEventListener("click", () => {
  window.parent.postMessage({ action: "close_popup" }, "*");
});

// Xử lý kéo popup: gửi message ra ngoài với thông tin di chuyển
let isDragging = false;
let offsetX = 0, offsetY = 0;
const header = document.getElementById("drag-header");

header.addEventListener("mousedown", (e) => {
  isDragging = true;
  offsetX = e.clientX;
  offsetY = e.clientY;
});

document.addEventListener("mousemove", (e) => {
  if (isDragging) {
    const dx = e.clientX - offsetX;
    const dy = e.clientY - offsetY;
    offsetX = e.clientX;
    offsetY = e.clientY;
    window.parent.postMessage({
      action: "move_popup",
      dx,
      dy
    }, "*");
  }
});

document.addEventListener("mouseup", () => {
  isDragging = false;
});