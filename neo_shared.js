// shared.js — dùng chung cho anchor/popup/options (content script tự chứa)

const DEFAULTS = {
  // Text hiển thị cùng task trên cửa sổ nổi PiP
  asksPip: [
    "Am I working on the right thing?",
    "How does the tab I just opened serve this?",
    "If I had only 30 minutes left, what would I do?",
    "Is what I'm doing taking me to the finish line?",
    "Am I being pulled along, or am I in control?",
    "Looking back an hour from now, will I be happy with this?",
    "Does this really need to be done right now?",
    "What am I avoiding?",
    "Which 20% decides 80% of this — am I doing it yet?",
    "Am I breathing deeply and staying relaxed?",
    "Is my back straight, neck tall, chest open?",
    "Am I looking into the distance now and then to rest my eyes?"
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

  // Text nhắc nhở định kỳ trên PiP (hiện giữa màn hình 3 giây rồi trả về trạng thái task)
  asksRemind: [
    "Look into the distance and breathe deeply",
    "Sit up straight, neck tall, chest open",
  ],
  remindOn: true,
  // Chu kỳ nhắc nhở (giây) — ngẫu nhiên trong khoảng [min, max]
  remindMinSec: 10,
  remindMaxSec: 30,

  // Chưa mở PiP → overlay cảnh báo đè lên mọi trang web yêu cầu mở PiP
  pipRemindOn: true,

};

// Cài đặt Neo nằm gọn trong MỘT key của chrome.storage.local.
// Trước đây để ở chrome.storage.sync (đồng bộ nhiều máy) — không cần nữa,
// đổi sang local để bỏ trần 100 KB và trần số lần ghi mỗi phút.
const NEO_SETTINGS_KEY = 'neoSettings';

async function getNeoSettings() {
  const data = await chrome.storage.local.get(NEO_SETTINGS_KEY);
  return { ...DEFAULTS, ...(data[NEO_SETTINGS_KEY] || {}) };
}

async function saveNeoSettings(patch) {
  const current = await getNeoSettings();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ [NEO_SETTINGS_KEY]: next });
  return next;
}

function fmtRemaining(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}