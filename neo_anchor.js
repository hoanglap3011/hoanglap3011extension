// neo_anchor.js — Neo Anchor v2: task queue + work/break phases + PiP
const $ = (id) => document.getElementById(id);
const pipSupported = 'documentPictureInPicture' in window;

// ── Storage keys ──
const KEY_TASKS     = 'neoTasks';
const KEY_PHASE     = 'neoPhase';       // 'idle'|'working'|'breaking'|'alert_add'|'alert_shutdown'
const KEY_CUR_TASK  = 'neoCurrentTask'; // task id
const KEY_WORK_END  = 'neoWorkEndsAt';
const KEY_BREAK_END = 'neoBreakEndsAt';
const KEY_SHUTDOWN  = 'neoShutdownTime';
const KEY_TAB       = 'neoAnchorTabId';
const KEY_PIP_WIN   = 'neoPipWindowId';
const KEY_ACK_STATS = 'neoAckStats';    // thời gian phản xạ (ms) của các lần xác nhận gần nhất

// ── Runtime state ──
let tasks      = [];
let phase      = 'idle';
let curTaskId  = null;
let workEndsAt = null;
let breakEndsAt = null;
let cfg        = {};
let pipWindow  = null;
let tickTimer  = null;
let pipRefreshTimer = null;
let pipLastTheme = -1, pipLastAsk = -1;
let selectedWork = null, selectedBreak = null;
let pipAtCenter = false;
let pipWinId = null;
let standupPipActive = false;
let remindTimer = null, remindHideTimer = null, remindActive = false, remindLastIdx = -1;
// Vị trí chuột (toạ độ màn hình thật) lần cuối bắt được trong tab neo hoặc cửa sổ PiP
let lastMouseScreen = null; // { x, y, t }
const MOUSE_FRESH_MS = 60_000;

// ── Chống "mù sự chú ý" ──
// 1) Thư viện hiệu ứng: mỗi lần nháy chọn ngẫu nhiên, không lặp lại các hiệu ứng vừa dùng
// 2) Chuyển động cửa sổ PiP (rung, rơi, trượt, nhảy) — chuyển động ngoại vi khó bị phớt lờ hơn đổi màu
// 3) Bắt buộc xác nhận: phải bấm đúng ký hiệu (thay đổi mỗi lần) mới tắt được,
//    chưa bấm thì leo thang: to hơn → rung → âm thanh, bám theo màn hình đang dùng
// 4) Thích nghi: phản xạ gần đây chậm → lần sau bắt đầu luôn ở mức leo thang 1
let fxHistory = [];          // các hiệu ứng vừa dùng gần nhất (tránh lặp lại)
let fxStopTimer = null;      // hẹn tắt hiệu ứng nháy ngắn
let fxRotateTimer = null;    // đổi hiệu ứng định kỳ khi nháy liên tục
let fxLooping = false;
let motionToken = 0;         // tăng lên để huỷ chuyển động cửa sổ đang chạy dở
let lastMotion = null;
let pipTitleBar = null;      // chiều cao thanh tiêu đề PiP (đo sau khi mở)
let ack = null;              // phiên xác nhận đang chờ: { startedAt, level, wrong, msg, opts, target, shownAt, done }
let ackTimer = null, ackDoneTimer = null;
let ackStats = [];
let audioCtx = null;

const PIP_W = 360, PIP_H = 90;                 // kích thước nội dung PiP bình thường
const ACK_SIZES = [                            // kích thước nội dung PiP theo mức leo thang
  { w: 360, h: 90 },
  { w: 480, h: 140 },
  { w: 620, h: 200 },
];
const ACK_MAX_LEVEL     = ACK_SIZES.length - 1;
const ACK_GRACE_MS      = 400;      // bỏ qua click ngay sau khi thử thách hiện (tránh bấm trúng do PiP nhảy tới dưới con trỏ)
const ACK_FEEDBACK_MS   = 900;      // thời gian hiện "✓ Phản xạ x giây"
const ACK_SOUND_MAX_MS  = 120_000;  // quá 2 phút chưa xác nhận thì thôi phát âm thanh (vẫn nháy)
const ACK_STATS_MAX     = 20;
const ACK_VOLUME        = 0.15;
const FX_LOOP_ROTATE_MS = 6000;     // nháy liên tục thì cứ 6 giây đổi kiểu hiệu ứng
const MOTION_STEP_MS    = 28;

const PIP_SECTIONS = ['s-working','s-breaking','s-alert-add','s-alert-shutdown','s-standup-alert','s-remind','s-ack'];

// ── PiP themes (same as before) ──
const PIP_THEMES = [
  { bg: '#11151f', fg: '#f4f1e8', accent: '#f0a33c', line: '#2a3142', muted: '#828ca0' },
  { bg: '#101a16', fg: '#eef4ec', accent: '#5fc88f', line: '#23362c', muted: '#7da08c' },
  { bg: '#1a1320', fg: '#f3edf7', accent: '#c98bf0', line: '#32263d', muted: '#9a87ab' },
  { bg: '#1c1412', fg: '#f6efe9', accent: '#f07b54', line: '#3a2a24', muted: '#a8907f' },
  { bg: '#f4f1e8', fg: '#11151f', accent: '#b4571e', line: '#d8d2c2', muted: '#6f7686' },
];

// ── Thư viện hiệu ứng (class CSS trong cửa sổ PiP) ──
const FX_ALL = [
  'fx-rainbow', 'fx-strobe', 'fx-invert', 'fx-redalarm', 'fx-hazard', 'fx-sweep',
  'fx-heartbeat', 'fx-shake', 'fx-glitch', 'fx-ripple', 'fx-blackout',
];
const FX_POOL = {
  light:  ['fx-rainbow', 'fx-invert', 'fx-sweep', 'fx-heartbeat', 'fx-ripple', 'fx-glitch', 'fx-redalarm'],
  strong: FX_ALL,
  loop:   ['fx-rainbow', 'fx-redalarm', 'fx-hazard', 'fx-sweep', 'fx-ripple', 'fx-heartbeat'],
};
const MOTIONS = ['shake', 'drop', 'slide', 'hop'];

// ── Thử thách xác nhận ──
const ACK_SETS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
  ['●', '▲', '■', '◆', '★', '♥'],
  ['←', '↑', '→', '↓'],
];
const ARROW_KEYS = { ArrowLeft: '←', ArrowUp: '↑', ArrowRight: '→', ArrowDown: '↓' };

// ── Âm thanh: [tần số, bắt đầu(s), độ dài(s), kiểu sóng, tần số cuối (quét)] ──
const BEEPS = {
  soft:   [[660, 0, .12, 'sine']],
  double: [[880, 0, .12], [880, .18, .12]],
  rise:   [[523, 0, .1], [659, .12, .1], [784, .24, .1], [1047, .36, .18]],
  fall:   [[1047, 0, .1], [784, .12, .1], [659, .24, .1], [523, .36, .18]],
  siren:  [[600, 0, .45, 'sawtooth', 1200], [1200, .45, .45, 'sawtooth', 600]],
  knock:  [[220, 0, .06], [220, .12, .06], [220, .24, .06]],
};
const BEEP_LOUD = ['double', 'rise', 'fall', 'siren', 'knock'];

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════
init();

async function init() {
  if (!pipSupported) $('pipWarn').style.display = 'block';

  // Register this tab + load all persisted state in one batch
  const [tab, local] = await Promise.all([
    chrome.tabs.getCurrent(),
    chrome.storage.local.get([
      KEY_TASKS, KEY_PHASE, KEY_CUR_TASK,
      KEY_WORK_END, KEY_BREAK_END, KEY_SHUTDOWN, KEY_ACK_STATS,
      'standupCfg', 'standupEndsAt',
    ]),
  ]);
  if (tab) await chrome.storage.local.set({ [KEY_TAB]: tab.id, standupTabId: tab.id });

  tasks       = local[KEY_TASKS]     || [];
  phase       = local[KEY_PHASE]     || 'idle';
  curTaskId   = local[KEY_CUR_TASK]  || null;
  workEndsAt  = local[KEY_WORK_END]  || null;
  breakEndsAt = local[KEY_BREAK_END] || null;
  ackStats    = Array.isArray(local[KEY_ACK_STATS]) ? local[KEY_ACK_STATS] : [];

  cfg = await getNeoSettings();
  await migrateRemindEvery();

  // Restore shutdown time field
  let savedShutdown = local[KEY_SHUTDOWN];
  if (!savedShutdown) {
    const d = new Date(Date.now() + 4 * 60 * 60 * 1000);
    savedShutdown = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  $('shutdownTime').value = savedShutdown;

  // Fill settings panel
  fillSettings(cfg);

  // Wire UI
  $('shutdownTime').addEventListener('change', () =>
    chrome.storage.local.set({ [KEY_SHUTDOWN]: $('shutdownTime').value }));

  // Settings modal
  $('settingsBtn').addEventListener('click', () => $('settingsOverlay').classList.add('open'));
  $('settingsCloseBtn').addEventListener('click', () => $('settingsOverlay').classList.remove('open'));
  $('settingsOverlay').addEventListener('click', (e) => {
    if (e.target === $('settingsOverlay')) $('settingsOverlay').classList.remove('open');
  });

  trackMouseOn(window);

  $('startBtn').addEventListener('click', onMainBtn);
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      onMainBtn();
    }
  });

  $('pipToggleBtn').addEventListener('click', async () => {
    if (pipWindow && !pipWindow.closed) {
      closePip();
    } else {
      await openPipWithState();
    }
    renderStatus();
  });

  wireAddTask();
  wireSettings();
  initMusic();
  initStandup(local);

  // Phase transition messages from background service worker
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'neo-work-end')   onWorkEnd();
    if (msg.type === 'neo-break-end')  onBreakEnd();
    if (msg.type === 'standup-alert')  showStandupAlert();
    // Media Hub hỏi trạng thái nhạc đang phát trong tab này
    if (msg.action === 'getMediaState' || msg.action === 'rescanMedia') {
      sendResponse(getMusicMediaState());
      return true;
    }
    if (msg.action === 'mediaControl') {
      sendResponse(handleMusicControl(msg.command, msg.value));
      return true;
    }
  });

  // Storage change (another tab modified tasks)
  chrome.storage.local.onChanged.addListener(async (changes) => {
    if (changes[KEY_TASKS]) {
      tasks = changes[KEY_TASKS].newValue || [];
      renderTaskList();
    }
  });

  renderAll();

  // Tự động chọn thời gian mặc định và focus tên task (trừ khi đã kết thúc phiên)
  if (phase !== 'alert_shutdown') {
    applyDefaultTime();
    $('taskNameInput').focus();
  }

  // Khôi phục đếm ngược nếu đang có phiên khi F5
  if (phase === 'working' || phase === 'breaking') {
    tick();
    tickTimer = setInterval(tick, 1000);
  }

  // Tự mở PiP khi trang load (tab được background mở lúc khởi động trình duyệt /
  // reload extension) — chưa có task thì PiP hiện luôn cảnh báo "thêm task".
  // Chrome bắt buộc user gesture cho documentPictureInPicture nên thường lần
  // thử đầu bị chặn → mở ngay ở thao tác đầu tiên của người dùng trong tab này.
  if (pipSupported && (!pipWindow || pipWindow.closed)) {
    const opened = await openPipWithState();
    if (opened) {
      renderStatus();
    } else {
      const openOnGesture = (e) => {
        document.removeEventListener('pointerdown', openOnGesture, true);
        document.removeEventListener('keydown', openOnGesture, true);
        // Bấm thẳng nút toggle PiP thì để handler của nút tự xử lý, tránh mở rồi đóng ngay
        if (e.target.closest && e.target.closest('#pipToggleBtn')) return;
        openPipWithState().then(() => renderStatus());
      };
      document.addEventListener('pointerdown', openOnGesture, true);
      document.addEventListener('keydown', openOnGesture, true);
    }
  }
}

