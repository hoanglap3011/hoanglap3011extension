/**
 * TUVUNG.JS — Vocabulary Util
 * ============================
 * File duy nhất cho toàn bộ chức năng từ vựng.
 * Tự detect context khi load (manager page / popup window / background SW).
 *
 * PUBLIC API — gọi từ bất kỳ đâu trong extension:
 *   TuVungUtil.show()              — mở popup từ ngẫu nhiên
 *   TuVungUtil.startRandomTimer()  — khởi động auto-popup (gọi trong background.js)
 *   TuVungUtil.getAll()            — lấy toàn bộ danh sách
 *   TuVungUtil.add(entry)          — thêm từ mới
 *   TuVungUtil.update(index, entry)— cập nhật từ
 *   TuVungUtil.remove(index)       — xóa từ
 *   TuVungUtil.getRandom()         — lấy 1 từ ngẫu nhiên
 */

const TuVungUtil = (() => {

  // ─────────────────────────────────────────────────────────────
  // CONSTANTS
  // ─────────────────────────────────────────────────────────────
  const STORAGE_KEY  = 'tuvung_list';
  const PENDING_KEY  = 'tuvung_pending';
  const ALARM_NAME   = 'tuvung_random_popup';
  const POPUP_WIDTH  = 480;
  const POPUP_HEIGHT = 520;

  // URL của popup window — tuvung.html?mode=popup
  const POPUP_URL = (typeof chrome !== 'undefined' && chrome.runtime?.getURL)
    ? chrome.runtime.getURL('tuvung.html') + '?mode=popup'
    : 'tuvung.html?mode=popup';


  // ─────────────────────────────────────────────────────────────
  // STORAGE HELPERS (private)
  // ─────────────────────────────────────────────────────────────

  function _storageGet(key) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get([key], (r) => resolve(r[key] ?? null));
      } else {
        const raw = localStorage.getItem(key);
        resolve(raw ? JSON.parse(raw) : null);
      }
    });
  }

  function _storageSet(key, value) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ [key]: value }, resolve);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
        resolve();
      }
    });
  }

  function _normalizeEntry(raw) {
    return {
      word:          (raw.word          || '').trim(),
      meaning:       (raw.meaning       || '').trim(),
      example:       (raw.example       || '').trim(),
      exampleMeaning:(raw.exampleMeaning|| '').trim(),
      note:          (raw.note          || '').trim(),
    };
  }


  // ─────────────────────────────────────────────────────────────
  // PUBLIC — STORAGE API
  // ─────────────────────────────────────────────────────────────

  async function getAll() {
    return (await _storageGet(STORAGE_KEY)) || [];
  }

  async function add(entry) {
    const list = await getAll();
    list.unshift({ id: Date.now(), ..._normalizeEntry(entry), createdAt: new Date().toISOString() });
    await _storageSet(STORAGE_KEY, list);
    return list;
  }

  async function update(index, entry) {
    const list = await getAll();
    if (index < 0 || index >= list.length) return list;
    list[index] = { ...list[index], ..._normalizeEntry(entry), updatedAt: new Date().toISOString() };
    await _storageSet(STORAGE_KEY, list);
    return list;
  }

  async function remove(index) {
    const list = await getAll();
    list.splice(index, 1);
    await _storageSet(STORAGE_KEY, list);
    return list;
  }

  async function getRandom() {
    const list = await getAll();
    if (!list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  }


  // ─────────────────────────────────────────────────────────────
  // PUBLIC — POPUP
  // ─────────────────────────────────────────────────────────────

  /**
   * Mở popup hiển thị từ ngẫu nhiên (chrome window riêng biệt).
   * Gọi được từ bất kỳ context nào: hub, manager, background...
   */
  async function show() {
    const entry = await getRandom();

    if (!entry) {
      if (typeof chrome !== 'undefined' && chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icon48.png'),
          title: 'Từ Vựng',
          message: 'Chưa có từ vựng nào. Hãy thêm từ mới nhé!',
        });
      }
      return;
    }

    // Lưu từ tạm để popup window đọc lại
    await _storageSet(PENDING_KEY, entry);

    // Tính vị trí giữa màn hình — an toàn cho cả Service Worker (không có window.screen)
    let left = 480, top = 190;
    try {
      if (typeof chrome !== 'undefined' && chrome.system?.display) {
        const displays = await new Promise(r => chrome.system.display.getInfo(r));
        const primary  = displays.find(d => d.isPrimary) || displays[0];
        if (primary) {
          left = Math.round((primary.workArea.width  - POPUP_WIDTH)  / 2) + primary.workArea.left;
          top  = Math.round((primary.workArea.height - POPUP_HEIGHT) / 2) + primary.workArea.top;
        }
      } else if (typeof window !== 'undefined' && window.screen) {
        left = Math.round((window.screen.width  - POPUP_WIDTH)  / 2);
        top  = Math.round((window.screen.height - POPUP_HEIGHT) / 2);
      }
    } catch (_) { /* dùng fallback */ }

    chrome.windows.create({ url: POPUP_URL, type: 'popup', width: POPUP_WIDTH, height: POPUP_HEIGHT, left, top, focused: true });
  }


  // ─────────────────────────────────────────────────────────────
  // PUBLIC — BACKGROUND TIMER
  // ─────────────────────────────────────────────────────────────

  /**
   * Khởi động auto-popup ngẫu nhiên mỗi 30s–60s.
   * Gọi ở TOP-LEVEL trong background.js (ngoài mọi listener).
   */
  function startRandomTimer() {
    // Listener phải register mỗi lần Service Worker khởi động
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name !== ALARM_NAME) return;
      show();
      _scheduleAlarm(); // lên lịch tiếp ngay sau khi fire
    });

    // Chỉ TẠO alarm nếu chưa tồn tại (tránh reset thời gian khi SW restart)
    chrome.alarms.get(ALARM_NAME, (existing) => {
      if (!existing) _scheduleAlarm();
    });
  }

  function _scheduleAlarm() {
    const delayMin = (Math.random() * 30 + 30) / 60; // 30s–60s tính bằng phút
    chrome.alarms.create(ALARM_NAME, { delayInMinutes: delayMin });
  }


  // ─────────────────────────────────────────────────────────────
  // POPUP WINDOW RENDERER (chạy khi tuvung.html?mode=popup load)
  // ─────────────────────────────────────────────────────────────

  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  async function _renderPopup() {
    const container = document.getElementById('popupContent');
    if (!container) return;

    const entry = await _storageGet(PENDING_KEY);
    if (!entry) {
      container.innerHTML = '<p style="color:#aaa;text-align:center;padding:40px">Không tìm thấy từ vựng.</p>';
      return;
    }

    container.innerHTML = `
      <div class="popup-badge">✦ Từ Vựng Hôm Nay</div>
      <div class="popup-word">${_esc(entry.word)}</div>
      <div class="popup-meaning">${_esc(entry.meaning)}</div>
      ${entry.example ? `
        <div class="popup-section">
          <div class="popup-section-label">Câu ví dụ</div>
          <div class="popup-section-text">${_esc(entry.example)}</div>
        </div>` : ''}
      ${entry.exampleMeaning ? `
        <div class="popup-section">
          <div class="popup-section-label">Nghĩa câu ví dụ</div>
          <div class="popup-section-text">${_esc(entry.exampleMeaning)}</div>
        </div>` : ''}
      ${entry.note ? `<div class="popup-note">${_esc(entry.note)}</div>` : ''}
      <div class="popup-footer">
        <button class="popup-close-btn" id="popupCloseBtn">${_esc(entry.word)} - ${_esc(entry.meaning)}</button>
    </div>
    `;

    // Đảm bảo logic tự động đóng 10 giây và click đóng vẫn hoạt động
    const closePopup = () => window.close();

    document.getElementById('popupCloseBtn').addEventListener('click', closePopup);

    // Logic tự động đóng sau 10 giây mà bạn đã chốt
    setTimeout(closePopup, 10000);

  }


  // ─────────────────────────────────────────────────────────────
  // MANAGER PAGE (chạy khi tuvung.html?mode=manager hoặc mặc định)
  // ─────────────────────────────────────────────────────────────

  let _allWords = [];
  let _filtered = [];
  let _deleteIndex = -1;

  const _$ = (id) => document.getElementById(id);

  function _domRefs() {
    return {
      wordList:       _$('wordList'),
      emptyState:     _$('emptyState'),
      wordCount:      _$('wordCount'),
      searchInput:    _$('searchInput'),
      modalOverlay:   _$('modalOverlay'),
      confirmOverlay: _$('confirmOverlay'),
      modalTitle:     _$('modalTitle'),
      wordForm:       _$('wordForm'),
      editIndex:      _$('editIndex'),
      fieldWord:      _$('fieldWord'),
      fieldMeaning:   _$('fieldMeaning'),
      fieldExample:   _$('fieldExample'),
      fieldExMeaning: _$('fieldExampleMeaning'),
      fieldNote:      _$('fieldNote'),
      confirmMsg:     _$('confirmMsg'),
      btnOpenForm:    _$('btnOpenForm'),
      btnCloseModal:  _$('btnCloseModal'),
      btnCancelForm:  _$('btnCancelForm'),
      btnCancelDel:   _$('btnCancelDelete'),
      btnConfirmDel:  _$('btnConfirmDelete'),
      btnDemo:        _$('btnDemo'),
    };
  }

  async function _initManager() {
    const r = _domRefs();
    _allWords = await getAll();
    _filtered = [..._allWords];
    _renderList(r);

    r.btnOpenForm  .addEventListener('click',  ()    => _openForm(r, -1));
    r.btnCloseModal.addEventListener('click',  ()    => _closeModal(r));
    r.btnCancelForm.addEventListener('click',  ()    => _closeModal(r));
    r.wordForm     .addEventListener('submit', (e)   => _handleSubmit(e, r));
    r.searchInput  .addEventListener('input',  ()    => _handleSearch(r));
    r.btnCancelDel .addEventListener('click',  ()    => _closeConfirm(r));
    r.btnConfirmDel.addEventListener('click',  ()    => _handleDelete(r));
    r.btnDemo      .addEventListener('click',  ()    => show());
    r.modalOverlay .addEventListener('click',  (e)   => { if (e.target === r.modalOverlay)  _closeModal(r);   });
    r.confirmOverlay.addEventListener('click', (e)   => { if (e.target === r.confirmOverlay) _closeConfirm(r); });
  }

  function _renderList(r) {
    r.wordCount.textContent = `${_allWords.length} từ`;

    if (!_filtered.length) {
      r.wordList.innerHTML = '';
      r.emptyState.style.display = 'block';
      return;
    }

    r.emptyState.style.display = 'none';
    r.wordList.innerHTML = _filtered.map((e) => `
      <div class="word-card" data-word-id="${e.id}">
        <div class="card-word">${_esc(e.word)}</div>
        <div class="card-meaning">${_esc(e.meaning)}</div>
        ${e.example ? `<div class="card-divider"></div>
          <div class="card-field"><strong>Câu ví dụ</strong>${_esc(e.example)}</div>` : ''}
        ${e.exampleMeaning ? `
          <div class="card-field"><strong>Nghĩa câu ví dụ</strong>${_esc(e.exampleMeaning)}</div>` : ''}
        ${e.note ? `
          <div class="card-field"><strong>Ghi chú</strong>${_esc(e.note)}</div>` : ''}
        <div class="card-actions">
          <button class="btn-icon btn-icon-edit"   data-action="edit"   data-id="${e.id}" title="Sửa">✏️</button>
          <button class="btn-icon btn-icon-delete" data-action="delete" data-id="${e.id}" title="Xóa">🗑️</button>
        </div>
      </div>`).join('');

    r.wordList.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => _openForm(r, _idxById(Number(btn.dataset.id))));
    });
    r.wordList.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', () => _openConfirm(r, _idxById(Number(btn.dataset.id))));
    });
  }

  function _idxById(id)    { return _allWords.findIndex((e) => e.id === id); }

  function _handleSearch(r) {
    const q = r.searchInput.value.trim().toLowerCase();
    _filtered = q
      ? _allWords.filter((e) =>
          e.word.toLowerCase().includes(q) ||
          e.meaning.toLowerCase().includes(q) ||
          (e.example || '').toLowerCase().includes(q) ||
          (e.note    || '').toLowerCase().includes(q))
      : [..._allWords];
    _renderList(r);
  }

  function _openForm(r, idx) {
    r.editIndex.value = idx;
    if (idx === -1) {
      r.modalTitle.textContent = 'Thêm từ mới';
      r.wordForm.reset();
    } else {
      const e = _allWords[idx];
      r.modalTitle.textContent = 'Sửa từ vựng';
      r.fieldWord.value      = e.word;
      r.fieldMeaning.value   = e.meaning;
      r.fieldExample.value   = e.example       || '';
      r.fieldExMeaning.value = e.exampleMeaning || '';
      r.fieldNote.value      = e.note           || '';
    }
    r.modalOverlay.classList.add('active');
    r.fieldWord.focus();
  }

  function _closeModal(r)   { r.modalOverlay.classList.remove('active');   r.wordForm.reset(); }
  function _closeConfirm(r) { _deleteIndex = -1; r.confirmOverlay.classList.remove('active'); }

  async function _handleSubmit(e, r) {
    e.preventDefault();
    const idx   = Number(r.editIndex.value);
    const entry = { word: r.fieldWord.value, meaning: r.fieldMeaning.value,
                    example: r.fieldExample.value, exampleMeaning: r.fieldExMeaning.value,
                    note: r.fieldNote.value };
    _allWords = idx === -1 ? await add(entry) : await update(idx, entry);
    _filtered = [..._allWords];
    _closeModal(r);
    _renderList(r);
  }

  function _openConfirm(r, idx) {
    _deleteIndex = idx;
    r.confirmMsg.textContent = `Bạn có chắc muốn xóa từ "${_allWords[idx].word}" không?`;
    r.confirmOverlay.classList.add('active');
  }

  async function _handleDelete(r) {
    if (_deleteIndex < 0) return;
    _allWords = await remove(_deleteIndex);
    _filtered = [..._allWords];
    _closeConfirm(r);
    _renderList(r);
  }


  // ─────────────────────────────────────────────────────────────
  // AUTO-INIT — tự detect context khi file được load
  // ─────────────────────────────────────────────────────────────
  //
  // Chỉ chạy khi có DOM (không chạy trong background Service Worker).
  // Service Worker dùng importScripts('tuvung.js') + TuVungUtil.startRandomTimer()
  // ở top-level — không có document nên đoạn này bị bỏ qua hoàn toàn.

// ─────────────────────────────────────────────────────────────
  // AUTO-INIT — Cập nhật phiên bản an toàn
  // ─────────────────────────────────────────────────────────────
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      const mode = new URLSearchParams(window.location.search).get('mode');
      
      const sectionPopup = document.getElementById('sectionPopup');
      const sectionManager = document.getElementById('sectionManager');

      if (mode === 'popup') {
        if (sectionPopup) {
          document.body.className = 'popup-body';
          sectionPopup.style.display = 'flex';
          _renderPopup();
        }
      } else {
        if (sectionManager) {
          document.body.className = 'manager-body';
          sectionManager.style.display = 'block';
          _initManager();
        }
        
      }
    });
  }


  // ─────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────
  return {
    // Storage
    getAll, add, update, remove, getRandom,
    // UI
    show, startRandomTimer,
  };

})();