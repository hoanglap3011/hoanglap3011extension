// Gửi message ra ngoài iframe khi bấm nút đóng
document.getElementById("close-btn").addEventListener("click", () => {
  window.parent.postMessage({ action: "close_popup" }, "*");
});

// Gửi message khi đang kéo
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