// Mở PiP và hiển thị đúng trạng thái hiện tại (idle → cảnh báo phải có task)
async function openPipWithState() {
  await openPip();
  if (!pipWindow || pipWindow.closed) return false;
  if (phase === 'idle' || phase === 'alert_add') {
    // Chưa chạy đồng hồ → hiển thị dạng cảnh báo như lúc hết task
    setPipPhase('alert_add');
    startAlertFlash();
  } else {
    setPipPhase(phase);
    if (phase === 'working' && workEndsAt) {
      const task = tasks.find(t => t.id === curTaskId);
      if (task) updatePipWorking(task, workEndsAt - Date.now());
    } else if (phase === 'breaking' && breakEndsAt) {
      updatePipBreaking(breakEndsAt - Date.now());
    }
  }
  return true;
}

async function stopAll() {
  chrome.alarms.clear('neo-work-end');
  chrome.alarms.clear('neo-break-end');
  clearInterval(tickTimer);
  clearTimeout(pipRefreshTimer);
  stopAlertFlash();

  // Reset running task to pending
  tasks = tasks.map(t => t.status === 'running' || t.status === 'breaking'
    ? { ...t, status: 'pending' } : t);
  await saveTasks();

  phase     = 'idle';
  curTaskId = null;
  workEndsAt = null;
  breakEndsAt = null;
  await chrome.storage.local.set({ [KEY_PHASE]: 'idle', [KEY_CUR_TASK]: null });
  await chrome.storage.local.remove([KEY_WORK_END, KEY_BREAK_END]);

  closePip();
  renderAll();
}

// ══════════════════════════════════════════════
//  TASK MANAGEMENT
// ══════════════════════════════════════════════
function wireAddTask() {
  // Preset buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedWork  = parseFloat(btn.dataset.work);
      selectedBreak = parseFloat(btn.dataset.break);
      $('customWork').value = selectedWork;
      $('breakHint').textContent = formatBreakLabel(selectedBreak);
      $('customRow').classList.add('on');
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.toggle('on', b === btn));
      $('taskNameInput').focus();
    });
  });

  // Custom work input
  $('customWork').addEventListener('input', () => {
    const v = parseFloat($('customWork').value);
    if (v > 0) {
      selectedWork  = v;
      selectedBreak = Math.round(v / 5 * 10) / 10;
      $('breakHint').textContent = formatBreakLabel(selectedBreak);
      $('customRow').classList.add('on');
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('on'));
    } else {
      selectedWork = selectedBreak = null;
      $('breakHint').textContent = '';
      $('customRow').classList.remove('on');
    }
  });
  $('customWork').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); $('taskNameInput').focus(); return; }
    blockNonDigit(e);
  });

  $('addTaskForm').addEventListener('submit', (e) => { e.preventDefault(); addTask(); });
}

function formatBreakLabel(min) {
  const breakStr = min < 1 ? `${Math.round(min * 60)} giây` : `${min} phút`;
  return `phút làm, ${breakStr} nghỉ`;
}

function addTask() {
  const name = $('taskNameInput').value.trim();
  if (!selectedWork) {
    showToast('Chọn thời gian làm trước.');
    $('customWork').focus();
    return;
  }
  if (!name) { showToast('Nhập tên task trước.'); $('taskNameInput').focus(); return; }

  const task = {
    id: Date.now().toString(),
    name,
    workMin:  selectedWork,
    breakMin: selectedBreak,
    status:   'pending',
  };
  tasks.push(task);
  saveTasks();
  $('taskNameInput').value = '';
  renderTaskList();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderTaskList();
}

async function saveTasks() {
  await chrome.storage.local.set({ [KEY_TASKS]: tasks });
}

// ══════════════════════════════════════════════
//  SESSION CONTROL
// ══════════════════════════════════════════════
async function onMainBtn() {
  if (phase === 'alert_shutdown') {
    tasks = [];
    await saveTasks();
    await stopAll();
    return;
  }

  if (phase === 'working') {
    chrome.alarms.clear('neo-work-end');
    clearInterval(tickTimer);
    // Người dùng tự bấm "Qua pha" → đang nhìn rồi, không bắt xác nhận
    await startBreakPhase(curTaskId, 'light');
  } else if (phase === 'breaking') {
    chrome.alarms.clear('neo-break-end');
    clearInterval(tickTimer);
    await onBreakEnd(true);
  } else {
    const pending = tasks.filter(t => t.status === 'pending');
    if (pending.length === 0) {
      showToast(phase === 'alert_add'
        ? 'Thêm task trước khi tiếp tục.'
        : 'Thêm ít nhất một task trước khi bắt đầu.');
      applyDefaultTime();
      $('taskNameInput').focus();
      return;
    }
    if (phase === 'idle') {
      const [hh, mm] = ($('shutdownTime').value || '22:00').split(':').map(Number);
      const shutdown = new Date(); shutdown.setHours(hh, mm, 0, 0);
      if (new Date() >= shutdown) {
        showToast('Thời gian kết thúc phải sau thời điểm hiện tại.');
        $('shutdownTime').focus();
        return;
      }
    }
    await startWorkPhase(pending[0].id);
    if (!pipWindow || pipWindow.closed) {
      await openPip();
      setPipPhase('working');
      const task = tasks.find(t => t.id === pending[0].id);
      if (task) updatePipWorking(task, task.workMin * 60 * 1000);
      renderStatus();
    }
  }
}

// ══════════════════════════════════════════════
//  PHASE TRANSITIONS
// ══════════════════════════════════════════════
// alert: false = không gây chú ý | 'light' = nháy ngắn | 'strong' = gây chú ý mạnh (bắt xác nhận)
async function startWorkPhase(taskId, alert = false) {
  stopAlertFlash();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  // Mark running
  tasks = tasks.map(t => ({ ...t,
    status: t.id === taskId ? 'running'
          : t.status === 'running' || t.status === 'breaking' ? 'pending'
          : t.status
  }));
  await saveTasks();

  const ms    = task.workMin * 60 * 1000;
  workEndsAt  = Date.now() + ms;
  phase       = 'working';
  curTaskId   = taskId;

  await chrome.storage.local.set({
    [KEY_PHASE]: 'working', [KEY_CUR_TASK]: taskId,
    [KEY_WORK_END]: workEndsAt,
  });
  await chrome.storage.local.remove(KEY_BREAK_END);

  chrome.alarms.clear('neo-work-end');
  chrome.alarms.clear('neo-break-end');
  chrome.alarms.create('neo-work-end', { when: workEndsAt });

  if (alert !== 'strong') cancelAck({ view: false });
  if (pipWindow && !pipWindow.closed) {
    setPipPhase('working');
    updatePipWorking(task, workEndsAt - Date.now());
  }
  if (alert === 'strong') {
    strongAlert(`▶ Bắt đầu: ${task.name}`);
  } else if (alert === 'light') {
    triggerBlink();
    movePip('center');
  }

  clearInterval(tickTimer);
  tickTimer = setInterval(tick, 1000);
  renderAll();
  tick();
}

async function startBreakPhase(taskId, alert = 'strong') {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  chrome.runtime.sendMessage({ type: 'neo-notify', id: `neo-work-done-${Date.now()}`, title: 'Hết giờ làm!', message: `${task.name} — đến lúc nghỉ ngơi.` }).catch(() => {});

  tasks = tasks.map(t => t.id === taskId ? { ...t, status: 'breaking' } : t);
  await saveTasks();

  const ms     = task.breakMin * 60 * 1000;
  breakEndsAt  = Date.now() + ms;
  phase        = 'breaking';

  await chrome.storage.local.set({
    [KEY_PHASE]: 'breaking', [KEY_CUR_TASK]: taskId,
    [KEY_BREAK_END]: breakEndsAt,
  });
  await chrome.storage.local.remove(KEY_WORK_END);

  chrome.alarms.clear('neo-work-end');
  chrome.alarms.create('neo-break-end', { when: breakEndsAt });

  clearInterval(tickTimer);

  if (alert !== 'strong') cancelAck({ view: false });
  setPipPhase('breaking');
  if (pipWindow && !pipWindow.closed) {
    const msgEl = pipWindow.document.getElementById('p-break-msg');
    if (msgEl) msgEl.textContent = 'Hãy nghỉ ngơi!';
    if (alert === 'strong') {
      strongAlert('☕ Hết giờ làm — đứng dậy nghỉ ngơi!');
    } else {
      triggerBlink();
      movePip('center');
    }
  }

  tickTimer = setInterval(tick, 1000);
  renderAll();
  tick();
}

async function onWorkEnd() {
  if (phase !== 'working') return;
  clearInterval(tickTimer);
  await startBreakPhase(curTaskId, 'strong');
}

// manual = true khi người dùng tự bấm "Qua pha" (đang nhìn rồi → chỉ nháy nhẹ)
async function onBreakEnd(manual = false) {
  if (phase !== 'breaking') return;
  clearInterval(tickTimer);
  clearTimeout(pipRefreshTimer);

  const doneTask   = tasks.find(t => t.id === curTaskId);
  const nextPending = tasks.find(t => t.status === 'pending' && t.id !== curTaskId);
  chrome.runtime.sendMessage({ type: 'neo-notify', id: `neo-break-done-${Date.now()}`, title: 'Hết giờ nghỉ!', message: nextPending ? `${doneTask?.name ?? ''} xong — bắt đầu task tiếp theo.` : 'Tất cả task đã hoàn thành.' }).catch(() => {});

  tasks = tasks.map(t => t.id === curTaskId ? { ...t, status: 'done' } : t);
  await saveTasks();

  if (nextPending) {
    await startWorkPhase(nextPending.id, manual ? 'light' : 'strong');
    return;
  }

  // No more tasks — check shutdown time
  const shutdownStr = $('shutdownTime').value || '22:00';
  const [hh, mm]    = shutdownStr.split(':').map(Number);
  const now         = new Date();
  const shutdown    = new Date(now);
  shutdown.setHours(hh, mm, 0, 0);

  if (now >= shutdown) {
    await enterAlertShutdown();
  } else {
    await enterAlertAdd();
  }
}

async function enterAlertAdd() {
  phase = 'alert_add';
  await chrome.storage.local.set({ [KEY_PHASE]: 'alert_add' });
  clearTimeout(pipRefreshTimer);
  cancelAck({ view: false });
  setPipPhase('alert_add');
  movePip('center');
  startAlertFlash();
  renderAll();
}

async function enterAlertShutdown() {
  phase = 'alert_shutdown';
  await chrome.storage.local.set({ [KEY_PHASE]: 'alert_shutdown' });
  cancelAck({ view: false });
  setPipPhase('alert_shutdown');
  applyPipLook(true);
  movePip('center');
  renderAll();
}

