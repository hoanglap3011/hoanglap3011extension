/**
 * TUVUNG.JS
 * =========
 * Gồm 3 phần chính:
 *
 *  1. TuVungStorage  — đọc/ghi từ vựng vào chrome.storage.local
 *  2. TuVungUtil     — tiện ích public, đặc biệt là TuVungUtil.show()
 *                      để hiển thị popup từ bất kỳ ở dạng chrome window riêng biệt.
 *                      Gọi được từ mọi nơi trong extension.
 *  3. TuVungManager  — logic trang quản lý (tuvung.html):
 *                      thêm / sửa / xóa / tìm kiếm từ vựng.
 *
 * Cách dùng nhanh:
 *   - Trang quản lý  : TuVungManager.init()
 *   - Popup từ bất kỳ: TuVungUtil.show()
 *   - Background timer: TuVungUtil.startRandomTimer()   ← gọi trong background.js
 */

/* ============================================================
   1. TUVUNG STORAGE
   ============================================================ */
const TuVungStorage = (() => {
  const STORAGE_KEY = 'tuvung_list';

  /**
   * Lấy toàn bộ danh sách từ vựng.
   * @returns {Promise<Array>}
   */
  async function getAll() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
          resolve(result[STORAGE_KEY] || []);
        });
      } else {
        // Fallback cho môi trường dev (không có chrome API)
        const raw = localStorage.getItem(STORAGE_KEY);
        resolve(raw ? JSON.parse(raw) : []);
      }
    });
  }

  /**
   * Lưu toàn bộ danh sách từ vựng.
   * @param {Array} list
   * @returns {Promise<void>}
   */
  async function saveAll(list) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ [STORAGE_KEY]: list }, resolve);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        resolve();
      }
    });
  }

  /**
   * Thêm một từ mới vào danh sách.
   * @param {Object} entry - { word, meaning, example, exampleMeaning, note }
   * @returns {Promise<Array>} danh sách mới
   */
  async function add(entry) {
    const list = await getAll();
    const newEntry = {
      id: Date.now(),
      word: entry.word.trim(),
      meaning: entry.meaning.trim(),
      example: (entry.example || '').trim(),
      exampleMeaning: (entry.exampleMeaning || '').trim(),
      note: (entry.note || '').trim(),
      createdAt: new Date().toISOString(),
    };
    list.unshift(newEntry); // thêm vào đầu danh sách
    await saveAll(list);
    return list;
  }

  /**
   * Cập nhật một từ theo index trong mảng.
   * @param {number} index
   * @param {Object} entry
   * @returns {Promise<Array>}
   */
  async function update(index, entry) {
    const list = await getAll();
    if (index < 0 || index >= list.length) return list;
    list[index] = {
      ...list[index],
      word: entry.word.trim(),
      meaning: entry.meaning.trim(),
      example: (entry.example || '').trim(),
      exampleMeaning: (entry.exampleMeaning || '').trim(),
      note: (entry.note || '').trim(),
      updatedAt: new Date().toISOString(),
    };
    await saveAll(list);
    return list;
  }

  /**
   * Xóa một từ theo index trong mảng.
   * @param {number} index
   * @returns {Promise<Array>}
   */
  async function remove(index) {
    const list = await getAll();
    list.splice(index, 1);
    await saveAll(list);
    return list;
  }

  /**
   * Lấy một từ ngẫu nhiên từ danh sách.
   * @returns {Promise<Object|null>}
   */
  async function getRandom() {
    const list = await getAll();
    if (list.length === 0) return null;
    const idx = Math.floor(Math.random() * list.length);
    return list[idx];
  }

  return { getAll, saveAll, add, update, remove, getRandom };
})();


/* ============================================================
   2. TUVUNG UTIL  — API public, dùng được ở mọi màn hình
   ============================================================ */
