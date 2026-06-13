// standup.js — nhắc nhở đứng dậy. Dùng chrome.notifications, không cần Document PiP.

const $ = (id) => document.getElementById(id);

const ALARM = 'standup-sitting';
const NOTIF_ID = 'standup-alert';

let state = 'idle'; // idle | tracking | alerting
let tickInterval = null;
let endsAt = null;
let cfg = { maxSec: 2700 };

init();

async function init() {
  const data = await chrome.storage.local.get('standupCfg');
  cfg = { maxSec: 2700, ...data.standupCfg };
  $('maxSec').value = cfg.maxSec;
  updateHint();

  $('maxSec').addEventListener('change', async () => {
    const v = parseInt($('maxSec').value, 10);
    if (v >= 10) { cfg.maxSec = v; await saveCfg(); updateHint(); }
  });

  $('startBtn').addEventListener('click', onStart);
  $('stopBtn').addEventListener('click', onStop);
  $('stopFromAlert').addEventListener('click', onStop);
  $('doneBtn').addEventListener('click', onDone);

  // Background relay khi alarm fire
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'standup-alert') showAlert();
  });

  // Lưu tab ID để background biết gửi message về đây
  const tab = await chrome.tabs.getCurrent();
  if (tab) await chrome.storage.local.set({ standupTabId: tab.id });

  // Khôi phục trạng thái nếu tab reload trong khi đang tracking
  const saved = await chrome.storage.local.get('standupEndsAt');
  if (saved.standupEndsAt) {
    endsAt = saved.standupEndsAt;
    if (Date.now() >= endsAt) {
      showAlert();
    } else {
      setState('tracking');
      startTick();
    }
  } else {
    setState('idle');
  }
}

function updateHint() {
  const s = cfg.maxSec;
  const min = Math.round(s / 60);
  $('secHint').textContent = s < 60
    ? `${s} giây — chế độ test.`
    : `${s} giây = ${min} phút. Khuyến nghị 2700 (45 phút).`;
}

async function saveCfg() {
  await chrome.storage.local.set({ standupCfg: cfg });
}

async function onStart() {
  endsAt = Date.now() + cfg.maxSec * 1000;
  await chrome.storage.local.set({ standupEndsAt: endsAt });
  chrome.alarms.create(ALARM, { when: endsAt });
  console.log('[Standup] alarm set, fires at', new Date(endsAt).toLocaleTimeString(), '(in', cfg.maxSec, 's)');
  setState('tracking');
  startTick();
}

async function onStop() {
  chrome.alarms.clear(ALARM);
  chrome.notifications.clear(NOTIF_ID);
  clearInterval(tickInterval);
  endsAt = null;
  await chrome.storage.local.remove('standupEndsAt');
  setState('idle');
}

async function onDone() {
  chrome.notifications.clear(NOTIF_ID);
  endsAt = Date.now() + cfg.maxSec * 1000;
  await chrome.storage.local.set({ standupEndsAt: endsAt });
  chrome.alarms.create(ALARM, { when: endsAt });
  setState('tracking');
  startTick();
}

function showAlert() {
  clearInterval(tickInterval);
  endsAt = null;
  chrome.storage.local.remove('standupEndsAt');
  setState('alerting');
}

function startTick() {
  clearInterval(tickInterval);
  tick();
  tickInterval = setInterval(tick, 1000);
}

function tick() {
  if (!endsAt) return;
  const remaining = endsAt - Date.now();
  if (remaining <= 0) { clearInterval(tickInterval); return; }

  const elapsed = cfg.maxSec * 1000 - remaining;
  const elapsedSec = Math.floor(elapsed / 1000);
  const elapsedMin = Math.floor(elapsedSec / 60);

  $('clockDisplay').textContent = fmtMs(remaining);
  $('clockSub').textContent = elapsedMin > 0 ? `Đã ngồi ${elapsedMin} phút` : '';
}

function fmtMs(ms) {
  if (ms < 0) ms = 0;
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function setState(s) {
  state = s;
  $('setupBlock').hidden     = s !== 'idle';
  $('countdownBlock').hidden = s !== 'tracking';
  $('alertBlock').hidden     = s !== 'alerting';
}