// ══════════════════════════════════════════════
//  TICK
// ══════════════════════════════════════════════
function tick() {
  if (phase === 'working' && workEndsAt) {
    const rem = workEndsAt - Date.now();
    if (rem <= 0) { clearInterval(tickTimer); onWorkEnd(); return; }
    const task = tasks.find(t => t.id === curTaskId);
    updatePipWorking(task, rem);
    const el = document.getElementById(`neo-wclk-${curTaskId}`);
    if (el) el.innerHTML = `<span class="st-run">${fmtRemaining(rem)}</span>`;
  } else if (phase === 'breaking' && breakEndsAt) {
    const rem = breakEndsAt - Date.now();
    if (rem <= 0) { clearInterval(tickTimer); onBreakEnd(); return; }
    updatePipBreaking(rem);
    const el = document.getElementById(`neo-bclk-${curTaskId}`);
    if (el) el.innerHTML = `<span class="st-break">${fmtRemaining(rem)}</span>`;
  }
}

// ══════════════════════════════════════════════
//  PiP
// ══════════════════════════════════════════════
async function openPip() {
  if (!pipSupported) return;
  if (pipWindow && !pipWindow.closed) return;
  const before = new Set((await chrome.windows.getAll()).map(w => w.id));
  try {
    pipWindow = await documentPictureInPicture.requestWindow({ width: PIP_W, height: PIP_H });
  } catch (e) {
    return;
  }
  const after  = await chrome.windows.getAll();
  const newWin = after.find(w => !before.has(w.id));
  if (newWin) {
    pipWinId = newWin.id;
    await chrome.storage.local.set({ [KEY_PIP_WIN]: newWin.id });
    await pipRegistryAdd('neo', newWin.id);
  }
  setupPipContent();
  // Đo title bar sau khi Chrome auto-resize xong, rồi set lại để content = 90px
  if (newWin) {
    setTimeout(async () => {
      if (!pipWindow || pipWindow.closed) return;
      const win = await chrome.windows.get(newWin.id).catch(() => null);
      if (!win) return;
      // Đang có thử thách xác nhận (PiP đã được phóng to) → để nguyên
      if (ack) return;
      const titleBar = win.height - pipWindow.innerHeight;
      pipTitleBar = titleBar;
      const w = PIP_W, h = PIP_H + titleBar;
      const upd = { width: w, height: h };
      // Chrome luôn mở PiP ở màn hình chính → kéo sang màn hình người dùng đang dùng
      const area = await getTargetArea();
      const cx = win.left + win.width / 2, cy = win.top + win.height / 2;
      const onArea = cx >= area.left && cx < area.left + area.width &&
                     cy >= area.top  && cy < area.top  + area.height;
      if (!onArea) {
        upd.left = area.left + Math.round((area.width  - w) / 2);
        upd.top  = area.top  + Math.round((area.height - h) / 2);
        pipAtCenter = true;
      }
      chrome.windows.update(newWin.id, upd);
    }, 200);
  }
  startPipRefresh();
  scheduleRemind();

  trackMouseOn(pipWindow);
  pipWindow.addEventListener('keydown', onPipKey);
  pipWindow.document.body.addEventListener('mouseenter', (e) => {
    if (standupPipActive || remindActive || ack) return;
    if (phase === 'idle' || phase === 'alert_add' || phase === 'breaking') return;
    const fromTop = e.clientY < 8 && e.clientX > 5 && e.clientX < pipWindow.innerWidth - 5;
    if (!fromTop) movePip(pipAtCenter ? 'random-corner' : 'opposite-corner');
  });
  pipWindow.addEventListener('pagehide', () => {
    clearTimeout(pipRefreshTimer);
    stopRemind();
    stopFxTimers();
    clearAckTimers();
    ack = null;
    motionToken++;
    chrome.storage.local.remove(KEY_PIP_WIN);
    pipRegistryRemove('neo');
    pipWindow = null;
    pipWinId = null;
    renderStatus();
  });
}

function closePip() {
  clearTimeout(pipRefreshTimer);
  stopRemind();
  stopFxTimers();
  clearAckTimers();
  ack = null;
  motionToken++;
  if (pipWindow && !pipWindow.closed) pipWindow.close();
  pipWindow = null;
  pipWinId = null;
  chrome.storage.local.remove(KEY_PIP_WIN);
  pipRegistryRemove('neo');
}

function setupPipContent() {
  const doc = pipWindow.document;
  const style = doc.createElement('style');
  style.textContent = `
    :root { color-scheme: dark; }
    html, body { margin:0; padding:0; width:100%; height:100%; overflow:hidden; }
    body { position:relative; background:var(--neo-bg,#11151f); color:var(--neo-fg,#f4f1e8);
      font:13px/1 ui-sans-serif,system-ui,sans-serif;
      transition:background .6s ease,color .6s ease; }
    .pip-row { display:flex; align-items:center; gap:10px;
      padding:0 14px; height:56px; box-sizing:border-box; }
    .pip-label { font-size:10px; letter-spacing:.14em; color:var(--neo-accent,#f0a33c);
      flex-shrink:0; font-weight:600; }
    .pip-name { flex:1; font-size:14px; font-weight:700; line-height:1.4; white-space:nowrap;
      overflow:hidden; text-overflow:ellipsis; }
    .pip-clock { font-size:14px; font-variant-numeric:tabular-nums; flex-shrink:0;
      color:var(--neo-muted,#828ca0); letter-spacing:.04em; }
    .pip-msg { flex:1; font-size:13px; font-weight:600; }
    .pip-remind { flex:1; text-align:center; font-size:15px; font-weight:700; line-height:1.35;
      color:var(--neo-accent,#f0a33c); }
    .pip-ask { font-size:11px; color:var(--neo-muted,#828ca0); padding:4px 14px 0; line-height:1.4; }
    button.pip-btn { flex-shrink:0; padding:6px 12px; border-radius:20px; border:none;
      background:var(--neo-accent,#f0a33c); color:#11151f; font:12px/1 ui-sans-serif,system-ui;
      font-weight:700; cursor:pointer; }
    .tide { position:absolute; bottom:0; left:0; right:0; height:3px;
      background:var(--neo-line,#2a3142); overflow:hidden; }
    .tide-fill { height:100%; background:var(--neo-accent,#f0a33c); width:100%; transition:width 1s linear; }
    .pip-wrap { position:relative; height:90px; overflow:hidden; }
    .hidden { display:none!important; }

    /* ── Thử thách xác nhận ── */
    #s-ack { height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:6px; padding:6px 10px; box-sizing:border-box; position:relative; z-index:2; }
    .ack-msg { font-weight:800; text-align:center; line-height:1.25; max-width:100%;
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--ack-msg,13px);
      text-shadow:0 1px 3px rgba(0,0,0,.55); }
    .ack-ask { display:flex; align-items:center; gap:8px; font-size:var(--ack-ask,11px); font-weight:600;
      text-shadow:0 1px 3px rgba(0,0,0,.55); }
    .ack-target { display:inline-flex; align-items:center; justify-content:center; min-width:1.6em;
      padding:2px 8px; border-radius:6px; background:#fff; color:#111; font-weight:900;
      font-size:var(--ack-target,16px); text-shadow:none; }
    .ack-opts { display:flex; gap:var(--ack-gap,6px); }
    .ack-opt { min-width:var(--ack-btn,34px); height:var(--ack-btn,34px); padding:0 6px; border-radius:8px;
      border:2px solid rgba(255,255,255,.75); background:rgba(0,0,0,.5); color:#fff; cursor:pointer;
      font:800 var(--ack-opt,16px)/1 ui-sans-serif,system-ui; transition:transform .1s ease; }
    .ack-opt:hover { transform:scale(1.08); background:rgba(0,0,0,.7); }
    .ack-opt.wrong { animation:ack-wrong .35s ease; border-color:#ff3b30; }
    @keyframes ack-wrong { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
    .ack-ok { font-size:var(--ack-msg,15px); font-weight:800; color:#34c759; text-shadow:0 1px 3px rgba(0,0,0,.6); }
    body.ack-l1 { --ack-msg:17px; --ack-ask:13px; --ack-target:22px; --ack-btn:44px; --ack-opt:20px; --ack-gap:8px; }
    body.ack-l2 { --ack-msg:24px; --ack-ask:16px; --ack-target:30px; --ack-btn:58px; --ack-opt:26px; --ack-gap:12px; }

    /* ── Thư viện hiệu ứng gây chú ý ── */
    body.fx-rainbow   { animation:fx-rainbow .8s steps(1) infinite; }
    @keyframes fx-rainbow {
      0%   {background:#ff3b30;color:#fff}
      14%  {background:#ff9500;color:#000}
      28%  {background:#ffcc00;color:#000}
      42%  {background:#34c759;color:#000}
      57%  {background:#007aff;color:#fff}
      71%  {background:#5856d6;color:#fff}
      85%  {background:#ff2d55;color:#fff}
      100% {background:var(--neo-bg,#11151f);color:var(--neo-fg,#f4f1e8)}
    }
    body.fx-strobe    { animation:fx-strobe .16s steps(1) infinite; }
    @keyframes fx-strobe { 0%{background:#fff;color:#000} 50%{background:#000;color:#fff} }
    body.fx-invert    { animation:fx-invert .45s steps(1) infinite; }
    @keyframes fx-invert { 0%{filter:invert(1) hue-rotate(180deg)} 50%{filter:none} }
    body.fx-redalarm  { animation:fx-redalarm .6s ease-in-out infinite; }
    @keyframes fx-redalarm {
      0%,100% {background:#3a0000;color:#fff;box-shadow:inset 0 0 0 0 #ff0000}
      50%     {background:#ff1a1a;color:#fff;box-shadow:inset 0 0 0 6px #ffe600}
    }
    body.fx-hazard    { color:#fff; background:repeating-linear-gradient(45deg,#ffcc00 0 18px,#111 18px 36px);
      background-size:51px 51px; animation:fx-hazard .5s linear infinite; text-shadow:0 0 4px #000,0 0 2px #000; }
    @keyframes fx-hazard { from{background-position:0 0} to{background-position:51px 0} }
    body.fx-sweep::after { content:""; position:absolute; inset:0; pointer-events:none; z-index:1;
      background:linear-gradient(100deg,transparent 0%,rgba(255,255,255,0) 30%,rgba(255,255,255,.95) 50%,rgba(255,255,255,0) 70%,transparent 100%);
      background-size:250% 100%; animation:fx-sweep .7s linear infinite; mix-blend-mode:overlay; }
    body.fx-sweep     { animation:fx-sweep-bg .7s steps(1) infinite; }
    @keyframes fx-sweep { from{background-position:150% 0} to{background-position:-100% 0} }
    @keyframes fx-sweep-bg { 0%{background:#007aff;color:#fff} 50%{background:#ff2d55;color:#fff} }
    body.fx-heartbeat { animation:fx-heartbeat .9s ease-in-out infinite; }
    @keyframes fx-heartbeat {
      0%,40%,100% {background:var(--neo-bg,#11151f);transform:scale(1)}
      10%  {background:#ff2d55;color:#fff;transform:scale(1.06)}
      25%  {background:#ff2d55;color:#fff;transform:scale(1.03)}
    }
    body.fx-shake     { background:#ff9500; color:#000; }
    body.fx-shake > div { animation:fx-shake .25s linear infinite; }
    @keyframes fx-shake { 0%,100%{transform:translate(0,0)} 25%{transform:translate(-5px,2px)} 50%{transform:translate(4px,-2px)} 75%{transform:translate(-3px,-1px)} }
    body.fx-glitch    { animation:fx-glitch .35s steps(2) infinite; }
    @keyframes fx-glitch {
      0%   {background:#00ffd5;color:#000;filter:hue-rotate(0deg);transform:skewX(0)}
      33%  {background:#ff00aa;color:#fff;filter:hue-rotate(90deg);transform:skewX(-8deg)}
      66%  {background:#000;color:#0f0;filter:hue-rotate(200deg);transform:skewX(6deg)}
      100% {background:#fff;color:#000;transform:skewX(0)}
    }
    body.fx-ripple    { animation:fx-ripple 1s ease-out infinite; background:#0b2a5c; color:#fff; }
    @keyframes fx-ripple {
      0%   {box-shadow:inset 0 0 0 0 rgba(0,229,255,.95), inset 0 0 0 0 rgba(255,255,255,.8)}
      100% {box-shadow:inset 0 0 0 40px rgba(0,229,255,0), inset 0 0 0 80px rgba(255,255,255,0)}
    }
    body.fx-blackout  { animation:fx-blackout 1.1s steps(1) infinite; }
    @keyframes fx-blackout {
      0%  {background:#000;color:#000}
      40% {background:#fff;color:#000}
      55% {background:#000;color:#fff}
      70% {background:#fff;color:#000}
    }
  `;
  doc.head.appendChild(style);

  doc.body.innerHTML = `
    <!-- working -->
    <div id="s-working" class="pip-wrap">
      <div class="pip-row">
        <span class="pip-name" id="p-goal"></span>
        <span class="pip-clock" id="p-work-clock">--:--</span>
      </div>
      <div class="pip-ask" id="p-ask"></div>
      <div class="tide"><div class="tide-fill" id="p-tide"></div></div>
    </div>
    <!-- breaking -->
    <div id="s-breaking" class="pip-wrap hidden">
      <div class="pip-row">
        <span class="pip-label">NGHỈ</span>
        <span class="pip-name" id="p-break-msg">Thư giãn, bước ra khỏi ghế</span>
        <span class="pip-clock" id="p-break-clock">--:--</span>
      </div>
      <div class="tide"><div class="tide-fill" id="p-break-tide"></div></div>
    </div>
    <!-- alert: add tasks -->
    <div id="s-alert-add" class="pip-wrap hidden">
      <div class="pip-row">
        <span class="pip-msg">Thêm task để tiếp tục!</span>
        <button class="pip-btn" id="p-go-setup">Vào thiết lập</button>
      </div>
    </div>
    <!-- alert: shutdown -->
    <div id="s-alert-shutdown" class="pip-wrap hidden">
      <div class="pip-row">
        <span class="pip-msg">Đã đến giờ nghỉ! Tắt máy thôi.</span>
      </div>
    </div>
    <!-- alert: standup -->
    <div id="s-standup-alert" class="pip-wrap hidden">
      <div class="pip-row">
        <span class="pip-msg">🧍 Đứng dậy đi!</span>
        <button class="pip-btn" id="p-go-standup">Vào điểm danh</button>
      </div>
    </div>
    <!-- reminder text -->
    <div id="s-remind" class="pip-wrap hidden">
      <div class="pip-row">
        <span class="pip-remind" id="p-remind-text"></span>
      </div>
    </div>
    <!-- attention check: bắt buộc xác nhận -->
    <div id="s-ack" class="hidden">
      <div class="ack-msg" id="p-ack-msg"></div>
      <div class="ack-ask" id="p-ack-ask">Bấm vào <span class="ack-target" id="p-ack-target"></span></div>
      <div class="ack-opts" id="p-ack-opts"></div>
      <div class="ack-ok hidden" id="p-ack-ok"></div>
    </div>
  `;

  doc.getElementById('p-go-setup').addEventListener('click', () => {
    focusAnchorTab();
    applyDefaultTime();
    $('taskNameInput').focus();
  });
  doc.getElementById('p-go-standup').addEventListener('click', focusAnchorTab);
  doc.getElementById('p-ack-opts').addEventListener('click', (e) => {
    const btn = e.target.closest('.ack-opt');
    if (btn) answerAck(btn.dataset.v, btn);
  });
}

