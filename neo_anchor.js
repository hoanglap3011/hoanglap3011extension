// neo_anchor.js — tab ghim Neo. Tự quản lý PiP + alarm, không phụ thuộc background.js.

const $ = (id) => document.getElementById(id);
let pipWindow = null;
let tickTimer = null;
let chosenMin = 50;
let cfg = null;

const pipSupported = "documentPictureInPicture" in window;
const NEO_ALARM = "neo-session-end";

init();

async function init() {
  if (!pipSupported) $("pipUnsupported").hidden = false;

  cfg = await getSync();
  $("goalInput").value = cfg.goal || "";
  chosenMin = cfg.durationMin || 50;

  const presetBtns = $("durations").querySelectorAll("button");
  const customInput = $("customMin");

  const selectPreset = (min) => {
    chosenMin = min;
    presetBtns.forEach(b => b.classList.toggle("on", Number(b.dataset.min) === min));
    customInput.classList.remove("on");
    customInput.value = "";
  };

  presetBtns.forEach(b => {
    b.classList.toggle("on", Number(b.dataset.min) === chosenMin);
    b.addEventListener("click", () => selectPreset(Number(b.dataset.min)));
  });

  customInput.addEventListener("input", () => {
    const v = parseInt(customInput.value, 10);
    if (v > 0) {
      chosenMin = v;
      presetBtns.forEach(b => b.classList.remove("on"));
      customInput.classList.add("on");
    }
  });

  $("startBtn").addEventListener("click", startSession);
  $("stopBtn").addEventListener("click", stopSession);
  $("reopenPip").addEventListener("click", () => openPip());

  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== "sync") return;
    cfg = await getSync();
    if (changes.session) render();
  });

  // Xử lý alarm khi tab này đang mở
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== NEO_ALARM) return;
    getSession().then(async session => {
      if (session) await setSession({ ...session, active: false });
      clearInterval(tickTimer);
      showPipDone();
      render();
    });
  });

  const tab = await chrome.tabs.getCurrent();
  if (tab) await chrome.storage.local.set({ neoAnchorTabId: tab.id });

  render();
}

async function render() {
  const session = await getSession();
  const active = session && session.active && session.endsAt > Date.now();

  $("setup").hidden = !!active;
  $("running").hidden = !active;

  clearInterval(tickTimer);
  if (active) {
    $("goalShow").textContent = session.goal;
    tickTimer = setInterval(() => tick(session), 1000);
    tick(session);
  }
}

function tick(session) {
  const remain = session.endsAt - Date.now();
  $("clock").textContent = fmtRemaining(remain);
  const total = session.endsAt - session.startedAt;
  $("tideFill").style.width = `${Math.max(0, (remain / total) * 100)}%`;
  updatePip(session, remain);
  if (remain <= 0) { clearInterval(tickTimer); render(); }
}

async function startSession() {
  const goal = $("goalInput").value.trim();
  if (!goal) { $("goalInput").focus(); return; }

  const now = Date.now();
  const session = { active: true, goal, startedAt: now, endsAt: now + chosenMin * 60 * 1000 };
  await chrome.storage.sync.set({ goal, durationMin: chosenMin, session });

  chrome.alarms.create(NEO_ALARM, { when: session.endsAt });

  openPip();
  render();
}

async function stopSession() {
  clearInterval(tickTimer);
  clearTimeout(pipRefreshTimer);
  const session = await getSession();
  if (session) await setSession({ ...session, active: false });
  chrome.alarms.clear(NEO_ALARM);
  // Đóng bằng chrome.windows.remove (đáng tin hơn pipWindow.close trên Document PiP)
  const { neoPipWindowId } = await chrome.storage.local.get("neoPipWindowId");
  if (neoPipWindowId) {
    chrome.windows.remove(neoPipWindowId).catch(() => {});
  }
  if (pipWindow && !pipWindow.closed) pipWindow.close();
  pipWindow = null;
  chrome.storage.local.remove("neoPipWindowId");
  pipRegistryRemove('neo');
  render();
}

async function openPip() {
  if (!pipSupported) return;
  const session = await getSession();
  if (!session || !session.active) return;

  if (pipWindow && !pipWindow.closed) { pipWindow.focus?.(); return; }

  const before = new Set((await chrome.windows.getAll()).map(w => w.id));

  try {
    pipWindow = await documentPictureInPicture.requestWindow({ width: 320, height: 130 });
  } catch (e) {
    console.warn("Không mở được PiP:", e);
    return;
  }

  // Lấy Chrome window ID của PiP để di chuyển về sau
  const after = await chrome.windows.getAll();
  const newWin = after.find(w => !before.has(w.id));
  if (newWin) {
    await chrome.storage.local.set({ neoPipWindowId: newWin.id });
    await pipRegistryAdd('neo', newWin.id);
  }

  setupPipContent(pipWindow, session);
  startPipRefresh();

  pipWindow.document.body.addEventListener("mouseenter", () => movePip(false));

  pipWindow.addEventListener("pagehide", () => {
    clearTimeout(pipRefreshTimer);
    chrome.storage.local.remove("neoPipWindowId");
    pipRegistryRemove('neo');
    pipWindow = null;
  });

  // Minimize cửa sổ anchor nếu là tab duy nhất trong cửa sổ
  try {
    const tabs = await chrome.tabs.query({ windowId: (await chrome.tabs.getCurrent()).windowId });
    if (tabs.length === 1) {
      chrome.windows.update((await chrome.tabs.getCurrent()).windowId, { state: "minimized" });
    }
  } catch (_) {}
}

