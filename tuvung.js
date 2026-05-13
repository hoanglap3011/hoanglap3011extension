import { LoadingModule } from './LoadingModule.js';
import { StorageModule } from './StorageModule.js';

export const TuVungModule = (() => {

  const STORAGE_KEY  = 'tuvung_list';
  const PENDING_KEY  = 'tuvung_pending';
  const ALARM_NAME   = 'tuvung_random_popup';

  const _TV_TIMER_KEY      = 'tvTimerSettings';
  const _TV_TIMER_DEFAULTS = { autoCloseMs: 10, timerMinSec: 30, timerMaxSec: 60 };

  const _storageGet = (key) => new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get([key], (r) => resolve(r[key] ?? null));
    } else resolve(JSON.parse(localStorage.getItem(key)));
  });

  const _storageSet = (key, value) => new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ [key]: value }, resolve);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
      resolve();
    }
  });

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
        if (typeof PasswordUtil !== 'undefined') PasswordUtil.openPasswordPopup();
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
        }).catch(err => console.warn('[TuVung] Lỗi xóa ngầm:', err));
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

  const mountDisplay = (container, entry, onClose, autoCloseMs = 0, enableEscClose = false) => {
    const tpl = document.getElementById('tpl-display');
    container.innerHTML = '';
    container.appendChild(tpl.content.cloneNode(true));

    if (!entry) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:#a8b4c4">Không tìm thấy từ vựng.</div>';
      return;
    }

    const $ = selector => container.querySelector(selector);

    $('.display-word').textContent = entry.word;
    $('.display-meaning').textContent = entry.meaning;
    if (entry.ipa) {
      const ipaText = entry.ipa.startsWith('/') ? entry.ipa : `/${entry.ipa}/`;
      $('.display-ipa').textContent = ipaText;
    }
    if (entry.partOfSpeech) {
      const posEl = $('.display-pos');
      if (posEl) { posEl.textContent = entry.partOfSpeech; posEl.classList.remove('d-none'); }
    }

    const btnToggleMeaning = $('.btn-toggle-meaning');
    const displayMeaningEl = $('.display-meaning');
    if (btnToggleMeaning && displayMeaningEl) {
      btnToggleMeaning.addEventListener('click', () => {

        displayMeaningEl.classList.toggle('d-none');

        btnToggleMeaning.classList.toggle('active');
      });
    }

    const playAudio = (word, onEndCallback = null) => {
      if (!('speechSynthesis' in window)) {
        if (onEndCallback) onEndCallback();
        else alert("Trình duyệt không hỗ trợ đọc giọng nói.");
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;

      if (onEndCallback) {
        let hasCalled = false;
        const finish = () => {
            if (!hasCalled) { hasCalled = true; onEndCallback(); }
        };
        utterance.onend = finish;
        utterance.onerror = finish;

        setTimeout(finish, 3000);
      }

      window.speechSynthesis.speak(utterance);
    };

    const btnPlay = $('.btn-play-audio');
    if (btnPlay) {
      btnPlay.addEventListener('click', () => playAudio(entry.word));
    }

    if (entry.example) {
      const row = $('.display-example-row');
      row.classList.remove('d-none');
      $('.text-example').textContent = entry.example;
      const btnPlayExample = row.querySelector('.btn-play-example');
      if (btnPlayExample) btnPlayExample.addEventListener('click', () => playAudio(entry.example));
    }
    if (entry.imageUrl) { $('.section-image').classList.remove('d-none'); $('.display-example-img').src = entry.imageUrl; }
    if (entry.exampleMeaning) { $('.section-example-meaning').classList.remove('d-none'); $('.text-example-meaning').textContent = entry.exampleMeaning; }
    if (entry.note) { $('.display-note').classList.remove('d-none'); $('.display-note').textContent = entry.note; }

    const btnClose = $('.btn-close-display');
    btnClose.textContent = `${entry.word} — /${entry.ipa}/`;

    btnClose.addEventListener('click', async () => {

      const settings = await _storageGet('LapsExtensionSettings') || {};

      if (settings.tvEnableReadOnClose) {

         const originalText = btnClose.textContent;
         btnClose.textContent = "Đang đọc...";
         btnClose.disabled = true;
         btnClose.style.opacity = '0.7';

         playAudio(entry.word, onClose);
      } else {
         onClose();
      }
    });

    if (enableEscClose) {
      const _onDisplayKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); document.removeEventListener('keydown', _onDisplayKey); onClose(); }
      };
      document.addEventListener('keydown', _onDisplayKey);

      const _origBtnClose = container.querySelector('.btn-close-display');
      if (_origBtnClose) {
        _origBtnClose.addEventListener('click', () => document.removeEventListener('keydown', _onDisplayKey), { once: true });
      }
    }

    if (autoCloseMs > 0) setTimeout(onClose, autoCloseMs);

