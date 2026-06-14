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
let alertFlashTimer = null;

// ── PiP themes (same as before) ──
const PIP_THEMES = [
  { bg: '#11151f', fg: '#f4f1e8', accent: '#f0a33c', line: '#2a3142', muted: '#828ca0' },
  { bg: '#101a16', fg: '#eef4ec', accent: '#5fc88f', line: '#23362c', muted: '#7da08c' },
  { bg: '#1a1320', fg: '#f3edf7', accent: '#c98bf0', line: '#32263d', muted: '#9a87ab' },
  { bg: '#1c1412', fg: '#f6efe9', accent: '#f07b54', line: '#3a2a24', muted: '#a8907f' },
  { bg: '#f4f1e8', fg: '#11151f', accent: '#b4571e', line: '#d8d2c2', muted: '#6f7686' },
];

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════
init();

async function init() {
  if (!pipSupported) $('pipWarn').style.display = 'block';

  // Register this tab
  const tab = await chrome.tabs.getCurrent();
  if (tab) await chrome.storage.local.set({ [KEY_TAB]: tab.id });

  // Load persisted state
  const local = await chrome.storage.local.get([
    KEY_TASKS, KEY_PHASE, KEY_CUR_TASK,
    KEY_WORK_END, KEY_BREAK_END, KEY_SHUTDOWN,
  ]);
  tasks       = local[KEY_TASKS]     || [];
  phase       = local[KEY_PHASE]     || 'idle';
  curTaskId   = local[KEY_CUR_TASK]  || null;
  workEndsAt  = local[KEY_WORK_END]  || null;
  breakEndsAt = local[KEY_BREAK_END] || null;

  cfg = await getSync();

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
      if (phase === 'idle') {
        alert('Chưa có phiên nào đang chạy. Nhấn Bắt đầu trước.');
        return;
      }
      await openPip();
      setPipPhase(phase);
      if (phase === 'working' && workEndsAt) {
        const task = tasks.find(t => t.id === curTaskId);
        if (task) updatePipWorking(task, workEndsAt - Date.now());
      } else if (phase === 'breaking' && breakEndsAt) {
        updatePipBreaking(breakEndsAt - Date.now());
      } else if (phase === 'alert_add') {
        startAlertFlash();
      }
    }
    renderStatus();
  });

  wireAddTask();
  wireSettings();

  // Phase transition messages from background service worker
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'neo-work-end')  onWorkEnd();
    if (msg.type === 'neo-break-end') onBreakEnd();
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

  $('customWork').addEventListener('keydown', e => { if (e.key === 'Enter') $('taskNameInput').focus(); });
  $('taskNameInput').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
  $('addTaskBtn').addEventListener('click', addTask);
}

function formatBreakLabel(min) {
  const breakStr = min < 1 ? `${Math.round(min * 60)} giây` : `${min} phút`;
  return `phút làm, ${breakStr} nghỉ`;
}

