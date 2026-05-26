import { LoadingModule } from './LoadingModule.js';
import { StorageModule } from './StorageModule.js';

export const TuVungModule = (() => {

  const STORAGE_KEY  = 'tuvung_list';
  const PENDING_KEY  = 'tuvung_pending';
  const ALARM_NAME   = 'tuvung_random_popup';
  const SETTINGS_KEY = 'LapsExtensionSettings'; // Bổ sung key để tránh lỗi ReferenceError

  // Thời gian delay (ms) trước khi đóng popup sau khi reveal tất cả các trường
  const REVEAL_THEN_CLOSE_DELAY_MS = 5000; // 5 giây — dùng khi nhấn nút đóng popup
  const REVEAL_THEN_NEXT_DELAY_MS  = 2000; // 2 giây — dùng khi chuyển từ trong chế độ browse

  const _TV_TIMER_KEY      = 'tvTimerSettings';
  const _TV_TIMER_DEFAULTS = { 
    autoCloseMs: 10, 
    timerMinSec: 30, 
    timerMaxSec: 60,
    tvShowMeaning: false, 
    tvShowExample: false, 
    tvShowExampleMeaning: false, 
    tvShowImage: false, 
    tvShowNote: false 
  };

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

  // Reveal tất cả các trường đang bị ẩn bởi toggle button trong một display container
  const _revealAllFields = (container) => {
    const toggleSelectors = [
      '.btn-toggle-meaning',
      '.btn-toggle-example',
      '.btn-toggle-example-meaning',
      '.btn-toggle-image',
      '.btn-toggle-note',
    ];
    toggleSelectors.forEach(sel => {
      const btn = container.querySelector(sel);
      // Chỉ click nếu button còn hiển thị (chưa được reveal) và chưa ở trạng thái active
      if (btn && !btn.classList.contains('d-none') && !btn.classList.contains('active')) {
        btn.click();
      }
    });
  };

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
    const meaningLabel = btnToggleMeaning ? btnToggleMeaning.nextElementSibling : null;
    if (btnToggleMeaning && displayMeaningEl) {
      btnToggleMeaning.addEventListener('click', () => {
        const hidden = displayMeaningEl.classList.toggle('d-none');
        btnToggleMeaning.classList.toggle('active', !hidden);
        if (meaningLabel && meaningLabel.classList.contains('toggle-label')) {
          meaningLabel.classList.toggle('d-none', !hidden);
        }
        if (!hidden) btnToggleMeaning.classList.add('d-none');
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
      const btnToggleExample = row.querySelector('.btn-toggle-example');
      const textExample = row.querySelector('.text-example');
      const exampleLabel = row.querySelector('.toggle-label');
      if (btnToggleExample) {
        btnToggleExample.addEventListener('click', () => {
          const hidden = textExample.classList.toggle('d-none');
          btnToggleExample.classList.toggle('active', !hidden);
          if (btnPlayExample) btnPlayExample.classList.toggle('d-none', hidden);
          if (exampleLabel) exampleLabel.classList.toggle('d-none', !hidden);
          if (!hidden) btnToggleExample.classList.add('d-none');
        });
      }
      if (btnPlayExample) btnPlayExample.addEventListener('click', () => playAudio(entry.example));
    }
    if (entry.imageUrl) {
      const sectionImage = $('.section-image');
      sectionImage.classList.remove('d-none');
      const imgWrap = sectionImage.querySelector('.image-reveal-wrap');
      const img = sectionImage.querySelector('.display-example-img');
      img.src = entry.imageUrl;
      const btnToggleImage = sectionImage.querySelector('.btn-toggle-image');
      const imageLabel = sectionImage.querySelector('.toggle-label');
      if (btnToggleImage) {
        btnToggleImage.addEventListener('click', () => {
          const hidden = imgWrap.classList.toggle('d-none');
          sectionImage.classList.toggle('img-revealed', !hidden);
          btnToggleImage.classList.toggle('active', !hidden);
          if (imageLabel) imageLabel.classList.toggle('d-none', !hidden);
          if (!hidden) btnToggleImage.classList.add('d-none');
        });
      }
    }
    if (entry.exampleMeaning) {
      const sectionMeaning = $('.section-example-meaning');
      sectionMeaning.classList.remove('d-none');
      const textMeaning = sectionMeaning.querySelector('.text-example-meaning');
      textMeaning.textContent = entry.exampleMeaning;
      const btnToggleExMeaning = sectionMeaning.querySelector('.btn-toggle-example-meaning');
      const exMeaningLabel = sectionMeaning.querySelector('.toggle-label');
      if (btnToggleExMeaning) {
        btnToggleExMeaning.addEventListener('click', () => {
          const hidden = textMeaning.classList.toggle('d-none');
          btnToggleExMeaning.classList.toggle('active', !hidden);
          if (exMeaningLabel) exMeaningLabel.classList.toggle('d-none', !hidden);
          if (!hidden) btnToggleExMeaning.classList.add('d-none');
        });
      }
    }
    if (entry.note) {
      const sectionNote = $('.section-note');
      sectionNote.classList.remove('d-none');
      const noteEl = sectionNote.querySelector('.display-note');
      noteEl.textContent = entry.note;
      const btnToggleNote = sectionNote.querySelector('.btn-toggle-note');
      const noteLabel = sectionNote.querySelector('.toggle-label');
      if (btnToggleNote) {
        btnToggleNote.addEventListener('click', () => {
          const hidden = noteEl.classList.toggle('d-none');
          btnToggleNote.classList.toggle('active', !hidden);
          if (noteLabel) noteLabel.classList.toggle('d-none', !hidden);
          if (!hidden) btnToggleNote.classList.add('d-none');
        });
      }
    }

    const btnClose = $('.btn-close-display');
    btnClose.textContent = `${entry.word} — /${entry.ipa}/`;

    const resizeWindow = () => {
        const targetH = document.documentElement.scrollHeight + 40;
        if (typeof chrome !== 'undefined' && chrome.windows) {
            chrome.windows.getCurrent((win) => {
                if (win.type === 'popup' || win.type === 'panel') {
                    const screenH = window.screen.availHeight || window.screen.height;
                    const newTop  = Math.max(0, Math.round((screenH - targetH) / 2));

                    chrome.windows.update(win.id, {
                        height: targetH,
                        top: newTop,
                        left: win.left ?? 0,
                    });
                }
            });
        }
    };

    btnClose.addEventListener('click', async () => {
      // Disable button ngay để tránh nhấn nhiều lần
      btnClose.disabled = true;
      btnClose.style.opacity = '0.7';

      // Reveal tất cả các trường bị ẩn trước khi đóng
      _revealAllFields(container);

      // Đợi DOM cập nhật xong rồi resize popup để hiển thị hết nội dung, giữ nguyên vị trí left
      setTimeout(resizeWindow, 50);

      const settings = await _storageGet('LapsExtensionSettings') || {};

      if (settings.tvEnableReadOnClose) {
        btnClose.textContent = "Đang đọc...";
        // Đọc audio xong thì delay thêm rồi đóng
        playAudio(entry.word, () => setTimeout(onClose, REVEAL_THEN_CLOSE_DELAY_MS));
      } else {
        btnClose.textContent = "Đóng sau 5 giây...";
        setTimeout(onClose, REVEAL_THEN_CLOSE_DELAY_MS);
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

    const imgs = container.querySelectorAll('img');
    Promise.all(Array.from(imgs).map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })))
      .then(() => setTimeout(resizeWindow, 50));
      
    // ---- Logic hiển thị mặc định theo Settings ----
    _getTvTimerSettings().then(settings => {
      if (settings.tvShowMeaning) {
        const btn = container.querySelector('.btn-toggle-meaning');
        if (btn && !btn.classList.contains('d-none')) btn.click();
      }
      if (settings.tvShowExample) {
        const btn = container.querySelector('.btn-toggle-example');
        if (btn && !btn.classList.contains('d-none')) btn.click();
      }
      if (settings.tvShowExampleMeaning) {
        const btn = container.querySelector('.btn-toggle-example-meaning');
        if (btn && !btn.classList.contains('d-none')) btn.click();
      }
      if (settings.tvShowImage) {
        const btn = container.querySelector('.btn-toggle-image');
        if (btn && !btn.classList.contains('d-none')) btn.click();
      }
      if (settings.tvShowNote) {
        const btn = container.querySelector('.btn-toggle-note');
        if (btn && !btn.classList.contains('d-none')) btn.click();
      }
    });
  };

  const openAddForm = () => chrome.windows.create({ url: chrome.runtime.getURL('tuvung.html?mode=add-form'), type: 'popup', width: 500, height: 680, focused: true });

  let _popupWindowId = null;

  const show = async () => {
    const entry = await getRandom();
    if (!entry) return;
    await _storageSet(PENDING_KEY, entry);

    const _createPopup = () => {
      const winWidth  = 480;
      const winHeight = 300;

      const _doCreate = (left, top) => {
        chrome.windows.create({
          url: chrome.runtime.getURL('tuvung.html?mode=popup'),
          type: 'popup',
          width: winWidth,
          height: winHeight,
          left,
          top,
          focused: true,
        }, (win) => {
          _popupWindowId = win?.id ?? null;
        });
      };

      // chrome.system.display khả dụng trong background service worker
      if (typeof chrome !== 'undefined' && chrome.system?.display) {
        chrome.system.display.getInfo((displays) => {
          const primary = displays.find(d => d.isPrimary) || displays[0];
          const bounds  = primary?.workArea || primary?.bounds || { left: 0, top: 0, width: 1920, height: 1080 };

          const positions = [
            bounds.left,
            bounds.left + Math.round((bounds.width - winWidth) / 2),
            bounds.left + bounds.width - winWidth,
          ];
          const initLeft = positions[Math.floor(Math.random() * positions.length)];
          const initTop  = bounds.top + Math.max(0, Math.round((bounds.height - winHeight) / 2));

          _doCreate(initLeft, initTop);
        });
      } else {
        // Fallback nếu không có chrome.system.display
        _doCreate(0, 0);
      }
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

    let _isTransitioning = false; // Chặn nhấn liên tục trong thời gian delay

    const _doNavigate = (nextCursor) => {
      if (_isTransitioning) return;
      _isTransitioning = true;

      // Disable nav buttons trong thời gian delay
      btnPrev.disabled = true;
      btnNext.disabled = true;

      // Reveal tất cả các trường của từ hiện tại
      _revealAllFields(browseContainer);

      setTimeout(() => {
        cursor = nextCursor;
        _isTransitioning = false;
        renderCurrent();
      }, REVEAL_THEN_NEXT_DELAY_MS);
    };

    const goNext = () => { if (cursor < queue.length - 1) _doNavigate(cursor + 1); };
    const goPrev = () => { if (cursor > 0) _doNavigate(cursor - 1); };

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

    // ---- DOM Màn hình Cài đặt ----
    const settingsOverlay  = document.getElementById('settingsOverlay');
    const chkAutoPopup     = document.getElementById('tvEnableAutoPopup');
    const chkReadOnClose   = document.getElementById('tvEnableReadOnClose');
    const inpAutoClose     = document.getElementById('tvAutoCloseMs');
    const inpTimerMin      = document.getElementById('tvTimerMinSec');
    const inpTimerMax      = document.getElementById('tvTimerMaxSec');
    const statusEl2        = document.getElementById('tvSettingsStatus');

    const autoCloseBadge  = document.getElementById('tvAutoCloseMsDisplay');
    const timerRangeBadge = document.getElementById('tvTimerRangeDisplay');
    
    const randomPopupSettingsArea = document.getElementById('randomPopupSettingsArea');
    const chkShowMeaning = document.getElementById('tvShowMeaning');
    const chkShowExample = document.getElementById('tvShowExample');
    const chkShowExampleMeaning = document.getElementById('tvShowExampleMeaning');
    const chkShowImage = document.getElementById('tvShowImage');
    const chkShowNote = document.getElementById('tvShowNote');

    // Xử lý enable/disable 2 dải trượt khi toggle bật/tắt
    if (chkAutoPopup && randomPopupSettingsArea) {
      chkAutoPopup.addEventListener('change', (e) => {
          const isEnabled = e.target.checked;
          const ranges = randomPopupSettingsArea.querySelectorAll('input[type="range"]');
          ranges.forEach(range => range.disabled = !isEnabled);
          randomPopupSettingsArea.style.opacity = isEnabled ? '1' : '0.5';
          randomPopupSettingsArea.style.pointerEvents = isEnabled ? 'auto' : 'none';
      });
    }

    const _fmtSec = (s) => s >= 60 ? `${Math.floor(s/60)}p${s%60?` ${s%60}s`:''}` : `${s} giây`;
    const _updateBadges = () => {
      if (autoCloseBadge)  autoCloseBadge.textContent  = _fmtSec(parseInt(inpAutoClose.value));
      if (timerRangeBadge) timerRangeBadge.textContent = `${_fmtSec(parseInt(inpTimerMin.value))} – ${_fmtSec(parseInt(inpTimerMax.value))}`;
    };

    const openSettings = () => {
      const DEFAULT_SETTINGS = { tvEnableAutoPopup: true, tvEnableReadOnClose: false };
      chrome.storage.local.get([SETTINGS_KEY, _TV_TIMER_KEY], (data) => {
        const settings = { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };
        const tv       = { ..._TV_TIMER_DEFAULTS, ...(data[_TV_TIMER_KEY] || {}) };
        
        if (chkAutoPopup) chkAutoPopup.checked   = settings.tvEnableAutoPopup  ?? true;
        if (chkReadOnClose) chkReadOnClose.checked = settings.tvEnableReadOnClose ?? false;
        if (inpAutoClose) inpAutoClose.value = tv.autoCloseMs;
        if (inpTimerMin) inpTimerMin.value  = tv.timerMinSec;
        if (inpTimerMax) inpTimerMax.value  = tv.timerMaxSec;

        // Load các cấu hình hiển thị mặc định
        if (chkShowMeaning) chkShowMeaning.checked = tv.tvShowMeaning || false;
        if (chkShowExample) chkShowExample.checked = tv.tvShowExample || false;
        if (chkShowExampleMeaning) chkShowExampleMeaning.checked = tv.tvShowExampleMeaning || false;
        if (chkShowImage) chkShowImage.checked = tv.tvShowImage || false;
        if (chkShowNote) chkShowNote.checked = tv.tvShowNote || false;

        _updateBadges();

        // Kích hoạt sự kiện change để disable/enable UI dựa theo trạng thái
        if (chkAutoPopup) chkAutoPopup.dispatchEvent(new Event('change'));
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
        const autoCloseMs = Math.max(10, Math.min(60,  parseInt(inpAutoClose.value) || _TV_TIMER_DEFAULTS.autoCloseMs));
        const timerMinSec = Math.max(10, Math.min(180, parseInt(inpTimerMin.value)  || _TV_TIMER_DEFAULTS.timerMinSec));
        const timerMaxSec = Math.max(timerMinSec, Math.min(180, parseInt(inpTimerMax.value) || _TV_TIMER_DEFAULTS.timerMaxSec));
        if (inpAutoClose) inpAutoClose.value = autoCloseMs; 
        if (inpTimerMin) inpTimerMin.value = timerMinSec; 
        if (inpTimerMax) inpTimerMax.value = timerMaxSec;

        // Đọc giá trị từ Checkbox cấu hình
        const tvShowMeaning = chkShowMeaning ? chkShowMeaning.checked : false;
        const tvShowExample = chkShowExample ? chkShowExample.checked : false;
        const tvShowExampleMeaning = chkShowExampleMeaning ? chkShowExampleMeaning.checked : false;
        const tvShowImage = chkShowImage ? chkShowImage.checked : false;
        const tvShowNote = chkShowNote ? chkShowNote.checked : false;

        chrome.storage.local.get([SETTINGS_KEY], (data) => {
          const settings = { ...(data[SETTINGS_KEY] || {}), tvEnableAutoPopup: chkAutoPopup?.checked ?? true, tvEnableReadOnClose: chkReadOnClose?.checked ?? false };
          
          chrome.storage.local.set({ 
            [SETTINGS_KEY]: settings, 
            [_TV_TIMER_KEY]: { 
                autoCloseMs, timerMinSec, timerMaxSec,
                tvShowMeaning, tvShowExample, tvShowExampleMeaning, tvShowImage, tvShowNote
            } 
          }, () => {
            if (statusEl2) {
                statusEl2.textContent = '✓ Đã lưu'; statusEl2.style.opacity = '1';
                setTimeout(() => { statusEl2.style.opacity = '0'; }, 1800);
            }
          });
        });
      }, 500);
    };

    [chkAutoPopup, chkReadOnClose, chkShowMeaning, chkShowExample, chkShowExampleMeaning, chkShowImage, chkShowNote].forEach(el => {
        if (el) el.addEventListener('change', saveSettingsPanel);
    });
    [inpAutoClose, inpTimerMin, inpTimerMax].forEach(el => {
        if (el) el.addEventListener('input', () => { _updateBadges(); saveSettingsPanel(); });
    });

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