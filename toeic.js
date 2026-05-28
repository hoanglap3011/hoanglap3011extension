// ================================================================
// TOEIC.JS — Chrome Extension client
// ================================================================
import { LoadingModule } from './LoadingModule.js';
import { StorageModule } from './StorageModule.js';

export const ToeicModule = (() => {

  // ── Constants ──────────────────────────────────────────────────
  const STORAGE_KEY = 'toeic_questions';
  const SETTINGS_KEY = 'LapsExtensionSettings';
  const TIMER_KEY   = 'toeicTimerSettings';
  const PENDING_KEY = 'toeic_pending_question';
  const PARTS_KEY   = 'toeicPopupParts';
  const PAGE_SIZE   = 40;

  const TIMER_DEFAULTS = { autoCloseSec: 30, timerMinSec: 10, timerMaxSec: 60 };

  // ── Storage ────────────────────────────────────────────────────
  const _get = (key) => new Promise((resolve) => {
    chrome.storage.local.get([key], (r) => resolve(r[key] ?? null));
  });

  const _set = (key, value) => new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });

  // ── Data ───────────────────────────────────────────────────────
  const getAll = async () => (await _get(STORAGE_KEY)) || [];

  const getRandom = async () => {
    const list = await getAll();
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  };

  // Lấy câu ngẫu nhiên theo parts đã lọc trong settings
  const getRandomFiltered = async () => {
    const all = await getAll();
    if (!all.length) return null;
    const saved = await _get(PARTS_KEY);
    const parts = Array.isArray(saved) && saved.length ? saved : null;
    const pool  = parts ? all.filter(q => parts.includes(String(q.part || '').trim())) : all;
    const src   = pool.length ? pool : all;
    return src[Math.floor(Math.random() * src.length)];
  };

  const pullFromServer = () => new Promise((resolve, reject) => {
    StorageModule.get([CACHE_PASS], async (result) => {
      const pass = result[CACHE_PASS] || '';
      if (!pass) return reject(new Error('Chưa có mật khẩu'));
      if (typeof LoadingModule !== 'undefined') LoadingModule.show();
      try {
        const res  = await fetch(API, { method: 'POST', body: JSON.stringify({ pass, action: API_ACTION_TOEIC_GET_ALL }) });
        const json = await res.json();
        if (json.code !== 1) throw new Error(json.error || 'Lỗi server');
        await _set(STORAGE_KEY, json.data || []);
        resolve(json.data || []);
      } catch (err) {
        reject(err);
      } finally {
        if (typeof LoadingModule !== 'undefined') LoadingModule.hide();
      }
    });
  });

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
    row.className = 'question-row';
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
  const mountDetail = (container, question, onClose, isPopupMode = false, showNext = false) => {
    const tpl = document.getElementById('tpl-question-detail');
    container.innerHTML = '';
    container.appendChild(tpl.content.cloneNode(true));

    const pc = _partClass(question.part);

    // Popup: cấu trúc lại DOM — bọc nội dung vào popup-body
    if (isPopupMode) {
      const wrap    = container.querySelector('.detail-wrap');
      const header  = wrap.querySelector('.detail-header');
      const actions = wrap.querySelector('.detail-actions');
      const isWide  = pc === '6' || pc === '7';

      if (isWide) wrap.classList.add('detail-wrap--wide');

      const body = document.createElement('div');
      body.className = 'popup-body';
      Array.from(wrap.childNodes).forEach(n => {
        if (n !== header && n !== actions) body.appendChild(n);
      });

      if (isWide) {
        // Part 6/7: Q + options + answer sang cột phải
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

    // Điền dữ liệu
    const pc_badge = container.querySelector('#detailPartBadge');
    pc_badge.textContent = `Part ${pc}`;
    pc_badge.className   = `detail-part-badge detail-part-badge--${pc}`;

    container.querySelector('#detailQuestionNo').textContent =
      question.question_no ? `Câu ${question.question_no}` : '';
    container.querySelector('#detailSetNo').textContent =
      [question.set_no ? `Đề ${question.set_no}` : '', question.year ? `(${question.year})` : '']
        .filter(Boolean).join(' ');

    // Context
    if (question.context && (pc === '6' || pc === '7')) {
      const ctxWrap = container.querySelector('#detailContextWrap');
      ctxWrap.classList.remove('d-none');
      container.querySelector('#detailContext').textContent = question.context;
    }

    // Câu hỏi
    const qEl = container.querySelector('#detailQuestion');
    qEl.textContent = question.question || '';
    if (!question.question) qEl.classList.add('d-none');

    // Đáp án A-D
    ['A','B','C','D'].forEach(l => {
      container.querySelector(`#opt${l}`).textContent = question[`option_${l.toLowerCase()}`] || '';
    });

    // Chọn đáp án
    const correct = String(question.correct_answer || '').trim().toUpperCase();
    let selected = null, revealed = false;
    const optRows = container.querySelectorAll('.option-row');

    optRows.forEach(row => {
      row.addEventListener('click', () => {
        if (revealed) return;
        optRows.forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        selected = row.dataset.opt;
      });
    });

    // Reveal đáp án
    const btnReveal  = container.querySelector('#btnRevealAnswer');
    const answerWrap = container.querySelector('#detailAnswerWrap');
    const btnNext    = container.querySelector('#btnNextRandom');

    btnReveal.addEventListener('click', () => {
      if (revealed) return;
      revealed = true;
      optRows.forEach(row => {
        if (row.dataset.opt === correct)   row.classList.add('correct');
        else if (row.dataset.opt === selected) row.classList.add('wrong');
        row.classList.remove('selected');
      });
      container.querySelector('#detailCorrectAnswer').textContent = correct;
      container.querySelector('#detailExplanation').textContent   = question.explanation || '';
      answerWrap.classList.remove('d-none');
      btnReveal.style.display = 'none';
      if (showNext && btnNext) btnNext.classList.remove('d-none');
    });

    // Câu tiếp theo
    if (btnNext) {
      btnNext.addEventListener('click', async () => {
        const next = await getRandomFiltered();
        if (next) { await _set(PENDING_KEY, next); mountDetail(container, next, onClose, true, true); }
      });
    }

    container.querySelector('#btnCloseDetail')?.addEventListener('click', onClose);
  };

  // ── Manager UI ─────────────────────────────────────────────────
  const _initManager = () => {
    const $ = (id) => document.getElementById(id);

    const listEl        = $('questionList');
    const searchInput   = $('searchInput');
    const emptyState    = $('emptyState');
    const questionCount = $('questionCount');
    const overlay       = $('modalOverlay');
    const modalCont     = $('modalContainer');
    const settingsOver  = $('settingsOverlay');
    const partFilter    = $('partFilter');
    const yearFilter    = $('yearFilter');
    const sentinel      = $('lazysentinel');

    let _all = [], _filtered = [], _rendered = 0;
    let _parts = new Set(), _years = new Set();
    let _observer = null;

    // Lazy load
    const _renderMore = () => {
      const to = Math.min(_rendered + PAGE_SIZE, _filtered.length);
      if (_rendered >= _filtered.length) return;
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
      sentinel.style.display = 'block';
      _renderMore();
      emptyState.classList.toggle('d-none', _filtered.length > 0);
      if (!_filtered.length) sentinel.style.display = 'none';
    };

    // Filters
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
      // Build year chips
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

    // Modal
    const openDetail = (q) => {
      overlay.classList.add('active');
      mountDetail(modalCont, q, () => {
        overlay.classList.remove('active');
        modalCont.innerHTML = '';
      }, false);
    };

    listEl.addEventListener('click', (e) => {
      const row = e.target.closest('.question-row');
      if (row && _filtered[+row.dataset.idx]) openDetail(_filtered[+row.dataset.idx]);
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { overlay.classList.remove('active'); modalCont.innerHTML = ''; }
    });

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

    // Đồng bộ
    $('btnSync').addEventListener('click', async () => {
      if (!confirm('Ghi đè dữ liệu local bằng dữ liệu từ Google Sheet?')) return;
      try {
        await pullFromServer();
        _parts.clear(); _years.clear();
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('chip--active'));
        await loadData();
      } catch (err) { alert('Lỗi đồng bộ: ' + err.message); }
    });

    // Ôn tập ngẫu nhiên — mở popup thủ công
    $('btnRandom').addEventListener('click', () => {
      if (!_all.length) { alert('Chưa có dữ liệu. Hãy đồng bộ trước!'); return; }
      chrome.runtime.sendMessage({ action: 'showToeicPopup' });
    });

    // Settings
    const _fmtSec = (s) => s >= 60 ? `${Math.floor(s/60)}p${s%60 ? ` ${s%60}s` : ''}` : `${s}s`;

    const _syncSliderState = (enabled) => {
      const area = $('popupSettingsArea');
      if (!area) return;
      area.style.opacity = enabled ? '1' : '0.4';
      area.style.pointerEvents = enabled ? '' : 'none';
      area.querySelectorAll('input[type="range"]').forEach(el => el.disabled = !enabled);
    };

    const _updateBadges = () => {
      const [ic, im, ix] = ['toeicAutoCloseSec','toeicTimerMinSec','toeicTimerMaxSec'].map($);
      const bd = $('toeicAutoCloseDisplay'), br = $('toeicTimerRangeDisplay');
      if (bd && ic) bd.textContent = _fmtSec(+ic.value);
      if (br && im && ix) br.textContent = `${_fmtSec(+im.value)} – ${_fmtSec(+ix.value)}`;
    };

    $('btnSettings').addEventListener('click', () => {
      chrome.storage.local.get([SETTINGS_KEY, TIMER_KEY, PARTS_KEY], (data) => {
        const s  = data[SETTINGS_KEY] || {};
        const tv = { ...TIMER_DEFAULTS, ...(data[TIMER_KEY] || {}) };
        const chk = $('toeicEnableAutoPopup');
        const enabled = s.toeicEnableAutoPopup ?? false;
        if (chk) chk.checked = enabled;
        [$('toeicAutoCloseSec'), $('toeicTimerMinSec'), $('toeicTimerMaxSec')]
          .forEach((el, i) => { if (el) el.value = [tv.autoCloseSec, tv.timerMinSec, tv.timerMaxSec][i]; });
        _updateBadges();
        _syncSliderState(enabled);
        const saved = Array.isArray(data[PARTS_KEY]) ? data[PARTS_KEY] : [];
        document.querySelectorAll('#settingsPartFilter .chip').forEach(c => {
          c.classList.toggle('chip--active', saved.includes(c.dataset.part));
        });
      });
      settingsOver.classList.add('active');
    });

    $('btnCloseSettings').addEventListener('click', () => settingsOver.classList.remove('active'));
    settingsOver.addEventListener('click', (e) => { if (e.target === settingsOver) settingsOver.classList.remove('active'); });

    let saveTimer;
    const saveSettings = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const chk = $('toeicEnableAutoPopup');
        const [ic, im, ix] = ['toeicAutoCloseSec','toeicTimerMinSec','toeicTimerMaxSec'].map($);
        const autoCloseSec = parseInt(ic?.value) || TIMER_DEFAULTS.autoCloseSec;
        const timerMinSec  = Math.max(10, parseInt(im?.value) || TIMER_DEFAULTS.timerMinSec);
        const timerMaxSec  = Math.max(timerMinSec, parseInt(ix?.value) || TIMER_DEFAULTS.timerMaxSec);
        const selParts     = [...document.querySelectorAll('#settingsPartFilter .chip--active')]
                               .map(c => c.dataset.part).filter(Boolean);
        chrome.storage.local.get([SETTINGS_KEY], (data) => {
          chrome.storage.local.set({
            [SETTINGS_KEY]: { ...(data[SETTINGS_KEY] || {}), toeicEnableAutoPopup: chk?.checked ?? false },
            [TIMER_KEY]: { autoCloseSec, timerMinSec, timerMaxSec },
            [PARTS_KEY]: selParts,
          }, () => {
            const st = $('settingsStatus');
            if (st) { st.textContent = '✓ Đã lưu'; st.style.opacity = '1'; setTimeout(() => st.style.opacity = '0', 1800); }
            chrome.runtime.sendMessage({ action: 'toeicTimerUpdated', enabled: chk?.checked ?? false });
          });
        });
      }, 500);
    };

    const chkEl = $('toeicEnableAutoPopup');
    chkEl?.addEventListener('change', () => { _syncSliderState(chkEl.checked); saveSettings(); });
    $('settingsPartFilter')?.addEventListener('click', (e) => {
      const c = e.target.closest('.chip');
      if (c) { c.classList.toggle('chip--active'); saveSettings(); }
    });
    ['toeicAutoCloseSec','toeicTimerMinSec','toeicTimerMaxSec'].forEach(id => {
      $(id)?.addEventListener('input', () => { _updateBadges(); saveSettings(); });
    });

    loadData();
  };

  // ── Khởi động ──────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const mode   = params.get('mode');
    const source = params.get('source');

    if (mode === 'popup') {
      document.getElementById('sectionManager').style.display = 'none';
      document.body.classList.add('popup-mode');

      const card = Object.assign(document.createElement('div'), { className: 'modal-card' });
      document.body.appendChild(card);

      const q = await _get(PENDING_KEY);
      if (q) {
        mountDetail(card, q, () => window.close(), true, source === 'manual');
        if (source !== 'manual') {
          const tv = await _get(TIMER_KEY).then(r => ({ ...TIMER_DEFAULTS, ...(r || {}) }));
          let t = tv.autoCloseSec;
          const timer = setInterval(() => { if (--t <= 0) { clearInterval(timer); window.close(); } }, 1000);
        }
      } else {
        card.innerHTML = '<div style="padding:40px;text-align:center;color:#666">Không có câu hỏi nào.</div>';
      }
    } else {
      _initManager();
    }
  });

  return { getAll, getRandom, pullFromServer };
})();