function addTask() {
  const name = $('taskNameInput').value.trim();
  if (!name) { $('taskNameInput').focus(); return; }
  if (!selectedWork) { alert('Chọn thời gian làm trước.'); return; }

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
    await startBreakPhase(curTaskId);
  } else if (phase === 'breaking') {
    chrome.alarms.clear('neo-break-end');
    clearInterval(tickTimer);
    await onBreakEnd();
  } else {
    const pending = tasks.filter(t => t.status === 'pending');
    if (pending.length === 0) {
      alert(phase === 'alert_add'
        ? 'Thêm task trước khi tiếp tục.'
        : 'Chưa có task nào. Thêm ít nhất một task trước khi bắt đầu.');
      applyDefaultTime();
      $('taskNameInput').focus();
      return;
    }
    if (phase === 'idle') {
      const [hh, mm] = ($('shutdownTime').value || '22:00').split(':').map(Number);
      const shutdown = new Date(); shutdown.setHours(hh, mm, 0, 0);
      if (new Date() >= shutdown) {
        alert('Thời gian kết thúc phải sau thời điểm hiện tại. Hãy cập nhật lại trong phần Cài đặt.');
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
async function startWorkPhase(taskId, flash = false) {
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

  if (pipWindow && !pipWindow.closed) {
    setPipPhase('working');
    updatePipWorking(task, workEndsAt - Date.now());
  }

  if (flash) {
    triggerBlink();
    movePip('center');
  }

  clearInterval(tickTimer);
  tickTimer = setInterval(tick, 1000);

  renderAll();
  tick();
}

async function startBreakPhase(taskId) {
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

  // Brief alert flash → then calm countdown
  setPipPhase('breaking');
  if (pipWindow && !pipWindow.closed) {
    const body = pipWindow.document.body;
    const goal = pipWindow.document.getElementById('p-break-msg');
    if (goal) goal.textContent = 'Hãy nghỉ ngơi!';
    triggerBlink();
    movePip('center');
  }

  tickTimer = setInterval(tick, 1000);
  renderAll();
  tick();
}

async function onWorkEnd() {
  if (phase !== 'working') return;
  clearInterval(tickTimer);
  await startBreakPhase(curTaskId);
}

async function onBreakEnd() {
  if (phase !== 'breaking') return;
  clearInterval(tickTimer);
  clearTimeout(pipRefreshTimer);

  const doneTask = tasks.find(t => t.id === curTaskId);
  const nextPendingCheck = tasks.find(t => t.status === 'pending' && t.id !== curTaskId);
  chrome.runtime.sendMessage({ type: 'neo-notify', id: `neo-break-done-${Date.now()}`, title: 'Hết giờ nghỉ!', message: nextPendingCheck ? `${doneTask?.name ?? ''} xong — bắt đầu task tiếp theo.` : 'Tất cả task đã hoàn thành.' }).catch(() => {});

  // Mark current task done
  tasks = tasks.map(t => t.id === curTaskId ? { ...t, status: 'done' } : t);
  await saveTasks();

  const nextPending = tasks.find(t => t.status === 'pending');

  if (nextPending) {
    await startWorkPhase(nextPending.id, true);
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
  setPipPhase('alert_add');
  movePip('center');
  startAlertFlash();
  renderAll();
}

async function enterAlertShutdown() {
  phase = 'alert_shutdown';
  await chrome.storage.local.set({ [KEY_PHASE]: 'alert_shutdown' });

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
    pipWindow = await documentPictureInPicture.requestWindow({ width: 360, height: 90 });
  } catch (e) {
    console.warn('[Neo PiP]', e);
    return;
  }

  const after  = await chrome.windows.getAll();
  const newWin = after.find(w => !before.has(w.id));
  if (newWin) {
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
      const titleBar = win.height - pipWindow.innerHeight;
      chrome.windows.update(newWin.id, { width: 360, height: 90 + titleBar });
    }, 200);
  }
  startPipRefresh();

  pipWindow.document.body.addEventListener('mouseenter', (e) => {
    if (phase === 'alert_add' || phase === 'breaking') return;
    const fromTop = e.clientY < 8 && e.clientX > 5 && e.clientX < pipWindow.innerWidth - 5;
    if (!fromTop) movePip(pipAtCenter ? 'random-corner' : 'opposite-corner');
  });
  pipWindow.addEventListener('pagehide', () => {
    clearTimeout(pipRefreshTimer);
    chrome.storage.local.remove(KEY_PIP_WIN);
    pipRegistryRemove('neo');
    pipWindow = null;
    renderStatus();
  });

}

function closePip() {
  clearTimeout(pipRefreshTimer);
  if (pipWindow && !pipWindow.closed) pipWindow.close();
  pipWindow = null;
  chrome.storage.local.remove(KEY_PIP_WIN);
  pipRegistryRemove('neo');
}

function setupPipContent() {
  const doc = pipWindow.document;
  const style = doc.createElement('style');
  style.textContent = `
    :root { color-scheme: dark; }
    html, body { margin:0; padding:0; width:100%; height:90px; overflow:hidden; }
    body { background:var(--neo-bg,#11151f); color:var(--neo-fg,#f4f1e8);
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
    .pip-ask { font-size:11px; color:var(--neo-muted,#828ca0); padding:4px 14px 0; line-height:1.4; }
    button.pip-btn { flex-shrink:0; padding:6px 12px; border-radius:20px; border:none;
      background:var(--neo-accent,#f0a33c); color:#11151f; font:12px/1 ui-sans-serif,system-ui;
      font-weight:700; cursor:pointer; }
    .tide { position:absolute; bottom:0; left:0; right:0; height:3px;
      background:var(--neo-line,#2a3142); overflow:hidden; }
    .tide-fill { height:100%; background:var(--neo-accent,#f0a33c); width:100%; transition:width 1s linear; }
    .pip-wrap { position:relative; height:90px; overflow:hidden; }
    body.neo-alert { animation:neo-alert .8s steps(1) forwards; }
    body.neo-alert-loop { animation:neo-alert .8s steps(1) infinite; }
    @keyframes neo-alert {
      0%   {background:#ff3b30;color:#fff}
      14%  {background:#ff9500;color:#000}
      28%  {background:#ffcc00;color:#000}
      42%  {background:#34c759;color:#000}
      57%  {background:#007aff;color:#fff}
      71%  {background:#5856d6;color:#fff}
      85%  {background:#ff2d55;color:#fff}
      100% {background:var(--neo-bg,#11151f);color:var(--neo-fg,#f4f1e8)}
    }
    body.neo-soft { animation:neo-soft .5s ease; }
    @keyframes neo-soft { 0%{opacity:.3} 100%{opacity:1} }
    .hidden { display:none!important; }
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
  `;

  // "Vào thiết lập" focuses anchor tab
  doc.getElementById('p-go-setup').addEventListener('click', async () => {
    const tab = await chrome.tabs.getCurrent();
    if (tab) {
      chrome.windows.update(tab.windowId, { focused: true });
      chrome.tabs.update(tab.id, { active: true });
    }
    applyDefaultTime();
    $('taskNameInput').focus();
  });
}

function setPipPhase(p) {
  if (!pipWindow || pipWindow.closed) return;
  const doc = pipWindow.document;
  ['s-working','s-breaking','s-alert-add','s-alert-shutdown'].forEach(id => {
    doc.getElementById(id)?.classList.toggle('hidden', id !== `s-${p.replace('_','-')}`);
  });
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

// ── Alert flash ──
function triggerBlink() {
  if (!pipWindow || pipWindow.closed) return;
  const dur = cfg?.alertDuration;
  if (!(dur > 0)) return;
  const body = pipWindow.document.body;
  body.classList.remove('neo-alert', 'neo-soft', 'neo-alert-loop');
  void body.offsetWidth;
  body.classList.add('neo-alert-loop');
  clearTimeout(alertFlashTimer);
  alertFlashTimer = setTimeout(stopAlertFlash, dur * 1000);
}

function startAlertFlash() { triggerBlink(); }

function stopAlertFlash() {
  clearTimeout(alertFlashTimer);
  if (!pipWindow || pipWindow.closed) return;
  pipWindow.document.body.classList.remove('neo-alert-loop');
}

// ── PiP look / refresh (same logic as before) ──
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
    if (pipWindow && !pipWindow.closed && phase === 'working') {
      applyPipLook(true);
      movePip('center');
    }
    schedulePipRefresh();
  }, (min + Math.random() * (max - min)) * 60 * 1000);
}