async function focusAnchorTab() {
  const tab = await chrome.tabs.getCurrent();
  if (tab) {
    chrome.windows.update(tab.windowId, { focused: true });
    chrome.tabs.update(tab.id, { active: true });
  }
}

function showPipSection(id) {
  if (!pipWindow || pipWindow.closed) return;
  const doc = pipWindow.document;
  PIP_SECTIONS.forEach(s => doc.getElementById(s)?.classList.toggle('hidden', s !== id));
}

function setPipPhase(p) {
  if (!pipWindow || pipWindow.closed) return;
  if (standupPipActive) return;
  // Đang chờ xác nhận → giữ màn thử thách; finishAck sẽ hiển thị pha mới nhất sau đó
  if (ack) return;
  // Text nhắc nhở giữ PiP đủ 3 giây; hideRemind sẽ hiển thị pha mới nhất sau đó
  if (remindActive) return;
  showPipSection(`s-${p.replace('_', '-')}`);
}

// Hiển thị lại đúng trạng thái phiên hiện tại (sau nhắc nhở / sau xác nhận)
function restorePhaseView() {
  if (!pipWindow || pipWindow.closed) return;
  if (standupPipActive || ack || remindActive) return;
  if (phase === 'idle' || phase === 'alert_add') {
    setPipPhase('alert_add');
    startAlertFlash(); // khôi phục nháy liên tục của màn cảnh báo
  } else {
    setPipPhase(phase);
  }
}

function updatePipWorking(task, remMs) {
  if (!pipWindow || pipWindow.closed || !task) return;
  const doc  = pipWindow.document;
  const goal = doc.getElementById('p-goal');
  const clk  = doc.getElementById('p-work-clock');
  const tide = doc.getElementById('p-tide');
  if (goal) goal.textContent = task.name;
  if (clk)  clk.textContent  = fmtRemaining(remMs);
  if (tide) {
    const total = task.workMin * 60 * 1000;
    tide.style.width = `${Math.max(0, (remMs / total) * 100)}%`;
  }
}

function updatePipBreaking(remMs) {
  if (!pipWindow || pipWindow.closed) return;
  const doc  = pipWindow.document;
  const clk  = doc.getElementById('p-break-clock');
  const tide = doc.getElementById('p-break-tide');
  const task = tasks.find(t => t.id === curTaskId);
  if (clk)  clk.textContent = fmtRemaining(remMs);
  if (tide && task) {
    const total = task.breakMin * 60 * 1000;
    tide.style.width = `${Math.max(0, (remMs / total) * 100)}%`;
  }
}

// ══════════════════════════════════════════════
//  HIỆU ỨNG GÂY CHÚ Ý (đa dạng hoá)
// ══════════════════════════════════════════════
// Chọn ngẫu nhiên 1 hiệu ứng trong pool, tránh 3 hiệu ứng vừa dùng gần nhất
function pickFx(pool) {
  const recent = fxHistory.slice(-3);
  const fresh = pool.filter(f => !recent.includes(f));
  const list = fresh.length ? fresh : pool;
  const fx = list[Math.floor(Math.random() * list.length)];
  fxHistory.push(fx);
  if (fxHistory.length > 10) fxHistory.shift();
  return fx;
}

function setFxClass(fx) {
  if (!pipWindow || pipWindow.closed) return;
  const body = pipWindow.document.body;
  FX_ALL.forEach(c => body.classList.remove(c));
  if (!fx) return;
  void body.offsetWidth; // restart animation
  body.classList.add(fx);
}

function stopFxTimers() {
  clearTimeout(fxStopTimer);
  clearInterval(fxRotateTimer);
  fxLooping = false;
}

// Nháy 1 hiệu ứng ngẫu nhiên trong durMs (không lặp)
function playFx(poolName, durMs) {
  if (!pipWindow || pipWindow.closed) return;
  stopFxTimers();
  setFxClass(pickFx(FX_POOL[poolName] || FX_POOL.light));
  fxStopTimer = setTimeout(() => setFxClass(null), durMs);
}

// Nháy liên tục, cứ FX_LOOP_ROTATE_MS lại đổi kiểu hiệu ứng để mắt không quen
function loopFx(poolName) {
  if (!pipWindow || pipWindow.closed) return;
  stopFxTimers();
  fxLooping = true;
  const pool = FX_POOL[poolName] || FX_POOL.loop;
  setFxClass(pickFx(pool));
  fxRotateTimer = setInterval(() => setFxClass(pickFx(pool)), FX_LOOP_ROTATE_MS);
}

function flashPip(infinite = false) {
  if (!pipWindow || pipWindow.closed) return;
  if (standupPipActive || ack) return;
  if (infinite) { loopFx('loop'); return; }
  const dur = cfg?.alertDuration;
  if (!(dur > 0)) return;
  playFx('light', dur * 1000);
}
const triggerBlink    = () => flashPip(false);
const startAlertFlash = () => flashPip(true);

function stopAlertFlash() {
  stopFxTimers();
  setFxClass(null);
}

// ══════════════════════════════════════════════
//  CHUYỂN ĐỘNG CỬA SỔ PiP
// ══════════════════════════════════════════════
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Kích thước cửa sổ (gồm thanh tiêu đề) cho kích thước nội dung {w,h}
function outerSize(size) {
  const tb = pipTitleBar ?? 32;
  return { width: size.w, height: size.h + tb };
}

// Đặt PiP ở giữa màn hình người dùng đang dùng, đồng thời đổi kích thước
async function placePipCenter(size) {
  const id = pipWinId;
  if (!id) return null;
  const area = await getTargetArea();
  const { width, height } = outerSize(size);
  const target = {
    width, height,
    left: area.left + Math.round((area.width  - width)  / 2),
    top:  area.top  + Math.round((area.height - height) / 2),
  };
  try { await chrome.windows.update(id, target); } catch (_) { return null; }
  pipAtCenter = true;
  return { area, target };
}

// Chạy chuyển động cửa sổ, kết thúc ở vị trí target. kind: shake|drop|slide|hop
async function runMotion(kind, area, target) {
  const id = pipWinId;
  if (!id) return;
  const my = ++motionToken;
  const frames = [];
  const { left: L, top: T, width: W, height: H } = target;
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  if (kind === 'shake') {
    for (let i = 0; i < 14; i++) {
      const amp = 26 * (1 - i / 14);
      frames.push({ left: L + Math.round((i % 2 ? amp : -amp)), top: T + Math.round((Math.random() - .5) * amp * .6) });
    }
  } else if (kind === 'drop') {
    const startTop = area.top;
    for (let i = 1; i <= 10; i++) frames.push({ left: L, top: Math.round(startTop + (T - startTop) * ease(i / 10)) });
    [-24, 0, -10, 0].forEach(d => frames.push({ left: L, top: T + d }));
  } else if (kind === 'slide') {
    const fromLeft = Math.random() < .5;
    const startLeft = fromLeft ? area.left : area.left + area.width - W;
    for (let i = 1; i <= 10; i++) frames.push({ left: Math.round(startLeft + (L - startLeft) * ease(i / 10)), top: T });
    [fromLeft ? 18 : -18, 0].forEach(d => frames.push({ left: L + d, top: T }));
  } else { // hop
    [-40, 0, -24, 0, -10, 0].forEach(d => frames.push({ left: L, top: T + d }));
  }
  frames.push({ left: L, top: T });
  for (const f of frames) {
    if (my !== motionToken || !pipWinId) return;
    // Giữ trong vùng màn hình
    f.left = Math.max(area.left, Math.min(area.left + area.width  - W, f.left));
    f.top  = Math.max(area.top,  Math.min(area.top  + area.height - H, f.top));
    try { await chrome.windows.update(id, f); } catch (_) { return; }
    await sleep(MOTION_STEP_MS);
  }
}

