// ============================================================
// Hẹn giờ — nhiều bộ đếm ngược chạy song song
// Nguồn dữ liệu duy nhất: chrome.storage.local['hengioTimers']
// Thông báo khi hết giờ do background.js bắn ra (chrome.notifications)
// ============================================================
(() => {
  const STORE_KEY = 'hengioTimers';
  const ALARM_PREFIX = 'hengio-';
  const TICK_MS = 200;

  const dom = {
    form: document.getElementById('createForm'),
    inputH: document.getElementById('inputH'),
    inputM: document.getElementById('inputM'),
    inputS: document.getElementById('inputS'),
    inputLabel: document.getElementById('inputLabel'),
    inputSound: document.getElementById('inputSound'),
    presets: document.getElementById('presets'),
    formError: document.getElementById('formError'),
    list: document.getElementById('timerList'),
    empty: document.getElementById('emptyState'),
    clearDoneBtn: document.getElementById('clearDoneBtn'),
  };

  let timers = [];
  const cards = new Map(); // id -> { root, timeEl, bar, statusEl }
  const finishing = new Set(); // tránh bắn 'hengio-done' nhiều lần cho cùng 1 bộ

  // ---------- Lưu trữ ----------
  const loadTimers = async () => {
    const data = await chrome.storage.local.get(STORE_KEY);
    return Array.isArray(data[STORE_KEY]) ? data[STORE_KEY] : [];
  };
  const saveTimers = (list) => chrome.storage.local.set({ [STORE_KEY]: list });

  // ---------- Tiện ích ----------
  const newId = () =>
    (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const remainingOf = (t) => {
    if (t.status === 'done') return 0;
    if (t.status === 'running') return Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
    return Math.max(0, t.remainingSec || 0);
  };

  const formatTime = (totalSec) => {
    const s = Math.max(0, Math.floor(totalSec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  };

  const formatDuration = (totalSec) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return [h ? `${h} giờ` : '', m ? `${m} phút` : '', s ? `${s} giây` : ''].filter(Boolean).join(' ') || '0 giây';
  };

  // ---------- Âm thanh báo hết giờ ----------
  let audioCtx = null;
  function playBeep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = audioCtx || new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      // 3 tiếng bíp ngắn
      [0, 0.45, 0.9].forEach((offset) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const start = audioCtx.currentTime + offset;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + 0.35);
      });
    } catch (_) {
      // Trình duyệt chặn phát âm thanh thì bỏ qua, thông báo vẫn hiện
    }
  }

  // ---------- Hẹn báo thức nền (để thông báo vẫn đúng giờ khi tab bị ẩn/đóng) ----------
  const scheduleAlarm = (t) => chrome.alarms.create(ALARM_PREFIX + t.id, { when: t.endsAt });
  const clearAlarm = (id) => chrome.alarms.clear(ALARM_PREFIX + id);

  // ---------- Thao tác trên bộ hẹn giờ ----------
  // Mọi thao tác đọc-sửa-ghi phải chạy tuần tự, nếu không hai thao tác gần nhau sẽ ghi đè lẫn nhau
  let opChain = Promise.resolve();
  const runExclusive = (fn) => {
    opChain = opChain.then(fn, fn); // lỗi của thao tác trước không chặn thao tác sau
    return opChain;
  };

  const mutate = (id, fn) => runExclusive(() => _mutate(id, fn));
  const createTimer = (totalSec, label, sound) => runExclusive(() => _createTimer(totalSec, label, sound));
  const removeTimer = (id) => runExclusive(() => _removeTimer(id));
  const clearDone = () => runExclusive(_clearDone);

  async function _mutate(id, fn) {
    const list = await loadTimers();
    const t = list.find((x) => x.id === id);
    if (!t) return;
    fn(t);
    timers = list;
    await saveTimers(list);
    render();
  }

  async function _createTimer(totalSec, label, sound) {
    const list = await loadTimers();
    const t = {
      id: newId(),
      label: label || `Hẹn giờ ${formatDuration(totalSec)}`,
      totalSec,
      remainingSec: totalSec,
      endsAt: Date.now() + totalSec * 1000,
      status: 'running',
      sound: !!sound,
      createdAt: Date.now(),
    };
    list.push(t);
    timers = list;
    await saveTimers(list);
    scheduleAlarm(t);
    render();
  }

  async function pauseTimer(id) {
    await mutate(id, (t) => {
      if (t.status !== 'running') return;
      t.remainingSec = remainingOf(t);
      t.endsAt = null;
      t.status = 'paused';
    });
    clearAlarm(id);
  }

  async function resumeTimer(id) {
    let resumed = null;
    await mutate(id, (t) => {
      if (t.status === 'running') return;
      const secs = t.status === 'done' ? t.totalSec : Math.max(1, t.remainingSec || t.totalSec);
      t.remainingSec = secs;
      t.endsAt = Date.now() + secs * 1000;
      t.status = 'running';
      resumed = t;
    });
    finishing.delete(id);
    if (resumed) scheduleAlarm(resumed);
  }

  async function resetTimer(id) {
    await mutate(id, (t) => {
      t.remainingSec = t.totalSec;
      t.endsAt = null;
      t.status = 'paused';
    });
    finishing.delete(id);
    clearAlarm(id);
  }

  async function _removeTimer(id) {
    const list = (await loadTimers()).filter((x) => x.id !== id);
    timers = list;
    await saveTimers(list);
    finishing.delete(id);
    clearAlarm(id);
    render();
  }

  async function _clearDone() {
    const list = await loadTimers();
    const kept = list.filter((x) => x.status !== 'done');
    timers = kept;
    await saveTimers(kept);
    render();
  }

  const toggleSound = (id, checked) => mutate(id, (t) => { t.sound = checked; });

  // Nhờ background chốt trạng thái 'done' + bắn thông báo (chỉ 1 nơi làm để không trùng)
  function requestFinish(id) {
    if (finishing.has(id)) return;
    finishing.add(id);
    chrome.runtime.sendMessage({ type: 'hengio-done', id }).catch(() => finishing.delete(id));
  }

  // ---------- Render ----------
  function statusText(t) {
    if (t.status === 'done') return '✅ Đã xong';
    if (t.status === 'paused') return '⏸ Tạm dừng';
    return '▶ Đang chạy';
  }

  function buildCard(t) {
    const root = document.createElement('div');
    root.className = 'timer-card';
    root.dataset.id = t.id;

    root.innerHTML = `
      <div class="timer-top">
        <span class="timer-name"></span>
        <span class="timer-status"></span>
      </div>
      <div class="timer-time"></div>
      <div class="progress"><div class="progress-bar"></div></div>
      <div class="timer-actions">
        <button type="button" class="btn btn--small" data-act="toggle"></button>
        <button type="button" class="btn btn--small" data-act="reset">↺ Đặt lại</button>
        <span class="spacer"></span>
        <label class="chk">
          <input type="checkbox" data-act="sound">
          <span>🔔 Âm thanh</span>
        </label>
        <button type="button" class="btn btn--small btn--remove" data-act="remove">✕ Xoá</button>
      </div>
    `;

    root.querySelector('.timer-name').textContent = t.label;
    root.querySelector('[data-act="sound"]').checked = !!t.sound;

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'toggle') {
        const cur = timers.find((x) => x.id === t.id);
        if (cur && cur.status === 'running') pauseTimer(t.id);
        else resumeTimer(t.id);
      }
      if (act === 'reset') resetTimer(t.id);
      if (act === 'remove') removeTimer(t.id);
    });

    root.querySelector('[data-act="sound"]').addEventListener('change', (e) => {
      toggleSound(t.id, e.target.checked);
    });

    cards.set(t.id, {
      root,
      timeEl: root.querySelector('.timer-time'),
      bar: root.querySelector('.progress-bar'),
      statusEl: root.querySelector('.timer-status'),
      toggleBtn: root.querySelector('[data-act="toggle"]'),
      resetBtn: root.querySelector('[data-act="reset"]'),
    });
    return root;
  }

  function render() {
    cards.clear();
    dom.list.innerHTML = '';

    const sorted = [...timers].sort((a, b) => {
      const rank = (t) => (t.status === 'done' ? 1 : 0);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      return remainingOf(a) - remainingOf(b);
    });
    sorted.forEach((t) => dom.list.appendChild(buildCard(t)));

    dom.empty.hidden = timers.length > 0;
    dom.clearDoneBtn.hidden = !timers.some((t) => t.status === 'done');
    tick();
  }

  function tick() {
    let nearest = null;

    timers.forEach((t) => {
      const card = cards.get(t.id);
      if (!card) return;

      const left = remainingOf(t);
      if (t.status === 'running' && left <= 0) requestFinish(t.id);

      card.root.classList.toggle('is-paused', t.status === 'paused');
      card.root.classList.toggle('is-done', t.status === 'done');
      card.timeEl.textContent = t.status === 'done' ? 'Hết giờ!' : formatTime(left);
      card.statusEl.textContent = statusText(t);
      card.toggleBtn.textContent =
        t.status === 'running' ? '⏸ Tạm dừng' : t.status === 'done' ? '↻ Chạy lại' : '▶ Tiếp tục';
      card.resetBtn.hidden = t.status === 'done';

      const done = t.totalSec > 0 ? (t.totalSec - left) / t.totalSec : 1;
      card.bar.style.width = `${Math.min(100, Math.max(0, done * 100))}%`;

      if (t.status === 'running' && (nearest === null || left < nearest)) nearest = left;
    });

    document.title = nearest === null ? 'Hẹn giờ' : `${formatTime(nearest)} — Hẹn giờ`;
  }

  // ---------- Sự kiện ----------
  dom.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const h = Number(dom.inputH.value) || 0;
    const m = Number(dom.inputM.value) || 0;
    const s = Number(dom.inputS.value) || 0;
    const totalSec = h * 3600 + m * 60 + s;

    if (totalSec <= 0) {
      dom.formError.textContent = 'Hãy nhập thời lượng lớn hơn 0 giây.';
      dom.formError.hidden = false;
      return;
    }
    dom.formError.hidden = true;

    createTimer(totalSec, dom.inputLabel.value.trim(), dom.inputSound.checked);
    dom.inputLabel.value = '';
  });

  dom.presets.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const sec = Number(chip.dataset.sec) || 0;
    dom.inputH.value = Math.floor(sec / 3600);
    dom.inputM.value = Math.floor((sec % 3600) / 60);
    dom.inputS.value = sec % 60;
  });

  dom.clearDoneBtn.addEventListener('click', clearDone);

  // Mọi thay đổi trạng thái đều đi qua storage -> nơi duy nhất phát hiện "vừa hết giờ" để kêu
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[STORE_KEY]) return;
    const oldList = changes[STORE_KEY].oldValue || [];
    const newList = changes[STORE_KEY].newValue || [];

    newList.forEach((t) => {
      const before = oldList.find((x) => x.id === t.id);
      if (t.status === 'done' && before && before.status !== 'done' && t.sound) playBeep();
    });

    timers = newList;
    render();
  });

  // ---------- Khởi chạy ----------
  (async () => {
    timers = await loadTimers();
    // Đảm bảo báo thức nền vẫn còn cho các bộ đang chạy (ví dụ sau khi khởi động lại trình duyệt)
    timers.filter((t) => t.status === 'running' && t.endsAt).forEach(scheduleAlarm);
    render();
    setInterval(tick, TICK_MS);
  })();
})();
