// ================================================================
// TOEIC.JS — Chrome Extension client
// ================================================================
import { LoadingModule } from './LoadingModule.js';
import { StorageModule } from './StorageModule.js';
import { PasswordModule } from './PasswordModule.js';

export const ToeicModule = (() => {

  // ── Constants ──────────────────────────────────────────────────
  const SETTINGS_KEY   = 'LapsExtensionSettings';
  const TIMER_KEY      = 'toeicTimerSettings';
  const PENDING_KEY    = 'toeic_pending_question';
  const PARTS_KEY      = 'toeicPopupParts';
  const PAGE_SIZE      = 40;
  const TIMER_DEFAULTS = { autoCloseSec: 30, timerMinSec: 10, timerMaxSec: 60 };

  // ── chrome.storage.local helpers (chỉ dùng cho settings nhỏ) ──
  const _get = (key) => new Promise(res => chrome.storage.local.get([key], r => res(r[key] ?? null)));
  const _set = (key, val) => new Promise(res => chrome.storage.local.set({ [key]: val }, res));

  // ── IndexedDB — lưu câu hỏi (không giới hạn quota) ────────────
  const DB_NAME    = 'toeic_db';
  const DB_VERSION = 1;
  const STORE_NAME = 'questions';

  let _dbInstance = null;

  const _openDB = () => new Promise((resolve, reject) => {
    if (_dbInstance) { resolve(_dbInstance); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // keyPath = _id là số thứ tự tự sinh; có thể đổi thành question_no nếu luôn unique
        db.createObjectStore(STORE_NAME, { keyPath: '_id', autoIncrement: true });
      }
    };
    req.onsuccess  = (e) => { _dbInstance = e.target.result; resolve(_dbInstance); };
    req.onerror    = (e) => reject(e.target.error);
  });

  /** Xoá toàn bộ và ghi mới — dùng transaction để atomic */
  const _dbSaveAll = async (arr) => {
    const db = await _openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      arr.forEach((item, i) => store.put({ ...item, _id: i + 1 }));
      tx.oncomplete = () => resolve();
      tx.onerror    = (e) => reject(e.target.error);
    });
  };

  /** Đọc toàn bộ câu hỏi */
  const _dbGetAll = async () => {
    const db = await _openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readonly');
      const req   = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = (e) => resolve(e.target.result || []);
      req.onerror   = (e) => reject(e.target.error);
    });
  };

  // ── Data ───────────────────────────────────────────────────────
  const getAll = () => _dbGetAll();

  const pullFromServer = () => new Promise((resolve, reject) => {
    StorageModule.get([CACHE_PASS], async ({ [CACHE_PASS]: pass = '' }) => {
      if (!pass) return reject(new Error('Chưa có mật khẩu'));
      LoadingModule?.show();
      try {
        const res  = await fetch(API, { method: 'POST', body: JSON.stringify({ pass, action: API_ACTION_TOEIC_GET_ALL }) });
        const json = await res.json();
        if (json.code !== 1) throw new Error(json.error || 'Lỗi server');
        await _dbSaveAll(json.data || []);   // ← IndexedDB, không còn quota
        resolve(json.data || []);
      } catch (err) {
        reject(err);
      } finally {
        LoadingModule?.hide();
      }
    });
  });

  // ── Session (in-memory, chỉ tồn tại trong phiên popup) ────────
  // Mỗi entry: { question, state: { selected, revealed } }
  const _session = { stack: [], pointer: -1, seenIds: new Set() };

  const sessionReset = () => {
    _session.stack   = [];
    _session.pointer = -1;
    _session.seenIds = new Set();
  };

  const sessionPush = (q) => {
    // Cắt bỏ "tương lai" nếu đang ở giữa stack, rồi push câu mới
    _session.stack = _session.stack.slice(0, _session.pointer + 1);
    _session.stack.push({ question: q, state: { selected: null, revealed: false } });
    _session.pointer = _session.stack.length - 1;
    _session.seenIds.add(q.question_no ?? JSON.stringify(q));
  };

  const sessionCurrent  = () => _session.stack[_session.pointer] ?? null;
  const sessionHasBack  = () => _session.pointer > 0;
  const sessionHasNext  = () => _session.pointer < _session.stack.length - 1;
  const sessionGo       = (delta) => { _session.pointer += delta; return sessionCurrent(); };

  // ── Random câu chưa xem, theo parts đã lọc ────────────────────
  const getRandomFiltered = async () => {
    const all   = await getAll();
    if (!all.length) return null;
    const saved = await _get(PARTS_KEY);
    const parts = Array.isArray(saved) && saved.length ? saved : null;
    const pool  = (parts ? all.filter(q => parts.includes(String(q.part || '').trim())) : all)
                    .filter(Boolean) || all;

    const unseen = pool.filter(q => !_session.seenIds.has(q.question_no ?? JSON.stringify(q)));
    // Đã xem hết → reset và cho phép lặp lại
    if (!unseen.length) _session.seenIds.clear();
    const src = unseen.length ? unseen : pool;
    return src[Math.floor(Math.random() * src.length)];
  };

  // ── Helpers ────────────────────────────────────────────────────
  const _esc = (str) => String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  const _partClass = (part) => {
    const p = String(part || '');
    return p.includes('6') ? '6' : p.includes('7') ? '7' : '5';
  };

  // ── Tạo row danh sách ─────────────────────────────────────────
  const _createRow = (q, idx) => {
    const pc  = _partClass(q.part);
    const row = document.createElement('div');
    row.className    = 'question-row';
    row.dataset.part = pc;
    row.dataset.idx  = idx;

    const pills = ['option_a','option_b','option_c','option_d']
      .map((k, i) => q[k] ? `<span class="row-option-pill">${'ABCD'[i]}. ${_esc(q[k])}</span>` : '')
      .filter(Boolean).join('');

    const qText = q.question
      ? _esc(q.question)
      : (q.context ? `<em class="row-context-preview">${_esc(q.context.substring(0, 80))}…</em>` : '');

    row.innerHTML = `
      <div class="row-left">
        <span class="row-part-badge row-part-badge--${pc}">Part ${pc}</span>
        <span class="row-q-no">${_esc(q.question_no || '')}</span>
        <span class="row-set-no">${q.set_no ? `Đề ${_esc(q.set_no)}` : ''}</span>
        ${q.year ? `<span class="row-year-tag">${_esc(q.year)}</span>` : ''}
      </div>
      <div class="row-content">
        <div class="row-question">${qText}</div>
        <div class="row-options">${pills}</div>
      </div>
      <div class="row-right">
        <svg class="row-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>`;
    return row;
  };

  // ── Mount chi tiết câu hỏi ─────────────────────────────────────
  // nav (chỉ truyền ở popup manual mode):
  //   { hasPrev, hasNext, onPrev, onNext, state, onSaveState }
  const mountDetail = (container, question, onClose, isPopupMode = false, nav = null) => {
    container.innerHTML = '';
    container.appendChild(document.getElementById('tpl-question-detail').content.cloneNode(true));

    const pc     = _partClass(question.part);
    const $ = (sel) => container.querySelector(sel);

    // ── Popup: bọc nội dung vào popup-body ──
    if (isPopupMode) {
      const wrap    = $('.detail-wrap');
      const header  = $('.detail-header');
      const actions = $('.detail-actions');
      const isWide  = pc === '6' || pc === '7';
      if (isWide) wrap.classList.add('detail-wrap--wide');

      const body = document.createElement('div');
      body.className = 'popup-body';
      Array.from(wrap.childNodes).forEach(n => { if (n !== header && n !== actions) body.appendChild(n); });

      if (isWide) {
        const right = document.createElement('div');
        right.className = 'popup-right';
        ['#detailQuestion','#detailOptions','#detailAnswerWrap'].forEach(sel => {
          const el = body.querySelector(sel);
          if (el) right.appendChild(el);
        });
        body.appendChild(right);
      }
      wrap.insertBefore(body, actions);
    }

    // ── Điền dữ liệu ──
    const badge = $('#detailPartBadge');
    badge.textContent = `Part ${pc}`;
    badge.className   = `detail-part-badge detail-part-badge--${pc}`;

    $('#detailQuestionNo').textContent =
      question.question_no ? `Câu ${question.question_no}` : '';
    $('#detailSetNo').textContent =
      [question.set_no && `Đề ${question.set_no}`, question.year && `(${question.year})`]
        .filter(Boolean).join(' ');

    if (question.context && pc !== '5') {
      $('#detailContextWrap').classList.remove('d-none');
      $('#detailContext').textContent = question.context;
    }

    const qEl = $('#detailQuestion');
    qEl.textContent = question.question || '';
    if (!question.question) qEl.classList.add('d-none');

    ['A','B','C','D'].forEach(l =>
      $(`#opt${l}`).textContent = question[`option_${l.toLowerCase()}`] || ''
    );

    // ── State ──
    const correct    = String(question.correct_answer || '').trim().toUpperCase();
    let { selected = null, revealed = false } = nav?.state ?? {};

    const optRows    = container.querySelectorAll('.option-row');
    const btnReveal  = $('#btnRevealAnswer');
    const answerWrap = $('#detailAnswerWrap');
    const btnNext    = $('#btnNextRandom');

    // Reveal: applica visivamente risultato
    const _doReveal = () => {
      optRows.forEach(row => {
        row.classList.remove('selected');
        if (row.dataset.opt === correct)       row.classList.add('correct');
        else if (row.dataset.opt === selected) row.classList.add('wrong');
      });
      $('#detailCorrectAnswer').textContent = correct;
      $('#detailExplanation').textContent   = question.explanation || '';
      answerWrap.classList.remove('d-none');
      btnReveal.style.display = 'none';
      if (nav && btnNext) btnNext.classList.remove('d-none');
    };

    // Restore state nếu đã xem câu này trước đó
    if (revealed) {
      _doReveal();
    } else if (selected) {
      container.querySelector(`.option-row[data-opt="${selected}"]`)?.classList.add('selected');
    }

    // Hiện btnNext ngay nếu đang ở giữa stack (không cần đợi reveal)
    if (nav?.hasNext && btnNext) btnNext.classList.remove('d-none');

    // ── Event listeners ──
    optRows.forEach(row => {
      row.addEventListener('click', () => {
        if (revealed) return;
        optRows.forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        selected = row.dataset.opt;
        nav?.onSaveState({ selected, revealed });
      });
    });

    btnReveal.addEventListener('click', () => {
      if (revealed) return;
      revealed = true;
      nav?.onSaveState({ selected, revealed });
      _doReveal();
    });

    if (nav) {
      if (btnNext) {
        btnNext.textContent = 'Câu tiếp theo →';
        btnNext.addEventListener('click', nav.onNext);
      }
      if (nav.hasPrev) {
        const btnPrev = Object.assign(document.createElement('button'), {
          className: 'btn-prev-random',
          textContent: '← Câu trước',
        });
        btnPrev.addEventListener('click', nav.onPrev);
        $('.detail-actions')?.prepend(btnPrev);
      }
    }

    $('#btnCloseDetail')?.addEventListener('click', onClose);
  };

  // ── Manager UI ─────────────────────────────────────────────────
  const _initManager = () => {
    const $id = (id) => document.getElementById(id);

    const listEl        = $id('questionList');
    const searchInput   = $id('searchInput');
    const emptyState    = $id('emptyState');
    const questionCount = $id('questionCount');
    const overlay       = $id('modalOverlay');
    const modalCont     = $id('modalContainer');
    const settingsOver  = $id('settingsOverlay');
    const partFilter    = $id('partFilter');
    const yearFilter    = $id('yearFilter');
    const sentinel      = $id('lazysentinel');

    let _all = [], _filtered = [], _rendered = 0;
    const _parts = new Set(), _years = new Set();
    let _observer = null;

    // ── Lazy render ──
    const _renderMore = () => {
      if (_rendered >= _filtered.length) return;
      const to   = Math.min(_rendered + PAGE_SIZE, _filtered.length);
      const frag = document.createDocumentFragment();
      for (let i = _rendered; i < to; i++) frag.appendChild(_createRow(_filtered[i], i));
      listEl.insertBefore(frag, sentinel);
      _rendered = to;
      sentinel.style.display = _rendered >= _filtered.length ? 'none' : 'block';
    };

    const _setupObserver = () => {
      _observer?.disconnect();
      _observer = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) _renderMore(); },
        { rootMargin: '200px' }
      );
      _observer.observe(sentinel);
    };

    const _resetRender = () => {
      Array.from(listEl.children).forEach(el => { if (el.id !== 'lazysentinel') el.remove(); });
      _rendered = 0;
      sentinel.style.display = _filtered.length ? 'block' : 'none';
      _renderMore();
      emptyState.classList.toggle('d-none', _filtered.length > 0);
    };

    // ── Filters ──
    const applyFilters = () => {
      const q = searchInput.value.trim().toLowerCase();
      _filtered = _all.filter(item => {
        const partOk = !_parts.size || _parts.has(_partClass(item.part));
        const yearOk = !_years.size || _years.has(item.year);
        const textOk = !q || [item.question, item.option_a, item.option_b, item.option_c,
                               item.option_d, item.explanation, item.context]
          .some(f => f?.toLowerCase().includes(q));
        return partOk && yearOk && textOk;
      });
      questionCount.textContent = `${_filtered.length} / ${_all.length} câu`;
      _resetRender();
    };

    const _toggleChip = (chip, set, key) => {
      const val = chip.dataset[key];
      set.has(val) ? (set.delete(val), chip.classList.remove('chip--active'))
                   : (set.add(val),    chip.classList.add('chip--active'));
      applyFilters();
    };

    const loadData = async () => {
      _all = await getAll();
      yearFilter.innerHTML = '';
      [...new Set(_all.map(q => q.year).filter(Boolean))].sort().forEach(y => {
        const chip = Object.assign(document.createElement('button'), {
          className: 'chip chip--year', textContent: y,
        });
        chip.dataset.year = y;
        yearFilter.appendChild(chip);
      });
      questionCount.textContent = `${_all.length} câu`;
      applyFilters();
      _setupObserver();
    };

    // ── Modal chi tiết ──
    const closeDetail = () => { overlay.classList.remove('active'); modalCont.innerHTML = ''; };
    const openDetail  = (q) => {
      overlay.classList.add('active');
      mountDetail(modalCont, q, closeDetail);
    };

    // ── Click câu → mở popup window (giống manual) ──
    listEl.addEventListener('click', (e) => {
      const row = e.target.closest('.question-row');
      if (!row) return;
      const q = _filtered[+row.dataset.idx];
      if (!q) return;
      _set(PENDING_KEY, q).then(() =>
        chrome.runtime.sendMessage({ action: 'showToeicPopupEntry' })
      );
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDetail(); });

    // ── Bộ lọc ──
    partFilter.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (chip) _toggleChip(chip, _parts, 'part');
    });
    yearFilter.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (chip) _toggleChip(chip, _years, 'year');
    });

    let searchTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(applyFilters, 250);
    });
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') { e.preventDefault(); searchInput.focus(); searchInput.select(); }
    });

    // ── Đồng bộ ──
    const doSync = async () => {
      if (!confirm('Ghi đè dữ liệu local bằng dữ liệu từ Google Sheet?')) return;
      try {
        await pullFromServer();
        _parts.clear(); _years.clear();
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('chip--active'));
        await loadData();
      } catch (err) { alert('Lỗi đồng bộ: ' + err.message); }
    };

    $id('btnSync').addEventListener('click', () => {
      StorageModule.get([CACHE_PASS], (r) => {
        const pass = r?.[CACHE_PASS] || '';
        if (!pass) {
          // Chưa có mật khẩu → mở popup nhập (giống màn hoanglap3011); nhập xong tự đồng bộ
          PasswordModule.openPasswordPopup(() => doSync());
          return;
        }
        doSync();
      });
    });

    $id('btnRandom').addEventListener('click', () => {
      if (!_all.length) { alert('Chưa có dữ liệu. Hãy đồng bộ trước!'); return; }
      chrome.runtime.sendMessage({ action: 'showToeicPopup' });
    });

    // ── Settings ──
    const _fmtSec = (s) => s >= 60 ? `${Math.floor(s/60)}p${s%60 ? ` ${s%60}s` : ''}` : `${s}s`;

    const _syncSliderState = (enabled) => {
      const area = $id('popupSettingsArea');
      if (!area) return;
      area.style.opacity      = enabled ? '1' : '0.4';
      area.style.pointerEvents = enabled ? '' : 'none';
      area.querySelectorAll('input[type="range"]').forEach(el => el.disabled = !enabled);
    };

    const _updateBadges = () => {
      const [ic, im, ix] = ['toeicAutoCloseSec','toeicTimerMinSec','toeicTimerMaxSec'].map($id);
      const bd = $id('toeicAutoCloseDisplay'), br = $id('toeicTimerRangeDisplay');
      if (bd && ic) bd.textContent = _fmtSec(+ic.value);
      if (br && im && ix) br.textContent = `${_fmtSec(+im.value)} – ${_fmtSec(+ix.value)}`;
    };

    $id('btnSettings').addEventListener('click', () => {
      chrome.storage.local.get([SETTINGS_KEY, TIMER_KEY, PARTS_KEY], (data) => {
        const s       = data[SETTINGS_KEY] || {};
        const tv      = { ...TIMER_DEFAULTS, ...(data[TIMER_KEY] || {}) };
        const enabled = s.toeicEnableAutoPopup ?? false;
        const chk     = $id('toeicEnableAutoPopup');
        if (chk) chk.checked = enabled;
        [$id('toeicAutoCloseSec'), $id('toeicTimerMinSec'), $id('toeicTimerMaxSec')]
          .forEach((el, i) => { if (el) el.value = [tv.autoCloseSec, tv.timerMinSec, tv.timerMaxSec][i]; });
        _updateBadges();
        _syncSliderState(enabled);
        const saved = Array.isArray(data[PARTS_KEY]) ? data[PARTS_KEY] : [];
        document.querySelectorAll('#settingsPartFilter .chip').forEach(c =>
          c.classList.toggle('chip--active', saved.includes(c.dataset.part))
        );
      });
      settingsOver.classList.add('active');
    });

    $id('btnCloseSettings').addEventListener('click', () => settingsOver.classList.remove('active'));
    settingsOver.addEventListener('click', (e) => { if (e.target === settingsOver) settingsOver.classList.remove('active'); });

    let saveTimer;
    const saveSettings = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const chk = $id('toeicEnableAutoPopup');
        const [ic, im, ix] = ['toeicAutoCloseSec','toeicTimerMinSec','toeicTimerMaxSec'].map($id);
        const autoCloseSec = parseInt(ic?.value)  || TIMER_DEFAULTS.autoCloseSec;
        const timerMinSec  = Math.max(10, parseInt(im?.value) || TIMER_DEFAULTS.timerMinSec);
        const timerMaxSec  = Math.max(timerMinSec, parseInt(ix?.value) || TIMER_DEFAULTS.timerMaxSec);
        const selParts     = [...document.querySelectorAll('#settingsPartFilter .chip--active')]
                               .map(c => c.dataset.part).filter(Boolean);
        chrome.storage.local.get([SETTINGS_KEY], (data) => {
          chrome.storage.local.set({
            [SETTINGS_KEY]: { ...(data[SETTINGS_KEY] || {}), toeicEnableAutoPopup: chk?.checked ?? false },
            [TIMER_KEY]:    { autoCloseSec, timerMinSec, timerMaxSec },
            [PARTS_KEY]:    selParts,
          }, () => {
            const st = $id('settingsStatus');
            if (st) { st.textContent = '✓ Đã lưu'; st.style.opacity = '1'; setTimeout(() => st.style.opacity = '0', 1800); }
            chrome.runtime.sendMessage({ action: 'toeicTimerUpdated', enabled: chk?.checked ?? false });
          });
        });
      }, 500);
    };

    const chkEl = $id('toeicEnableAutoPopup');
    chkEl?.addEventListener('change', () => { _syncSliderState(chkEl.checked); saveSettings(); });
    $id('settingsPartFilter')?.addEventListener('click', (e) => {
      const c = e.target.closest('.chip');
      if (c) { c.classList.toggle('chip--active'); saveSettings(); }
    });
    ['toeicAutoCloseSec','toeicTimerMinSec','toeicTimerMaxSec'].forEach(id =>
      $id(id)?.addEventListener('input', () => { _updateBadges(); saveSettings(); })
    );

    loadData();
  };

  // ── Khởi động ──────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    const params   = new URLSearchParams(window.location.search);
    const isPopup  = params.get('mode') === 'popup';
    const isManual = params.get('source') === 'manual';
    const isEntry  = params.get('source') === 'entry';

    if (!isPopup) { _initManager(); return; }

    document.getElementById('sectionManager').style.display = 'none';
    document.body.classList.add('popup-mode');

    const card  = Object.assign(document.createElement('div'), { className: 'modal-card' });
    document.body.appendChild(card);

    const firstQ = await _get(PENDING_KEY);
    if (!firstQ) {
      card.innerHTML = '<div style="padding:40px;text-align:center;color:#666">Không có câu hỏi nào.</div>';
      return;
    }

    sessionReset();
    sessionPush(firstQ);

    const renderCurrent = () => {
      const entry = sessionCurrent();
      if (!entry) return;
      const { question, state } = entry;

      const nav = isManual ? {
        hasPrev:     sessionHasBack(),
        hasNext:     sessionHasNext(),
        state,
        onSaveState: (newState) => Object.assign(entry.state, newState),
        onPrev:      () => { sessionGo(-1); renderCurrent(); },
        onNext:      async () => {
          if (sessionHasNext()) { sessionGo(1); renderCurrent(); return; }
          const next = await getRandomFiltered();
          if (next) { sessionPush(next); renderCurrent(); }
        },
      } : null;

      mountDetail(card, question, () => window.close(), true, nav);
    };

    renderCurrent();

    if (!isManual && !isEntry) {
      const tv = await _get(TIMER_KEY).then(r => ({ ...TIMER_DEFAULTS, ...(r || {}) }));
      let t = tv.autoCloseSec;
      const countdownEl = card.querySelector('#detailCountdown');
      if (countdownEl) { countdownEl.textContent = t; countdownEl.classList.remove('d-none'); }
      const timer = setInterval(() => {
        t--;
        if (countdownEl) countdownEl.textContent = t;
        if (t <= 0) { clearInterval(timer); window.close(); }
      }, 1000);
      // Nút X cũng clear countdown
      card.querySelector('#btnCloseDetail')?.addEventListener('click', () => clearInterval(timer), { once: true });
    }
  });

  return { getAll, pullFromServer, sessionReset };
})();