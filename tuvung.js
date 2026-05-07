import { LoadingModule } from './LoadingModule.js';
import { StorageModule } from './StorageModule.js';

export const TuVungModule = (() => {

  const STORAGE_KEY  = 'tuvung_list';
  const PENDING_KEY  = 'tuvung_pending';
  const ALARM_NAME   = 'tuvung_random_popup';

  const _TV_TIMER_KEY      = 'tvTimerSettings';
  const _TV_TIMER_DEFAULTS = { autoCloseMs: 10, timerMinSec: 30, timerMaxSec: 60 };

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================

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

  // ==========================================
  // API & STORAGE CORE
  // ==========================================

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

  // ==========================================
  // RENDER COMPONENTS
  // ==========================================

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
      imgWrap.classList.toggle('d-none', !src); // Tối ưu DOM
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
      }
    }

    els.imageFile.addEventListener('change', (e) => {
      _selectedFile = e.target.files[0];
      setPreview(_selectedFile ? URL.createObjectURL(_selectedFile) : els.imageUrl.value.trim());
      if (_selectedFile) els.imageUrl.value = '';
    });
    
    els.imageUrl.addEventListener('input', (e) => { if (!_selectedFile) setPreview(e.target.value.trim()); });

    // Phím tắt Cmd+S (macOS) / Ctrl+S → Lưu từ (scoped, tự cleanup khi form đóng)
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
        const entry = {
          word: els.word.value, meaning: els.meaning.value, ipa: els.ipa.value,
          example: els.example.value, exampleMeaning: els.exampleMeaning.value,
          note: els.note.value, imageUrl: els.imageUrl.value.trim(), isActive: els.isActive.checked
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
    if (entry.ipa) $('.display-ipa').textContent = entry.ipa;

// --- BẮT ĐẦU ĐOẠN THAY THẾ ---
    // 1. Tách logic phát âm ra một hàm riêng để dùng chung
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
      
      // Nếu có callback (trường hợp bấm đóng), đợi đọc xong mới gọi
      if (onEndCallback) {
        let hasCalled = false;
        const finish = () => { 
            if (!hasCalled) { hasCalled = true; onEndCallback(); } 
        };
        utterance.onend = finish;
        utterance.onerror = finish;
        // Fallback: nếu API kẹt/lỗi không báo onend, tự động đóng sau 3 giây
        setTimeout(finish, 3000); 
      }
      
      window.speechSynthesis.speak(utterance);
    };

    // 2. Gắn event cho nút Play (hình cái loa)
    const btnPlay = $('.btn-play-audio');
    if (btnPlay) {
      btnPlay.addEventListener('click', () => playAudio(entry.word));
    }    
    
    // Tối ưu DOM
    if (entry.example) { $('.section-example').classList.remove('d-none'); $('.text-example').textContent = entry.example; }
    if (entry.imageUrl) { $('.section-image').classList.remove('d-none'); $('.display-example-img').src = entry.imageUrl; }
    if (entry.exampleMeaning) { $('.section-example-meaning').classList.remove('d-none'); $('.text-example-meaning').textContent = entry.exampleMeaning; }
    if (entry.note) { $('.display-note').classList.remove('d-none'); $('.display-note').textContent = entry.note; }

    // 3. Gắn event cho nút Đóng (btn-close-display)
    const btnClose = $('.btn-close-display');
    btnClose.textContent = `${entry.word} — /${entry.ipa}/ — ${entry.meaning}`;
    
    btnClose.addEventListener('click', async () => {
      // Lấy setting từ storage, key mặc định của Lập's Extension là 'LapsExtensionSettings'
      const settings = await _storageGet('LapsExtensionSettings') || {};
      
      if (settings.tvEnableReadOnClose) {
         // Đổi UI để user biết đang chờ phát âm
         const originalText = btnClose.textContent;
         btnClose.textContent = "🔊 Đang đọc...";
         btnClose.disabled = true; // Chặn spam click
         btnClose.style.opacity = '0.7';
         
         playAudio(entry.word, onClose);
      } else {
         onClose();
      }
    });

    // Esc để đóng popup xem từ đơn (không áp dụng trong browse mode)
    if (enableEscClose) {
      const _onDisplayKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); document.removeEventListener('keydown', _onDisplayKey); onClose(); }
      };
      document.addEventListener('keydown', _onDisplayKey);
      // Cleanup nếu onClose được gọi bằng cách khác (click nút đóng)
      const _origBtnClose = container.querySelector('.btn-close-display');
      if (_origBtnClose) {
        _origBtnClose.addEventListener('click', () => document.removeEventListener('keydown', _onDisplayKey), { once: true });
      }
    }

    // Hàm tự động đóng sẽ không bị ảnh hưởng (gọi thẳng onClose)
    if (autoCloseMs > 0) setTimeout(onClose, autoCloseMs);
    // --- KẾT THÚC ĐOẠN THAY THẾ ---
    
    const resizeWindow = () => {
      const targetH = document.documentElement.scrollHeight + 40; 
      if (typeof chrome !== 'undefined' && chrome.windows) {
        chrome.windows.getCurrent((win) => {
          if (win.type === 'popup' || win.type === 'panel') {
            const screenH = window.screen.availHeight || window.screen.height;
            const newTop = Math.max(0, Math.round((screenH - targetH) / 2));
            chrome.windows.update(win.id, { height: targetH, top: newTop });
          }
        });
      }
    };

    const imgs = container.querySelectorAll('img');
    Promise.all(Array.from(imgs).map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })))
      .then(() => setTimeout(resizeWindow, 50)); 
  };

  // ==========================================
  // WINDOW & BACKGROUND CONTROLLERS
  // ==========================================

  const openAddForm = () => chrome.windows.create({ url: chrome.runtime.getURL('tuvung.html?mode=add-form'), type: 'popup', width: 500, height: 680, focused: true });

  const show = async () => {
    const entry = await getRandom();
    if (!entry) return;
    await _storageSet(PENDING_KEY, entry);
    chrome.windows.create({ url: chrome.runtime.getURL('tuvung.html?mode=popup'), type: 'popup', width: 480, height: 300, focused: true });
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

  // ==========================================
  // BROWSE MODE (Xem từ với nav prev/next)
  // ==========================================

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

    // Shuffle 1 lần, duyệt tuần tự
    const queue = _shuffle(active);
    let cursor = 0;

    // Wrap comp-card trong browse-wrapper để đặt nav buttons bên ngoài
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

    // Keyboard: ←→ để nav, Esc để đóng
    const onKey = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'Escape') { e.preventDefault(); doClose(); }
    };
    document.addEventListener('keydown', onKey);

    // Click overlay (vùng trống ngoài wrapper) → đóng
    const onOverlayClick = (e) => {
      if (!e.target.closest('.browse-wrapper') && !e.target.closest('.browse-counter')) doClose();
    };
    overlayEl.addEventListener('click', onOverlayClick);

    btnPrev.addEventListener('click', goPrev);
    btnNext.addEventListener('click', goNext);

    const doClose = () => {
      document.removeEventListener('keydown', onKey);
      overlayEl.removeEventListener('click', onOverlayClick);
      // Restore overlay về trạng thái ban đầu (chứa comp-card gốc)
      overlayEl.innerHTML = '<div class="comp-card" id="modalContainer"></div>';
      onClose();
    };

    renderCurrent();
  };

  // ==========================================
  // MANAGER PAGE INIT
  // ==========================================
  
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
        r.empty.classList.remove('d-none'); // Tối ưu DOM
        return; 
      }
      r.empty.classList.add('d-none');
      
      r.list.innerHTML = _mgrFiltered.map(e => `
        <div class="word-card">
          <div class="card-word">${_esc(e.word)}</div>
          ${e.ipa ? `<div class="card-ipa">${_esc(e.ipa)}</div>` : ''}
          <div class="card-meaning">${_esc(e.meaning)}</div>
          ${(e.example || e.imageUrl) ? `<div class="card-divider"></div>` : ''}
          ${e.example ? `<div class="card-field"><strong>Câu ví dụ</strong>${_esc(e.example)}</div>` : ''}
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

    $('btnOpenForm').addEventListener('click', () => openModalForm(-1));
    $('btnDemo').addEventListener('click', async () => { r.overlay.classList.add('active'); await mountBrowseDisplay(r.container, r.overlay, closeModal); });
    $('btnCancelDelete').addEventListener('click', closeConfirm);
    $('btnPullServer').addEventListener('click', async () => { if(confirm('Ghi đè local bằng dữ liệu từ Server?')) { await pullFromServer(); loadData(); }});
    $('btnConfirmDelete').addEventListener('click', async () => { if(_delIdx >= 0) { await remove(_delIdx); closeConfirm(); loadData(); } });
    
    // Tối ưu: EVENT DELEGATION cho List - Gắn đúng 1 Listener duy nhất thay vì n Listener
    r.list.addEventListener('click', (e) => {
      const btnEdit = e.target.closest('.btn-icon-edit');
      const btnDel = e.target.closest('.btn-icon-delete');
      if (btnEdit) openModalForm(_mgrWords.findIndex(x => String(x.id) === btnEdit.dataset.id));
      else if (btnDel) openConfirm(_mgrWords.findIndex(x => String(x.id) === btnDel.dataset.id));
    });

    // Tối ưu: DEBOUNCE Search (Độ trễ 250ms)
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

    // Phím tắt Cmd+F (macOS) / Ctrl+F (Windows) → focus ô tìm kiếm
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        r.search.focus();
        r.search.select();
      }
    });

    // Double-click vào word-card → hiện popup xem từ đó
    r.list.addEventListener('dblclick', (e) => {
      const card = e.target.closest('.word-card');
      if (!card) return;
      // Nếu click đúp vào button thì bỏ qua
      if (e.target.closest('.btn-icon')) return;
      // Tìm id của card qua button edit bên trong
      const btnEdit = card.querySelector('.btn-icon-edit');
      if (!btnEdit) return;
      const idx = _mgrWords.findIndex(x => String(x.id) === btnEdit.dataset.id);
      if (idx < 0) return;
      r.overlay.classList.add('active');
      mountDisplay(r.container, _mgrWords[idx], closeModal, 0, true);
    });
  };

  // ==========================================
  // BOOTSTRAP
  // ==========================================
  
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', async () => {
      const sectionStandalone = document.getElementById('sectionStandalone');
      const sectionManager = document.getElementById('sectionManager');

      if (!sectionStandalone && !sectionManager) return; 

      const mode = new URLSearchParams(window.location.search).get('mode');
      
      if (mode) {
        if (sectionStandalone) sectionStandalone.classList.remove('d-none'); // Tối ưu DOM
        
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
          sectionManager.classList.remove('d-none'); // Tối ưu DOM
          _initManager();
        }
      }
    });
  }

  return { getAll, add, update, remove, getRandom, show, openAddForm, startRandomTimer, pullFromServer };
})();