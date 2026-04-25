import { LoadingModule } from './LoadingModule.js';
import { StorageModule } from './StorageModule.js';

export const TuVungModule = (() => {

  // ─────────────────────────────────────────────────────────────
  // CONSTANTS
  // ─────────────────────────────────────────────────────────────
  const STORAGE_KEY  = 'tuvung_list';
  const PENDING_KEY  = 'tuvung_pending';
  const ALARM_NAME   = 'tuvung_random_popup';
  const POPUP_WIDTH  = 480;
  const POPUP_HEIGHT = 560; // tăng nhẹ để chứa ảnh

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
      ipa:           (raw.ipa           || '').trim(),   // 🆕 Phát âm IPA
      imageUrl:      (raw.imageUrl      || '').trim(),   // 🆕 URL ảnh câu ví dụ
    };
  }


  // ─────────────────────────────────────────────────────────────
  // IMAGE HELPERS (private)
  // ─────────────────────────────────────────────────────────────

  // File ảnh đang được chọn trong form (null nếu chưa chọn / không thay đổi)
  let _selectedImageFile = null;

  /** Đọc File object → base64 thuần (không có prefix data:...) */
  function _fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error('Không đọc được file ảnh'));
      reader.readAsDataURL(file);
    });
  }

  /** Hiển thị preview ảnh trong form (src = objectURL hoặc imageUrl hiện tại) */
  function _updateImagePreview(src) {
    const wrap = document.getElementById('imagePreviewWrap');
    const img  = document.getElementById('imagePreview');
    if (!wrap || !img) return;
    if (src) {
      img.src = src;
      wrap.style.display = 'block';
    } else {
      img.src = '';
      wrap.style.display = 'none';
    }
  }


  // ─────────────────────────────────────────────────────────────
  // SERVER SYNC HELPERS (private)
  // ─────────────────────────────────────────────────────────────

  /**
   * Lấy pass từ storage rồi gọi API — theo đúng pattern của TodolistUtil.
   * Trả về Promise<{ code, data, error }> hoặc throw nếu không có pass.
   */
  function _callApi(body) {
    return new Promise((resolve, reject) => {
      StorageUtil.get([CACHE_PASS], (result) => {
        const pass = result[CACHE_PASS] || '';
        if (!pass) {
          PasswordUtil.openPasswordPopup();
          reject(new Error('Chưa có mật khẩu'));
          return;
        }

        fetch(API, {
          method: 'POST',
          body: JSON.stringify({ pass, ...body }),
        })
          .then((res) => {
            if (!res.ok) throw new Error('Lỗi kết nối server (' + res.status + ')');
            return res.json();
          })
          .then(resolve)
          .catch(reject);
      });
    });
  }

  /**
   * Sync 1 từ lên server.
   * - op = 'add' | 'update': có thể kèm imageBase64 (string base64 thuần) nếu có ảnh mới
   * - op = 'delete': server sẽ tự xóa ảnh trên Drive nếu có imageUrl
   * Trả về Promise để caller có thể await lấy imageUrl từ server.
   */
  async function _syncOneToServer(op, entry, imageBase64 = null) {
    try {
      const body = {
        action: API_ACTION_TUVUNG_SYNC_ONE,
        op,
        entry,
      };
      if (imageBase64) body.imageBase64 = imageBase64;

      const result = await _callApi(body);
      if (result.code !== 1) {
        console.warn('[TuVung] Sync server thất bại:', result.error);
        return null;
      }
      return result.data ?? null; // server trả về { imageUrl } nếu có upload ảnh
    } catch (err) {
      console.warn('[TuVung] Lỗi sync server:', err.message);
      return null;
    }
  }


  // ─────────────────────────────────────────────────────────────
  // PUBLIC — STORAGE API
  // ─────────────────────────────────────────────────────────────

  async function getAll() {
    return (await _storageGet(STORAGE_KEY)) || [];
  }

  /**
   * @param {object} entry  - dữ liệu từ vựng
   * @param {File|null} imageFile - file ảnh mới (null nếu không có)
   */
  async function add(entry, imageFile = null) {
    const list       = await getAll();
    const normalized = _normalizeEntry(entry);
    const newEntry   = {
      id: Date.now(),
      ...normalized,
      createdAt: new Date().toISOString(),
    };
    list.unshift(newEntry);
    await _storageSet(STORAGE_KEY, list);

    // Sync lên server — nếu có ảnh thì encode base64 rồi gửi kèm
    const imageBase64 = imageFile ? await _fileToBase64(imageFile) : null;
    const serverData  = await _syncOneToServer('add', newEntry, imageBase64);

    // Nếu server trả về imageUrl (sau khi upload Drive), cập nhật lại local
    if (serverData?.imageUrl) {
      list[0].imageUrl = serverData.imageUrl;
      await _storageSet(STORAGE_KEY, list);
    }

    return list;
  }

  /**
   * @param {number} index   - vị trí trong _allWords
   * @param {object} entry   - dữ liệu từ vựng
   * @param {File|null} imageFile - file ảnh mới (null = giữ nguyên ảnh cũ)
   */
  async function update(index, entry, imageFile = null) {
    const list = await getAll();
    if (index < 0 || index >= list.length) return list;
    list[index] = {
      ...list[index],
      ..._normalizeEntry(entry),
      updatedAt: new Date().toISOString(),
    };
    await _storageSet(STORAGE_KEY, list);

    const imageBase64 = imageFile ? await _fileToBase64(imageFile) : null;
    const serverData  = await _syncOneToServer('update', list[index], imageBase64);

    // Nếu server upload ảnh mới và trả về url, cập nhật lại local
    if (serverData?.imageUrl) {
      list[index].imageUrl = serverData.imageUrl;
      await _storageSet(STORAGE_KEY, list);
    }

    return list;
  }

  async function remove(index) {
    const list  = await getAll();
    const entry = list[index];
    list.splice(index, 1);
    await _storageSet(STORAGE_KEY, list);
    // Gửi cả imageUrl để server xóa ảnh trên Drive
    if (entry) _syncOneToServer('delete', { id: entry.id, imageUrl: entry.imageUrl });
    return list;
  }

  async function getRandom() {
    const list = await getAll();
    if (!list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  /**
   * Kéo toàn bộ dữ liệu từ server về, ghi đè local.
   * Gọi khi người dùng bấm nút "Lấy dữ liệu từ server".
   */
  async function pullFromServer() {
    return new Promise((resolve, reject) => {
      StorageUtil.get([CACHE_PASS], async (result) => {
        const pass = result[CACHE_PASS] || '';
        if (!pass) {
          PasswordUtil.openPasswordPopup();
          reject(new Error('Chưa có mật khẩu'));
          return;
        }

        LoadingOverlayUtil.show();
        try {
          const res = await fetch(API, {
            method: 'POST',
            body: JSON.stringify({ pass, action: API_ACTION_TUVUNG_GET_ALL }),
          });

          if (!res.ok) throw new Error('Lỗi kết nối server (' + res.status + ')');

          const json = await res.json();
          if (json.code !== 1) throw new Error(json.error || 'Server trả về lỗi');

          const serverList = Array.isArray(json.data) ? json.data : [];
          await _storageSet(STORAGE_KEY, serverList);
          resolve(serverList);
        } catch (err) {
          alert('Lỗi khi lấy dữ liệu từ server: ' + err.message);
          reject(err);
        } finally {
          LoadingOverlayUtil.hide();
        }
      });
    });
  }


  // ─────────────────────────────────────────────────────────────
  // PUBLIC — POPUP
  // ─────────────────────────────────────────────────────────────

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

    await _storageSet(PENDING_KEY, entry);

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

  function startRandomTimer() {
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name !== ALARM_NAME) return;
      show();
      _scheduleAlarm();
    });

    chrome.alarms.get(ALARM_NAME, (existing) => {
      if (!existing) _scheduleAlarm();
    });
  }

  function _scheduleAlarm() {
    const delayMin = (Math.random() * 30 + 30) / 60;
    chrome.alarms.create(ALARM_NAME, { delayInMinutes: delayMin });
  }


  // ─────────────────────────────────────────────────────────────
  // POPUP WINDOW RENDERER
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
      ${entry.ipa ? `<div class="popup-ipa">${_esc(entry.ipa)}</div>` : ''}
      <div class="popup-meaning">${_esc(entry.meaning)}</div>
      ${entry.example ? `
        <div class="popup-section">
          <div class="popup-section-label">Câu ví dụ</div>
          <div class="popup-section-text">${_esc(entry.example)}</div>
        </div>` : ''}
      ${entry.imageUrl ? `
        <div class="popup-section popup-section--image">
          <div class="popup-section-label">Hình ảnh</div>
          <img class="popup-example-img" src="${_esc(entry.imageUrl)}" alt="Hình minh hoạ" loading="lazy" />
        </div>` : ''}
      ${entry.exampleMeaning ? `
        <div class="popup-section">
          <div class="popup-section-label">Nghĩa câu ví dụ</div>
          <div class="popup-section-text">${_esc(entry.exampleMeaning)}</div>
        </div>` : ''}
      ${entry.note ? `<div class="popup-note">${_esc(entry.note)}</div>` : ''}
      <div class="popup-footer">
        <button class="popup-close-btn" id="popupCloseBtn">${_esc(entry.word)} — ${_esc(entry.meaning)}</button>
      </div>
    `;

    const closePopup = () => window.close();
    document.getElementById('popupCloseBtn').addEventListener('click', closePopup);
    setTimeout(closePopup, 10000);
  }


  // ─────────────────────────────────────────────────────────────
  // MANAGER PAGE
  // ─────────────────────────────────────────────────────────────

  let _allWords   = [];
  let _filtered   = [];
  let _deleteIndex = -1;

  const _$ = (id) => document.getElementById(id);

  function _domRefs() {
    return {
      wordList:        _$('wordList'),
      emptyState:      _$('emptyState'),
      wordCount:       _$('wordCount'),
      searchInput:     _$('searchInput'),
      modalOverlay:    _$('modalOverlay'),
      confirmOverlay:  _$('confirmOverlay'),
      modalTitle:      _$('modalTitle'),
      wordForm:        _$('wordForm'),
      editIndex:       _$('editIndex'),
      fieldWord:       _$('fieldWord'),
      fieldMeaning:    _$('fieldMeaning'),
      fieldIpa:        _$('fieldIpa'),
      fieldExample:    _$('fieldExample'),
      fieldExMeaning:  _$('fieldExampleMeaning'),
      fieldImageFile:  _$('fieldImageFile'),   // 🆕 input[type=file]
      fieldNote:       _$('fieldNote'),
      confirmMsg:      _$('confirmMsg'),
      btnOpenForm:     _$('btnOpenForm'),
      btnCloseModal:   _$('btnCloseModal'),
      btnCancelForm:   _$('btnCancelForm'),
      btnCancelDel:    _$('btnCancelDelete'),
      btnConfirmDel:   _$('btnConfirmDelete'),
      btnDemo:         _$('btnDemo'),
      btnPullServer:   _$('btnPullServer'),
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
    r.btnPullServer.addEventListener('click',  ()    => _handlePullServer(r));
    r.modalOverlay .addEventListener('click',  (e)   => { if (e.target === r.modalOverlay)  _closeModal(r);   });
    r.confirmOverlay.addEventListener('click', (e)   => { if (e.target === r.confirmOverlay) _closeConfirm(r); });

    // Listener chọn ảnh: lưu file + hiện preview
    r.fieldImageFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) { _selectedImageFile = null; return; }
      _selectedImageFile = file;
      _updateImagePreview(URL.createObjectURL(file));
    });
  }

  // 🆕 Xử lý kéo dữ liệu từ server về
  async function _handlePullServer(r) {
    if (!confirm('Dữ liệu local sẽ bị ghi đè bằng dữ liệu từ server. Bạn có chắc không?')) return;
    try {
      _allWords = await pullFromServer();
      _filtered = [..._allWords];
      _renderList(r);
      alert(`✅ Đã đồng bộ ${_allWords.length} từ từ server.`);
    } catch (_) {
      // Lỗi đã được alert bên trong pullFromServer
    }
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
        ${e.ipa ? `<div class="card-ipa">${_esc(e.ipa)}</div>` : ''}
        <div class="card-meaning">${_esc(e.meaning)}</div>
        ${(e.example || e.imageUrl) ? `<div class="card-divider"></div>` : ''}
        ${e.example ? `
          <div class="card-field"><strong>Câu ví dụ</strong>${_esc(e.example)}</div>` : ''}
        ${e.imageUrl ? `
          <div class="card-field card-field--image">
            <strong>Hình ảnh</strong>
            <img class="card-example-img" src="${_esc(e.imageUrl)}" alt="Hình minh hoạ" loading="lazy" />
          </div>` : ''}
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
      btn.addEventListener('click', () => _openForm(r, _idxById(btn.dataset.id)));
    });
    r.wordList.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', () => _openConfirm(r, _idxById(btn.dataset.id)));
    });
  }

  // So sánh dạng string để xử lý cả id number (từ local) lẫn string base36 (từ server)
  function _idxById(id)    { return _allWords.findIndex((e) => String(e.id) === String(id)); }

  function _handleSearch(r) {
    const q = r.searchInput.value.trim().toLowerCase();
    _filtered = q
      ? _allWords.filter((e) =>
          e.word.toLowerCase().includes(q) ||
          e.meaning.toLowerCase().includes(q) ||
          (e.ipa     || '').toLowerCase().includes(q) ||
          (e.example || '').toLowerCase().includes(q) ||
          (e.note    || '').toLowerCase().includes(q))
      : [..._allWords];
    _renderList(r);
  }

  function _openForm(r, idx) {
    _selectedImageFile = null; // reset file mỗi lần mở form
    r.editIndex.value = idx;
    if (idx === -1) {
      r.modalTitle.textContent = 'Thêm từ mới';
      r.wordForm.reset();
      _updateImagePreview(null);
    } else {
      const e = _allWords[idx];
      r.modalTitle.textContent = 'Sửa từ vựng';
      r.fieldWord.value        = e.word;
      r.fieldMeaning.value     = e.meaning;
      r.fieldIpa.value         = e.ipa            || '';
      r.fieldExample.value     = e.example        || '';
      r.fieldExMeaning.value   = e.exampleMeaning || '';
      r.fieldNote.value        = e.note           || '';
      // Hiện ảnh hiện tại nếu có
      _updateImagePreview(e.imageUrl || null);
    }
    r.modalOverlay.classList.add('active');
    r.fieldWord.focus();
  }

  function _closeModal(r) {
    r.modalOverlay.classList.remove('active');
    r.wordForm.reset();
    _selectedImageFile = null;
    _updateImagePreview(null);
  }
  function _closeConfirm(r) { _deleteIndex = -1; r.confirmOverlay.classList.remove('active'); }

  async function _handleSubmit(e, r) {
    e.preventDefault();
    const idx   = Number(r.editIndex.value);
    const entry = {
      word:          r.fieldWord.value,
      meaning:       r.fieldMeaning.value,
      ipa:           r.fieldIpa.value,
      example:       r.fieldExample.value,
      exampleMeaning:r.fieldExMeaning.value,
      note:          r.fieldNote.value,
      // imageUrl giữ nguyên từ local; sẽ được cập nhật sau khi server trả về nếu có ảnh mới
      imageUrl:      idx === -1 ? '' : (_allWords[idx].imageUrl || ''),
    };

    LoadingOverlayUtil.show();
    try {
      _allWords = idx === -1
        ? await add(entry, _selectedImageFile)
        : await update(idx, entry, _selectedImageFile);
      _filtered = [..._allWords];
      _closeModal(r);
      _renderList(r);
    } catch (err) {
      alert('Lỗi khi lưu từ: ' + err.message);
    } finally {
      LoadingOverlayUtil.hide();
    }
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
  // AUTO-INIT
  // ─────────────────────────────────────────────────────────────
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      const mode = new URLSearchParams(window.location.search).get('mode');

      const sectionPopup   = document.getElementById('sectionPopup');
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
    getAll, add, update, remove, getRandom,
    show, startRandomTimer,
    pullFromServer,
  };

})();