import { LoadingModule } from './LoadingModule.js';
import { StorageModule } from './StorageModule.js';

export const TuVungModule = (() => {

  const STORAGE_KEY  = 'tuvung_list';
  const PENDING_KEY  = 'tuvung_pending';
  const ALARM_NAME   = 'tuvung_random_popup';

  const _TV_TIMER_KEY      = 'tvTimerSettings';
  const _TV_TIMER_DEFAULTS = { autoCloseMs: 10, timerMinSec: 30, timerMaxSec: 60 };

  async function _getTvTimerSettings() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get([_TV_TIMER_KEY], (r) => resolve({ ..._TV_TIMER_DEFAULTS, ...(r[_TV_TIMER_KEY] || {}) }));
      } else resolve(_TV_TIMER_DEFAULTS);
    });
  }

  // Helpers
  function _storageGet(key) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get([key], (r) => resolve(r[key] ?? null));
      } else resolve(JSON.parse(localStorage.getItem(key)));
    });
  }
  function _storageSet(key, value) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ [key]: value }, resolve);
      } else { localStorage.setItem(key, JSON.stringify(value)); resolve(); }
    });
  }

  function _normalizeEntry(raw) {
    return {
      word: (raw.word || '').trim(), meaning: (raw.meaning || '').trim(),
      example: (raw.example || '').trim(), exampleMeaning: (raw.exampleMeaning || '').trim(),
      note: (raw.note || '').trim(), ipa: (raw.ipa || '').trim(),
      imageUrl: (raw.imageUrl || '').trim(), isActive: raw.isActive !== false,
    };
  }

  function _fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error('Không đọc được file'));
      reader.readAsDataURL(file);
    });
  }

  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // --- API / Storage Core ---
  function _callApi(body) {
    return new Promise((resolve, reject) => {
      StorageModule.get([CACHE_PASS], (result) => {
        const pass = result[CACHE_PASS] || '';
        if (!pass) { PasswordUtil.openPasswordPopup(); return reject(new Error('Chưa có mật khẩu')); }
        fetch(API, { method: 'POST', body: JSON.stringify({ pass, ...body }) })
          .then(res => res.json()).then(resolve).catch(reject);
      });
    });
  }

  async function _syncOneToServer(op, entry, imageBase64 = null) {
    try {
      const body = { action: API_ACTION_TUVUNG_SYNC_ONE, op, entry };
      if (imageBase64) body.imageBase64 = imageBase64;
      const res = await _callApi(body);
      return res.code === 1 ? res.data : null;
    } catch (err) { return null; }
  }

  async function getAll() { return (await _storageGet(STORAGE_KEY)) || []; }
  
  async function add(entry, imageFile = null) {
    const list = await getAll();
    const newEntry = { id: Date.now(), ..._normalizeEntry(entry), createdAt: new Date().toISOString() };
    list.unshift(newEntry);
    await _storageSet(STORAGE_KEY, list);
    const b64 = imageFile ? await _fileToBase64(imageFile) : null;
    const serverData = await _syncOneToServer('add', newEntry, b64);
    if (serverData?.imageUrl) { list[0].imageUrl = serverData.imageUrl; await _storageSet(STORAGE_KEY, list); }
    return list;
  }

  async function update(index, entry, imageFile = null) {
    const list = await getAll();
    if (index < 0 || index >= list.length) return list;
    list[index] = { ...list[index], ..._normalizeEntry(entry), updatedAt: new Date().toISOString() };
    await _storageSet(STORAGE_KEY, list);
    const b64 = imageFile ? await _fileToBase64(imageFile) : null;
    const serverData = await _syncOneToServer('update', list[index], b64);
    if (serverData?.imageUrl) { list[index].imageUrl = serverData.imageUrl; await _storageSet(STORAGE_KEY, list); }
    return list;
  }

  async function remove(index) {
    const list = await getAll();
    const entry = list[index];
    list.splice(index, 1);
    await _storageSet(STORAGE_KEY, list);
    
    if (entry) {
      // Chạy ngầm API xóa (không dùng await)
      _syncOneToServer('delete', { id: entry.id, imageUrl: entry.imageUrl })
        .then((res) => {
          // Khi server trả về kết quả thành công (res !== null)
          if (res !== null && typeof chrome !== 'undefined' && chrome.notifications) {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: chrome.runtime.getURL('image/icon.png'), // Dùng lại icon của tiện ích
              title: 'Đồng bộ thành công',
              message: `Đã xóa vĩnh viễn từ "${entry.word}" khỏi server.`
            });
          }
        })
        .catch((err) => {
          // (Tùy chọn) Báo lỗi nếu server không xóa được
          console.warn('[TuVung] Lỗi xóa ngầm trên server:', err);
        });
    }
    
    return list;
  }

  async function getRandom() {
    const list = await getAll();
    const active = list.filter(e => e.isActive !== false);
    return active.length ? active[Math.floor(Math.random() * active.length)] : null;
  }

  async function pullFromServer() {
    return new Promise((resolve, reject) => {
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
  }

  // --- RENDER COMPONENTS ---

  async function mountForm(container, editIdx = -1, onComplete, onCancel) {
    const tpl = document.getElementById('tpl-form');
    container.innerHTML = '';
    container.appendChild(tpl.content.cloneNode(true));

    const form = container.querySelector('form');
    const title = container.querySelector('.comp-title');
    const inputs = {
      word: form.querySelector('[name="word"]'),
      meaning: form.querySelector('[name="meaning"]'),
      ipa: form.querySelector('[name="ipa"]'),
      example: form.querySelector('[name="example"]'),
      exampleMeaning: form.querySelector('[name="exampleMeaning"]'),
      imageUrl: form.querySelector('[name="imageUrl"]'),
      imageFile: form.querySelector('[name="imageFile"]'),
      note: form.querySelector('[name="note"]'),
      isActive: form.querySelector('[name="isActive"]')
    };
    const imgPreview = container.querySelector('.image-preview');
    const imgWrap = container.querySelector('.image-preview-wrap');
    const statusEl = container.querySelector('.comp-status');
    const btnSubmit = container.querySelector('.btn-submit');

    let _selectedFile = null;
    let _allWords = [];

    const setPreview = (src) => {
      if (src) { imgPreview.src = src; imgWrap.style.display = 'block'; }
      else { imgPreview.src = ''; imgWrap.style.display = 'none'; }
    };

    if (editIdx >= 0) {
      title.textContent = 'Sửa từ vựng';
      _allWords = await getAll();
      const e = _allWords[editIdx];
      if (e) {
        inputs.word.value = e.word; inputs.meaning.value = e.meaning;
        inputs.ipa.value = e.ipa || ''; inputs.example.value = e.example || '';
        inputs.exampleMeaning.value = e.exampleMeaning || ''; inputs.note.value = e.note || '';
        inputs.imageUrl.value = e.imageUrl || ''; inputs.isActive.checked = e.isActive;
        setPreview(e.imageUrl);
      }
    }

    inputs.imageFile.addEventListener('change', (e) => {
      _selectedFile = e.target.files[0];
      if (!_selectedFile) { setPreview(inputs.imageUrl.value.trim()); return; }
      setPreview(URL.createObjectURL(_selectedFile));
      inputs.imageUrl.value = '';
    });
    inputs.imageUrl.addEventListener('input', (e) => { if (!_selectedFile) setPreview(e.target.value.trim()); });

    container.querySelector('.comp-close').addEventListener('click', onCancel);
    container.querySelector('.btn-cancel').addEventListener('click', onCancel);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btnSubmit.disabled = true; btnSubmit.textContent = 'Đang lưu...';
      statusEl.textContent = ''; statusEl.style.color = '';
      LoadingModule.show();
      try {
        const entry = {
          word: inputs.word.value, meaning: inputs.meaning.value, ipa: inputs.ipa.value,
          example: inputs.example.value, exampleMeaning: inputs.exampleMeaning.value,
          note: inputs.note.value, imageUrl: inputs.imageUrl.value.trim(), isActive: inputs.isActive.checked
        };
        editIdx === -1 ? await add(entry, _selectedFile) : await update(editIdx, entry, _selectedFile);
        statusEl.textContent = '✅ Thành công!'; statusEl.style.color = '#5cb85c';
        setTimeout(onComplete, 800);
      } catch (err) {
        statusEl.textContent = '❌ Lỗi: ' + err.message; statusEl.style.color = '#e74c3c';
        btnSubmit.disabled = false; btnSubmit.textContent = 'Lưu từ';
      } finally { LoadingModule.hide(); }
    });

    inputs.word.focus();
  }

  function mountDisplay(container, entry, onClose, autoCloseMs = 0) {
    const tpl = document.getElementById('tpl-display');
    container.innerHTML = '';
    container.appendChild(tpl.content.cloneNode(true));

    if (!entry) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:#a8b4c4">Không tìm thấy từ vựng.</div>';
      return;
    }

    container.querySelector('.display-word').textContent = entry.word;
    container.querySelector('.display-meaning').textContent = entry.meaning;

    const btnPlay = container.querySelector('.btn-play-audio');
    if (btnPlay) {
      btnPlay.addEventListener('click', () => {
        // Kiểm tra xem trình duyệt (hoặc Web View) có hỗ trợ không
        if ('speechSynthesis' in window) {
          // Hủy các giọng đọc đang dang dở (nếu có)
          window.speechSynthesis.cancel(); 
          
          const utterance = new SpeechSynthesisUtterance(entry.word);
          utterance.lang = 'en-US'; // Giọng Anh-Mỹ (Có thể đổi thành 'en-GB' cho Anh-Anh)
          utterance.rate = 0.9;     // Tốc độ đọc (0.9 là hơi chậm lại một xíu cho dễ nghe)
          
          window.speechSynthesis.speak(utterance);
        } else {
          alert("Trình duyệt/Web View của bạn không hỗ trợ đọc giọng nói.");
        }
      });
    }    
    
    if (entry.ipa) container.querySelector('.display-ipa').textContent = entry.ipa;

    if (entry.example) {
      container.querySelector('.section-example').style.display = 'block';
      container.querySelector('.text-example').textContent = entry.example;
    }
    if (entry.imageUrl) {
      container.querySelector('.section-image').style.display = 'block';
      container.querySelector('.display-example-img').src = entry.imageUrl;
    }
    if (entry.exampleMeaning) {
      container.querySelector('.section-example-meaning').style.display = 'block';
      container.querySelector('.text-example-meaning').textContent = entry.exampleMeaning;
    }
    if (entry.note) {
      const noteEl = container.querySelector('.display-note');
      noteEl.style.display = 'block'; noteEl.textContent = entry.note;
    }

    const btnClose = container.querySelector('.btn-close-display');
    btnClose.textContent = `${entry.word} — /${entry.ipa}/ — ${entry.meaning}`;
    btnClose.addEventListener('click', onClose);

    if (autoCloseMs > 0) setTimeout(onClose, autoCloseMs);

    // FIX LỖI CO GIÃN CỬA SỔ
    const resizeWindow = () => {
      // Vì ta đã gỡ bỏ max-height ở hàm khởi tạo, nội dung sẽ bung ra hết cỡ
      // Nên ta có thể dùng lại chính xác logic đo scrollHeight ban đầu của bạn[cite: 3]
      const contentH = document.documentElement.scrollHeight;
      const targetH  = contentH + 40; // Cộng thêm 40px cho thanh tiêu đề browser
      
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

    // Chờ ảnh load xong (nếu có) rồi mới tính toán resize
    const imgs = container.querySelectorAll('img');
    Promise.all(Array.from(imgs).map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })))
      .then(() => setTimeout(resizeWindow, 50)); 
  }

  // --- WINDOW CONTROLLERS ---

  async function openAddForm() {
    chrome.windows.create({ url: chrome.runtime.getURL('tuvung.html?mode=add-form'), type: 'popup', width: 500, height: 680, focused: true });
  }

  async function show() {
    const entry = await getRandom();
    if (!entry) return;
    await _storageSet(PENDING_KEY, entry);
    chrome.windows.create({ url: chrome.runtime.getURL('tuvung.html?mode=popup'), type: 'popup', width: 480, height: 300, focused: true });
  }

  function startRandomTimer() {
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name !== ALARM_NAME) return;
      show();
      _getTvTimerSettings().then(tv => {
        const delay = (Math.random() * (Math.max(tv.timerMinSec, tv.timerMaxSec) - tv.timerMinSec) + tv.timerMinSec) / 60;
        chrome.alarms.create(ALARM_NAME, { delayInMinutes: delay });
      });
    });
    chrome.alarms.get(ALARM_NAME, (ex) => {
      if (!ex) chrome.alarms.create(ALARM_NAME, { delayInMinutes: 0.5 });
    });
  }

  // --- MANAGER PAGE CONTROLLER ---
  let _mgrWords = [], _mgrFiltered = [], _delIdx = -1;

  async function _initManager() {
    const $ = id => document.getElementById(id);
    const r = {
      list: $('wordList'), count: $('wordCount'), search: $('searchInput'), empty: $('emptyState'),
      overlay: $('modalOverlay'), container: $('modalContainer'), confirmOver: $('confirmOverlay'), msg: $('confirmMsg')
    };

    const renderList = () => {
      r.count.textContent = `${_mgrWords.length} từ`;
      if (!_mgrFiltered.length) { r.list.innerHTML = ''; r.empty.style.display = 'block'; return; }
      r.empty.style.display = 'none';
      r.list.innerHTML = _mgrFiltered.map(e => `
        <div class="word-card">
          <div class="card-word">${_esc(e.word)}</div>
          ${e.ipa ? `<div class="card-ipa">${_esc(e.ipa)}</div>` : ''}
          <div class="card-meaning">${_esc(e.meaning)}</div>
          ${(e.example || e.imageUrl) ? `<div class="card-divider"></div>` : ''}
          ${e.example ? `<div class="card-field"><strong>Câu ví dụ</strong>${_esc(e.example)}</div>` : ''}
          ${e.imageUrl ? `<img class="card-example-img" src="${_esc(e.imageUrl)}" loading="lazy" />` : ''}
          <div class="card-actions">
            <button class="btn-icon btn-icon-edit" data-id="${e.id}">✏️</button>
            <button class="btn-icon btn-icon-delete" data-id="${e.id}">🗑️</button>
          </div>
        </div>`).join('');
      
      r.list.querySelectorAll('.btn-icon-edit').forEach(b => b.addEventListener('click', () => openModalForm(_mgrWords.findIndex(x => String(x.id) === b.dataset.id))));
      r.list.querySelectorAll('.btn-icon-delete').forEach(b => b.addEventListener('click', () => openConfirm(_mgrWords.findIndex(x => String(x.id) === b.dataset.id))));
    };

    const loadData = async () => { _mgrWords = await getAll(); _mgrFiltered = [..._mgrWords]; renderList(); };
    await loadData();

    const closeModal = () => r.overlay.classList.remove('active');
    const openModalForm = (idx) => { r.overlay.classList.add('active'); mountForm(r.container, idx, () => { closeModal(); loadData(); }, closeModal); };
    
    $('btnOpenForm').addEventListener('click', () => openModalForm(-1));
    $('btnDemo').addEventListener('click', async () => { r.overlay.classList.add('active'); mountDisplay(r.container, await getRandom(), closeModal, 0); });
    $('btnPullServer').addEventListener('click', async () => { if(confirm('Ghi đè local?')) { await pullFromServer(); loadData(); }});
    r.search.addEventListener('input', (e) => { const q = e.target.value.trim().toLowerCase(); _mgrFiltered = q ? _mgrWords.filter(w => w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q)) : [..._mgrWords]; renderList(); });

    const closeConfirm = () => { _delIdx = -1; r.confirmOver.classList.remove('active'); };
    const openConfirm = (idx) => { _delIdx = idx; r.msg.textContent = `Xóa từ "${_mgrWords[idx].word}"?`; r.confirmOver.classList.add('active'); };
    $('btnCancelDelete').addEventListener('click', closeConfirm);
    $('btnConfirmDelete').addEventListener('click', async () => { if(_delIdx >= 0) { await remove(_delIdx); closeConfirm(); loadData(); } });
    
    r.overlay.addEventListener('click', e => { if(e.target === r.overlay) closeModal(); });
    r.confirmOver.addEventListener('click', e => { if(e.target === r.confirmOver) closeConfirm(); });
  }

  // --- BOOTSTRAP ---
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', async () => {
      
      const sectionStandalone = document.getElementById('sectionStandalone');
      const sectionManager = document.getElementById('sectionManager');

      if (!sectionStandalone && !sectionManager) return; 

      const mode = new URLSearchParams(window.location.search).get('mode');
      if (mode) {
        if (sectionStandalone) {
            sectionStandalone.style.display = 'flex';
        }
        
        const container = document.getElementById('standaloneContainer');
        
        // MẤU CHỐT LÀ ĐÂY: Xoá bỏ giới hạn chiều cao max-height: 90vh
        // Để cho cửa sổ có thể bung chiều cao tự do theo nội dung
        if(container) {
            container.style.maxHeight = 'none';
        }
        
        const closeWin = () => window.close();
        
        if (mode === 'add-form') {
            mountForm(container, -1, closeWin, closeWin);
        } else if (mode === 'popup') {
            const tv = await _getTvTimerSettings();
            mountDisplay(container, await _storageGet(PENDING_KEY), closeWin, tv.autoCloseMs * 1000);
        }
      } else {
        if (sectionManager) {
          sectionManager.style.display = 'block';
          _initManager();
        }
      }
    });
  }

  return { getAll, add, update, remove, getRandom, show, openAddForm, startRandomTimer, pullFromServer };
})();