function pickMotion() {
  const list = MOTIONS.filter(m => m !== lastMotion);
  lastMotion = list[Math.floor(Math.random() * list.length)];
  return lastMotion;
}

// ══════════════════════════════════════════════
//  ÂM THANH
// ══════════════════════════════════════════════
function playBeep(name) {
  if (cfg?.alertSoundOn === false) return;
  const seq = BEEPS[name];
  if (!seq) return;
  try {
    audioCtx = audioCtx || new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const t0 = audioCtx.currentTime + .02;
    seq.forEach(([freq, start, len, type = 'square', freqEnd]) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0 + start);
      if (freqEnd) osc.frequency.linearRampToValueAtTime(freqEnd, t0 + start + len);
      gain.gain.setValueAtTime(0, t0 + start);
      gain.gain.linearRampToValueAtTime(ACK_VOLUME, t0 + start + .01);
      gain.gain.setValueAtTime(ACK_VOLUME, t0 + start + len - .02);
      gain.gain.linearRampToValueAtTime(0, t0 + start + len);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + len + .02);
    });
  } catch (_) {}
}

// ══════════════════════════════════════════════
//  GÂY CHÚ Ý MẠNH — BẮT BUỘC XÁC NHẬN
// ══════════════════════════════════════════════
// Bỏ qua thông báo thì không tắt được: phải nhìn vào PiP và bấm đúng ký hiệu.
// Mỗi ACK_ESCALATE_SEC giây chưa xác nhận → PiP to hơn, rung, đổi hiệu ứng, kêu to dần.
function ackEnabled(kind) {
  const mode = cfg?.ackMode ?? DEFAULTS.ackMode;
  if (mode === 'off') return false;
  if (kind === 'refresh') return mode === 'all';
  return true;
}

function clearAckTimers() {
  clearTimeout(ackTimer);
  clearTimeout(ackDoneTimer);
}

// Phản xạ trung bình gần đây chậm → lần sau bắt đầu luôn ở mức cao hơn
function adaptiveStartLevel() {
  const recent = ackStats.slice(-5);
  if (recent.length < 3) return 0;
  const avg = recent.reduce((s, x) => s + x, 0) / recent.length;
  return avg > 10_000 ? 1 : 0;
}

async function strongAlert(msg, kind = 'phase') {
  if (!pipWindow || pipWindow.closed) return;
  if (standupPipActive) return; // nhắc đứng dậy đang chiếm PiP (bản thân nó đã bắt điểm danh)
  // Nhắc nhở đang hiện → huỷ để nhường chỗ
  if (remindActive) { clearTimeout(remindHideTimer); remindActive = false; }

  if (!ackEnabled(kind)) {
    // Không bắt xác nhận: vẫn đa dạng hoá hiệu ứng + chuyển động cửa sổ
    const dur = (cfg?.alertDuration > 0 ? cfg.alertDuration : 2) * 1000;
    playFx('strong', dur);
    const placed = await placePipCenter({ w: PIP_W, h: PIP_H });
    if (placed) runMotion(pickMotion(), placed.area, placed.target);
    return;
  }

  const keepLevel = ack && !ack.done ? ack.level : null;
  clearAckTimers();
  ack = {
    startedAt: ack && !ack.done ? ack.startedAt : Date.now(),
    level: keepLevel ?? adaptiveStartLevel(),
    wrong: 0, msg, kind, done: false,
  };
  newAckChallenge();
  showPipSection('s-ack');
  await renderAckLevel(true);
  scheduleAckEscalate();
}

// Tạo thử thách mới: ký hiệu đích + các lựa chọn xáo trộn (đổi mỗi lần nên không bấm theo quán tính được)
function newAckChallenge() {
  if (!ack) return;
  const set = ACK_SETS[Math.floor(Math.random() * ACK_SETS.length)];
  const n = Math.min(4, set.length);
  const opts = [...set].sort(() => Math.random() - .5).slice(0, n);
  ack.opts = opts;
  ack.target = opts[Math.floor(Math.random() * n)];
  ack.shownAt = Date.now();
  renderAckChallenge();
}

function renderAckChallenge() {
  if (!ack || !pipWindow || pipWindow.closed) return;
  const doc = pipWindow.document;
  doc.getElementById('p-ack-msg').textContent = ack.msg;
  doc.getElementById('p-ack-target').textContent = ack.target;
  doc.getElementById('p-ack-ok').classList.add('hidden');
  doc.getElementById('p-ack-ask').classList.remove('hidden');
  const box = doc.getElementById('p-ack-opts');
  box.classList.remove('hidden');
  // Số / mũi tên: gõ phím tương ứng cũng được; ký hiệu hình: phím 1..4 theo vị trí
  box.innerHTML = ack.opts.map(v =>
    `<button class="ack-opt" data-v="${v}">${v}</button>`).join('');
}

async function renderAckLevel(withMotion) {
  if (!ack || !pipWindow || pipWindow.closed) return;
  const body = pipWindow.document.body;
  body.classList.remove('ack-l1', 'ack-l2');
  if (ack.level > 0) body.classList.add(`ack-l${ack.level}`);
  loopFx(ack.level === 0 ? 'loop' : 'strong');
  const placed = await placePipCenter(ACK_SIZES[ack.level]);
  if (withMotion && placed && ack) runMotion(pickMotion(), placed.area, placed.target);
  // Âm thanh: mức 0 kêu nhẹ, mức cao kêu to dần; quá ACK_SOUND_MAX_MS thì thôi
  if (ack && Date.now() - ack.startedAt < ACK_SOUND_MAX_MS) {
    playBeep(ack.level === 0 ? 'soft' : BEEP_LOUD[Math.floor(Math.random() * BEEP_LOUD.length)]);
  }
}

function scheduleAckEscalate() {
  clearTimeout(ackTimer);
  const sec = clamp(cfg?.ackEscalateSec, 3, 60, DEFAULTS.ackEscalateSec);
  ackTimer = setTimeout(async () => {
    if (!ack || ack.done) return;
    if (!pipWindow || pipWindow.closed) return;
    ack.level = Math.min(ACK_MAX_LEVEL, ack.level + 1);
    newAckChallenge(); // đổi đề để không bấm mò theo vị trí cũ
    await renderAckLevel(true);
    scheduleAckEscalate();
  }, sec * 1000);
}

function answerAck(v, btn) {
  if (!ack || ack.done) return;
  // Click ngay khi thử thách vừa hiện = PiP nhảy tới dưới con trỏ, không tính
  if (Date.now() - ack.shownAt < ACK_GRACE_MS) return;
  if (v === ack.target) { finishAck(); return; }
  ack.wrong++;
  if (btn) {
    btn.classList.remove('wrong'); void btn.offsetWidth; btn.classList.add('wrong');
  }
  playBeep('knock');
  setTimeout(() => { if (ack && !ack.done) newAckChallenge(); }, 350);
}

function onPipKey(e) {
  if (!ack || ack.done) return;
  let v = null;
  if (ARROW_KEYS[e.key] && ack.opts.includes(ARROW_KEYS[e.key])) v = ARROW_KEYS[e.key];
  else if (/^\d$/.test(e.key)) {
    if (ack.opts.includes(e.key)) v = e.key;                       // bộ số: gõ đúng số
    else if (!ack.opts.some(o => /^\d$/.test(o))) v = ack.opts[Number(e.key) - 1]; // bộ hình: phím 1..4 theo vị trí
  }
  if (v == null) return;
  e.preventDefault();
  const btn = pipWindow.document.querySelector(`.ack-opt[data-v="${CSS.escape(v)}"]`);
  answerAck(v, btn);
}

async function finishAck() {
  if (!ack) return;
  const reaction = Date.now() - ack.startedAt;
  ack.done = true;
  clearAckTimers();
  motionToken++;
  ackStats.push(reaction);
  if (ackStats.length > ACK_STATS_MAX) ackStats = ackStats.slice(-ACK_STATS_MAX);
  chrome.storage.local.set({ [KEY_ACK_STATS]: ackStats });
  renderAckStats();

  stopAlertFlash();
  if (pipWindow && !pipWindow.closed) {
    const doc = pipWindow.document;
    doc.getElementById('p-ack-ask').classList.add('hidden');
    doc.getElementById('p-ack-opts').classList.add('hidden');
    const ok = doc.getElementById('p-ack-ok');
    ok.textContent = `✓ Phản xạ ${(reaction / 1000).toFixed(1)} giây${ack.wrong ? ` · sai ${ack.wrong} lần` : ''}`;
    ok.classList.remove('hidden');
  }
  ackDoneTimer = setTimeout(() => cancelAck({ view: true }), ACK_FEEDBACK_MS);
}

// Kết thúc phiên xác nhận: thu PiP về kích thước thường, hiện lại trạng thái phiên
// view = false khi pha mới sẽ tự hiển thị (enterAlertAdd...)
function cancelAck({ view = true } = {}) {
  if (!ack) return;
  clearAckTimers();
  motionToken++;
  ack = null;
  stopAlertFlash();
  if (!pipWindow || pipWindow.closed) return;
  pipWindow.document.body.classList.remove('ack-l1', 'ack-l2');
  placePipCenter({ w: PIP_W, h: PIP_H });
  if (view) {
    restorePhaseView();
    if (phase === 'working') applyPipLook(false);
  }
}

// ── Text nhắc nhở định kỳ ──
// Ưu tiên hiển thị: 1) nhắc đứng dậy  2) xác nhận gây chú ý mạnh  3) text nhắc nhở  4) trạng thái task
function scheduleRemind() {
  clearTimeout(remindTimer);
  if (!cfg?.remindOn) return;
  if (!pipWindow || pipWindow.closed) return;
  const { lo, hi } = remindRangeSec(cfg);
  const sec = lo + Math.random() * (hi - lo);
  remindTimer = setTimeout(showRemind, sec * 1000);
}

// Cấu hình cũ chỉ có một chu kỳ cố định remindEverySec → giữ nguyên nhịp đó dưới dạng khoảng min = max
async function migrateRemindEvery() {
  const raw = await getNeoSettings();
  if (raw.remindEverySec == null || raw.remindMinSec != null) return;
  const sec = clamp(raw.remindEverySec, 10, 60, DEFAULTS.remindMinSec);
  cfg.remindMinSec = cfg.remindMaxSec = sec;
  const { remindEverySec, ...rest } = raw;
  await chrome.storage.local.set({
    [NEO_SETTINGS_KEY]: { ...rest, remindMinSec: sec, remindMaxSec: sec },
  });
}

function remindRangeSec(c) {
  const lo = clamp(c?.remindMinSec, 10, 60, DEFAULTS.remindMinSec);
  const hi = clamp(c?.remindMaxSec, 10, 60, DEFAULTS.remindMaxSec);
  return { lo, hi: Math.max(lo, hi) };
}