const TuVungUtil = (() => {

  /**
   * POPUP_URL: đường dẫn đến file popup riêng biệt.
   * File này sẽ load tuvung.js và gọi TuVungUtil.renderPopupWindow()
   * Bạn cần tạo file tuvung_popup.html (xem mẫu ở cuối file này).
   */
  const POPUP_URL = chrome?.runtime?.getURL
    ? chrome.runtime.getURL('tuvung_popup.html')
    : 'tuvung_popup.html';

  const POPUP_WIDTH  = 480;
  const POPUP_HEIGHT = 520;

  /**
   * show() — Hiển thị popup từ bất kỳ bằng cách mở chrome window riêng biệt.
   * Gọi được từ bất kỳ màn hình nào trong extension:
   *   TuVungUtil.show()
   *
   * @returns {Promise<void>}
   */
  async function show() {
    const entry = await TuVungStorage.getRandom();

    if (!entry) {
      if (typeof chrome !== 'undefined' && chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icon48.png'),
          title: 'Từ Vựng',
          message: 'Chưa có từ vựng nào. Hãy thêm từ mới nhé!',
        });
      } else {
        alert('Chưa có từ vựng nào. Hãy thêm từ mới nhé!');
      }
      return;
    }

    await _savePendingWord(entry);

    if (typeof chrome !== 'undefined' && chrome.windows) {
      // Tính toán vị trí giữa màn hình an toàn cho cả Service Worker (không có window.screen)
      let left = 480, top = 190;
      try {
        if (chrome.system && chrome.system.display) {
          const displays = await new Promise(r => chrome.system.display.getInfo(r));
          const primary = displays.find(d => d.isPrimary) || displays[0];
          if (primary) {
            left = Math.round((primary.workArea.width  - POPUP_WIDTH)  / 2) + primary.workArea.left;
            top  = Math.round((primary.workArea.height - POPUP_HEIGHT) / 2) + primary.workArea.top;
          }
        } else if (typeof window !== 'undefined' && window.screen) {
          left = Math.round((window.screen.width  - POPUP_WIDTH)  / 2);
          top  = Math.round((window.screen.height - POPUP_HEIGHT) / 2);
        }
      } catch (_) { /* dùng fallback */ }

      chrome.windows.create({
        url:    POPUP_URL,
        type:   'popup',
        width:  POPUP_WIDTH,
        height: POPUP_HEIGHT,
        left,
        top,
        focused: true,
      });
    } else {
      window.open(POPUP_URL, '_blank', `width=${POPUP_WIDTH},height=${POPUP_HEIGHT}`);
    }
  }

  /**
   * renderPopupWindow() — Gọi từ tuvung_popup.html để render nội dung từ.
   * Đọc từ pending trong storage và render ra DOM của popup window.
   *
   * @param {string} containerId - id của phần tử chứa nội dung
   */
  async function renderPopupWindow(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const entry = await _loadPendingWord();
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
        </div>
      ` : ''}

      ${entry.exampleMeaning ? `
        <div class="popup-section">
          <div class="popup-section-label">Nghĩa câu ví dụ</div>
          <div class="popup-section-text">${_esc(entry.exampleMeaning)}</div>
        </div>
      ` : ''}

      ${entry.note ? `<div class="popup-note">${_esc(entry.note)}</div>` : ''}

      <div class="popup-footer">
        <button class="popup-close-btn" id="popupCloseBtn">Đóng ✕</button>
      </div>
    `;

    // Gán event bằng addEventListener để không vi phạm CSP (không dùng onclick inline)
    document.getElementById('popupCloseBtn').addEventListener('click', () => {
      window.close();
    });
  }

  /**
   * startRandomTimer() — Khởi động vòng lặp hiển thị popup ngẫu nhiên.
   * Khoảng thời gian giữa 2 lần hiển thị: 30 giây → 1 phút (ngẫu nhiên).
   *
   * GỌI HÀM NÀY TRONG background.js (Service Worker) của extension.
   * Ví dụ:
   *   // background.js
   *   importScripts('tuvung.js');
   *   TuVungUtil.startRandomTimer();
   *
   * Lưu ý: chrome.alarms phù hợp hơn cho Service Worker (không bị sleep).
   * Hàm này cung cấp cả 2 phiên bản: alarm (ưu tiên) và setTimeout (fallback).
   */
  function startRandomTimer() {
    if (typeof chrome !== 'undefined' && chrome.alarms) {
      _startWithAlarms();
    } else {
      _startWithTimeout();
    }
  }

  // ── Private helpers ──────────────────────────────────────────

  /** Lưu từ pending vào storage để popup window đọc */
  async function _savePendingWord(entry) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ tuvung_pending: entry }, resolve);
      } else {
        sessionStorage.setItem('tuvung_pending', JSON.stringify(entry));
        resolve();
      }
    });
  }

  /** Đọc từ pending từ storage */
  async function _loadPendingWord() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['tuvung_pending'], (result) => {
          resolve(result.tuvung_pending || null);
        });
      } else {
        const raw = sessionStorage.getItem('tuvung_pending');
        resolve(raw ? JSON.parse(raw) : null);
      }
    });
  }

  /**
   * Escape HTML để tránh XSS khi render dữ liệu người dùng nhập
   */
  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Tính thời gian chờ ngẫu nhiên giữa MIN và MAX (ms)
   */
  function _randomDelay(minSec = 30, maxSec = 60) {
    return (Math.random() * (maxSec - minSec) + minSec) * 1000;
  }

  /** Sử dụng chrome.alarms (Service Worker friendly) */
  function _startWithAlarms() {
    const ALARM_NAME = 'tuvung_random_popup';

    // QUAN TRỌNG: Listener phải được register MỖI LẦN Service Worker khởi động.
    // Service Worker có thể bị terminate và restart bất cứ lúc nào — nếu chỉ
    // register trong onInstalled thì các lần restart sau sẽ không có listener,
    // alarm vẫn fire nhưng không ai xử lý.
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name !== ALARM_NAME) return;
      show();
      _scheduleNextAlarm(ALARM_NAME); // Lên lịch lần tiếp theo ngay sau khi fire
    });

    // Chỉ TẠO alarm nếu chưa tồn tại (tránh reset thời gian khi SW restart)
    chrome.alarms.get(ALARM_NAME, (existing) => {
      if (!existing) {
        _scheduleNextAlarm(ALARM_NAME);
      }
    });
  }

  function _scheduleNextAlarm(name) {
    const delayMs  = _randomDelay(30, 60);
    const delayMin = delayMs / 60000; // chrome.alarms dùng phút
    chrome.alarms.create(name, { delayInMinutes: delayMin });
  }

  /** Fallback dùng setTimeout (cho content script hoặc dev) */
  function _startWithTimeout() {
    function schedule() {
      const delay = _randomDelay(30, 60);
      setTimeout(async () => {
        await show();
        schedule(); // lên lịch lần tiếp theo
      }, delay);
    }
    schedule();
  }

  // Public API
  return {
    show,
    renderPopupWindow,
    startRandomTimer,
  };
})();


