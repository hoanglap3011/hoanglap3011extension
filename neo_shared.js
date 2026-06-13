// shared.js — dùng chung cho anchor/popup/options (content script tự chứa)

const DEFAULTS = {
  // Đồng bộ qua tài khoản Google (chrome.storage.sync)
  goal: "",
  durationMin: 50,
  // Câu nhắc trên cửa sổ nổi PiP
  asksPip: [
    "Mình đang làm đúng việc này chứ?",
    "Tab vừa mở phục vụ gì cho việc này?",
    "Nếu chỉ còn 30 phút, mình sẽ làm gì?",
    "Cái đang làm có đưa mình đến đích không?",
    "Đang bị kéo đi hay đang chủ động?",
    "Mình mở tab này để làm gì?",
    "Nếu nhìn lại sau 1 giờ, mình có hài lòng không?",
    "Việc này có thực sự cần làm ngay không?",
    "Đang tránh né điều gì?",
    "Cái khó nhất của việc này là gì — mình đang làm nó chưa?",
  ],

  // Chu kỳ tự làm mới (phút) — ngẫu nhiên trong khoảng [min, max]
  refreshMin: 3,
  refreshMax: 7,

  // Có xoay vòng bảng màu không
  themesOn: true,

  // Hiệu ứng nháy mạnh khi làm mới
  alertOn: true,

  // Hiển thị lời nhắc phản tư trong cửa sổ nổi
  askOn: true,

};

async function getSync() {
  const data = await chrome.storage.sync.get(null);
  return { ...DEFAULTS, ...data };
}

async function getSession() {
  const { session } = await chrome.storage.sync.get("session");
  return session || null;
}

async function setSession(session) {
  await chrome.storage.sync.set({ session });
}

function fmtRemaining(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}