import { LoadingModule } from './LoadingModule.js';
import { StorageModule } from './StorageModule.js';
import { SystemNotifyModule } from './SystemNotifyModule.js';

export const TuVungModule = (() => {

  const STORAGE_KEY  = 'tuvung_list';
  const PENDING_KEY  = 'tuvung_pending';
  const SETTINGS_KEY = 'LapsExtensionSettings';

  const _TV_TIMER_KEY      = 'tvTimerSettings';
  const _TV_TIMER_DEFAULTS = { 
    autoCloseMs: 30,        // giây — thời gian tự đóng popup
    timerMinSec: 300,       // giây — khoảng cách tối thiểu giữa các popup
    timerMaxSec: 600,       // giây — khoảng cách tối đa giữa các popup
  };

  const _isChromeStorage = typeof chrome !== 'undefined' && chrome.storage;
  const IS_EXT = StorageModule.isExtensionEnv();
  const _storageGet = (key) => new Promise((resolve) =>
    _isChromeStorage
      ? chrome.storage.local.get([key], (r) => resolve(r[key] ?? null))
      : resolve(JSON.parse(localStorage.getItem(key)))
  );
  const _storageSet = (key, value) => new Promise((resolve) =>
    _isChromeStorage
      ? chrome.storage.local.set({ [key]: value }, resolve)
      : (localStorage.setItem(key, JSON.stringify(value)), resolve())
  );

  const _getTvTimerSettings = async () => {
    const r = await _storageGet(_TV_TIMER_KEY);
    return { ..._TV_TIMER_DEFAULTS, ...(r || {}) };
  };

  const _normalizeEntry = (raw) => ({
    word: (raw.word || '').trim(),
    meaning: (raw.meaning || '').trim(),
    example: (raw.example || '').trim(),
    exampleMeaning: (raw.exampleMeaning || '').trim(),
    note: (raw.note || '').trim(),
    ipa: (raw.ipa || '').trim(),
    imageUrl: (raw.imageUrl || '').trim(),
    synonyms: (raw.synonyms || '').trim(),
    confusingWords: (raw.confusingWords || '').trim(),
    isActive: raw.isActive !== false,
    partOfSpeech: (raw.partOfSpeech || '').trim(),
  });

  const _fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Không đọc được file'));
    reader.readAsDataURL(file);
  });

  const _esc = (str) => String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const _callApi = (body) => new Promise((resolve, reject) => {
    StorageModule.get([CACHE_PASS], async (result) => {
      const pass = result[CACHE_PASS] || '';
      if (!pass) {
        if (typeof PasswordModule !== 'undefined') PasswordModule.openPasswordPopup();
        return reject(new Error('Chưa có mật khẩu'));
      }
      try {
        const res = await fetch(API, { method: 'POST', body: JSON.stringify({ pass, ...body }) });
        resolve(await res.json());
      } catch (err) {
        reject(err);
      }
    });
  });

  const _syncOneToServer = async (op, entry, imageBase64 = null) => {
    try {
      const body = { action: API_ACTION_TUVUNG_SYNC_ONE, op, entry, ...(imageBase64 && { imageBase64 }) };
      const res = await _callApi(body);
      return res.code === 1 ? res.data : null;
    } catch (err) {
      return null;
    }
  };

  // ==========================================================
  // --- KHO TỪ VỰNG: IndexedDB (mỗi từ là một bản ghi) ---
  // Chạy được cả trong extension lẫn bản web nên không cần
  // nhánh localStorage riêng như trước.
  // ==========================================================
  const DB_NAME = 'tuvung_db';
  const DB_VERSION = 1;
  const STORE = 'words';
  let _dbInstance = null;

  const _openDB = () => new Promise((resolve, reject) => {
    if (_dbInstance) { resolve(_dbInstance); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('order', 'order');          // giữ đúng thứ tự hiển thị cũ
        store.createIndex('activeKey', 'activeKey');  // 1/0 vì IndexedDB không index được boolean
      }
    };
    req.onsuccess = (e) => { _dbInstance = e.target.result; resolve(_dbInstance); };
    req.onerror   = (e) => reject(e.target.error);
  });

  const _tx = async (mode, fn) => {
    const db = await _openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const out = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(out?.result ?? out);
      tx.onerror    = () => reject(tx.error);
    });
  };
  const _req = (request) => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror   = () => reject(request.error);
  });

  // Bản ghi trong DB = entry + 2 trường phụ phục vụ index
  const _toRecord = (entry, order) => ({
    ...entry,
    order: order ?? entry.order ?? 0,
    activeKey: entry.isActive !== false ? 1 : 0,
  });
  // Trả ra ngoài thì bỏ 2 trường phụ đi cho giống dữ liệu cũ
  const _fromRecord = ({ order, activeKey, ...entry }) => entry;

  // Chuyển dữ liệu từ chrome.storage.local sang IndexedDB, chỉ chạy một lần.
  // Key 'tuvung_list' cũ được GIỮ NGUYÊN làm bản sao lưu.
  const _migrateIfNeeded = async () => {
    const db = await _openDB();
    const count = await _req(db.transaction(STORE, 'readonly').objectStore(STORE).count());
    if (count > 0) return;

    const old = (await _storageGet(STORAGE_KEY)) || [];
    if (!old.length) return;
    await _bulkReplace(old);
  };

  // Ghi đè toàn bộ kho (dùng khi kéo dữ liệu từ server, hoặc lúc chuyển đổi lần đầu)
  const _bulkReplace = (list) => _tx('readwrite', (store) => {
    store.clear();
    list.forEach((entry, i) => {
      const id = entry.id ?? (Date.now() + i);
      store.put(_toRecord({ ...entry, id }, i));
    });
  });

  const _ready = (async () => { try { await _migrateIfNeeded(); } catch (_) {} })();

  const getAll = async () => {
    await _ready;
    const db = await _openDB();
    const rows = await _req(db.transaction(STORE, 'readonly').objectStore(STORE).index('order').getAll());
    return rows.map(_fromRecord);
  };

  const add = async (entry, imageFile = null) => {
    await _ready;
    const db = await _openDB();
    // Từ mới lên đầu danh sách: order nhỏ hơn phần tử nhỏ nhất hiện có
    const first = await _req(db.transaction(STORE, 'readonly').objectStore(STORE).index('order').openCursor());
    const minOrder = first ? first.value.order : 0;

    const newEntry = { id: Date.now(), ..._normalizeEntry(entry), createdAt: new Date().toISOString() };
    await _tx('readwrite', (store) => store.put(_toRecord(newEntry, minOrder - 1)));

    const b64 = imageFile ? await _fileToBase64(imageFile) : null;
    const serverData = await _syncOneToServer('add', newEntry, b64);
    if (serverData?.imageUrl) {
      newEntry.imageUrl = serverData.imageUrl;
      await _tx('readwrite', (store) => store.put(_toRecord(newEntry, minOrder - 1)));
    }
    return getAll();
  };

  const update = async (id, entry, imageFile = null) => {
    await _ready;
    const db = await _openDB();
    const current = await _req(db.transaction(STORE, 'readonly').objectStore(STORE).get(id));
    if (!current) return getAll();

    const updated = { ...current, ..._normalizeEntry(entry), id: current.id, updatedAt: new Date().toISOString() };
    await _tx('readwrite', (store) => store.put(_toRecord(updated, current.order)));

    const b64 = imageFile ? await _fileToBase64(imageFile) : null;
    const serverData = await _syncOneToServer('update', _fromRecord(updated), b64);
    if (serverData?.imageUrl) {
      updated.imageUrl = serverData.imageUrl;
      await _tx('readwrite', (store) => store.put(_toRecord(updated, current.order)));
    }
    return getAll();
  };

  const remove = async (id) => {
    await _ready;
    const db = await _openDB();
    const entry = await _req(db.transaction(STORE, 'readonly').objectStore(STORE).get(id));
    await _tx('readwrite', (store) => store.delete(id));

    if (entry) {
      _syncOneToServer('delete', { id: entry.id, imageUrl: entry.imageUrl })
        .then((res) => {
          if (res !== null) {
            SystemNotifyModule.show(
              '✅ Đồng bộ thành công',
              `Đã xóa vĩnh viễn từ "${entry.word}" khỏi server.`,
              'tuvung-delete'
            );
          }
        }).catch(() => {});
    }
    return getAll();
  };

  // Lấy đúng MỘT từ đang bật, không nạp cả kho vào bộ nhớ
  const getRandom = async () => {
    await _ready;
    const db = await _openDB();
    const range = IDBKeyRange.only(1);
    const total = await _req(
      db.transaction(STORE, 'readonly').objectStore(STORE).index('activeKey').count(range)
    );
    if (!total) return null;

    // Transaction tự đóng sau mỗi await, nên phải mở transaction mới cho cursor
    const skip = Math.floor(Math.random() * total);
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE)
        .index('activeKey').openCursor(range);
      let moved = false;
      req.onsuccess = () => {
        const c = req.result;
        if (!c) { resolve(null); return; }
        if (!moved && skip > 0) { moved = true; c.advance(skip); return; }
        resolve(_fromRecord(c.value));
      };
      req.onerror = () => reject(req.error);
    });
  };

  const pullFromServer = () => new Promise((resolve, reject) => {
    StorageModule.get([CACHE_PASS], async (result) => {
      const pass = result[CACHE_PASS] || '';
      if (!pass) return reject(new Error('Chưa có mật khẩu'));

      LoadingModule.show();
      try {
        const res = await fetch(API, { method: 'POST', body: JSON.stringify({ pass, action: API_ACTION_TUVUNG_GET_ALL }) });
        const json = await res.json();
        if (json.code !== 1) throw new Error(json.error);

        await _bulkReplace(json.data || []);
        resolve(json.data || []);
      } catch (err) { reject(err); } finally { LoadingModule.hide(); }
    });
  });

  const mountForm = async (container, editId = null, onComplete, onCancel) => {
    const tpl = document.getElementById('tpl-form');
    container.innerHTML = '';
    container.appendChild(tpl.content.cloneNode(true));

    const form = container.querySelector('form');
    const els = form.elements;
    const imgPreview = container.querySelector('.image-preview');
    const imgWrap = container.querySelector('.image-preview-wrap');
    const statusEl = container.querySelector('.comp-status');
    const btnSubmit = container.querySelector('.btn-submit');

    let _selectedFile = null;

    const setPreview = (src) => {
      imgPreview.src = src || '';
      imgWrap.classList.toggle('d-none', !src);
    };

    if (editId !== null && editId !== undefined) {
      container.querySelector('.comp-title').textContent = 'Sửa từ vựng';
      const e = (await getAll()).find(w => String(w.id) === String(editId));
      if (e) {
        els.word.value = e.word; els.meaning.value = e.meaning;
        els.ipa.value = e.ipa || ''; els.example.value = e.example || '';
        els.exampleMeaning.value = e.exampleMeaning || ''; els.note.value = e.note || '';
        els.synonyms.value = e.synonyms || ''; els.confusingWords.value = e.confusingWords || '';
        els.imageUrl.value = e.imageUrl || ''; els.isActive.checked = e.isActive;
        setPreview(e.imageUrl);

        if (e.partOfSpeech) {
          const radio = form.querySelector(`input[name="partOfSpeech"][value="${e.partOfSpeech}"]`);
          if (radio) radio.checked = true;
        }
      }
    }

    els.imageFile.addEventListener('change', (e) => {
      _selectedFile = e.target.files[0];
      setPreview(_selectedFile ? URL.createObjectURL(_selectedFile) : els.imageUrl.value.trim());
      if (_selectedFile) els.imageUrl.value = '';
    });

    els.imageUrl.addEventListener('input', (e) => { if (!_selectedFile) setPreview(e.target.value.trim()); });

    const _onFormKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (!btnSubmit.disabled) form.requestSubmit();
      }
    };
    document.addEventListener('keydown', _onFormKey);
    const _cleanupFormKey = () => document.removeEventListener('keydown', _onFormKey);
    const _wrappedCancel   = () => { _cleanupFormKey(); onCancel(); };
    const _wrappedComplete = () => { _cleanupFormKey(); onComplete(); };

    container.querySelector('.comp-close').addEventListener('click', _wrappedCancel);
    container.querySelector('.btn-cancel').addEventListener('click', _wrappedCancel);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btnSubmit.disabled = true; btnSubmit.textContent = 'Đang lưu...';
      statusEl.textContent = ''; statusEl.style.color = '';
      LoadingModule.show();

      try {
        const checkedPos = form.querySelector('input[name="partOfSpeech"]:checked');
        const entry = {
          word: els.word.value, meaning: els.meaning.value, ipa: els.ipa.value,
          example: els.example.value, exampleMeaning: els.exampleMeaning.value,
          note: els.note.value, imageUrl: els.imageUrl.value.trim(), isActive: els.isActive.checked,
          synonyms: els.synonyms.value, confusingWords: els.confusingWords.value,
          partOfSpeech: checkedPos ? checkedPos.value : '',
        };

        (editId === null || editId === undefined)
          ? await add(entry, _selectedFile)
          : await update(editId, entry, _selectedFile);

        statusEl.textContent = '✅ Thành công!'; statusEl.style.color = '#5cb85c';
        setTimeout(_wrappedComplete, 800);
      } catch (err) {
        statusEl.textContent = '❌ Lỗi: ' + err.message; statusEl.style.color = '#e74c3c';
        btnSubmit.disabled = false; btnSubmit.textContent = 'Lưu từ';
      } finally { LoadingModule.hide(); }
    });

    els.word.focus();
  };

  const mountDisplay = (container, entry, onClose, autoCloseSec = 0) => {
    const tpl = document.getElementById('tpl-display');
    container.innerHTML = '';
    container.appendChild(tpl.content.cloneNode(true));

    if (!entry) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:#a8b4c4">Không tìm thấy từ vựng.</div>';
      return;
    }

    const $ = sel => container.querySelector(sel);

    // ── Header ──
    $('.display-word-title').textContent = entry.word;
    if (entry.partOfSpeech) {
      const b = $('.display-pos-badge');
      b.textContent = entry.partOfSpeech;
      b.classList.remove('d-none');
    }

    // ── IPA ──
    if (entry.ipa) {
      $('.display-ipa').textContent = entry.ipa.startsWith('/') ? entry.ipa : `/${entry.ipa}/`;
    }

    // ── Audio ──
    const playAudio = (word) => {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(word);
      utt.lang = 'en-US'; utt.rate = 0.9;
      window.speechSynthesis.speak(utt);
    };
    const btnPlay = $('.btn-play-audio');
    if (btnPlay) btnPlay.addEventListener('click', () => playAudio(entry.word));

    // ── Toggle helper: click 1 lần → hiện content, ẩn button luôn ──
    const _bindToggle = (rowSel, contentEl, onReveal) => {
      const row = container.querySelector(rowSel);
      if (!row || !contentEl) return;
      const btn   = row.querySelector('.btn-toggle');
      const label = row.querySelector('.toggle-label');
      if (!btn) return;
      btn.addEventListener('click', () => {
        contentEl.classList.remove('d-none');
        btn.classList.add('d-none');
        if (label) label.classList.add('d-none');
        if (onReveal) onReveal();
      }, { once: true });
    };

    // ── Nghĩa tiếng Việt ──
    if (entry.meaning) {
      $('.display-meaning').textContent = entry.meaning;
      _bindToggle('.display-meaning-row', $('.display-meaning'));
    }

    // ── Câu ví dụ ──
    if (entry.example) {
      const row = $('.display-example-row');
      row.classList.remove('d-none');
      const content = row.querySelector('.display-example-content');
      row.querySelector('.text-example').textContent = entry.example;
      const btnPlayEx = row.querySelector('.btn-play-example');
      if (btnPlayEx) btnPlayEx.addEventListener('click', () => playAudio(entry.example));
      _bindToggle('.display-example-row', content);
    }

    // ── Nghĩa câu ví dụ ──
    if (entry.exampleMeaning) {
      const sec = $('.section-example-meaning');
      sec.classList.remove('d-none');
      const txt = sec.querySelector('.text-example-meaning');
      txt.textContent = entry.exampleMeaning;
      _bindToggle('.section-example-meaning', txt);
    }

    // ── Ảnh: cột phải hiện ngay, toggle dùng _bindToggle như mục khác ──
    if (entry.imageUrl) {
      const colRight = $('.display-col-right');
      colRight.classList.remove('d-none');
      $('.display-example-img').src = entry.imageUrl;
      _bindToggle('.section-image', $('.display-image-wrap'));
    }

    // ── Ghi chú ──
    if (entry.note) {
      const sec = $('.section-note');
      sec.classList.remove('d-none');
      const noteEl = sec.querySelector('.display-note');
      noteEl.textContent = entry.note;
      _bindToggle('.section-note', noteEl);
    }

    // ── Từ gần nghĩa ──
    if (entry.synonyms) {
      const sec = $('.section-synonyms');
      sec.classList.remove('d-none');
      const txt = sec.querySelector('.display-synonyms');
      txt.textContent = entry.synonyms;
      _bindToggle('.section-synonyms', txt);
    }

    // ── Từ dễ nhầm lẫn ──
    if (entry.confusingWords) {
      const sec = $('.section-confusing');
      sec.classList.remove('d-none');
      const txt = sec.querySelector('.display-confusing');
      txt.textContent = entry.confusingWords;
      _bindToggle('.section-confusing', txt);
    }

    // ── Nút X + countdown (chỉ auto popup) ──
    const btnClose    = $('.btn-close-display');
    const countdownEl = $('.display-countdown');

    let _cdInterval = null;
    const _clearCd = () => { if (_cdInterval) { clearInterval(_cdInterval); _cdInterval = null; } };

    if (autoCloseSec > 0) {
      let rem = autoCloseSec;
      countdownEl.textContent = rem;
      countdownEl.classList.remove('d-none');
      _cdInterval = setInterval(() => {
        rem--;
        if (rem <= 0) { _clearCd(); onClose(); }
        else countdownEl.textContent = rem;
      }, 1000);
    }

    btnClose.addEventListener('click', () => { _clearCd(); onClose(); });

  };

  const openAddForm = (prefill = null) => {
    const params = new URLSearchParams({ mode: 'add-form' });
    if (prefill?.word) params.set('word', prefill.word);
    if (prefill?.meaning) params.set('meaning', prefill.meaning);
    const url = `tuvung.html?${params.toString()}`;

    return IS_EXT
      ? chrome.windows.create({ url: chrome.runtime.getURL(url), type: 'popup', width: 500, height: 680, focused: true })
      : (location.href = url);
  };

  let _mgrWords = [], _mgrFiltered = [], _delId = null;

  const _initManager = async () => {
    const $ = id => document.getElementById(id);
    const r = {
      list: $('wordList'), count: $('wordCount'), search: $('searchInput'), empty: $('emptyState'),
      overlay: $('modalOverlay'), container: $('modalContainer'), confirmOver: $('confirmOverlay'), msg: $('confirmMsg')
    };

    // Web thường: không có chrome.alarms / cửa sổ background → ẩn khối "Popup tự động".
    if (!IS_EXT) {
      document.getElementById('tvEnableAutoPopup')?.closest('.form-group')?.classList.add('d-none');
    }

    const renderList = () => {
      r.count.textContent = `${_mgrWords.length} từ`;
      if (!_mgrFiltered.length) {
        r.list.innerHTML = '';
        r.empty.classList.remove('d-none');
        return;
      }
      r.empty.classList.add('d-none');

      r.list.innerHTML = _mgrFiltered.map(e => `
        <div class="word-card">
          <div class="card-word">${_esc(e.word)}</div>
          ${e.ipa ? `<div class="card-ipa">${_esc(e.ipa)}</div>` : ''}
          ${(e.example || e.imageUrl) ? `<div class="card-divider"></div>` : ''}
          ${e.example ? `<div class="card-field">${_esc(e.example)}</div>` : ''}
          ${e.imageUrl ? `<img class="card-example-img" src="${_esc(e.imageUrl)}" loading="lazy" />` : ''}
          <div class="card-actions">
            <button class="btn-icon btn-icon-edit" data-id="${e.id}">✏️</button>
            <button class="btn-icon btn-icon-delete" data-id="${e.id}">🗑️</button>
          </div>
        </div>`).join('');
    };

    const loadData = async () => { _mgrWords = await getAll(); _mgrFiltered = [..._mgrWords]; renderList(); };
    const closeModal = () => r.overlay.classList.remove('active');
    const _byId = (id) => _mgrWords.find(w => String(w.id) === String(id));
    const openModalForm = (id) => { r.overlay.classList.add('active'); mountForm(r.container, id, () => { closeModal(); loadData(); }, closeModal); };
    const closeConfirm = () => { _delId = null; r.confirmOver.classList.remove('active'); };
    const openConfirm = (id) => { _delId = id; r.msg.textContent = `Xóa từ "${_byId(id)?.word ?? ''}"?`; r.confirmOver.classList.add('active'); };

    await loadData();

    // ---- Cài đặt ----
    const settingsOverlay = document.getElementById('settingsOverlay');
    const chkAutoPopup    = document.getElementById('tvEnableAutoPopup');
    const inpAutoClose    = document.getElementById('tvAutoCloseSec');
    const inpTimerMin     = document.getElementById('tvTimerMinSec');
    const inpTimerMax     = document.getElementById('tvTimerMaxSec');
    const autoCloseBadge  = document.getElementById('tvAutoCloseDisplay');
    const timerRangeBadge = document.getElementById('tvTimerRangeDisplay');
    const popupArea       = document.getElementById('popupSettingsArea');
    const statusEl2       = document.getElementById('tvSettingsStatus');

    const _fmtSec = (s) => s >= 60 ? `${Math.floor(s/60)}p${s%60?` ${s%60}s`:''}` : `${s} giây`;
    const timerFill = document.getElementById('tvTimerFill');
    const _updateBadges = () => {
      if (autoCloseBadge)  autoCloseBadge.textContent  = _fmtSec(parseInt(inpAutoClose.value));
      if (inpTimerMin && inpTimerMax) {
        let lo = parseInt(inpTimerMin.value), hi = parseInt(inpTimerMax.value);
        if (lo > hi) { inpTimerMin.value = hi; lo = hi; }
        if (timerFill) {
          const MIN = +inpTimerMin.min, MAX = +inpTimerMin.max;
          const left  = ((lo - MIN) / (MAX - MIN)) * 100;
          const right = ((hi - MIN) / (MAX - MIN)) * 100;
          timerFill.style.left  = `${left}%`;
          timerFill.style.width = `${right - left}%`;
        }
        if (timerRangeBadge) timerRangeBadge.textContent = lo === hi ? _fmtSec(lo) : `${_fmtSec(lo)} – ${_fmtSec(hi)}`;
      }
    };

    const _applyPopupAreaState = (on) => {
      if (!popupArea) return;
      popupArea.style.opacity = on ? '1' : '0.5';
      popupArea.style.pointerEvents = on ? 'auto' : 'none';
      popupArea.querySelectorAll('input[type="range"]').forEach(r => r.disabled = !on);
    };

    if (chkAutoPopup) chkAutoPopup.addEventListener('change', (e) => _applyPopupAreaState(e.target.checked));

    const openSettings = () => {
      StorageModule.get([SETTINGS_KEY, _TV_TIMER_KEY], (data) => {
        const settings = { tvEnableAutoPopup: true, ...(data[SETTINGS_KEY] || {}) };
        const tv       = { ..._TV_TIMER_DEFAULTS, ...(data[_TV_TIMER_KEY] || {}) };
        if (chkAutoPopup) chkAutoPopup.checked = settings.tvEnableAutoPopup ?? true;
        if (inpAutoClose) inpAutoClose.value = tv.autoCloseMs;
        if (inpTimerMin)  inpTimerMin.value  = tv.timerMinSec;
        if (inpTimerMax)  inpTimerMax.value  = tv.timerMaxSec;
        _updateBadges();
        _applyPopupAreaState(chkAutoPopup?.checked ?? true);
      });
      settingsOverlay.classList.add('active');
    };

    const closeSettings = () => settingsOverlay.classList.remove('active');
    $('btnSettings').addEventListener('click', openSettings);
    $('btnCloseSettings').addEventListener('click', closeSettings);
    settingsOverlay.addEventListener('click', e => { if (e.target === settingsOverlay) closeSettings(); });

    let _settingsDebounce;
    const saveSettings = () => {
      clearTimeout(_settingsDebounce);
      _settingsDebounce = setTimeout(() => {
        const autoCloseMs = Math.max(10, Math.min(120, parseInt(inpAutoClose.value) || _TV_TIMER_DEFAULTS.autoCloseMs));
        const timerMinSec = Math.max(10, Math.min(1800, parseInt(inpTimerMin.value) || _TV_TIMER_DEFAULTS.timerMinSec));
        const timerMaxSec = Math.max(timerMinSec, Math.min(1800, parseInt(inpTimerMax.value) || _TV_TIMER_DEFAULTS.timerMaxSec));
        if (inpAutoClose) inpAutoClose.value = autoCloseMs;
        if (inpTimerMin)  inpTimerMin.value  = timerMinSec;
        if (inpTimerMax)  inpTimerMax.value  = timerMaxSec;

        StorageModule.get([SETTINGS_KEY], (data) => {
          const settings = { ...(data[SETTINGS_KEY] || {}), tvEnableAutoPopup: chkAutoPopup?.checked ?? true };
          StorageModule.set({ [SETTINGS_KEY]: settings, [_TV_TIMER_KEY]: { autoCloseMs, timerMinSec, timerMaxSec } }, () => {
            if (IS_EXT) chrome.runtime.sendMessage({ action: 'tvTimerUpdated', enabled: chkAutoPopup?.checked ?? true });
            if (statusEl2) { statusEl2.textContent = '✓ Đã lưu'; statusEl2.style.opacity = '1'; setTimeout(() => statusEl2.style.opacity = '0', 1800); }
          });
        });
      }, 500);
    };

    if (chkAutoPopup) chkAutoPopup.addEventListener('change', saveSettings);
    [inpAutoClose, inpTimerMin, inpTimerMax].forEach(el => {
      if (el) el.addEventListener('input', () => { _updateBadges(); saveSettings(); });
    });

    $('btnOpenForm').addEventListener('click', () => openModalForm(null));
    $('btnDemo').addEventListener('click', async () => {
      if (IS_EXT) { chrome.runtime.sendMessage({ action: 'showTuvungPopup' }); return; }
      const entry = await getRandom();
      if (!entry) { alert('Chưa có từ vựng nào (đang bật hiển thị).'); return; }
      await _storageSet(PENDING_KEY, entry);
      location.href = 'tuvung.html?mode=popup&source=manual';
    });
    $('btnCancelDelete').addEventListener('click', closeConfirm);

    const doPull = async () => {
      const dangCo = _mgrWords.length;
      const canhBao = dangCo
        ? `Tải dữ liệu từ Server và GHI ĐÈ toàn bộ ${dangCo} từ đang có trên máy?`
        : 'Tải dữ liệu từ vựng từ Server về máy?';
      if (!confirm(canhBao)) return;

      try {
        const data = await pullFromServer();
        await loadData();
        SystemNotifyModule.show(
          '✅ Đồng bộ từ vựng xong',
          `Đã tải ${(data || []).length} từ từ Server về máy.`,
          'tuvung-sync'
        );
      } catch (err) {
        const msg = err?.message || err;
        alert('Lỗi đồng bộ: ' + msg);
        SystemNotifyModule.show('❌ Đồng bộ từ vựng thất bại', String(msg), 'tuvung-sync');
      }
    };
    $('btnPullServer').addEventListener('click', () => {
      StorageModule.get([CACHE_PASS], (res) => {
        const pass = res?.[CACHE_PASS] || '';
        if (!pass) { PasswordModule.openPasswordPopup(() => doPull()); return; }
        doPull();
      });
    });
    $('btnConfirmDelete').addEventListener('click', async () => { if (_delId !== null) { await remove(_byId(_delId)?.id ?? _delId); closeConfirm(); loadData(); } });

    r.list.addEventListener('click', (e) => {
      const btnEdit = e.target.closest('.btn-icon-edit');
      const btnDel = e.target.closest('.btn-icon-delete');
      if (btnEdit) { openModalForm(_byId(btnEdit.dataset.id)?.id); return; }
      if (btnDel)  { openConfirm(_byId(btnDel.dataset.id)?.id); return; }
      // Web: chạm thẻ để xem chi tiết (extension dùng double-click bên dưới)
      if (!IS_EXT) {
        const card = e.target.closest('.word-card');
        if (!card) return;
        const eb = card.querySelector('.btn-icon-edit');
        const entry = eb ? _byId(eb.dataset.id) : null;
        if (!entry) return;
        _storageSet(PENDING_KEY, entry).then(() => {
          location.href = 'tuvung.html?mode=popup&source=manual';
        });
      }
    });

    let searchTimeout;
    r.search.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const q = e.target.value.trim().toLowerCase();
        _mgrFiltered = q ? _mgrWords.filter(w => w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q)) : [..._mgrWords];
        renderList();
      }, 250);
    });

    r.overlay.addEventListener('click', e => { if(e.target === r.overlay) closeModal(); });
    r.confirmOver.addEventListener('click', e => { if(e.target === r.confirmOver) closeConfirm(); });

    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        r.search.focus();
        r.search.select();
      }
    });

    r.list.addEventListener('dblclick', (e) => {
      if (!IS_EXT) return;  // web đã mở chi tiết bằng click 1 lần ở trên
      const card = e.target.closest('.word-card');
      if (!card) return;
      if (e.target.closest('.btn-icon')) return;
      const btnEdit = card.querySelector('.btn-icon-edit');
      if (!btnEdit) return;
      const entry = _byId(btnEdit.dataset.id);
      if (!entry) return;
      // Lưu entry rồi mở popup window (giống manual popup)
      chrome.storage.local.set({ [PENDING_KEY]: entry }, () => {
        chrome.runtime.sendMessage({ action: 'showTuvungPopupEntry' });
      });
    });
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', async () => {
      const sectionStandalone = document.getElementById('sectionStandalone');
      const sectionManager    = document.getElementById('sectionManager');

      if (!sectionStandalone && !sectionManager) return;

      const params = new URLSearchParams(window.location.search);
      const mode   = params.get('mode');

      if (mode) {
        if (sectionStandalone) sectionStandalone.classList.remove('d-none');
        const closeWin = () => {
          if (IS_EXT) { window.close(); return; }
          if (history.length > 1) history.back();
          else location.href = 'tuvung.html';
        };

        if (mode === 'add-form') {
          const card = Object.assign(document.createElement('div'), { className: 'comp-card' });
          document.getElementById('standaloneContainer').appendChild(card);
          await mountForm(card, null, closeWin, closeWin);

          // Mở từ hub (sau khi dịch) thì điền sẵn từ và nghĩa
          const els = card.querySelector('form')?.elements;
          if (els) {
            if (params.get('word')) els.word.value = params.get('word');
            if (params.get('meaning')) els.meaning.value = params.get('meaning');
          }
        } else if (mode === 'popup') {
          document.body.classList.add('popup-mode');
          document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeWin(); });
          const source = params.get('source');
          const tv = await _getTvTimerSettings();
          const autoSec = (source === 'manual') ? 0 : tv.autoCloseMs;
          mountDisplay(document.getElementById('standaloneContainer'), await _storageGet(PENDING_KEY), closeWin, autoSec);
        }
      } else {
        if (sectionManager) {
          sectionManager.classList.remove('d-none');
          _initManager();
        }
      }
    });
  }

  return { getAll, add, update, remove, getRandom, openAddForm, pullFromServer };
})();