/* ============================================================
   3. TUVUNG MANAGER  — Trang quản lý tuvung.html
   ============================================================ */
const TuVungManager = (() => {

  let _allWords    = [];   // cache toàn bộ từ
  let _filtered    = [];   // sau khi lọc/tìm kiếm
  let _deleteIndex = -1;   // index từ đang chờ xác nhận xóa

  // ── DOM refs ────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  function _refs() {
    return {
      wordList:       $('wordList'),
      emptyState:     $('emptyState'),
      wordCount:      $('wordCount'),
      searchInput:    $('searchInput'),
      modalOverlay:   $('modalOverlay'),
      confirmOverlay: $('confirmOverlay'),
      modalTitle:     $('modalTitle'),
      wordForm:       $('wordForm'),
      editIndex:      $('editIndex'),
      fieldWord:      $('fieldWord'),
      fieldMeaning:   $('fieldMeaning'),
      fieldExample:   $('fieldExample'),
      fieldExMeaning: $('fieldExampleMeaning'),
      fieldNote:      $('fieldNote'),
      confirmMsg:     $('confirmMsg'),
      btnOpenForm:    $('btnOpenForm'),
      btnCloseModal:  $('btnCloseModal'),
      btnCancelForm:  $('btnCancelForm'),
      btnCancelDel:   $('btnCancelDelete'),
      btnConfirmDel:  $('btnConfirmDelete'),
      btnDemo:        $('btnDemo'),
    };
  }

  // ── Init ────────────────────────────────────────────────────
  async function init() {
    const r = _refs();

    // Load dữ liệu
    _allWords = await TuVungStorage.getAll();
    _filtered = [..._allWords];
    _render(r);

    // Events
    r.btnOpenForm.addEventListener('click', () => _openForm(r, -1));
    r.btnCloseModal.addEventListener('click', () => _closeModal(r));
    r.btnCancelForm.addEventListener('click', () => _closeModal(r));
    r.wordForm.addEventListener('submit', (e) => _handleSubmit(e, r));
    r.searchInput.addEventListener('input', () => _handleSearch(r));
    r.btnCancelDel.addEventListener('click', () => _closeConfirm(r));
    r.btnConfirmDel.addEventListener('click', () => _handleDelete(r));
    r.btnDemo.addEventListener('click', () => TuVungUtil.show());

    // Click overlay đóng modal
    r.modalOverlay.addEventListener('click', (e) => {
      if (e.target === r.modalOverlay) _closeModal(r);
    });
    r.confirmOverlay.addEventListener('click', (e) => {
      if (e.target === r.confirmOverlay) _closeConfirm(r);
    });
  }

  // ── Render ──────────────────────────────────────────────────
  function _render(r) {
    const words = _filtered;

    // Cập nhật bộ đếm (dùng tổng toàn bộ từ, không phải kết quả tìm kiếm)
    r.wordCount.textContent = `${_allWords.length} từ`;

    if (words.length === 0) {
      r.wordList.innerHTML = '';
      r.emptyState.style.display = 'block';
      return;
    }

    r.emptyState.style.display = 'none';

    r.wordList.innerHTML = words.map((entry, idx) => {
      // Lưu ý: idx ở đây là index trong _filtered.
      // Khi sửa/xóa cần tìm lại index thực trong _allWords.
      return `
        <div class="word-card" data-word-id="${entry.id}">
          <div class="card-word">${_esc(entry.word)}</div>
          <div class="card-meaning">${_esc(entry.meaning)}</div>

          ${entry.example ? `
            <div class="card-divider"></div>
            <div class="card-field">
              <strong>Câu ví dụ</strong>
              ${_esc(entry.example)}
            </div>
          ` : ''}

          ${entry.exampleMeaning ? `
            <div class="card-field">
              <strong>Nghĩa câu ví dụ</strong>
              ${_esc(entry.exampleMeaning)}
            </div>
          ` : ''}

          ${entry.note ? `
            <div class="card-field">
              <strong>Ghi chú</strong>
              ${_esc(entry.note)}
            </div>
          ` : ''}

          <div class="card-actions">
            <button class="btn-icon btn-icon-edit" 
                    data-action="edit" data-id="${entry.id}" 
                    title="Sửa">✏️</button>
            <button class="btn-icon btn-icon-delete" 
                    data-action="delete" data-id="${entry.id}" 
                    title="Xóa">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    // Gán event cho các nút edit/delete
    r.wordList.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const realIdx = _getIndexById(Number(btn.dataset.id));
        _openForm(r, realIdx);
      });
    });

    r.wordList.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const realIdx = _getIndexById(Number(btn.dataset.id));
        _openConfirm(r, realIdx);
      });
    });
  }

  // ── Tìm index thực trong _allWords theo id ──────────────────
  function _getIndexById(id) {
    return _allWords.findIndex((e) => e.id === id);
  }

  // ── Search ──────────────────────────────────────────────────
  function _handleSearch(r) {
    const q = r.searchInput.value.trim().toLowerCase();
    if (!q) {
      _filtered = [..._allWords];
    } else {
      _filtered = _allWords.filter((e) =>
        e.word.toLowerCase().includes(q) ||
        e.meaning.toLowerCase().includes(q) ||
        (e.example || '').toLowerCase().includes(q) ||
        (e.note || '').toLowerCase().includes(q)
      );
    }
    _render(r);
  }

  // ── Form ────────────────────────────────────────────────────
  function _openForm(r, idx) {
    r.editIndex.value = idx;
    if (idx === -1) {
      // Thêm mới
      r.modalTitle.textContent = 'Thêm từ mới';
      r.wordForm.reset();
    } else {
      // Sửa
      const entry = _allWords[idx];
      r.modalTitle.textContent = 'Sửa từ vựng';
      r.fieldWord.value        = entry.word;
      r.fieldMeaning.value     = entry.meaning;
      r.fieldExample.value     = entry.example || '';
      r.fieldExMeaning.value   = entry.exampleMeaning || '';
      r.fieldNote.value        = entry.note || '';
    }
    r.modalOverlay.classList.add('active');
    r.fieldWord.focus();
  }

  function _closeModal(r) {
    r.modalOverlay.classList.remove('active');
    r.wordForm.reset();
  }

  async function _handleSubmit(e, r) {
    e.preventDefault();
    const idx = Number(r.editIndex.value);
    const entry = {
      word:          r.fieldWord.value,
      meaning:       r.fieldMeaning.value,
      example:       r.fieldExample.value,
      exampleMeaning: r.fieldExMeaning.value,
      note:          r.fieldNote.value,
    };

    if (idx === -1) {
      _allWords = await TuVungStorage.add(entry);
    } else {
      _allWords = await TuVungStorage.update(idx, entry);
    }

    _filtered = [..._allWords];
    _closeModal(r);
    _render(r);
  }

  // ── Delete ──────────────────────────────────────────────────
  function _openConfirm(r, idx) {
    _deleteIndex = idx;
    const entry = _allWords[idx];
    r.confirmMsg.textContent = `Bạn có chắc muốn xóa từ "${entry.word}" không?`;
    r.confirmOverlay.classList.add('active');
  }

  function _closeConfirm(r) {
    _deleteIndex = -1;
    r.confirmOverlay.classList.remove('active');
  }

  async function _handleDelete(r) {
    if (_deleteIndex < 0) return;
    _allWords = await TuVungStorage.remove(_deleteIndex);
    _filtered = [..._allWords];
    _closeConfirm(r);
    _render(r);
  }

  // ── Escape HTML ─────────────────────────────────────────────
  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return { init };
})();


/* ============================================================
   GHI CHÚ TÍCH HỢP VÀO EXTENSION
   ============================================================

   ① manifest.json  — khai báo các file:
   ─────────────────────────────────────
   {
     "manifest_version": 3,
     "background": { "service_worker": "background.js" },
     "web_accessible_resources": [{
       "resources": ["tuvung_popup.html", "tuvung.css", "tuvung.js"],
       "matches": ["<all_urls>"]
     }],
     "permissions": ["storage", "alarms", "windows", "notifications"]
   }

   ② background.js  — khởi động timer ngẫu nhiên:
   ─────────────────────────────────────────────────
   importScripts('tuvung.js');

   chrome.runtime.onInstalled.addListener(() => {
     TuVungUtil.startRandomTimer();
   });

   // Cần re-register alarm listener mỗi lần SW khởi động lại
   chrome.alarms.onAlarm.addListener((alarm) => {
     // Đã được xử lý bên trong TuVungUtil.startRandomTimer()
   });

   ③ tuvung_popup.html  — cửa sổ popup hiển thị từ:
   ─────────────────────────────────────────────────
   <!DOCTYPE html>
   <html lang="vi">
   <head>
     <meta charset="UTF-8" />
     <link rel="preconnect" href="https://fonts.googleapis.com" />
     <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,500&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
     <link rel="stylesheet" href="tuvung.css" />
   </head>
   <body class="popup-body">
     <div class="popup-card" id="popupContent">
       <div style="color:#aaa;text-align:center;padding:40px">Đang tải…</div>
     </div>
     <script src="tuvung.js"></script>
     <script>
       TuVungUtil.renderPopupWindow('popupContent');
     </script>
   </body>
   </html>

   ④ Gọi từ màn hình khác:
   ─────────────────────────
   // Bất kỳ file JS nào trong extension (popup.js, options.js...)
   TuVungUtil.show();

   ============================================================ */