const resizeWindow = () => {
    const targetH = document.documentElement.scrollHeight + 40;
    if (typeof chrome !== 'undefined' && chrome.windows) {
        chrome.windows.getCurrent((win) => {
            if (win.type === 'popup' || win.type === 'panel') {
                const screenW = window.screen.availWidth || window.screen.width;
                const screenH = window.screen.availHeight || window.screen.height;

                const newTop = Math.max(0, Math.round((screenH - targetH) / 2));

                const winWidth = win.width || 480;
                const positions = [
                    0,
                    Math.round((screenW - winWidth) / 2),
                    screenW - winWidth
                ];

                const randomLeft = positions[Math.floor(Math.random() * positions.length)];

                chrome.windows.update(win.id, {
                    height: targetH,
                    top: newTop,
                    left: randomLeft
                });
            }
        });
    }
};

    const imgs = container.querySelectorAll('img');
    Promise.all(Array.from(imgs).map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })))
      .then(() => setTimeout(resizeWindow, 50));
  };

  const openAddForm = () => chrome.windows.create({ url: chrome.runtime.getURL('tuvung.html?mode=add-form'), type: 'popup', width: 500, height: 680, focused: true });

  let _popupWindowId = null;

  const show = async () => {
    const entry = await getRandom();
    if (!entry) return;
    await _storageSet(PENDING_KEY, entry);

    const _createPopup = () => {
      chrome.windows.create({ url: chrome.runtime.getURL('tuvung.html?mode=popup'), type: 'popup', width: 480, height: 300, focused: true }, (win) => {
        _popupWindowId = win?.id ?? null;
      });
    };

    if (_popupWindowId !== null) {
      chrome.windows.get(_popupWindowId, (win) => {
        if (chrome.runtime.lastError || !win) {

          _popupWindowId = null;
          _createPopup();
        } else {

          chrome.windows.remove(_popupWindowId, () => {
            _popupWindowId = null;
            _createPopup();
          });
        }
      });
    } else {
      _createPopup();
    }
  };

  const startRandomTimer = () => {
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name !== ALARM_NAME) return;
      show();
      _getTvTimerSettings().then(tv => {
        const delay = (Math.random() * (Math.max(tv.timerMinSec, tv.timerMaxSec) - tv.timerMinSec) + tv.timerMinSec) / 60;
        chrome.alarms.create(ALARM_NAME, { delayInMinutes: delay });
      });
    });
    chrome.alarms.get(ALARM_NAME, (ex) => { if (!ex) chrome.alarms.create(ALARM_NAME, { delayInMinutes: 0.5 }); });
  };

  const _shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const mountBrowseDisplay = async (container, overlayEl, onClose) => {
    const list = await getAll();
    const active = list.filter(e => e.isActive !== false);
    if (!active.length) { onClose(); return; }

    const queue = _shuffle(active);
    let cursor = 0;

    overlayEl.innerHTML = `
      <div class="browse-wrapper">
        <button class="browse-nav browse-nav--prev" title="Từ trước (←)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="comp-card" id="browseContainer"></div>
        <button class="browse-nav browse-nav--next" title="Từ tiếp (→)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
      <div class="browse-counter" id="browseCounter"></div>
    `;

    const browseContainer = overlayEl.querySelector('#browseContainer');
    const counterEl       = overlayEl.querySelector('#browseCounter');
    const btnPrev         = overlayEl.querySelector('.browse-nav--prev');
    const btnNext         = overlayEl.querySelector('.browse-nav--next');

    const updateNav = () => {
      btnPrev.disabled = cursor <= 0;
      counterEl.textContent = `${cursor + 1} / ${queue.length}`;
    };

    const renderCurrent = () => {
      updateNav();
      mountDisplay(browseContainer, queue[cursor], doClose, 0);
    };

    const goNext = () => { if (cursor < queue.length - 1) { cursor++; renderCurrent(); } };
    const goPrev = () => { if (cursor > 0) { cursor--; renderCurrent(); } };

    const onKey = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'Escape') { e.preventDefault(); doClose(); }
    };
    document.addEventListener('keydown', onKey);

    const onOverlayClick = (e) => {
      if (!e.target.closest('.browse-wrapper') && !e.target.closest('.browse-counter')) doClose();
    };
    overlayEl.addEventListener('click', onOverlayClick);

    btnPrev.addEventListener('click', goPrev);
    btnNext.addEventListener('click', goNext);

    const doClose = () => {
      document.removeEventListener('keydown', onKey);
      overlayEl.removeEventListener('click', onOverlayClick);

      overlayEl.innerHTML = '<div class="comp-card" id="modalContainer"></div>';
      onClose();
    };

    renderCurrent();
  };

  let _mgrWords = [], _mgrFiltered = [], _delIdx = -1;

  const _initManager = async () => {
    const $ = id => document.getElementById(id);
    const r = {
      list: $('wordList'), count: $('wordCount'), search: $('searchInput'), empty: $('emptyState'),
      overlay: $('modalOverlay'), container: $('modalContainer'), confirmOver: $('confirmOverlay'), msg: $('confirmMsg')
    };

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
            <!-- Tối ưu: Dùng data-id để Event Delegation bắt sự kiện -->
            <button class="btn-icon btn-icon-edit" data-id="${e.id}">✏️</button>
            <button class="btn-icon btn-icon-delete" data-id="${e.id}">🗑️</button>
          </div>
        </div>`).join('');
    };

    const loadData = async () => { _mgrWords = await getAll(); _mgrFiltered = [..._mgrWords]; renderList(); };
    const closeModal = () => { r.overlay.classList.remove('active'); r.container = document.getElementById('modalContainer') || r.container; };
    const openModalForm = (idx) => { r.overlay.classList.add('active'); mountForm(r.container, idx, () => { closeModal(); loadData(); }, closeModal); };
    const closeConfirm = () => { _delIdx = -1; r.confirmOver.classList.remove('active'); };
    const openConfirm = (idx) => { _delIdx = idx; r.msg.textContent = `Xóa từ "${_mgrWords[idx].word}"?`; r.confirmOver.classList.add('active'); };

    await loadData();

    const settingsOverlay  = document.getElementById('settingsOverlay');
    const chkAutoPopup     = document.getElementById('tvEnableAutoPopup');
    const chkReadOnClose   = document.getElementById('tvEnableReadOnClose');
    const inpAutoClose     = document.getElementById('tvAutoCloseMs');
    const inpTimerMin      = document.getElementById('tvTimerMinSec');
    const inpTimerMax      = document.getElementById('tvTimerMaxSec');
    const statusEl2        = document.getElementById('tvSettingsStatus');

    const openSettings = () => {
      chrome.storage.local.get([SETTINGS_KEY, _TV_TIMER_KEY], (data) => {
        const settings = { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };
        const tv       = { ..._TV_TIMER_DEFAULTS, ...(data[_TV_TIMER_KEY] || {}) };
        chkAutoPopup.checked   = settings.tvEnableAutoPopup  ?? true;
        chkReadOnClose.checked = settings.tvEnableReadOnClose ?? false;
        inpAutoClose.value = tv.autoCloseMs;
        inpTimerMin.value  = tv.timerMinSec;
        inpTimerMax.value  = tv.timerMaxSec;
      });
      settingsOverlay.classList.add('active');
    };
    const closeSettings = () => settingsOverlay.classList.remove('active');

    $('btnSettings').addEventListener('click', openSettings);
    $('btnCloseSettings').addEventListener('click', closeSettings);
    settingsOverlay.addEventListener('click', e => { if (e.target === settingsOverlay) closeSettings(); });

    let _settingsDebounce;
    const saveSettingsPanel = () => {
      clearTimeout(_settingsDebounce);
      _settingsDebounce = setTimeout(() => {
        const autoCloseMs = Math.max(3,  Math.min(120,  parseInt(inpAutoClose.value) || _TV_TIMER_DEFAULTS.autoCloseMs));
        const timerMinSec = Math.max(10, Math.min(3600, parseInt(inpTimerMin.value)  || _TV_TIMER_DEFAULTS.timerMinSec));
        const timerMaxSec = Math.max(timerMinSec, Math.min(3600, parseInt(inpTimerMax.value) || _TV_TIMER_DEFAULTS.timerMaxSec));
        inpAutoClose.value = autoCloseMs; inpTimerMin.value = timerMinSec; inpTimerMax.value = timerMaxSec;

        chrome.storage.local.get([SETTINGS_KEY], (data) => {
          const settings = { ...(data[SETTINGS_KEY] || {}), tvEnableAutoPopup: chkAutoPopup.checked, tvEnableReadOnClose: chkReadOnClose.checked };
          chrome.storage.local.set({ [SETTINGS_KEY]: settings, [_TV_TIMER_KEY]: { autoCloseMs, timerMinSec, timerMaxSec } }, () => {
            statusEl2.textContent = '✓ Đã lưu'; statusEl2.style.opacity = '1';
            setTimeout(() => { statusEl2.style.opacity = '0'; }, 1800);
          });
        });
      }, 500);
    };

    [chkAutoPopup, chkReadOnClose].forEach(el => el.addEventListener('change', saveSettingsPanel));
    [inpAutoClose, inpTimerMin, inpTimerMax].forEach(el => el.addEventListener('input', saveSettingsPanel));

    $('btnOpenForm').addEventListener('click', () => openModalForm(-1));
    $('btnDemo').addEventListener('click', async () => { r.overlay.classList.add('active'); await mountBrowseDisplay(r.container, r.overlay, closeModal); });
    $('btnCancelDelete').addEventListener('click', closeConfirm);
    $('btnPullServer').addEventListener('click', async () => { if(confirm('Ghi đè local bằng dữ liệu từ Server?')) { await pullFromServer(); loadData(); }});
    $('btnConfirmDelete').addEventListener('click', async () => { if(_delIdx >= 0) { await remove(_delIdx); closeConfirm(); loadData(); } });

    r.list.addEventListener('click', (e) => {
      const btnEdit = e.target.closest('.btn-icon-edit');
      const btnDel = e.target.closest('.btn-icon-delete');
      if (btnEdit) openModalForm(_mgrWords.findIndex(x => String(x.id) === btnEdit.dataset.id));
      else if (btnDel) openConfirm(_mgrWords.findIndex(x => String(x.id) === btnDel.dataset.id));
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
      const card = e.target.closest('.word-card');
      if (!card) return;

      if (e.target.closest('.btn-icon')) return;

      const btnEdit = card.querySelector('.btn-icon-edit');
      if (!btnEdit) return;
      const idx = _mgrWords.findIndex(x => String(x.id) === btnEdit.dataset.id);
      if (idx < 0) return;
      r.overlay.classList.add('active');
      mountDisplay(r.container, _mgrWords[idx], closeModal, 0, true);
    });
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', async () => {
      const sectionStandalone = document.getElementById('sectionStandalone');
      const sectionManager = document.getElementById('sectionManager');

      if (!sectionStandalone && !sectionManager) return;

      const mode = new URLSearchParams(window.location.search).get('mode');

      if (mode) {
        if (sectionStandalone) sectionStandalone.classList.remove('d-none');

        const container = document.getElementById('standaloneContainer');
        if (container) container.style.maxHeight = 'none';

        const closeWin = () => window.close();

        if (mode === 'add-form') mountForm(container, -1, closeWin, closeWin);
        else if (mode === 'popup') {
            const tv = await _getTvTimerSettings();
            mountDisplay(container, await _storageGet(PENDING_KEY), closeWin, tv.autoCloseMs * 1000);
        }
      } else {
        if (sectionManager) {
          sectionManager.classList.remove('d-none');
          _initManager();
        }
      }
    });
  }

  return { getAll, add, update, remove, getRandom, show, openAddForm, startRandomTimer, pullFromServer };
})();