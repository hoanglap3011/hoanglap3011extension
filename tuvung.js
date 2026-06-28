import { LoadingModule } from './LoadingModule.js';
import { StorageModule } from './StorageModule.js';

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

  const getAll = async () => (await _storageGet(STORAGE_KEY)) || [];

  const add = async (entry, imageFile = null) => {
    const list = await getAll();
    const newEntry = { id: Date.now(), ..._normalizeEntry(entry), createdAt: new Date().toISOString() };
    list.unshift(newEntry);
    await _storageSet(STORAGE_KEY, list);

    const b64 = imageFile ? await _fileToBase64(imageFile) : null;
    const serverData = await _syncOneToServer('add', newEntry, b64);
    if (serverData?.imageUrl) { list[0].imageUrl = serverData.imageUrl; await _storageSet(STORAGE_KEY, list); }
    return list;
  };

  const update = async (index, entry, imageFile = null) => {
    const list = await getAll();
    if (index < 0 || index >= list.length) return list;

    list[index] = { ...list[index], ..._normalizeEntry(entry), updatedAt: new Date().toISOString() };
    await _storageSet(STORAGE_KEY, list);

    const b64 = imageFile ? await _fileToBase64(imageFile) : null;
    const serverData = await _syncOneToServer('update', list[index], b64);
    if (serverData?.imageUrl) { list[index].imageUrl = serverData.imageUrl; await _storageSet(STORAGE_KEY, list); }
    return list;
  };

  const remove = async (index) => {
    const list = await getAll();
    const entry = list.splice(index, 1)[0];
    await _storageSet(STORAGE_KEY, list);

    if (entry) {
      _syncOneToServer('delete', { id: entry.id, imageUrl: entry.imageUrl })
        .then((res) => {
          if (res !== null && typeof chrome !== 'undefined' && chrome.notifications) {
            chrome.notifications.create({
              type: 'basic', iconUrl: chrome.runtime.getURL('image/icon.png'),
              title: 'Đồng bộ thành công', message: `Đã xóa vĩnh viễn từ "${entry.word}" khỏi server.`
            });
          }
        }).catch(() => {});
    }
    return list;
  };

  const getRandom = async () => {
    const list = await getAll();
    const active = list.filter(e => e.isActive !== false);
    return active.length ? active[Math.floor(Math.random() * active.length)] : null;
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

        await _storageSet(STORAGE_KEY, json.data || []);
        resolve(json.data || []);
      } catch (err) { reject(err); } finally { LoadingModule.hide(); }
    });
  });

  const mountForm = async (container, editIdx = -1, onComplete, onCancel) => {
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

    if (editIdx >= 0) {
      container.querySelector('.comp-title').textContent = 'Sửa từ vựng';
      const allWords = await getAll();
      const e = allWords[editIdx];
      if (e) {
        els.word.value = e.word; els.meaning.value = e.meaning;
        els.ipa.value = e.ipa || ''; els.example.value = e.example || '';
        els.exampleMeaning.value = e.exampleMeaning || ''; els.note.value = e.note || '';
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
          partOfSpeech: checkedPos ? checkedPos.value : '',
        };

        editIdx === -1 ? await add(entry, _selectedFile) : await update(editIdx, entry, _selectedFile);

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

  const openAddForm = () => IS_EXT
    ? chrome.windows.create({ url: chrome.runtime.getURL('tuvung.html?mode=add-form'), type: 'popup', width: 500, height: 680, focused: true })
    : (location.href = 'tuvung.html?mode=add-form');

  let _mgrWords = [], _mgrFiltered = [], _delIdx = -1;

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
    const openModalForm = (idx) => { r.overlay.classList.add('active'); mountForm(r.container, idx, () => { closeModal(); loadData(); }, closeModal); };
    const closeConfirm = () => { _delIdx = -1; r.confirmOver.classList.remove('active'); };
    const openConfirm = (idx) => { _delIdx = idx; r.msg.textContent = `Xóa từ "${_mgrWords[idx].word}"?`; r.confirmOver.classList.add('active'); };

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
    const _updateBadges = () => {
      if (autoCloseBadge)  autoCloseBadge.textContent  = _fmtSec(parseInt(inpAutoClose.value));
      if (timerRangeBadge) timerRangeBadge.textContent = `${_fmtSec(parseInt(inpTimerMin.value))} – ${_fmtSec(parseInt(inpTimerMax.value))}`;
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

    $('btnOpenForm').addEventListener('click', () => openModalForm(-1));
    $('btnDemo').addEventListener('click', async () => {
      if (IS_EXT) { chrome.runtime.sendMessage({ action: 'showTuvungPopup' }); return; }
      const entry = await getRandom();
      if (!entry) { alert('Chưa có từ vựng nào (đang bật hiển thị).'); return; }
      await _storageSet(PENDING_KEY, entry);
      location.href = 'tuvung.html?mode=popup&source=manual';
    });
    $('btnCancelDelete').addEventListener('click', closeConfirm);

    const doPull = async () => {
      if (!confirm('Ghi đè local bằng dữ liệu từ Server?')) return;
      try { await pullFromServer(); loadData(); }
      catch (err) { alert('Lỗi đồng bộ: ' + (err?.message || err)); }
    };
    $('btnPullServer').addEventListener('click', () => {
      StorageModule.get([CACHE_PASS], (res) => {
        const pass = res?.[CACHE_PASS] || '';
        if (!pass) { PasswordModule.openPasswordPopup(() => doPull()); return; }
        doPull();
      });
    });
    $('btnConfirmDelete').addEventListener('click', async () => { if(_delIdx >= 0) { await remove(_delIdx); closeConfirm(); loadData(); } });

    r.list.addEventListener('click', (e) => {
      const btnEdit = e.target.closest('.btn-icon-edit');
      const btnDel = e.target.closest('.btn-icon-delete');
      if (btnEdit) { openModalForm(_mgrWords.findIndex(x => String(x.id) === btnEdit.dataset.id)); return; }
      if (btnDel) { openConfirm(_mgrWords.findIndex(x => String(x.id) === btnDel.dataset.id)); return; }
      // Web: chạm thẻ để xem chi tiết (extension dùng double-click bên dưới)
      if (!IS_EXT) {
        const card = e.target.closest('.word-card');
        if (!card) return;
        const eb = card.querySelector('.btn-icon-edit');
        const idx = eb ? _mgrWords.findIndex(x => String(x.id) === eb.dataset.id) : -1;
        if (idx < 0) return;
        _storageSet(PENDING_KEY, _mgrWords[idx]).then(() => {
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
      const idx = _mgrWords.findIndex(x => String(x.id) === btnEdit.dataset.id);
      if (idx < 0) return;
      // Lưu entry rồi mở popup window (giống manual popup)
      chrome.storage.local.set({ [PENDING_KEY]: _mgrWords[idx] }, () => {
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
          mountForm(card, -1, closeWin, closeWin);
        } else if (mode === 'popup') {
          document.body.classList.add('popup-mode');
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