async function movePip(center = false) {
  const { neoPipWindowId } = await chrome.storage.local.get("neoPipWindowId");
  if (!neoPipWindowId) return;
  let pip;
  try { pip = await chrome.windows.get(neoPipWindowId, {}); } catch (_) { return; }

  const sw = window.screen.width;
  const sh = window.screen.height;
  const pw = pip.width;
  const ph = pip.height;

  let target;
  if (center) {
    target = {
      left: Math.round((sw - pw) / 2),
      top:  Math.round((sh - ph) / 2),
    };
  } else {
    const margin = 40;
    for (let i = 0; i < 8; i++) {
      target = {
        left: Math.round(margin + Math.random() * (sw - pw - margin * 2)),
        top:  Math.round(margin + Math.random() * (sh - ph - margin * 2)),
      };
      const dx = target.left - pip.left;
      const dy = target.top  - pip.top;
      if (Math.sqrt(dx * dx + dy * dy) > 200) break;
    }
  }
  chrome.windows.update(neoPipWindowId, target);
}

function setupPipContent(win, session) {
  const doc = win.document;
  doc.documentElement.lang = "vi";
  const style = doc.createElement("style");
  style.textContent = `
    :root { color-scheme: dark; }
    body { margin: 0; background: var(--neo-bg, #11151f); color: var(--neo-fg, #f4f1e8); height: 100vh;
      display: flex; flex-direction: column; justify-content: center;
      font: 13px/1.4 ui-sans-serif, system-ui, sans-serif; padding: 14px 16px; box-sizing: border-box;
      transition: background .6s ease, color .6s ease; }
    .eyebrow { font-size: 9px; letter-spacing: .22em; color: var(--neo-accent, #f0a33c); margin-bottom: 5px; }
    .goal { font-size: 20px; font-weight: 750; line-height: 1.3; overflow: hidden; display: -webkit-box;
      -webkit-line-clamp: 3; -webkit-box-orient: vertical; margin-bottom: 10px; }
    .foot { display: flex; align-items: center; justify-content: space-between; }
    .clock { font-size: 13px; font-weight: 400; font-variant-numeric: tabular-nums;
      color: var(--neo-muted, #828ca0); letter-spacing: .04em; }
    .ask { font-size: 11px; color: var(--neo-muted, #828ca0); max-width: 55%; text-align: right; }
    .tide { height: 2px; background: var(--neo-line, #2a3142); margin-top: 8px; border-radius: 2px; overflow: hidden; }
    .tide-fill { height: 100%; background: var(--neo-accent, #f0a33c); width: 100%; transition: width 1s linear; }
    body.neo-alert { animation: neo-alert 3s steps(1) forwards; }
    @keyframes neo-alert {
      0%   { background: #ff3b30; color: #fff; }
      10%  { background: #ff9500; color: #000; }
      20%  { background: #ff3b30; color: #fff; }
      30%  { background: #ffcc00; color: #000; }
      40%  { background: #ff3b30; color: #fff; }
      50%  { background: #ff9500; color: #000; }
      60%  { background: #ff3b30; color: #fff; }
      70%  { background: #ffcc00; color: #000; }
      80%  { background: #ff3b30; color: #fff; }
      90%  { background: #1a1a2e; color: #fff; }
      100% { background: var(--neo-bg, #11151f); color: var(--neo-fg, #f4f1e8); }
    }
    body.neo-soft { animation: neo-soft .5s ease; }
    @keyframes neo-soft { 0% { opacity: .3; } 100% { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { body.neo-alert, body.neo-soft { animation: none; } }
  `;
  doc.head.appendChild(style);
  doc.body.innerHTML = `
    <div class="goal" id="pGoal"></div>
    <div class="foot">
      <div class="clock" id="pClock">--:--</div>
      <div class="ask" id="pAsk"></div>
    </div>
    <div class="tide"><div class="tide-fill" id="pTide"></div></div>
  `;
  doc.getElementById("pGoal").textContent = session.goal;
}

function updatePip(session, remain) {
  if (!pipWindow || pipWindow.closed) return;
  const d = pipWindow.document;
  const clock = d.getElementById("pClock");
  const tide  = d.getElementById("pTide");
  if (clock) clock.textContent = fmtRemaining(remain);
  if (tide) {
    const total = session.endsAt - session.startedAt;
    tide.style.width = `${Math.max(0, (remain / total) * 100)}%`;
  }
}