function showRemind() {
  scheduleRemind(); // đặt lịch cho lượt kế tiếp
  if (!pipWindow || pipWindow.closed) return;
  if (standupPipActive || ack) return; // PiP đang bị chiếm → bỏ qua lượt này
  const texts = (cfg?.asksRemind?.length) ? cfg.asksRemind : DEFAULTS.asksRemind;
  let i;
  do { i = Math.floor(Math.random() * texts.length); } while (texts.length > 1 && i === remindLastIdx);
  remindLastIdx = i;
  const doc = pipWindow.document;
  const el = doc.getElementById('p-remind-text');
  if (el) el.textContent = texts[i];
  showPipSection('s-remind');
  remindActive = true;
  movePip('center');
  // Nhắc nhở xuất hiện dày → chỉ dùng hiệu ứng nhẹ, luân phiên kiểu để không bị quen
  const dur = (cfg?.alertDuration > 0 ? cfg.alertDuration : 2) * 1000;
  playFx('light', Math.min(dur, 3000));
  clearTimeout(remindHideTimer);
  remindHideTimer = setTimeout(hideRemind, 3000);
}

function hideRemind() {
  remindActive = false;
  if (!pipWindow || pipWindow.closed) return;
  if (standupPipActive || ack) return;
  // Trả về trạng thái phiên mới nhất (pha có thể đã đổi trong lúc nhắc nhở hiển thị)
  restorePhaseView();
}

function stopRemind() {
  clearTimeout(remindTimer);
  clearTimeout(remindHideTimer);
  remindActive = false;
}

// ── PiP look / refresh ──
const ASKS_DEFAULT = DEFAULTS.asksPip;

function startPipRefresh() {
  clearTimeout(pipRefreshTimer);
  applyPipLook(false);
  schedulePipRefresh();
}

function schedulePipRefresh() {
  clearTimeout(pipRefreshTimer);
  const min = cfg?.refreshMin ?? 3;
  const max = Math.max(cfg?.refreshMax ?? 7, min);
  pipRefreshTimer = setTimeout(() => {
    if (pipWindow && !pipWindow.closed && phase === 'working' && !ack && !standupPipActive) {
      applyPipLook(false);
      const task = tasks.find(t => t.id === curTaskId);
      strongAlert(`🎯 Đang làm: ${task?.name ?? ''}`, 'refresh');
    }
    schedulePipRefresh();
  }, (min + Math.random() * (max - min)) * 60 * 1000);
}

function applyPipLook(blink) {
  if (!pipWindow || pipWindow.closed) return;
  if (standupPipActive) return;
  const pick = (arr, last) => {
    let i;
    do { i = Math.floor(Math.random() * arr.length); } while (arr.length > 1 && i === last);
    return i;
  };
  const body = pipWindow.document.body;
  pipLastTheme = pick(PIP_THEMES, pipLastTheme);
  const t = PIP_THEMES[pipLastTheme];
  body.style.setProperty('--neo-bg',     t.bg);
  body.style.setProperty('--neo-fg',     t.fg);
  body.style.setProperty('--neo-accent', t.accent);
  body.style.setProperty('--neo-line',   t.line);
  body.style.setProperty('--neo-muted',  t.muted);
  const ask = pipWindow.document.getElementById('p-ask');
  if (ask) {
    if (cfg?.askOn === false) { ask.textContent = ''; }
    else {
      const asks = (cfg?.asksPip?.length) ? cfg.asksPip : ASKS_DEFAULT;
      pipLastAsk = pick(asks, Math.min(pipLastAsk, asks.length - 1));
      ask.textContent = asks[pipLastAsk];
    }
  }
  if (blink && !fxLooping) {
    triggerBlink();
  }
}

// mode: 'center' | 'random-corner' | 'opposite-corner'
// ── Đa màn hình: đoán màn hình người dùng đang thao tác ──
function trackMouseOn(win) {
  const on = (e) => { lastMouseScreen = { x: e.screenX, y: e.screenY, t: Date.now() }; };
  win.addEventListener('mousemove', on, true);
  win.addEventListener('pointerdown', on, true);
}

// Trả về workArea (left/top/width/height, toạ độ toàn cục nhiều màn hình) của màn
// hình nên hiển thị PiP. Ưu tiên: chuột → cửa sổ Chrome focus gần nhất → tab neo → primary.
async function getTargetArea() {
  let displays = [];
  try { displays = await chrome.system.display.getInfo(); } catch (_) {}
  if (!displays.length) {
    return { left: 0, top: 0, width: window.screen.width, height: window.screen.height };
  }
  const at = (x, y) => displays.find(d =>
    x >= d.workArea.left && x < d.workArea.left + d.workArea.width &&
    y >= d.workArea.top  && y < d.workArea.top  + d.workArea.height);

  if (lastMouseScreen && Date.now() - lastMouseScreen.t < MOUSE_FRESH_MS) {
    const d = at(lastMouseScreen.x, lastMouseScreen.y);
    if (d) return d.workArea;
  }
  try {
    const w = await chrome.windows.getLastFocused();
    if (w && w.id !== pipWinId && w.left != null) {
      const d = at(w.left + w.width / 2, w.top + w.height / 2);
      if (d) return d.workArea;
    }
  } catch (_) {}
  try {
    const w = await chrome.windows.getCurrent();
    if (w && w.left != null) {
      const d = at(w.left + w.width / 2, w.top + w.height / 2);
      if (d) return d.workArea;
    }
  } catch (_) {}
  return (displays.find(d => d.isPrimary) || displays[0]).workArea;
}

async function movePip(mode, { force = false } = {}) {
  if (!force && (standupPipActive || ack)) return;
  const id = pipWinId;
  if (!id) return;
  motionToken++; // huỷ chuyển động đang chạy dở (nếu có)
  let pip;
  try { pip = await chrome.windows.get(id); } catch (_) { return; }
  const area = await getTargetArea();
  const ox = area.left, oy = area.top;
  const sw = area.width, sh = area.height;
  const pw = pip.width,  ph = pip.height;
  const m  = 16; // margin từ mép màn hình

  const corners = [
    { left: ox + m,           top: oy + m           }, // trên-trái
    { left: ox + sw - pw - m, top: oy + m           }, // trên-phải
    { left: ox + m,           top: oy + sh - ph - m }, // dưới-trái
    { left: ox + sw - pw - m, top: oy + sh - ph - m }, // dưới-phải
  ];

  let target;
  if (mode === 'center') {
    target = { left: ox + Math.round((sw - pw) / 2), top: oy + Math.round((sh - ph) / 2) };
    pipAtCenter = true;
  } else if (mode === 'random-corner') {
    target = corners[Math.floor(Math.random() * 4)];
    pipAtCenter = false;
  } else { // 'opposite-corner'
    const cx = pip.left + pw / 2;
    const cy = pip.top  + ph / 2;
    const onArea = cx >= ox && cx < ox + sw && cy >= oy && cy < oy + sh;
    if (!onArea) {
      // PiP đang ở màn hình khác → nhảy thẳng sang một góc của màn hình đích
      target = corners[Math.floor(Math.random() * 4)];
    } else {
      // góc đối diện: đảo cả trục X lẫn Y
      target = {
        left: cx <= ox + sw / 2 ? ox + sw - pw - m : ox + m,
        top:  cy <= oy + sh / 2 ? oy + sh - ph - m : oy + m,
      };
    }
    pipAtCenter = false;
  }
  chrome.windows.update(id, target);
}

async function pipRegistryAdd(owner, windowId) {
  const data = await chrome.storage.local.get('pipRegistry');
  const reg  = (data.pipRegistry || []).filter(e => e.owner !== owner);
  reg.push({ owner, windowId });
  await chrome.storage.local.set({ pipRegistry: reg });
}

async function pipRegistryRemove(owner) {
  const data = await chrome.storage.local.get('pipRegistry');
  const reg  = (data.pipRegistry || []).filter(e => e.owner !== owner);
  await chrome.storage.local.set({ pipRegistry: reg });
}

// ══════════════════════════════════════════════
//  RENDER
// ══════════════════════════════════════════════
function renderAll() {
  renderTaskList();
  renderStatus();
}

function renderTaskList() {
  const tbody = $('taskBody');
  const empty = $('taskEmpty');
  tbody.querySelectorAll('tr:not(#taskEmpty)').forEach(r => r.remove());

  if (!tasks.length) { empty.style.display = ''; return; }
  empty.style.display = 'none';

  tasks.forEach((task, i) => {
    const wLabel = task.workMin < 1 ? `${task.workMin * 60}s` : `${task.workMin} ph`;
    const bLabel = task.breakMin < 1 ? `${Math.round(task.breakMin * 60)}s` : `${task.breakMin} ph`;
    const isRunning  = task.status === 'running';
    const isBreaking = task.status === 'breaking';
    const isDone     = task.status === 'done';
    const canDelete  = task.status === 'pending';

    // Work row (carries rowspan cells for idx, name, del)
    const trWork = document.createElement('tr');
    trWork.className = `tr-task-work${isRunning ? ' tr-run' : ''}${isDone ? ' tr-done' : ''}`;
    trWork.innerHTML = `
      <td class="td-idx" rowspan="2">${i + 1}</td>
      <td class="td-name" rowspan="2">${escHtml(task.name)}</td>
      <td class="td-phase">Làm</td>
      <td class="td-time">${wLabel}</td>
      <td class="td-clock" id="neo-wclk-${task.id}">${isDone ? '<span class="st-done">✓</span>' : ''}</td>
      <td class="td-del" rowspan="2">${canDelete
        ? `<button class="task-del" data-id="${task.id}" title="Xóa">×</button>`
        : ''}</td>
    `;

    // Break row
    const trBreak = document.createElement('tr');
    trBreak.className = `tr-task-break tr-last${isBreaking ? ' tr-break' : ''}${isDone ? ' tr-done' : ''}`;
    trBreak.innerHTML = `
      <td class="td-phase td-phase-break">Nghỉ</td>
      <td class="td-time">${bLabel}</td>
      <td class="td-clock" id="neo-bclk-${task.id}">${isDone ? '<span class="st-done">✓</span>' : ''}</td>
    `;

    tbody.appendChild(trWork);
    tbody.appendChild(trBreak);
  });

  tbody.querySelectorAll('.task-del').forEach(btn =>
    btn.addEventListener('click', () => deleteTask(btn.dataset.id)));
}