function applyPipLook(blink) {
  if (!pipWindow || pipWindow.closed) return;
  const pick = (arr, last) => {
    let i;
    do { i = Math.floor(Math.random() * arr.length); } while (arr.length > 1 && i === last);
    return i;
  };
  const body = pipWindow.document.body;
  if (cfg?.themesOn !== false) pipLastTheme = pick(PIP_THEMES, pipLastTheme);
  else pipLastTheme = 0;
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

  if (blink && !body.classList.contains('neo-alert-loop')) {
    triggerBlink();
  }
}

// mode: 'center' | 'random-corner' | 'opposite-corner'
async function movePip(mode) {
  const data = await chrome.storage.local.get(KEY_PIP_WIN);
  const id   = data[KEY_PIP_WIN];
  if (!id) return;
  let pip;
  try { pip = await chrome.windows.get(id); } catch (_) { return; }

  const sw = window.screen.width, sh = window.screen.height;
  const pw = pip.width,           ph = pip.height;
  const m  = 16; // margin từ mép màn hình
  const corners = [
    { left: m,          top: m          }, // trên-trái
    { left: sw - pw - m, top: m          }, // trên-phải
    { left: m,          top: sh - ph - m }, // dưới-trái
    { left: sw - pw - m, top: sh - ph - m }, // dưới-phải
  ];
  let target;

  if (mode === 'center') {
    target = { left: Math.round((sw - pw) / 2), top: Math.round((sh - ph) / 2) };
    pipAtCenter = true;
  } else if (mode === 'random-corner') {
    target = corners[Math.floor(Math.random() * 4)];
    pipAtCenter = false;
  } else { // 'opposite-corner'
    const cx = pip.left + pw / 2;
    const cy = pip.top  + ph / 2;
    // góc đối diện: đảo cả trục X lẫn Y
    target = {
      left: cx <= sw / 2 ? sw - pw - m : m,
      top:  cy <= sh / 2 ? sh - ph - m : m,
    };
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

  const running = phase === 'working' || phase === 'breaking';
  const btnLabel = phase === 'working' || phase === 'breaking' ? 'Qua pha'
                 : phase === 'alert_add'      ? 'Tiếp tục'
                 : phase === 'alert_shutdown' ? 'Kết thúc' : 'Bắt đầu';
  $('startBtn').textContent = btnLabel;
  $('startBtn').disabled = false;
  const sessionActive = phase !== 'idle';
  const pipOpen = pipWindow && !pipWindow.closed;
  $('shutdownTime').disabled = sessionActive;
  $('pipToggleBtn').textContent = pipOpen ? 'Tắt PiP' : 'Mở PiP';
  $('pipToggleBtn').style.display = sessionActive ? '' : 'none';
  $('alertAddBox').style.display = phase === 'alert_add' ? '' : 'none';
  const lockAdd = phase === 'alert_shutdown';
  document.querySelector('.add-task-area').style.display = lockAdd ? 'none' : '';
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
  $('refreshMin').value     = c.refreshMin ?? 3;
  $('refreshMax').value     = c.refreshMax ?? 7;
  $('themesOn').checked       = c.themesOn      ?? true;
  $('alertDuration').value    = (c.alertDuration > 0) ? c.alertDuration : '';
  $('askOn').checked          = c.askOn         ?? true;
}

function wireSettings() {
  $('resetBtn').addEventListener('click', () => { fillSettings(DEFAULTS); saveSettings(); });

  // Textarea: debounce 800ms
  let debounceTimer = null;
  $('asksPip').addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(saveSettings, 800);
  });

  // Numbers: save on blur
  ['defaultWorkMin', 'refreshMin', 'refreshMax'].forEach(id =>
    $(id).addEventListener('change', saveSettings));

  // Switches: save immediately on toggle
  ['themesOn', 'askOn'].forEach(id =>
    $(id).addEventListener('change', saveSettings));
  $('alertDuration').addEventListener('change', saveSettings);
}

const lines = v => v.split('\n').map(s => s.trim()).filter(Boolean);
const clamp = (v, min, max, fb) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fb; };

async function saveSettings() {
  const asksPip = lines($('asksPip').value);
  let refreshMin = clamp($('refreshMin').value, 10/60, 120, DEFAULTS.refreshMin);
  let refreshMax = clamp($('refreshMax').value, 10/60, 120, DEFAULTS.refreshMax);
  if (refreshMax < refreshMin) [refreshMin, refreshMax] = [refreshMax, refreshMin];

  const dwRaw = parseFloat($('defaultWorkMin').value);
  cfg = {
    defaultWorkMin: (dwRaw > 0) ? dwRaw : null,
    asksPip:    asksPip.length ? asksPip : DEFAULTS.asksPip,
    refreshMin, refreshMax,
    themesOn:      $('themesOn').checked,
    alertDuration: parseInt($('alertDuration').value) || null,
    askOn:         $('askOn').checked,
  };
  await chrome.storage.sync.set(cfg);
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
  el.textContent = 'Đã lưu cài đặt';
  clearTimeout(savedMsgTimer);
  savedMsgTimer = setTimeout(() => { el.textContent = ''; }, 2000);
}
