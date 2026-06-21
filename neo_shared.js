// shared.js — dùng chung cho anchor/popup/options (content script tự chứa)

const DEFAULTS = {
  // Text hiển thị cùng task trên cửa sổ nổi PiP
  asksPip: [
    "Mình đang làm đúng việc này chứ?",
    "Tab vừa mở phục vụ gì cho việc này?",
    "Nếu chỉ còn 30 phút, mình sẽ làm gì?",
    "Cái đang làm có đưa mình đến đích không?",
    "Đang bị kéo đi hay đang chủ động?",
    "Nếu nhìn lại sau 1 giờ, mình có hài lòng không?",
    "Việc này có thực sự cần làm ngay không?",
    "Đang tránh né điều gì?",
    "20% nào quyết định 80% việc này? — mình đang làm nó chưa?",
    "Có hít thở sâu và thư giãn khi làm không đấy?",
    "Có đang ngồi thẳng lưng thẳng cổ ưỡn ngực không đấy?",
    "Thi thoảng có đưa mắt ra xa thư giãn không đấy?"
  ],

  // Thời gian làm mặc định (phút)
  defaultWorkMin: 5,

  // Chu kỳ tự làm mới (phút) — ngẫu nhiên trong khoảng [min, max]
  refreshMin: 3,
  refreshMax: 7,

  // Thời lượng nháy mạnh (giây); null = không nháy
  alertDuration: 2,

  // Hiển thị text cùng task trong cửa sổ nổi
  askOn: false,

};

async function getSync() {
  const data = await chrome.storage.sync.get(null);
  return { ...DEFAULTS, ...data };
}

function fmtRemaining(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}