// ---- Chống "mù banner": đổi màu + câu nhắc + vị trí theo chu kỳ ----
const PIP_THEMES = [
  { bg: "#11151f", fg: "#f4f1e8", accent: "#f0a33c", line: "#2a3142", muted: "#828ca0" },
  { bg: "#101a16", fg: "#eef4ec", accent: "#5fc88f", line: "#23362c", muted: "#7da08c" },
  { bg: "#1a1320", fg: "#f3edf7", accent: "#c98bf0", line: "#32263d", muted: "#9a87ab" },
  { bg: "#1c1412", fg: "#f6efe9", accent: "#f07b54", line: "#3a2a24", muted: "#a8907f" },
  { bg: "#f4f1e8", fg: "#11151f", accent: "#b4571e", line: "#d8d2c2", muted: "#6f7686" },
];
let pipRefreshTimer = null;
let pipLastTheme = -1, pipLastAsk = -1;

function startPipRefresh() {
  applyPipLook(false);
  schedulePipRefresh();
}

function schedulePipRefresh() {
  clearTimeout(pipRefreshTimer);
  const min = cfg?.refreshMin ?? 3;
  const max = Math.max(cfg?.refreshMax ?? 7, min);
  pipRefreshTimer = setTimeout(() => {
    if (pipWindow && !pipWindow.closed) {
      applyPipLook(true);
      movePip(cfg?.alertOn !== false);
      schedulePipRefresh();
    }
  }, (min + Math.random() * (max - min)) * 60 * 1000);
}

async function pipRegistryAdd(owner, windowId) {
  const data = await chrome.storage.local.get('pipRegistry');
  const reg = (data.pipRegistry || []).filter(e => e.owner !== owner);
  reg.push({ owner, windowId });
  await chrome.storage.local.set({ pipRegistry: reg });
}

async function pipRegistryRemove(owner) {
  const data = await chrome.storage.local.get('pipRegistry');
  const reg = (data.pipRegistry || []).filter(e => e.owner !== owner);
  await chrome.storage.local.set({ pipRegistry: reg });
}

function applyPipLook(blink) {
  if (!pipWindow || pipWindow.closed) return;
  const pick = (arr, last) => {
    let i;
    do { i = Math.floor(Math.random() * arr.length); } while (arr.length > 1 && i === last);
    return i;
  };

  const body = pipWindow.document.body;
  if (cfg?.themesOn !== false) {
    pipLastTheme = pick(PIP_THEMES, pipLastTheme);
  } else {
    pipLastTheme = 0;
  }
  const t = PIP_THEMES[pipLastTheme];
  body.style.setProperty("--neo-bg", t.bg);
  body.style.setProperty("--neo-fg", t.fg);
  body.style.setProperty("--neo-accent", t.accent);
  body.style.setProperty("--neo-line", t.line);
  body.style.setProperty("--neo-muted", t.muted);

  const ask = pipWindow.document.getElementById("pAsk");
  if (ask) {
    if (cfg?.askOn === false) {
      ask.textContent = "";
    } else {
      const asks = (cfg?.asksPip && cfg.asksPip.length) ? cfg.asksPip : DEFAULTS.asksPip;
      pipLastAsk = pick(asks, Math.min(pipLastAsk, asks.length - 1));
      ask.textContent = asks[pipLastAsk];
    }
  }

  if (blink) {
    const cls = cfg?.alertOn !== false ? "neo-alert" : "neo-soft";
    body.classList.remove("neo-alert", "neo-soft");
    void body.offsetWidth;
    body.classList.add(cls);
  }
}

function showPipDone() {
  if (!pipWindow || pipWindow.closed) return;
  clearTimeout(pipRefreshTimer);

  // Di chuyển ra giữa + nháy mạnh nếu alertOn, ngược lại chỉ fade nhẹ
  if (cfg?.alertOn !== false) movePip(true);

  const body = pipWindow.document.body;
  body.classList.remove("neo-alert", "neo-soft");
  void body.offsetWidth;
  body.classList.add(cfg?.alertOn !== false ? "neo-alert" : "neo-soft");

  // Ghi đè nội dung PiP thành thông báo hết giờ + đếm ngược 6s
  const goal = pipWindow.document.getElementById("pGoal");
  const clock = pipWindow.document.getElementById("pClock");
  const ask = pipWindow.document.getElementById("pAsk");
  const tide = pipWindow.document.getElementById("pTide");
  if (goal)  goal.textContent  = "Hết giờ rồi! Nghỉ ngắn 1–2 phút để cân bằng nhé.";
  if (ask)   ask.textContent   = "";
  if (tide)  tide.style.width  = "0%";

  let remaining = 6;
  const update = () => { if (clock) clock.textContent = `Đóng sau ${remaining}s`; };
  update();

  const countdown = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(countdown);
      stopSession();
    } else {
      update();
    }
  }, 1000);
}