function renderStatus() {
  const statusText = phase === 'working' ? '· Đang làm'
    : phase === 'breaking'        ? '· Đang nghỉ'
    : phase === 'alert_add'       ? '· Chờ thêm task'
    : phase === 'alert_shutdown'  ? '· Kết thúc phiên'
    : '· Chờ bắt đầu';
  $('statusLabel').textContent = statusText;

  const btnLabel = phase === 'working' || phase === 'breaking' ? 'Qua pha'
                 : phase === 'alert_add'      ? 'Tiếp tục'
                 : phase === 'alert_shutdown' ? 'Kết thúc' : 'Bắt đầu';
  $('startBtn').textContent = btnLabel;
  $('startBtn').disabled = false;

  const sessionActive = phase !== 'idle';
  const pipOpen = pipWindow && !pipWindow.closed;
  $('shutdownTime').disabled = sessionActive;
  $('pipToggleBtn').textContent = pipOpen ? 'Tắt PiP' : 'Mở PiP';
  $('alertAddBox').style.display = phase === 'alert_add' ? '' : 'none';

  const lockAdd = phase === 'alert_shutdown';
  const addCard = document.querySelector('.add-task-card');
  if (addCard) addCard.style.display = lockAdd ? 'none' : '';
  $('addTaskBtn').disabled = lockAdd;
  $('taskNameInput').disabled = lockAdd;
  $('customWork').disabled = lockAdd;
  document.querySelectorAll('.preset-btn').forEach(b => b.disabled = lockAdd);
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ══════════════════════════════════════════════
//  SETTINGS PANEL (merged from neo_options)
// ══════════════════════════════════════════════
function fillSettings(c) {
  $('defaultWorkMin').value = c.defaultWorkMin ?? '';
  $('asksPip').value        = (c.asksPip || []).join('\n');
  $('refreshMin').value = Math.round((c.refreshMin ?? 3) * 60);
  $('refreshMax').value = Math.round((c.refreshMax ?? 7) * 60);
  updateRefreshSlider();
  $('alertDuration').value = (c.alertDuration > 0) ? c.alertDuration : '';
  $('askOn').checked       = c.askOn ?? false;
  updateAskOnUI();
  $('asksRemind').value     = (c.asksRemind || DEFAULTS.asksRemind).join('\n');
  $('remindOn').checked     = c.remindOn ?? DEFAULTS.remindOn;
  const remindRange = remindRangeSec(c);
  $('remindMinSec').value = remindRange.lo;
  $('remindMaxSec').value = remindRange.hi;
  updateRemindSlider();
  updateRemindUI();
  $('pipRemindOn').checked  = c.pipRemindOn ?? true;
  $('ackMode').value        = c.ackMode ?? DEFAULTS.ackMode;
  $('ackEscalateSec').value = c.ackEscalateSec ?? DEFAULTS.ackEscalateSec;
  $('alertSoundOn').checked = c.alertSoundOn ?? DEFAULTS.alertSoundOn;
  updateAckUI();
  renderAckStats();
}

function updateAskOnUI() {
  const on = $('askOn').checked;
  $('asksPipWrap').classList.toggle('disabled', !on);
}

function updateRemindUI() {
  $('asksRemindWrap').classList.toggle('disabled', !$('remindOn').checked);
}

function updateAckUI() {
  $('ackEscalateWrap').classList.toggle('disabled', $('ackMode').value === 'off');
}

function renderAckStats() {
  const el = $('ackStats');
  if (!el) return;
  const recent = ackStats.slice(-10);
  if (!recent.length) { el.textContent = 'Chưa có dữ liệu phản xạ.'; return; }
  const avg = recent.reduce((s, x) => s + x, 0) / recent.length / 1000;
  el.textContent = `Phản xạ trung bình ${recent.length} lần gần nhất: ${avg.toFixed(1)} giây`
    + (adaptiveStartLevel() > 0 ? ' — đang chậm, PiP sẽ bắt đầu ở mức to hơn.' : '');
}

function wireSettings() {
  $('resetBtn').addEventListener('click', () => { fillSettings(DEFAULTS); saveSettings(); });

  // Textarea: debounce 800ms
  let debounceTimer = null;
  ['asksPip', 'asksRemind'].forEach(id => $(id).addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(saveSettings, 800);
  }));
  $('remindOn').addEventListener('change', () => { updateRemindUI(); saveSettings(); });

  ['defaultWorkMin', 'alertDuration', 'ackEscalateSec'].forEach(id => $(id).addEventListener('keydown', blockNonDigit));

  // Dual-handle sliders — debounce writes to avoid sync quota exhaustion
  let sliderDebounce = null;
  const wireSlider = (ids, update) => ids.forEach(id =>
    $(id).addEventListener('input', () => {
      update();
      clearTimeout(sliderDebounce);
      sliderDebounce = setTimeout(saveSettings, 300);
    }));
  wireSlider(['refreshMin', 'refreshMax'], updateRefreshSlider);
  wireSlider(['remindMinSec', 'remindMaxSec'], updateRemindSlider);

  // Numbers: save on blur
  $('defaultWorkMin').addEventListener('change', saveSettings);
  $('askOn').addEventListener('change', () => { updateAskOnUI(); saveSettings(); });
  $('alertDuration').addEventListener('change', saveSettings);
  $('pipRemindOn').addEventListener('change', saveSettings);
  $('ackMode').addEventListener('change', () => { updateAckUI(); saveSettings(); });
  $('ackEscalateSec').addEventListener('change', saveSettings);
  $('alertSoundOn').addEventListener('change', saveSettings);
  $('ackTestBtn').addEventListener('click', async () => {
    if (!pipWindow || pipWindow.closed) await openPipWithState();
    if (!pipWindow || pipWindow.closed) { showToast('Mở PiP trước để thử.'); return; }
    // Nút thử luôn chạy chế độ bắt xác nhận để xem trước
    const saved = cfg.ackMode;
    cfg.ackMode = 'phase';
    await strongAlert('🔔 Thử gây chú ý mạnh');
    cfg.ackMode = saved;
  });
}

const lines = v => v.split('\n').map(s => s.trim()).filter(Boolean);
const clamp = (v, min, max, fb) => { const n = Number(v); return (v !== null && v !== '' && Number.isFinite(n)) ? Math.min(max, Math.max(min, n)) : fb; };

