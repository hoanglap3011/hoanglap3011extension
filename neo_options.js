// options.js — trang cấu hình. Mọi thứ lưu vào chrome.storage.sync (đồng bộ qua tài khoản Google).

const $ = (id) => document.getElementById(id);

init();

async function init() {
  const cfg = await getSync();
  fill(cfg);
  $("saveBtn").addEventListener("click", save);
  $("resetBtn").addEventListener("click", async () => {
    fill(DEFAULTS);
    flash("Đã điền lại giá trị mặc định — bấm Lưu để áp dụng.");
  });
}

function fill(cfg) {
  $("asksPip").value = cfg.asksPip.join("\n");
  $("refreshMin").value = cfg.refreshMin;
  $("refreshMax").value = cfg.refreshMax;
  $("themesOn").checked = cfg.themesOn;
  $("alertOn").checked  = cfg.alertOn;
  $("askOn").checked    = cfg.askOn;
  $("durationMin").value = cfg.durationMin;
}

const lines = (v) => v.split("\n").map((s) => s.trim()).filter(Boolean);
const clamp = (v, min, max, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

async function save() {
  const asksPip = lines($("asksPip").value);

  // Tối thiểu 10 giây (10/60 phút) — chủ yếu để test
  let refreshMin = clamp($("refreshMin").value, 10 / 60, 120, DEFAULTS.refreshMin);
  let refreshMax = clamp($("refreshMax").value, 10 / 60, 120, DEFAULTS.refreshMax);
  if (refreshMax < refreshMin) [refreshMin, refreshMax] = [refreshMax, refreshMin];

  const cfg = {
    asksPip: asksPip.length ? asksPip : DEFAULTS.asksPip,
    refreshMin,
    refreshMax,
    themesOn: $("themesOn").checked,
    alertOn:  $("alertOn").checked,
    askOn:    $("askOn").checked,
    durationMin: clamp($("durationMin").value, 5, 240, DEFAULTS.durationMin),
  };

  await chrome.storage.sync.set(cfg);
  fill({ ...DEFAULTS, ...cfg }); // hiển thị lại giá trị đã chuẩn hóa
  flash("Đã lưu. Cấu hình áp dụng ngay trên mọi tab và đồng bộ qua các máy.");
}

let flashTimer = null;
function flash(msg) {
  $("savedMsg").textContent = msg;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => ($("savedMsg").textContent = ""), 4000);
}