function blockNonDigit(e) {
  const nav = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
  if (!e.ctrlKey && !e.metaKey && !nav.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault();
}

function fmtSeconds(s) {
  if (s < 60) return `${s} giây`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m} phút ${r} giây` : `${m} phút`;
}

function updateRangeSlider(minId, maxId, fillId, displayId, MIN, MAX) {
  let lo = parseInt($(minId).value);
  let hi = parseInt($(maxId).value);
  // Enforce lo ≤ hi
  if (lo > hi) { $(minId).value = hi; lo = hi; }
  const fillLeft  = ((lo - MIN) / (MAX - MIN)) * 100;
  const fillRight = ((hi - MIN) / (MAX - MIN)) * 100;
  $(fillId).style.left  = `${fillLeft}%`;
  $(fillId).style.width = `${fillRight - fillLeft}%`;
  $(displayId).textContent = lo === hi
    ? fmtSeconds(lo)
    : `${fmtSeconds(lo)} – ${fmtSeconds(hi)}`;
}

function updateRefreshSlider() {
  updateRangeSlider('refreshMin', 'refreshMax', 'refreshFill', 'refreshRangeDisplay', 10, 600);
}

function updateRemindSlider() {
  updateRangeSlider('remindMinSec', 'remindMaxSec', 'remindFill', 'remindRangeDisplay', 10, 60);
}

async function saveSettings() {
  const asksPip = lines($('asksPip').value);
  // Slider values are in seconds → convert to minutes for storage
  const loSec = parseInt($('refreshMin').value) || Math.round(DEFAULTS.refreshMin * 60);
  const hiSec = parseInt($('refreshMax').value) || Math.round(DEFAULTS.refreshMax * 60);
  const refreshMin = loSec / 60;
  const refreshMax = hiSec / 60;
  const dwRaw = parseFloat($('defaultWorkMin').value);
  const asksRemind = lines($('asksRemind').value);
  cfg = {
    defaultWorkMin: (dwRaw > 0) ? dwRaw : null,
    asksPip:    asksPip.length ? asksPip : DEFAULTS.asksPip,
    refreshMin, refreshMax,
    alertDuration: parseInt($('alertDuration').value) || null,
    askOn:         $('askOn').checked,
    asksRemind:    asksRemind.length ? asksRemind : DEFAULTS.asksRemind,
    remindOn:      $('remindOn').checked,
    remindMinSec: clamp($('remindMinSec').value, 10, 60, DEFAULTS.remindMinSec),
    remindMaxSec: clamp($('remindMaxSec').value, 10, 60, DEFAULTS.remindMaxSec),
    pipRemindOn:   $('pipRemindOn').checked,
    ackMode:        $('ackMode').value,
    ackEscalateSec: clamp($('ackEscalateSec').value, 3, 60, DEFAULTS.ackEscalateSec),
    alertSoundOn:   $('alertSoundOn').checked,
  };
  $('ackEscalateSec').value = cfg.ackEscalateSec;
  await saveNeoSettings(cfg);
  scheduleRemind(); // áp dụng ngay bật/tắt hoặc chu kỳ mới
  flashSaved();
}

function applyDefaultTime() {
  if (selectedWork) return; // đã chọn rồi
  const defMin = cfg?.defaultWorkMin;
  if (defMin > 0) {
    selectedWork  = defMin;
    selectedBreak = Math.round(defMin / 5 * 10) / 10;
    $('customWork').value = selectedWork;
    $('breakHint').textContent = formatBreakLabel(selectedBreak);
    $('customRow').classList.add('on');
  } else {
    const firstPreset = document.querySelector('.preset-btn');
    if (firstPreset) firstPreset.click();
  }
}

let savedMsgTimer = null;
function flashSaved() {
  const el = $('savedMsg');
  if (!el) return;
  el.classList.add('show');
  clearTimeout(savedMsgTimer);
  savedMsgTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

// ══════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════
let toastTimer = null;
function showToast(msg) {
  const el = $('neoToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

// ══════════════════════════════════════════════
//  MUSIC PLAYER  (File System Access API)
// ══════════════════════════════════════════════
let musicTracks    = []; // [{ name, handle }]
let musicIdx       = 0;
let musicAudio     = new Audio();
let musicPlaying   = false;
let musicObjUrl    = null;
let musicDirHandle = null;
let repeatMode     = 'none'; // 'none' | 'all' | 'one'
let musicDurKnown  = false;

// ── IndexedDB helpers ──
function _idb(mode, fn) {
  return new Promise((res, rej) => {
    const r = indexedDB.open('neo-music-db', 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore('kv');
    r.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction('kv', mode);
      fn(tx.objectStore('kv'), res, rej);
      tx.onerror = () => rej(tx.error);
    };
    r.onerror = () => rej(r.error);
  });
}
const idbGet = (k)    => _idb('readonly',  (s,res,rej) => { const r = s.get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const idbSet = (k, v) => _idb('readwrite', (s,res,rej) => { const r = s.put(v, k); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });

async function initMusic() {
  musicAudio.volume = 0.8;

  // Audio events
  musicAudio.addEventListener('timeupdate', onMusicTick);
  musicAudio.addEventListener('ended', onMusicEnded);
  musicAudio.addEventListener('play',  () => { musicPlaying = true;  updatePlayBtn(); });
  musicAudio.addEventListener('pause', () => { musicPlaying = false; updatePlayBtn(); });

  // Controls
  $('musicPickBtn').addEventListener('click', pickMusicDir);
  $('musicPermBtn').addEventListener('click', grantMusicPerm);
  $('musicPlayPause').addEventListener('click', togglePlay);
  $('musicPrev').addEventListener('click', () => musicStep(-1, true));
  $('musicNext').addEventListener('click', () => musicStep(+1, true));
  $('musicRepeat').addEventListener('click', toggleRepeat);
  $('musicVolume').addEventListener('input', () => { musicAudio.volume = $('musicVolume').value / 100; });
  $('musicProgressBar').addEventListener('click', (e) => {
    if (!musicAudio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    musicAudio.currentTime = ((e.clientX - rect.left) / rect.width) * musicAudio.duration;
  });

  // Space bar = play/pause (global, skip when typing in inputs)
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
    if (musicTracks.length === 0) return;
    e.preventDefault();
    togglePlay();
  });

  // Restore saved dir handle
  try { musicDirHandle = await idbGet('musicDir'); } catch (_) {}
  if (!musicDirHandle) { showMusicState('pick'); return; }

  const perm = await musicDirHandle.queryPermission({ mode: 'read' });
  if (perm === 'granted') await loadMusicFiles();
  else showMusicState('perm');
}

async function pickMusicDir() {
  try {
    musicDirHandle = await window.showDirectoryPicker({ mode: 'read' });
    await idbSet('musicDir', musicDirHandle);
    await loadMusicFiles();
  } catch (e) {
    if (e.name !== 'AbortError') {}
  }
}

async function grantMusicPerm() {
  const perm = await musicDirHandle.requestPermission({ mode: 'read' });
  if (perm === 'granted') await loadMusicFiles();
}

async function loadMusicFiles() {
  musicTracks = [];
  try {
    for await (const [name, handle] of musicDirHandle.entries()) {
      if (handle.kind === 'file' && name.toLowerCase().endsWith('.mp3'))
        musicTracks.push({ name, handle });
    }
  } catch (_) { showMusicState('pick'); return; }

  musicTracks.sort((a, b) => a.name.localeCompare(b.name));
  if (musicTracks.length === 0) { showMusicState('empty'); return; }

  showMusicState('player');
  await loadTrack(0, false);
}

async function loadTrack(idx, autoplay) {
  musicIdx = idx;
  const { name, handle } = musicTracks[idx];
  musicAudio.pause();
  if (musicObjUrl) { URL.revokeObjectURL(musicObjUrl); musicObjUrl = null; }
  const file = await handle.getFile();
  musicObjUrl = URL.createObjectURL(file);
  musicAudio.src = musicObjUrl;
  $('musicTrackName').textContent = name.replace(/\.mp3$/i, '');
  $('musicProgressFill').style.width = '0%';
  $('musicCurTime').textContent = '0:00';
  $('musicDurTime').textContent = '0:00';
  musicDurKnown = false;
  if (autoplay) musicAudio.play().catch(() => {});
}

function musicStep(dir, autoplay) {
  if (musicTracks.length === 0) return;
  const next = ((musicIdx + dir) % musicTracks.length + musicTracks.length) % musicTracks.length;
  loadTrack(next, autoplay);
}

function onMusicEnded() {
  if (repeatMode === 'one') {
    musicAudio.currentTime = 0;
    musicAudio.play().catch(() => {});
  } else if (repeatMode === 'all') {
    musicStep(+1, true);
  } else {
    // 'none': advance if not last track
    if (musicIdx < musicTracks.length - 1) musicStep(+1, true);
    // else stop (audio already ended naturally)
  }
}

function toggleRepeat() {
  const cycle = { none: 'all', all: 'one', one: 'none' };
  repeatMode = cycle[repeatMode];
  updateRepeatBtn();
}

function updateRepeatBtn() {
  const btn = $('musicRepeat');
  btn.classList.toggle('on', repeatMode !== 'none');
  btn.title = repeatMode === 'one' ? 'Lặp lại: 1 bài'
            : repeatMode === 'all' ? 'Lặp lại: tất cả'
            : 'Lặp lại: tắt';
  // Swap icon to show "1" badge when repeat-one
  btn.querySelector('svg').style.opacity = repeatMode === 'none' ? '0.4' : '1';
  // Show "1" text overlay for repeat-one
  let badge = btn.querySelector('.repeat-badge');
  if (repeatMode === 'one') {
    if (!badge) { badge = document.createElement('span'); badge.className = 'repeat-badge'; btn.appendChild(badge); }
    badge.textContent = '1';
  } else {
    badge?.remove();
  }
}

function togglePlay() {
  if (musicPlaying) musicAudio.pause();
  else musicAudio.play().catch(() => {});
}

function updatePlayBtn() {
  $('iconPlay').style.display  = musicPlaying ? 'none' : '';
  $('iconPause').style.display = musicPlaying ? '' : 'none';
}

function onMusicTick() {
  const dur = musicAudio.duration || 0;
  const cur = musicAudio.currentTime || 0;
  $('musicProgressFill').style.width = dur ? `${(cur / dur) * 100}%` : '0%';
  $('musicCurTime').textContent = fmtSec(cur);
  if (!musicDurKnown && dur > 0) {
    $('musicDurTime').textContent = fmtSec(dur);
    musicDurKnown = true;
  }
}

function fmtSec(s) {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

// ── Media Hub integration ──
// Trả về trạng thái theo đúng format của media_detector.js để Media Hub hiển thị
function getMusicMediaState() {
  if (musicTracks.length === 0 || !musicAudio.src) return { hasMedia: false };
  return {
    hasMedia: true,
    isPlaying: !musicAudio.paused && !musicAudio.ended,
    isPaused: musicAudio.paused,
    currentTime: musicAudio.currentTime,
    duration: musicAudio.duration,
    volume: musicAudio.volume,
    muted: musicAudio.muted,
    title: musicTracks[musicIdx].name.replace(/\.mp3$/i, ''),
    thumbnail: '',
    isVideo: false,
    src: musicAudio.src,
    canPlayNext: musicTracks.length > 1,
    canPlayPrevious: musicTracks.length > 1
  };
}

function handleMusicControl(command, value) {
  if (musicTracks.length === 0 || !musicAudio.src) return { success: false, error: 'No media found' };
  try {
    switch (command) {
      case 'play':         musicAudio.play().catch(() => {}); break;
      case 'pause':        musicAudio.pause(); break;
      case 'toggle':       togglePlay(); break;
      case 'seek':         musicAudio.currentTime = value; break;
      case 'seekForward':  musicAudio.currentTime = Math.min(musicAudio.duration || 0, musicAudio.currentTime + (value || 10)); break;
      case 'seekBackward': musicAudio.currentTime = Math.max(0, musicAudio.currentTime - (value || 10)); break;
      case 'volume':
        musicAudio.volume = Math.max(0, Math.min(1, value));
        $('musicVolume').value = Math.round(musicAudio.volume * 100);
        break;
      case 'mute':         musicAudio.muted = true; break;
      case 'unmute':       musicAudio.muted = false; break;
      case 'next':         musicStep(+1, true); break;
      case 'previous':     musicStep(-1, true); break;
      default: return { success: false, error: 'Unknown command' };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// 'pick' | 'perm' | 'empty' | 'player'
const MUSIC_STATE_ELS = { pick: 'musicPickBtn', perm: 'musicPermBtn', empty: 'musicEmptyMsg', player: 'musicPlayerUI' };
function showMusicState(state) {
  $('musicAction').style.display = state === 'player' ? 'none' : '';
  Object.entries(MUSIC_STATE_ELS).forEach(([s, id]) => $(id).style.display = s === state ? '' : 'none');
}

// ══════════════════════════════════════════════
//  STANDUP — Nhắc nhở đứng dậy
// ══════════════════════════════════════════════
const STANDUP_ALARM = 'standup-sitting';
const STANDUP_NOTIF = 'standup-alert';

let standupState = 'idle'; // idle | tracking | alerting
let standupEndsAt = null;
let standupCfg = { maxSec: 2700 };
let standupTickTimer = null;

function initStandup(local) {
  standupCfg = { maxSec: 2700, ...local.standupCfg };
  $('standupMin').value = Math.round(standupCfg.maxSec / 60);

  $('standupMin').addEventListener('change', async () => {
    const v = parseInt($('standupMin').value, 10);
    if (v >= 1) { standupCfg.maxSec = v * 60; await chrome.storage.local.set({ standupCfg }); }
  });
  $('standupMin').addEventListener('keydown', blockNonDigit);
  $('standupStartBtn').addEventListener('click', onStandupStart);
  $('standupStopBtn').addEventListener('click', onStandupStop);
  $('standupStopAlertBtn').addEventListener('click', onStandupStop);
  $('standupCheckinInput').addEventListener('input', (e) => {
    if (e.target.value.trim().toLowerCase() === 'đã đứng dậy') {
      e.target.value = '';
      onStandupDone();
    }
  });

  // Restore state on reload
  if (local.standupEndsAt) {
    standupEndsAt = local.standupEndsAt;
    if (Date.now() >= standupEndsAt) showStandupAlert();
    else { setStandupState('tracking'); startStandupTick(); }
  } else {
    setStandupState('idle');
  }
}

async function onStandupStart() {
  standupEndsAt = Date.now() + standupCfg.maxSec * 1000;
  await chrome.storage.local.set({ standupEndsAt });
  chrome.alarms.create(STANDUP_ALARM, { when: standupEndsAt });
  setStandupState('tracking');
  startStandupTick();
}

async function onStandupStop() {
  chrome.alarms.clear(STANDUP_ALARM);
  chrome.notifications.clear(STANDUP_NOTIF);
  clearInterval(standupTickTimer);
  standupEndsAt = null;
  await chrome.storage.local.remove('standupEndsAt');
  if (standupPipActive) deactivateStandupPip();
  setStandupState('idle');
}

async function onStandupDone() {
  chrome.notifications.clear(STANDUP_NOTIF);
  if (standupPipActive) deactivateStandupPip();
  standupEndsAt = Date.now() + standupCfg.maxSec * 1000;
  await chrome.storage.local.set({ standupEndsAt });
  chrome.alarms.create(STANDUP_ALARM, { when: standupEndsAt });
  setStandupState('tracking');
  startStandupTick();
}

function showStandupAlert() {
  clearInterval(standupTickTimer);
  standupEndsAt = null;
  chrome.storage.local.remove('standupEndsAt');
  setStandupState('alerting');
  activateStandupPip();
}

function activateStandupPip() {
  if (!pipWindow || pipWindow.closed) return;
  // Nhắc đứng dậy (bắt điểm danh) được ưu tiên hơn thử thách xác nhận đang chờ
  cancelAck({ view: false });
  if (remindActive) { clearTimeout(remindHideTimer); remindActive = false; }
  standupPipActive = true;
  showPipSection('s-standup-alert');
  // Nháy liên tục, đổi kiểu định kỳ
  loopFx('strong');
  placePipCenter({ w: PIP_W, h: PIP_H }).then(p => {
    if (p && standupPipActive) runMotion(pickMotion(), p.area, p.target);
  });
  playBeep('rise');
}

function deactivateStandupPip() {
  standupPipActive = false;
  if (!pipWindow || pipWindow.closed) return;
  stopAlertFlash();
  // idle hiển thị màn cảnh báo giống lúc hết task
  const target = phase === 'idle' ? 's-alert-add' : `s-${phase.replace('_', '-')}`;
  showPipSection(target);
  if (phase === 'alert_add' || phase === 'idle') startAlertFlash();
  else if (phase === 'working') { applyPipLook(false); startPipRefresh(); }
}

function startStandupTick() {
  clearInterval(standupTickTimer);
  standupTick();
  standupTickTimer = setInterval(standupTick, 1000);
}

function standupTick() {
  if (!standupEndsAt) return;
  const remaining = standupEndsAt - Date.now();
  if (remaining <= 0) { clearInterval(standupTickTimer); return; }
  $('standupClock').textContent = fmtRemaining(remaining);
}

function setStandupState(s) {
  standupState = s;
  const isTracking = s === 'tracking';
  const isAlerting = s === 'alerting';
  $('standupClock').textContent       = isTracking && standupEndsAt ? fmtRemaining(standupEndsAt - Date.now()) : '--:--';
  $('standupIdleRow').style.display   = (!isTracking && !isAlerting) ? '' : 'none';
  $('standupTrackRow').style.display  = isTracking ? '' : 'none';
  $('standupAlertRow').style.display  = isAlerting ? '' : 'none';
  if (isAlerting) {
    const inp = $('standupCheckinInput');
    inp.value = '';
    setTimeout(() => inp.focus(), 50);
  }
}
