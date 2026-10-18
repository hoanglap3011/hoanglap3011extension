import { LoadingModule } from './LoadingModule.js';
import { StorageModule } from './StorageModule.js';
import { SystemNotifyModule } from './SystemNotifyModule.js';
import {
  TV_GROUPS_KEY, TV_NO_GROUP, TV_GROUP_COLORS,
  tvNormalizeGroupIds, tvBuildGroupMap, tvEffectiveGroupIds, tvIsEligible, tvSortGroups,
  TV_RELATIONS_KEY, TV_REL_SYNONYM, TV_REL_CONFUSING, TV_REL_TYPES, tvRelInvolves, tvRelationsOf,
  TV_FILTER_KEY, TV_FILTER_DIMS, TV_YN_FILTERS, tvNormalizeFilter, tvBuildFilterCtx, tvBuildRelTypeMap,
  tvMatchFilter, tvIsPopupEligible, tvYesNoOf,
} from './tuvung_core.js';

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
    groupIds: tvNormalizeGroupIds(raw.groupIds),
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

  // relations (tuỳ chọn): danh sách liên kết ĐẦY ĐỦ của từ [{ type, wordId, note }].
  // Không truyền (undefined) = server giữ nguyên liên kết.
  // Khi lỗi: trả null và ghi lý do vào _lastSyncError (người gọi tự hiện popup kết quả).
  let _lastSyncError = '';
  const _syncOneToServer = async (op, entry, imageBase64 = null, relations = undefined) => {
    _lastSyncError = '';
    const fail = (msg) => {
      _lastSyncError = msg || 'Không rõ lỗi';
      return null;
    };
    try {
      const body = {
        action: API_ACTION_TUVUNG_SYNC_ONE, op, entry,
        ...(imageBase64 && { imageBase64 }),
        ...(relations !== undefined && { relations }),
      };
      const res = await _callApi(body);
      if (res?.code === 1) return res.data ?? {};
      return fail(res?.error || res?.message || res?.msg || 'Server trả về lỗi');
    } catch (err) {
      return fail(err?.message || String(err));
    }
  };

  // ==========================================================
  // --- POPUP KẾT QUẢ (dùng chung) + THÔNG BÁO TRÌNH DUYỆT ---
  // type: 'success' | 'error'
  // Trả về Promise, resolve khi popup đóng (OK / Enter / Esc / click ra ngoài / tự đóng).
  // Thành công tự đóng sau RESULT_AUTO_CLOSE giây; lỗi phải bấm OK.
  // ==========================================================
  const RESULT_AUTO_CLOSE = 3;
  const RESULT_ICON = { success: '✅', warning: '⚠️', error: '❌' };
  const showResult = (type, title, message, notifyTag = 'tuvung-result') => {
    try { SystemNotifyModule.show(`${RESULT_ICON[type] || ''} ${title}`, message, notifyTag); } catch (_) {}
    return new Promise((resolve) => {
      document.getElementById('tvResultOverlay')?.remove();
      const over = document.createElement('div');
      over.id = 'tvResultOverlay';
      over.className = 'modal-overlay active tv-result-overlay';
      over.innerHTML = `
        <div class="confirm-box tv-result-box tv-result--${type}" role="alertdialog" aria-modal="true">
          <div class="confirm-icon">${RESULT_ICON[type] || 'ℹ️'}</div>
          <h3 class="confirm-title tv-result-title">${_esc(title)}</h3>
          <p class="tv-result-msg">${_esc(message)}</p>
          <div class="form-actions tv-result-actions">
            <button type="button" class="btn-primary tv-result-ok">OK</button>
          </div>
          <div class="tv-result-cd"></div>
        </div>`;
      document.body.appendChild(over);
      const btnOk = over.querySelector('.tv-result-ok');
      const cdEl  = over.querySelector('.tv-result-cd');
      let timer = null, closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        document.removeEventListener('keydown', onKey, true);
        over.remove();
        resolve();
      };
      // Bắt ở pha capture + chặn lan truyền để Enter/Esc không tác động màn bên dưới
      const onKey = (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      };
      document.addEventListener('keydown', onKey, true);
      btnOk.addEventListener('click', close);
      over.addEventListener('mousedown', (e) => { if (e.target === over) close(); });
      if (type === 'success') {
        let rem = RESULT_AUTO_CLOSE;
        cdEl.textContent = `Tự đóng sau ${rem}s`;
        timer = setInterval(() => {
          rem--;
          if (rem <= 0) close(); else cdEl.textContent = `Tự đóng sau ${rem}s`;
        }, 1000);
      }
      btnOk.focus();
    });
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

  // ==========================================================
  // --- LIÊN KẾT TỪ: gần nghĩa / dễ nhầm lẫn ---
  // Lưu ở storage (key TV_RELATIONS_KEY) giống nhóm: danh sách gọn, 1 nguồn duy nhất.
  // Bản ghi: { id, type, wordId, relatedWordId, note } — 2 chiều, mỗi cặp 1 bản ghi.
  // ==========================================================
  const getRelations = async () => {
    const v = await _storageGet(TV_RELATIONS_KEY);
    return Array.isArray(v) ? v : [];
  };
  const _saveRelations = (list) => _storageSet(TV_RELATIONS_KEY, list);
  const _newRelId = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // Chuẩn hoá đầu vào: bỏ loại lạ, bỏ tự liên kết, bỏ trùng → [{ type, wordId, note }]
  const _normalizeRelInput = (selfId, list) => {
    const self = String(selfId), seen = new Set(), out = [];
    (list || []).forEach(d => {
      const type = String(d?.type || ''), other = String(d?.wordId ?? '').trim();
      if (!TV_REL_TYPES.includes(type) || !other || other === self) return;
      const k = type + '|' + other;
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ type, wordId: other, note: String(d?.note || '').trim() });
    });
    return out;
  };

  // Thay TOÀN BỘ liên kết (2 loại) của 1 từ bằng records ở local
  const _replaceWordRelationsLocal = async (wordId, records) => {
    const all = await getRelations();
    const rest = all.filter(r => !(TV_REL_TYPES.includes(r.type) && tvRelInvolves(r, wordId)));
    await _saveRelations([...rest, ...(records || [])]);
  };

  // Ghi liên kết mong muốn vào local (giữ id cũ nếu cặp đã tồn tại)
  const _applyRelationsLocal = async (wordId, input) => {
    const id = String(wordId);
    const oldIds = new Map(tvRelationsOf(await getRelations(), id).map(o => [o.type + '|' + o.otherId, o.relId]));
    await _replaceWordRelationsLocal(id, input.map(d => ({
      id: oldIds.get(d.type + '|' + d.wordId) || _newRelId(),
      type: d.type, wordId: id, relatedWordId: d.wordId, note: d.note,
    })));
  };

  // ==========================================================
  // THÊM / SỬA: GỌI SERVER TRƯỚC
  //   1. Gửi entry + ảnh (base64) + liên kết lên server
  //   2. Server thành công → mới ghi IndexedDB + liên kết (theo dữ liệu server trả về)
  //   3. Server lỗi → ném Error, KHÔNG ghi gì ở máy (form giữ nguyên để Lưu lại)
  // Id từ mới sinh ở client và được giữ nguyên qua các lần bấm Lưu lại trong cùng 1 form
  // (opts.clientId) → server nhận ra id đã tồn tại thì cập nhật thay vì thêm dòng trùng.
  // ==========================================================
  const _newWordId = () => Date.now();

  // Ghi liên kết server trả về; server không trả (server cũ) → ghi theo input
  const _saveRelationsAfterServer = async (wordId, serverData, relIn) => {
    if (Array.isArray(serverData?.relations)) await _replaceWordRelationsLocal(wordId, serverData.relations);
    else if (relIn !== undefined) await _applyRelationsLocal(wordId, relIn);
  };

  // Lõi thêm từ: trả về entry vừa tạo
  const _addCore = async (entry, imageFile = null, relations = undefined, opts = {}) => {
    await _ready;
    const newEntry = { id: opts.clientId ?? _newWordId(), ..._normalizeEntry(entry), createdAt: new Date().toISOString() };
    const relIn = relations !== undefined ? _normalizeRelInput(newEntry.id, relations) : undefined;

    // 1. Server trước
    const b64 = imageFile ? await _fileToBase64(imageFile) : null;
    const serverData = await _syncOneToServer('add', newEntry, b64, relIn);
    if (serverData === null) throw new Error(_lastSyncError);
    if (serverData?.imageUrl !== undefined) newEntry.imageUrl = serverData.imageUrl || '';

    // 2. Server OK → ghi máy. Từ mới lên đầu danh sách (order nhỏ hơn phần tử nhỏ nhất);
    //    nếu id đã có ở máy (lưu lại) thì giữ order cũ.
    const db = await _openDB();
    const existing = await _req(db.transaction(STORE, 'readonly').objectStore(STORE).get(newEntry.id));
    let order = existing?.order;
    if (order === undefined) {
      const first = await _req(db.transaction(STORE, 'readonly').objectStore(STORE).index('order').openCursor());
      order = (first ? first.value.order : 0) - 1;
    }
    await _tx('readwrite', (store) => store.put(_toRecord(newEntry, order)));
    await _saveRelationsAfterServer(newEntry.id, serverData, relIn);
    return newEntry;
  };

  // Ném Error nếu server lỗi (khi đó máy không thay đổi gì)
  const add = async (entry, imageFile = null, relations = undefined, opts = {}) => {
    await _addCore(entry, imageFile, relations, opts);
    return getAll();
  };

  // Thêm nhanh 1 từ (chỉ từ + nghĩa) — dùng trong ô chọn từ liên kết của form.
  // Server lưu xong mới có ở máy → không bao giờ liên kết tới từ không có trên Sheet.
  const quickAdd = async ({ word, meaning }) => {
    if (!String(word || '').trim() || !String(meaning || '').trim()) throw new Error('Cần nhập từ và nghĩa');
    try {
      return await _addCore({ word, meaning, isActive: true });
    } catch (err) {
      throw new Error('Chưa thêm được lên Server: ' + (err?.message || err));
    }
  };

  const update = async (id, entry, imageFile = null, relations = undefined) => {
    await _ready;
    const db = await _openDB();
    const current = await _req(db.transaction(STORE, 'readonly').objectStore(STORE).get(id));
    if (!current) throw new Error('Không tìm thấy từ trên máy (có thể đã bị xoá). Hãy Đồng bộ lại.');

    const updated = { ...current, ..._normalizeEntry(entry), id: current.id, updatedAt: new Date().toISOString() };
    const relIn = relations !== undefined ? _normalizeRelInput(current.id, relations) : undefined;

    // 1. Server trước
    const b64 = imageFile ? await _fileToBase64(imageFile) : null;
    const serverData = await _syncOneToServer('update', _fromRecord(updated), b64, relIn);
    if (serverData === null) throw new Error(_lastSyncError);
    if (serverData?.imageUrl !== undefined) updated.imageUrl = serverData.imageUrl || '';

    // 2. Server OK → ghi máy
    await _tx('readwrite', (store) => store.put(_toRecord(updated, current.order)));
    await _saveRelationsAfterServer(current.id, serverData, relIn);
    return getAll();
  };

  // Xoá: gọi SERVER TRƯỚC, server thành công mới xoá ở máy.
  // Server lỗi → ném Error, dữ liệu trên máy giữ nguyên.
  // Ngoại lệ: server báo "Không tìm thấy" (từ chưa từng lên Sheet) → coi như đã xoá trên server.
  const remove = async (id) => {
    await _ready;
    const db = await _openDB();
    const entry = await _req(db.transaction(STORE, 'readonly').objectStore(STORE).get(id));
    if (!entry) return getAll();

    const res = await _syncOneToServer('delete', { id: entry.id, imageUrl: entry.imageUrl }, null, undefined);
    if (res === null && !/không tìm thấy/i.test(_lastSyncError)) throw new Error(_lastSyncError);

    await _tx('readwrite', (store) => store.delete(id));
    // Xoá mọi liên kết dính tới từ này (server tự xoá trong op 'delete')
    const rels = await getRelations();
    const restRels = rels.filter(r => !tvRelInvolves(r, id));
    if (restRels.length !== rels.length) await _saveRelations(restRels);
    return getAll();
  };

  // Lấy ngẫu nhiên MỘT từ hợp lệ theo BỘ LỌC MÀN QUẢN LÝ (tvIsPopupEligible — cùng quy tắc với background.js).
  // Duyệt cursor 1 lượt + reservoir sampling, không nạp cả kho vào bộ nhớ.
  // excludeIds (Set<string>, tuỳ chọn): ưu tiên từ CHƯA nằm trong tập này (từ chưa xem
  // trong phiên popup). Nếu mọi từ hợp lệ đều đã xem → vẫn trả 1 từ (cho phép lặp lại).
  const getRandom = async (excludeIds = null) => {
    await _ready;
    const db = await _openDB();
    const [groups, relations, filter] = await Promise.all([
      _storageGet(TV_GROUPS_KEY), _storageGet(TV_RELATIONS_KEY), _storageGet(TV_FILTER_KEY)]);
    const ctx = tvBuildFilterCtx({ groups, relations, filter });
    const groupMap = ctx.groupMap;
    const ex = excludeIds instanceof Set ? excludeIds : null;
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE)
        .index('activeKey').openCursor(IDBKeyRange.only(1));
      // 4 "giỏ": khớp nhóm chọn (chưa xem / bất kỳ), fallback bỏ lọc nhóm chọn (chưa xem / bất kỳ)
      const pool = { sNew: [null, 0], sAny: [null, 0], fNew: [null, 0], fAny: [null, 0] };
      const take = (k, w) => { const p = pool[k]; if (Math.random() * ++p[1] < 1) p[0] = w; };
      req.onsuccess = () => {
        const c = req.result;
        if (c) {
          const w = c.value;
          const unseen = !ex || !ex.has(String(w.id));
          if (tvIsPopupEligible(w, ctx)) {
            take('sAny', w);
            if (unseen) take('sNew', w);
          }
          // Bộ lọc ra rỗng → fallback bỏ lọc (vẫn tôn trọng từ đang tắt)
          if (ctx.active && tvIsEligible(w, groupMap, null)) {
            take('fAny', w);
            if (unseen) take('fNew', w);
          }
          c.continue();
          return;
        }
        const chosen = pool.sAny[1]
          ? (pool.sNew[0] || pool.sAny[0])
          : (pool.fNew[0] || pool.fAny[0]);
        resolve(chosen ? _fromRecord(chosen) : null);
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

        // Server mới trả { words, groups }; server cũ trả mảng từ
        const words  = Array.isArray(json.data) ? json.data : (json.data?.words || []);
        const groups = Array.isArray(json.data) ? null : (json.data?.groups ?? null);
        const relations = Array.isArray(json.data?.relations) ? json.data.relations : null;
        await _bulkReplace(words);
        if (groups) await _saveGroups(groups);
        if (relations) await _saveRelations(relations);
        resolve({ words, groups, relations });
      } catch (err) { reject(err); } finally { LoadingModule.hide(); }
    });
  });

  // ==========================================================
  // --- THAO TÁC HÀNG LOẠT + NHÓM TỪ VỰNG ---
  // Nhóm lưu ở storage (key TV_GROUPS_KEY) vì danh sách nhỏ và
  // background.js cần đọc nhanh khi chọn từ cho popup.
  // ==========================================================
  // Tra theo id dạng số (tạo ở máy: Date.now) hoặc chuỗi (tải từ Sheet / uuid)
  const _getByAnyId = async (id) => {
    const n = Number(id);
    return (Number.isFinite(n) && await getById(n)) || (await getById(String(id)));
  };

  const getById = async (id) => {
    await _ready;
    const db = await _openDB();
    const rec = await _req(db.transaction(STORE, 'readonly').objectStore(STORE).get(id));
    return rec ? _fromRecord(rec) : null;
  };

  /**
   * Cập nhật HÀNG LOẠT: GỌI SERVER TRƯỚC (giống Thêm / Sửa / Xoá).
   *   1. Gửi 1 lần lên server
   *   2. Server thành công → mới ghi IndexedDB (1 transaction)
   *   3. Server lỗi → ném Error, máy giữ nguyên
   * changes: { addGroupIds?: [], removeGroupIds?: [], setActive?: boolean }
   * Trả về số từ đã cập nhật ở máy.
   */
  const bulkUpdate = async (ids, changes = {}) => {
    await _ready;
    const idSet  = new Set((ids || []).map(String));
    if (!idSet.size) return 0;
    const addG   = tvNormalizeGroupIds(changes.addGroupIds);
    const remG   = new Set(tvNormalizeGroupIds(changes.removeGroupIds));
    const hasAct = typeof changes.setActive === 'boolean';

    // 1. Server trước
    let res;
    try {
      res = await _callApi({
        action: API_ACTION_TUVUNG_BULK_UPDATE,
        ids: [...idSet], addGroupIds: addG, removeGroupIds: [...remG],
        ...(hasAct && { setActive: changes.setActive }),
      });
    } catch (err) {
      throw new Error(err?.message || String(err));
    }
    if (res?.code !== 1) throw new Error(res?.error || res?.message || res?.msg || 'Server trả về lỗi');

    // 2. Server OK → ghi máy
    const nowIso = new Date().toISOString();
    let count = 0;
    await _tx('readwrite', (store) => {
      store.openCursor().onsuccess = (e) => {
        const c = e.target.result;
        if (!c) return;
        const rec = c.value;
        if (idSet.has(String(rec.id))) {
          const g = tvNormalizeGroupIds([...(rec.groupIds || []), ...addG]).filter(x => !remG.has(x));
          const next = { ...rec, groupIds: g, updatedAt: nowIso };
          if (hasAct) next.isActive = changes.setActive;
          c.update(_toRecord(next, rec.order));
          count++;
        }
        c.continue();
      };
    });
    return count;
  };

  // Gỡ 1 nhóm khỏi mọi từ (chỉ ở local; server tự gỡ trong op 'delete' của nhóm)
  const _stripGroupLocal = (groupId) => _tx('readwrite', (store) => {
    store.openCursor().onsuccess = (e) => {
      const c = e.target.result;
      if (!c) return;
      const rec = c.value;
      const g = tvNormalizeGroupIds(rec.groupIds);
      if (g.includes(groupId)) c.update({ ...rec, groupIds: g.filter(x => x !== groupId) });
      c.continue();
    };
  });

  const getGroups = async () => tvSortGroups((await _storageGet(TV_GROUPS_KEY)) || []);
  const _saveGroups = (list) => _storageSet(TV_GROUPS_KEY, tvSortGroups(list));
  // ==========================================================
  // NHÓM: GỌI SERVER TRƯỚC (giống Thêm / Sửa / Xoá từ)
  //   Server thành công → mới ghi máy. Server lỗi → ném Error, máy giữ nguyên.
  // ==========================================================
  const _groupApi = async (op, payload) => {
    let res;
    try {
      res = await _callApi({ action: API_ACTION_TUVUNG_GROUP_SYNC, op, ...payload });
    } catch (err) {
      throw new Error(err?.message || String(err));
    }
    if (res?.code !== 1) throw new Error(res?.error || res?.message || res?.msg || 'Server trả về lỗi');
    return res.data ?? {};
  };

  const _checkGroupName = (list, name, exceptId = null) => {
    const n = String(name || '').trim();
    if (!n) throw new Error('Tên nhóm không được để trống');
    if (list.some(g => g.id !== exceptId && g.name.trim().toLowerCase() === n.toLowerCase())) {
      throw new Error(`Nhóm "${n}" đã tồn tại`);
    }
    return n;
  };

  const addGroup = async ({ name, color, description = '' }) => {
    const list = await getGroups();
    const n = _checkGroupName(list, name);
    const group = {
      id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      name: n,
      color: color || TV_GROUP_COLORS[list.length % TV_GROUP_COLORS.length],
      description: String(description || '').trim(),
    };
    await _groupApi('add', { group });                 // 1. server
    await _saveGroups([...list, group]);               // 2. máy
    return group;
  };

  // patch: { name?, description?, color? }
  const updateGroup = async (id, patch) => {
    const list = await getGroups();
    const cur = list.find(g => g.id === id);
    if (!cur) throw new Error('Không tìm thấy nhóm');
    const next = { id, name: cur.name, color: cur.color, description: cur.description || '' };
    if (patch.name !== undefined) next.name = _checkGroupName(list, patch.name, id);
    if (patch.description !== undefined) next.description = String(patch.description || '').trim();
    if (patch.color !== undefined) next.color = patch.color;
    await _groupApi('update', { group: next });        // 1. server
    await _saveGroups(list.map(g => (g.id === id ? { ...g, ...next } : g)));   // 2. máy
    return next;
  };

  const deleteGroup = async (id) => {
    await _groupApi('delete', { group: { id } });      // 1. server (tự gỡ nhóm khỏi mọi từ trên Sheet)
    const list = await getGroups();                    // 2. máy
    await _saveGroups(list.filter(g => g.id !== id));
    await _stripGroupLocal(id);
    // Bỏ nhóm vừa xoá khỏi bộ lọc đã lưu (bộ lọc cũng là bộ chọn từ của popup)
    const flt = tvNormalizeFilter(await _storageGet(TV_FILTER_KEY));
    if (flt.groups.includes(id)) await _storageSet(TV_FILTER_KEY, { ...flt, groups: flt.groups.filter(x => x !== id) });
  };

  // Chip nhóm (dùng chung cho form, cài đặt, chọn nhóm hàng loạt)
  const _groupChipHtml = (g, active, extraCls = '', count = null) => `
    <button type="button" class="chip chip--group ${extraCls} ${active ? 'chip--active' : ''}"
      data-gid="${_esc(g.id)}" style="--gc:${_esc(g.color || '#c8a84b')}" title="${_esc(g.description || g.name)}">
      <span class="group-dot"></span>${_esc(g.name)}${count !== null ? ` <span class="chip-count">${count}</span>` : ''}
    </button>`;
  const _NO_GROUP_CHIP = { id: TV_NO_GROUP, name: 'Chưa phân nhóm', color: '#7f8c8d' };

  // opts.defaultGroupIds: nhóm chọn sẵn khi thêm từ mới
  const mountForm = async (container, editId = null, onComplete, onCancel, opts = {}) => {
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
    // Id cho từ mới: sinh 1 lần cho mỗi lần mở form, giữ nguyên khi bấm Lưu lại
    // → server nhận ra id đã có thì cập nhật, không thêm dòng trùng.
    const _addClientId = Date.now();

    const setPreview = (src) => {
      imgPreview.src = src || '';
      imgWrap.classList.toggle('d-none', !src);
    };

    // ── Chọn nhóm ──
    let _formGroupSel = new Set(tvNormalizeGroupIds(opts.defaultGroupIds));
    let _formGroups = await getGroups();
    const groupChipsEl = container.querySelector('.form-group-chips');
    const groupInput   = container.querySelector('.group-inline-input');
    const renderFormGroups = () => {
      groupChipsEl.innerHTML = _formGroups.length
        ? _formGroups.map(g => _groupChipHtml(g, _formGroupSel.has(g.id), 'chip--settings')).join('')
        : '<span class="settings-hint" style="margin:0">Chưa có nhóm — gõ tên bên dưới để tạo.</span>';
    };
    groupChipsEl.addEventListener('click', (ev) => {
      const c = ev.target.closest('.chip'); if (!c) return;
      const id = c.dataset.gid;
      _formGroupSel.has(id) ? _formGroupSel.delete(id) : _formGroupSel.add(id);
      c.classList.toggle('chip--active', _formGroupSel.has(id));
    });
    groupInput.addEventListener('keydown', async (ev) => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();                  // không submit form
      const name = groupInput.value.trim();
      if (!name) return;
      const exist = _formGroups.find(g => g.name.toLowerCase() === name.toLowerCase());
      if (exist) {
        _formGroupSel.add(exist.id);
        groupInput.value = '';
        renderFormGroups();
        return;
      }
      // Tạo nhóm mới: server trước → thành công mới có ở máy
      groupInput.disabled = true;
      LoadingModule.show();
      try {
        const g = await addGroup({ name });
        _formGroups = await getGroups();
        _formGroupSel.add(g.id);
        groupInput.value = '';
        renderFormGroups();
        LoadingModule.hide();
      } catch (err) {
        LoadingModule.hide();
        await showResult('error', 'Tạo nhóm thất bại', err?.message || String(err), 'tuvung-group');
      } finally {
        groupInput.disabled = false;
        groupInput.focus();
      }
    });

    if (editId !== null && editId !== undefined) {
      container.querySelector('.comp-title').textContent = 'Sửa từ vựng';
      const e = (await getById(editId)) || (await getAll()).find(w => String(w.id) === String(editId));
      if (e) {
        els.word.value = e.word; els.meaning.value = e.meaning;
        els.ipa.value = e.ipa || ''; els.example.value = e.example || '';
        els.exampleMeaning.value = e.exampleMeaning || ''; els.note.value = e.note || '';
        els.imageUrl.value = e.imageUrl || ''; els.isActive.checked = e.isActive;
        setPreview(e.imageUrl);

        _formGroupSel = new Set(tvNormalizeGroupIds(e.groupIds));
        if (e.partOfSpeech) {
          const radio = form.querySelector(`input[name="partOfSpeech"][value="${e.partOfSpeech}"]`);
          if (radio) radio.checked = true;
        }
      }
    }
    renderFormGroups();

    // ── Liên kết từ: gần nghĩa / dễ nhầm lẫn ──
    // Mỗi loại: Map(otherId → note). Chỉ chọn từ đã có trong kho, hoặc "Thêm nhanh" từ mới.
    const _allWords = await getAll();
    const _wordById = new Map(_allWords.map(w => [String(w.id), w]));
    const selfId = (editId !== null && editId !== undefined) ? String(editId) : null;
    const _relSel = { [TV_REL_SYNONYM]: new Map(), [TV_REL_CONFUSING]: new Map() };
    if (selfId) {
      tvRelationsOf(await getRelations(), selfId).forEach(r => {
        if (_relSel[r.type] && _wordById.has(r.otherId)) _relSel[r.type].set(r.otherId, r.note);
      });
    }
    const _markFormDirty = () => { container.dataset.dirty = '1'; };
    const _wordMeta = (w) => [w.partOfSpeech, w.meaning].filter(Boolean).join(' · ');
    const SUGGEST_LIMIT = 8;

    const setupRelPicker = (picker) => {
      const sel     = _relSel[picker.dataset.rel];
      const listEl  = picker.querySelector('.rel-selected');
      const input   = picker.querySelector('.rel-search');
      const sugEl   = picker.querySelector('.rel-suggest');
      const quickEl = picker.querySelector('.rel-quick');
      const qWord   = picker.querySelector('.rel-quick-word');
      const qMean   = picker.querySelector('.rel-quick-meaning');
      const qSave   = picker.querySelector('.rel-quick-save');
      let items = [], active = -1;

      const renderSelected = () => {
        listEl.innerHTML = [...sel.entries()].map(([id, note]) => {
          const w = _wordById.get(id);
          if (!w) return '';
          return `
            <div class="rel-chip" data-id="${_esc(id)}">
              <div class="rel-chip-main" title="${_esc(_wordMeta(w))}">
                <span class="rel-chip-word">${_esc(w.word)}</span>
                <span class="rel-chip-meta">${_esc(_wordMeta(w))}</span>
              </div>
              <input type="text" class="rel-chip-note" maxlength="200" value="${_esc(note)}"
                placeholder="Ghi chú: vì sao gần nghĩa / dễ nhầm…" />
              <button type="button" class="rel-chip-remove" title="Bỏ liên kết">✕</button>
            </div>`;
        }).join('');
      };

      const closeSuggest = () => { sugEl.classList.add('d-none'); sugEl.innerHTML = ''; items = []; active = -1; };
      const paintActive = () => sugEl.querySelectorAll('.rel-suggest-item')
        .forEach((el, i) => el.classList.toggle('is-active', i === active));

      const renderSuggest = () => {
        const raw = input.value.trim();
        const q = raw.toLowerCase();
        if (!q) { closeSuggest(); return; }
        const starts = (w) => ((w.word || '').toLowerCase().startsWith(q) ? 0 : 1);
        const matches = _allWords
          .filter(w => String(w.id) !== selfId && !sel.has(String(w.id)) &&
            ((w.word || '').toLowerCase().includes(q) || (w.meaning || '').toLowerCase().includes(q)))
          .sort((a, b) => starts(a) - starts(b) || String(a.word).localeCompare(String(b.word)));
        items = matches.slice(0, SUGGEST_LIMIT).map(w => ({ kind: 'word', w }));
        items.push({ kind: 'quick', text: raw });   // luôn cho thêm nhanh (từ mới / nghĩa mới)
        active = 0;
        sugEl.innerHTML = items.map((it, i) => it.kind === 'word'
          ? `<div class="rel-suggest-item" data-i="${i}">
               <span class="rel-chip-word">${_esc(it.w.word)}</span>
               <span class="rel-chip-meta">${_esc(_wordMeta(it.w))}</span>
             </div>`
          : `<div class="rel-suggest-item rel-suggest-quick" data-i="${i}">+ Thêm nhanh từ mới "${_esc(it.text)}"</div>`
        ).join('');
        sugEl.classList.remove('d-none');
        paintActive();
      };

      const openQuick = (text) => {
        closeSuggest();
        qWord.value = text; qMean.value = '';
        quickEl.classList.remove('d-none');
        qMean.focus();
      };
      const closeQuick = () => { quickEl.classList.add('d-none'); input.focus(); };

      const choose = (i) => {
        const it = items[i];
        if (!it) return;
        if (it.kind === 'quick') { openQuick(it.text); return; }
        sel.set(String(it.w.id), '');
        input.value = '';
        closeSuggest();
        renderSelected();
        _markFormDirty();
        input.focus();
      };

      const submitQuick = async () => {
        const word = qWord.value.trim(), meaning = qMean.value.trim();
        if (!word)    { qWord.focus(); return; }
        if (!meaning) { qMean.focus(); return; }
        qSave.disabled = true; qSave.textContent = 'Đang thêm...';
        try {
          const w = await quickAdd({ word, meaning });
          _allWords.unshift(w);
          _wordById.set(String(w.id), w);
          sel.set(String(w.id), '');
          input.value = '';
          renderSelected();
          _markFormDirty();
          closeQuick();
        } catch (err) {
          await showResult('error', 'Thêm nhanh thất bại', err?.message || String(err), 'tuvung-save');
        } finally { qSave.disabled = false; qSave.textContent = 'Thêm'; }
      };

      input.addEventListener('input', renderSuggest);
      input.addEventListener('focus', () => { if (input.value.trim()) renderSuggest(); });
      input.addEventListener('blur', () => setTimeout(closeSuggest, 150));
      input.addEventListener('keydown', (e) => {
        const open = !sugEl.classList.contains('d-none') && items.length;
        if (e.key === 'ArrowDown' && open) { e.preventDefault(); active = (active + 1) % items.length; paintActive(); }
        else if (e.key === 'ArrowUp' && open) { e.preventDefault(); active = (active - 1 + items.length) % items.length; paintActive(); }
        else if (e.key === 'Enter') { e.preventDefault(); if (open) choose(active); }   // không submit form
        else if (e.key === 'Escape' && open) { e.stopPropagation(); closeSuggest(); }   // không đóng form
      });
      sugEl.addEventListener('mousedown', (e) => e.preventDefault());   // giữ focus ở ô tìm
      sugEl.addEventListener('click', (e) => {
        const it = e.target.closest('.rel-suggest-item');
        if (it) choose(Number(it.dataset.i));
      });

      [qWord, qMean].forEach(el => el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  { e.preventDefault(); submitQuick(); }
        if (e.key === 'Escape') { e.stopPropagation(); closeQuick(); }
      }));
      qSave.addEventListener('click', submitQuick);
      picker.querySelector('.rel-quick-cancel').addEventListener('click', closeQuick);

      listEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.rel-chip-remove');
        if (!btn) return;
        sel.delete(btn.closest('.rel-chip').dataset.id);
        renderSelected();
        _markFormDirty();
      });
      listEl.addEventListener('input', (e) => {
        if (!e.target.classList.contains('rel-chip-note')) return;
        sel.set(e.target.closest('.rel-chip').dataset.id, e.target.value);
      });

      renderSelected();
    };
    container.querySelectorAll('.rel-picker').forEach(setupRelPicker);

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
      let _loading = true;   // ẩn loading đúng 1 lần (trước khi hiện popup kết quả)
      const _hideLoading = () => { if (_loading) { _loading = false; LoadingModule.hide(); } };

      try {
        const checkedPos = form.querySelector('input[name="partOfSpeech"]:checked');
        const entry = {
          word: els.word.value, meaning: els.meaning.value, ipa: els.ipa.value,
          example: els.example.value, exampleMeaning: els.exampleMeaning.value,
          note: els.note.value, imageUrl: els.imageUrl.value.trim(), isActive: els.isActive.checked,
          partOfSpeech: checkedPos ? checkedPos.value : '',
          groupIds: [..._formGroupSel],
        };

        const relations = TV_REL_TYPES.flatMap(t =>
          [..._relSel[t].entries()].map(([wordId, note]) => ({ type: t, wordId, note: String(note || '').trim() })));

        const isAdd = editId === null || editId === undefined;
        const label = `"${String(entry.word || '').trim()}"`;
        // Server trước: lỗi → nhảy xuống catch, máy không đổi, form giữ nguyên để Lưu lại
        isAdd
          ? await add(entry, _selectedFile, relations, { clientId: _addClientId })
          : await update(editId, entry, _selectedFile, relations);

        _hideLoading();
        await showResult('success', isAdd ? 'Đã thêm từ mới' : 'Đã cập nhật từ',
          `Từ ${label} đã được lưu lên Server.`, 'tuvung-save');
        _wrappedComplete();
      } catch (err) {
        _hideLoading();
        btnSubmit.disabled = false; btnSubmit.textContent = 'Lưu từ';
        await showResult('error', 'Lưu thất bại',
          `Chưa lưu được lên Server (${err?.message || err}). Dữ liệu trên máy không thay đổi, ` +
          'nội dung form vẫn giữ nguyên — kiểm tra mạng/mật khẩu rồi bấm Lưu lại.', 'tuvung-save');
      } finally { _hideLoading(); }
    });

    els.word.focus();
  };

  // ── Các trường có thể ẩn/hiện trong popup ──
  // key → selector của hàng (row) và của phần nội dung bên trong hàng
  const TV_REVEAL_KEY = 'tvRevealFields';   // mảng key được HIỆN SẴN khi mở popup (mặc định rỗng = ẩn hết)
  const TV_DISPLAY_FIELDS = [
    { key: 'meaning',        label: 'Nghĩa tiếng Việt', row: '.display-meaning-row',     content: '.display-meaning' },
    { key: 'example',        label: 'Câu ví dụ',        row: '.display-example-row',     content: '.display-example-content' },
    { key: 'exampleMeaning', label: 'Nghĩa câu ví dụ',  row: '.section-example-meaning', content: '.text-example-meaning' },
    { key: 'note',           label: 'Chú thích',        row: '.section-note',            content: '.display-note' },
    { key: 'synonyms',       label: 'Từ gần nghĩa',     row: '.section-synonyms',        content: '.display-synonyms' },
    { key: 'confusingWords', label: 'Từ dễ nhầm lẫn',   row: '.section-confusing',       content: '.display-confusing' },
    { key: 'image',          label: 'Ảnh minh hoạ',     row: '.section-image',           content: '.display-image-wrap' },
  ];
  const _getRevealDefaults = async () => {
    const v = await _storageGet(TV_REVEAL_KEY);
    const valid = new Set(TV_DISPLAY_FIELDS.map(f => f.key));
    return Array.isArray(v) ? v.filter(k => valid.has(k)) : [];
  };

  /**
   * Hiển thị 1 từ.
   * opts:
   *   showClose   : hiện nút X ở header (chỉ bản web; extension dùng nút đóng của cửa sổ)
   *   revealed    : Set<key> các trường đang hiện (được mutate trực tiếp để nhớ trạng thái)
   *   nav         : { hasPrev, hasNext, onPrev, onNext } — có thì hiện footer điều hướng
   *   onInteract  : gọi khi người dùng bấm Trước / Sau / Hiện-Ẩn tất cả (dừng đếm ngược)
   *   related     : { synonym: [{ entry, note, off }], confusing: [...] } — từ liên kết
   *   onOpenRelated(id): bấm vào 1 từ liên kết
   * Trả về { prev, next, toggleAll, speakWord, speakExample } để gắn phím tắt.
   */
  const mountDisplay = (container, entry, onClose, opts = {}) => {
    const tpl = document.getElementById('tpl-display');
    container.innerHTML = '';
    container.appendChild(tpl.content.cloneNode(true));

    if (!entry) {
      container.innerHTML = '<div class="display-empty">Không tìm thấy từ vựng.</div>';
      return null;
    }

    const $ = sel => container.querySelector(sel);
    const revealed = opts.revealed instanceof Set ? opts.revealed : new Set();
    const nav = opts.nav || null;
    const interact = () => { if (opts.onInteract) opts.onInteract(); };

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

    // ── Audio: loa tương ứng chuyển vàng (.is-playing) trong lúc đọc ──
    const btnPlayWord    = $('.display-ipa-row .btn-play-audio');
    const btnPlayExample = $('.btn-play-example');
    const _clearPlaying = () => container.querySelectorAll('.btn-play-audio.is-playing')
      .forEach(b => b.classList.remove('is-playing'));
    const playAudio = (text, btn) => {
      if (!text || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();          // huỷ câu đang đọc (onend của nó có thể không bắn)
      _clearPlaying();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'en-US'; utt.rate = 0.9;
      const done = () => btn?.classList.remove('is-playing');
      utt.onend = done;
      utt.onerror = done;
      btn?.classList.add('is-playing');
      window.speechSynthesis.speak(utt);
    };
    const speakWord    = () => playAudio(entry.word, btnPlayWord);
    const speakExample = () => playAudio(entry.example, btnPlayExample);
    btnPlayWord?.addEventListener('click', speakWord);

    // ── Từ liên kết ──
    const relSyn  = opts.related?.[TV_REL_SYNONYM]   || [];
    const relConf = opts.related?.[TV_REL_CONFUSING] || [];
    const _relListHtml = (list) => list.map(({ entry: w, note, off }) => `
      <div class="rel-item ${off ? 'rel-item--off' : ''}">
        <button type="button" class="rel-link" data-id="${_esc(w.id)}" title="Xem chi tiết &quot;${_esc(w.word)}&quot;">${_esc(w.word)}</button>
        <span class="rel-meta">${_esc([w.partOfSpeech, w.meaning].filter(Boolean).join(' · '))}</span>
        ${note ? `<span class="rel-note">${_esc(note)}</span>` : ''}
      </div>`).join('');

    // ── Điền dữ liệu từng trường ──
    const has = {
      meaning:        !!entry.meaning,
      example:        !!entry.example,
      exampleMeaning: !!entry.exampleMeaning,
      note:           !!entry.note,
      synonyms:       !!relSyn.length,
      confusingWords: !!relConf.length,
      image:          !!entry.imageUrl,
    };
    if (has.meaning) $('.display-meaning').textContent = entry.meaning;
    else $('.display-meaning-row').classList.add('d-none');
    if (has.example) {
      $('.text-example').textContent = entry.example;
      btnPlayExample?.addEventListener('click', speakExample);
    }
    if (has.exampleMeaning) $('.text-example-meaning').textContent = entry.exampleMeaning;
    if (has.note)           $('.display-note').textContent = entry.note;
    if (has.synonyms)       $('.display-synonyms').innerHTML = _relListHtml(relSyn);
    if (has.confusingWords) $('.display-confusing').innerHTML = _relListHtml(relConf);
    // Bấm vào từ liên kết → xem chi tiết từ đó (không ẩn hàng)
    [$('.display-synonyms'), $('.display-confusing')].forEach(el => el?.addEventListener('click', (e) => {
      const a = e.target.closest('.rel-link');
      if (!a || !opts.onOpenRelated) return;
      interact();
      opts.onOpenRelated(a.dataset.id);
    }));
    if (has.image) {
      $('.display-col-right').classList.remove('d-none');
      $('.display-example-img').src = entry.imageUrl;
    }

    // ── Ẩn/hiện từng trường ──
    // Đang ẩn : chỉ hiện placeholder (nút có tên trường) → bấm để hiện
    // Đang hiện: nội dung THAY CHỖ placeholder (placeholder bị ẩn) → bấm vào nội dung để ẩn lại
    const fields = TV_DISPLAY_FIELDS.filter(f => has[f.key]).map(f => ({
      ...f, rowEl: $(f.row), contentEl: $(f.content),
    }));
    const btnToggleAll = $('.btn-toggle-all');

    const _updateToggleAll = () => {
      if (!btnToggleAll) return;
      if (!fields.length) {
        btnToggleAll.disabled = true;
        btnToggleAll.textContent = 'Không có trường';
        return;
      }
      btnToggleAll.disabled = false;
      const allShown = fields.every(f => revealed.has(f.key));
      btnToggleAll.textContent = allShown ? 'Ẩn tất cả' : 'Hiện tất cả';
      btnToggleAll.classList.toggle('btn-nav--active', allShown);
    };
    const _apply = (f) => {
      const show = revealed.has(f.key);
      f.rowEl.classList.remove('d-none');
      f.rowEl.classList.toggle('is-open', show);
      f.rowEl.querySelector('.btn-toggle')?.classList.toggle('d-none', show);
      f.contentEl.classList.toggle('d-none', !show);
    };
    const _flip = (f) => {
      revealed.has(f.key) ? revealed.delete(f.key) : revealed.add(f.key);
      _apply(f);
      _updateToggleAll();
    };
    fields.forEach(f => {
      f.contentEl.classList.add('reveal-content');
      f.contentEl.title = `${f.label} — bấm để ẩn`;
      _apply(f);
      f.rowEl.querySelector('.btn-toggle')?.addEventListener('click', () => _flip(f));
      f.contentEl.addEventListener('click', (e) => {
        if (e.target.closest('.btn-play-audio, .rel-link')) return; // bấm nút loa / link từ thì không ẩn
        if (window.getSelection?.().toString()) return;           // đang bôi đen để copy thì không ẩn
        _flip(f);
      });
    });

    const toggleAll = () => {
      if (!fields.length) return;
      interact();
      const allShown = fields.every(f => revealed.has(f.key));
      fields.forEach(f => { allShown ? revealed.delete(f.key) : revealed.add(f.key); _apply(f); });
      _updateToggleAll();
    };
    btnToggleAll?.addEventListener('click', toggleAll);
    _updateToggleAll();

    // ── Footer điều hướng ──
    const footer  = $('.display-footer');
    const btnPrev = $('.btn-nav-prev');
    const btnNext = $('.btn-nav-next');
    let prev = null, next = null;
    if (nav) {
      btnPrev.disabled = !nav.hasPrev;
      btnNext.disabled = !nav.hasNext;
      prev = () => { if (!nav.hasPrev) return; interact(); nav.onPrev(); };
      next = () => { if (!nav.hasNext) return; interact(); nav.onNext(); };
      btnPrev.addEventListener('click', prev);
      btnNext.addEventListener('click', next);
      if (nav.prevLabel) { btnPrev.textContent = nav.prevLabel; btnPrev.title = 'Quay lại (←)'; }
      if (nav.hideNext) btnNext.classList.add('invisible');
    } else {
      btnPrev.classList.add('invisible');
      btnNext.classList.add('invisible');
    }
    footer.classList.remove('d-none');

    // ── Nút X: chỉ bản web ──
    const btnClose = $('.btn-close-display');
    if (opts.showClose) {
      btnClose.classList.remove('d-none');
      btnClose.addEventListener('click', () => onClose());
    }

    return { prev, next, toggleAll, speakWord, speakExample };
  };

  // ==========================================================
  // --- POPUP: điều hướng Trước / Sau + đếm ngược ---
  //   source=auto   : popup tự động (có đếm ngược) — "Từ sau" = từ ngẫu nhiên
  //   source=manual : nút "Xem từ bất kỳ"            — "Từ sau" = từ ngẫu nhiên
  //   source=entry  : click 1 từ trong danh sách     — "Từ sau" = từ kế tiếp trong
  //                   danh sách đang hiển thị (đã lọc) lúc click
  // ==========================================================
  const PENDING_LIST_KEY = 'tuvung_pending_list';

  const _runPopup = async (container, source, closeWin) => {
    const first = await _storageGet(PENDING_KEY);
    if (!first) { mountDisplay(container, null, closeWin); return; }

    const defaults = await _getRevealDefaults();
    const newReveal = () => new Set(defaults);
    const tv = await _getTvTimerSettings();
    const autoSec = source === 'auto' ? tv.autoCloseMs : 0;

    // ── Đếm ngược (chỉ popup tự động); dừng hẳn khi người dùng điều hướng / Hiện-Ẩn ──
    let cdRem = autoSec, cdTimer = null;
    const _cdEl = () => container.querySelector('.display-countdown');
    const _paintCd = () => {
      const el = _cdEl(); if (!el) return;
      if (cdTimer) { el.textContent = cdRem; el.classList.remove('d-none'); }
      else el.classList.add('d-none');
    };
    const stopCountdown = () => {
      if (!cdTimer) return;
      clearInterval(cdTimer); cdTimer = null;
      _paintCd();
    };
    if (autoSec > 0) {
      cdTimer = setInterval(() => {
        cdRem--;
        if (cdRem <= 0) { clearInterval(cdTimer); cdTimer = null; closeWin(); return; }
        _paintCd();
      }, 1000);
    }

    let keys = null;   // phím tắt của màn đang hiển thị
    const showClose = !IS_EXT;
    // Chuyển từ thì dừng đọc của từ cũ
    const _stopSpeech = () => { try { window.speechSynthesis?.cancel(); } catch (_) {} };

    // ── Từ liên kết (gần nghĩa / dễ nhầm) của 1 từ ──
    // Từ đang tắt vẫn hiện (làm mờ) vì đây là phần tham khảo.
    const _loadRelated = async (entry) => {
      const [rels, groups] = await Promise.all([getRelations(), getGroups()]);
      const groupMap = tvBuildGroupMap(groups);
      const out = {};
      for (const t of TV_REL_TYPES) {
        const list = [];
        for (const r of tvRelationsOf(rels, entry.id, t)) {
          const w = await _getByAnyId(r.otherId);
          if (w) list.push({ entry: w, note: r.note, off: !tvIsEligible(w, groupMap, null) });
        }
        out[t] = list;
      }
      return out;
    };

    // ── "Rẽ nhánh" sang từ liên kết: stack các từ đang xem; ← để quay lại ──
    // Khi stack rỗng thì hiển thị từ "gốc" (theo danh sách / ngẫu nhiên) như cũ.
    const detour = [];                 // [{ entry, revealed }]
    let baseRender = () => {};
    let baseEntry  = null;
    let mountSeq   = 0;
    const _short = (t) => { t = String(t || ''); return t.length > 18 ? t.slice(0, 17) + '…' : t; };

    const show = async (entry, revealed, nav) => {
      const seq = ++mountSeq;
      const related = entry ? await _loadRelated(entry).catch(() => ({})) : {};
      if (seq !== mountSeq) return;    // đã chuyển sang từ khác trong lúc chờ
      _stopSpeech();
      keys = mountDisplay(container, entry, closeWin, {
        showClose, revealed, nav, related,
        onInteract: stopCountdown,
        onOpenRelated: async (id) => {
          const e = await _getByAnyId(id);
          if (!e) return;
          detour.push({ entry: e, revealed: newReveal() });
          renderTop();
        },
      });
      _paintCd();
    };

    const renderTop = () => {
      if (!detour.length) { baseRender(); return; }
      const top = detour[detour.length - 1];
      const backTo = detour.length > 1 ? detour[detour.length - 2].entry : baseEntry;
      show(top.entry, top.revealed, {
        hasPrev: true, hasNext: false, hideNext: true,
        prevLabel: `← Quay lại "${_short(backTo?.word)}"`,
        onPrev: () => { detour.pop(); renderTop(); },
        onNext: () => {},
      });
    };

    if (source === 'entry') {
      // ── Theo danh sách ──
      const rawList = await _storageGet(PENDING_LIST_KEY);
      let ids = Array.isArray(rawList) ? rawList.map(String) : [];
      let idx = ids.indexOf(String(first.id));
      if (idx < 0) { ids = [String(first.id)]; idx = 0; }
      const reveals = new Map();                   // id → Set (nhớ trạng thái hiện/ẩn)
      const cache   = new Map([[String(first.id), first]]);

      const _load = async (i) => {
        const id = ids[i];
        if (cache.has(id)) return cache.get(id);
        const e = await _getByAnyId(id);
        if (e) cache.set(id, e);
        return e;
      };
      // Tìm vị trí hợp lệ kế tiếp theo hướng dir (bỏ qua từ đã bị xoá)
      const _seek = async (from, dir) => {
        for (let i = from + dir; i >= 0 && i < ids.length; i += dir) {
          if (await _load(i)) return i;
        }
        return -1;
      };

      const render = () => {
        const id = ids[idx];
        if (!reveals.has(id)) reveals.set(id, newReveal());
        baseEntry = cache.get(id);
        show(baseEntry, reveals.get(id), {
          hasPrev: idx > 0,
          hasNext: idx < ids.length - 1,
          onPrev: async () => { const j = await _seek(idx, -1); if (j >= 0) { idx = j; render(); } },
          onNext: async () => { const j = await _seek(idx, +1); if (j >= 0) { idx = j; render(); } },
        });
      };
      baseRender = render;
      render();
    } else {
      // ── Ngẫu nhiên: lịch sử như TOEIC (stack + pointer), tránh lặp trong phiên ──
      const stack = [{ entry: first, revealed: newReveal() }];
      let ptr = 0;
      const seen = new Set([String(first.id)]);

      const render = () => {
        const cur = stack[ptr];
        baseEntry = cur.entry;
        show(cur.entry, cur.revealed, {
          hasPrev: ptr > 0,
          hasNext: true,
          onPrev: () => { ptr--; render(); },
          onNext: async () => {
            if (ptr < stack.length - 1) { ptr++; render(); return; }
            let e = await getRandom(seen);
            if (!e) return;
            // Đã xem hết mọi từ hợp lệ → bắt đầu vòng mới (cố tránh trùng từ hiện tại)
            if (seen.has(String(e.id))) {
              seen.clear();
              seen.add(String(stack[ptr].entry.id));
              e = (await getRandom(seen)) || e;
              seen.clear();
            }
            seen.add(String(e.id));
            stack.push({ entry: e, revealed: newReveal() });
            ptr = stack.length - 1;
            render();
          },
        });
      };
      baseRender = render;
      render();
    }

    // ── Phím tắt ──
    //   ← / →  : từ trước / từ sau
    //   ↑      : phát âm từ          ↓ : phát âm câu ví dụ
    //   Space  : hiện / ẩn tất cả    Esc: đóng (gắn ở init)
    document.addEventListener('keydown', (e) => {
      if (!keys || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.closest?.('input, textarea')) return;
      switch (e.key) {
        case 'ArrowLeft':  if (keys.prev) { e.preventDefault(); keys.prev(); } break;
        case 'ArrowRight': if (keys.next) { e.preventDefault(); keys.next(); } break;
        case 'ArrowUp':    e.preventDefault(); keys.speakWord();    break;
        case 'ArrowDown':  e.preventDefault(); keys.speakExample(); break;
        case ' ':
        case 'Spacebar':
          e.preventDefault();
          document.activeElement?.blur?.();   // tránh Space "bấm" luôn nút đang focus
          keys.toggleAll();
          break;
      }
    });
  };

  const openAddForm = (prefill = null) => {
    const params = new URLSearchParams({ mode: 'add-form' });
    if (prefill?.word) params.set('word', prefill.word);
    if (prefill?.meaning) params.set('meaning', prefill.meaning);
    const url = `tuvung.html?${params.toString()}`;

    return IS_EXT
      ? chrome.windows.create({ url: chrome.runtime.getURL(url), type: 'popup', width: 980, height: 720, focused: true })
      : (location.href = url);
  };

  // ==========================================================
  // --- MÀN QUẢN LÝ ---
  // ==========================================================
  const PAGE_SIZE = 40;
  const UNSAVED_MSG = 'Dữ liệu bạn vừa nhập chưa được lưu. Vẫn đóng form?';

  const _initManager = async () => {
    const $ = id => document.getElementById(id);
    const r = {
      list: $('wordList'), count: $('wordCount'), search: $('searchInput'),
      empty: $('emptyState'), emptyText: $('emptyText'), sentinel: $('lazySentinel'),
      overlay: $('modalOverlay'), container: $('modalContainer'),
      confirmOver: $('confirmOverlay'), msg: $('confirmMsg'),
      groupFilter: $('groupFilter'), posFilter: $('posFilter'), statusFilter: $('statusFilter'), ynFilter: $('ynFilter'),
      btnBulk: $('btnBulkMode'), bulkBar: $('bulkBar'), bulkCount: $('bulkCount'),
      searchBar: $('searchInput').closest('.mgr-search-bar'),
      btnSearchClear: $('btnSearchClear'), searchBadge: $('searchResultBadge'),
    };

    // Web thường: không có chrome.alarms / cửa sổ background → ẩn khối "Popup tự động".
    // Nút "Xem từ bất kỳ" vẫn dùng getRandom (chọn từ theo bộ lọc màn quản lý).
    if (!IS_EXT) {
      $('tvEnableAutoPopup')?.closest('.form-group')?.classList.add('d-none');
    }

    // ── State ──
    let _words = [], _filtered = [], _wordMap = new Map();
    let _groups = [], _groupMap = new Map();
    let _relText = new Map();                  // id từ → chữ của các từ liên kết (để tìm kiếm)
    let _relTypeMap = new Map();               // id từ → Set loại liên kết đang có
    let _rendered = 0, _delId = null;

    // Bộ lọc: mỗi chiều 1 Set; Set rỗng = không lọc (= chọn tất cả).
    // Lưu vào storage mỗi khi đổi → F5 vẫn còn; popup ngẫu nhiên cũng chọn từ theo bộ lọc này.
    const _f = Object.fromEntries(TV_FILTER_DIMS.map(d => [d, new Set()]));
    const _fGroups = _f.groups, _fPos = _f.pos, _fStatus = _f.status;
    {
      const saved = tvNormalizeFilter(await _storageGet(TV_FILTER_KEY));
      TV_FILTER_DIMS.forEach(d => saved[d].forEach(v => _f[d].add(v)));
    }
    const _saveFilter = () => _storageSet(TV_FILTER_KEY,
      Object.fromEntries(TV_FILTER_DIMS.map(d => [d, [..._f[d]]])));
    // Chip tĩnh trong HTML (Từ loại, Trạng thái): tô lại theo bộ lọc đã lưu
    const _paintStaticChips = () => {
      r.posFilter.querySelectorAll('.chip[data-pos]')
        .forEach(c => c.classList.toggle('chip--active', _fPos.has(c.dataset.pos)));
      r.statusFilter.querySelectorAll('.chip[data-status]')
        .forEach(c => c.classList.toggle('chip--active', _fStatus.has(c.dataset.status)));
    };
    _paintStaticChips();
    let _bulkMode = false;
    const _selected = new Set();               // id dạng chuỗi

    const _byId = (id) => _wordMap.get(String(id));

    // Chỉ đóng modal khi NHẤN và THẢ chuột đều nằm trên overlay.
    // → Kéo chọn text từ trong form ra ngoài rồi thả chuột sẽ KHÔNG đóng modal.
    const _bindOutsideClose = (overlay, onClose) => {
      let downOnSelf = false;
      overlay.addEventListener('mousedown', (e) => { downOnSelf = e.target === overlay; });
      overlay.addEventListener('click', (e) => {
        if (downOnSelf && e.target === overlay) onClose();
        downOnSelf = false;
      });
    };

    // ── Thẻ từ ──
    const _cardHtml = (e) => {
      const gids = tvEffectiveGroupIds(e, _groupMap);
      const off  = e.isActive === false;
      const sel  = _selected.has(String(e.id));
      const tags = gids.map(id => {
        const g = _groupMap.get(id);
        return `<span class="card-group-tag" style="--gc:${_esc(g.color || '#c8a84b')}">${_esc(g.name)}</span>`;
      }).join('');
      return `
        <div class="word-card ${off ? 'word-card--off' : ''} ${sel ? 'word-card--selected' : ''}" data-id="${_esc(e.id)}">
          <span class="card-check">✓</span>
          ${off ? '<span class="card-off-badge">Đang tắt</span>' : ''}
          ${tags ? `<div class="card-groups">${tags}</div>` : ''}
          <div class="card-word">${_esc(e.word)}</div>
          ${e.ipa ? `<div class="card-ipa">${_esc(e.ipa)}</div>` : ''}
          ${(e.example || e.imageUrl) ? `<div class="card-divider"></div>` : ''}
          ${e.example ? `<div class="card-field">${_esc(e.example)}</div>` : ''}
          ${e.imageUrl ? `<img class="card-example-img" src="${_esc(e.imageUrl)}" loading="lazy" />` : ''}
          <div class="card-actions">
            <button class="btn-icon btn-icon-edit" data-id="${_esc(e.id)}" title="Sửa">✏️</button>
            <button class="btn-icon btn-icon-delete" data-id="${_esc(e.id)}" title="Xóa">🗑️</button>
          </div>
        </div>`;
    };

    // ── Lazy render (giống TOEIC) ──
    const _renderMore = () => {
      if (_rendered >= _filtered.length) { r.sentinel.style.display = 'none'; return; }
      const to = Math.min(_rendered + PAGE_SIZE, _filtered.length);
      r.list.insertAdjacentHTML('beforeend', _filtered.slice(_rendered, to).map(_cardHtml).join(''));
      _rendered = to;
      r.sentinel.style.display = _rendered >= _filtered.length ? 'none' : 'block';
    };
    const _observer = new IntersectionObserver(
      ([en]) => { if (en.isIntersecting) _renderMore(); },
      { rootMargin: '300px' }
    );
    _observer.observe(r.sentinel);

    const _resetRender = () => {
      r.list.innerHTML = '';
      _rendered = 0;
      _renderMore();
      r.empty.classList.toggle('d-none', _filtered.length > 0);
      r.emptyText.innerHTML = _words.length
        ? 'Không có từ nào khớp bộ lọc.<br/>Thử bỏ bớt bộ lọc.'
        : 'Chưa có từ vựng nào.<br/>Nhấn <strong>+ Thêm từ mới</strong> để bắt đầu!';
    };

    // Ô tìm có chữ → viền vàng + nền vàng nhạt + số kết quả; có ký tự (kể cả dấu cách) → hiện nút X
    const _paintSearchState = () => {
      const has = !!r.search.value.trim();
      r.searchBar.classList.toggle('mgr-search-bar--active', has);
      r.btnSearchClear.classList.toggle('d-none', !r.search.value);
      r.searchBadge.classList.toggle('d-none', !has);
      if (has) r.searchBadge.textContent = `${_filtered.length} kết quả`;
    };

    // ── Bộ lọc ──
    const applyFilters = () => {
      const q = r.search.value.trim().toLowerCase();
      // Cùng hàm lọc với popup ngẫu nhiên (tuvung_core.js) → 2 bên không lệch nhau
      const ctx = { groupMap: _groupMap, relTypeMap: _relTypeMap, sets: _f };
      _filtered = _words.filter(w => {
        if (!tvMatchFilter(w, ctx)) return false;
        // Tìm "fleeting" cũng ra "ephemeral" nếu 2 từ có liên kết
        if (q && ![w.word, w.meaning, w.example, _relText.get(String(w.id))].some(f => f?.toLowerCase().includes(q))) return false;
        return true;
      });
      r.count.textContent = _filtered.length === _words.length
        ? `${_words.length} từ`
        : `${_filtered.length} / ${_words.length} từ`;
      _paintSearchState();
      _resetRender();
    };

    const renderGroupFilter = () => {
      // Bỏ các nhóm đã bị xoá khỏi bộ lọc đang chọn
      let pruned = false;
      [..._fGroups].forEach(id => { if (id !== TV_NO_GROUP && !_groupMap.has(id)) { _fGroups.delete(id); pruned = true; } });
      if (pruned) _saveFilter();
      const counts = new Map();
      let none = 0;
      _words.forEach(w => {
        const gids = tvEffectiveGroupIds(w, _groupMap);
        if (!gids.length) none++;
        gids.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
      });
      r.groupFilter.innerHTML =
        _groups.map(g => _groupChipHtml(g, _fGroups.has(g.id), '', counts.get(g.id) || 0)).join('') +
        _groupChipHtml(_NO_GROUP_CHIP, _fGroups.has(TV_NO_GROUP), '', none);
    };

    // Hàng lọc Có / Không (Từ gần nghĩa, Từ dễ nhầm lẫn, Ví dụ, Nghĩa ví dụ, Ghi chú, Ảnh)
    const renderYnFilter = () => {
      r.ynFilter.innerHTML = TV_YN_FILTERS.map(d => {
        let yes = 0;
        _words.forEach(w => { if (tvYesNoOf(w, d.key, _relTypeMap) === 'yes') yes++; });
        const btn = (v, label, n) =>
          `<button type="button" class="chip chip--yn ${_f[d.key].has(v) ? 'chip--active' : ''}" data-dim="${d.key}" data-v="${v}">${label} <span class="chip-count">${n}</span></button>`;
        return `<div class="yn-group"><span class="yn-label">${_esc(d.label)}</span>${btn('yes', 'Có', yes)}${btn('no', 'Không', _words.length - yes)}</div>`;
      }).join('');
    };

    const loadData = async () => {
      let relations;
      [_words, _groups, relations] = await Promise.all([getAll(), getGroups(), getRelations()]);
      _wordMap  = new Map(_words.map(w => [String(w.id), w]));
      _groupMap = tvBuildGroupMap(_groups);

      // Chỉ tính liên kết mà cả 2 từ còn tồn tại
      const validRels = relations.filter(x =>
        _wordMap.has(String(x.wordId)) && _wordMap.has(String(x.relatedWordId)));
      _relTypeMap = tvBuildRelTypeMap(validRels);
      _relText = new Map();
      validRels.forEach(x => {
        const a = String(x.wordId), b = String(x.relatedWordId);
        if (a === b || !TV_REL_TYPES.includes(x.type)) return;
        _relText.set(a, (_relText.get(a) || '') + ' ' + _wordMap.get(b).word);
        _relText.set(b, (_relText.get(b) || '') + ' ' + _wordMap.get(a).word);
      });
      // Từ đã bị xoá thì bỏ khỏi danh sách đang chọn
      [..._selected].forEach(id => { if (!_wordMap.has(id)) _selected.delete(id); });
      renderGroupFilter();
      renderYnFilter();
      applyFilters();
      _updateBulkBar();
    };

    const _toggleIn = (set, val, chip) => {
      set.has(val) ? set.delete(val) : set.add(val);
      chip.classList.toggle('chip--active', set.has(val));
      _saveFilter();
      applyFilters();
    };
    r.groupFilter.addEventListener('click', (e) => {
      const c = e.target.closest('.chip'); if (c) _toggleIn(_fGroups, c.dataset.gid, c);
    });
    r.posFilter.addEventListener('click', (e) => {
      const c = e.target.closest('.chip'); if (c) _toggleIn(_fPos, c.dataset.pos, c);
    });
    r.statusFilter.addEventListener('click', (e) => {
      const c = e.target.closest('.chip[data-status]'); if (c) _toggleIn(_fStatus, c.dataset.status, c);
    });
    r.ynFilter.addEventListener('click', (e) => {
      const c = e.target.closest('.chip[data-dim]'); if (c) _toggleIn(_f[c.dataset.dim], c.dataset.v, c);
    });
    $('btnClearFilters').addEventListener('click', () => {
      TV_FILTER_DIMS.forEach(d => _f[d].clear()); r.search.value = '';
      _saveFilter();
      document.querySelectorAll('.filter-section .chip--active:not(#btnBulkMode)')
        .forEach(c => c.classList.remove('chip--active'));
      applyFilters();
    });

    // ── Ô tìm kiếm: nút X xoá nhanh + làm nổi bật khi đang có từ khoá ──
    let searchTimeout;
    const clearSearch = () => {
      clearTimeout(searchTimeout);
      r.search.value = '';
      applyFilters();
      r.search.focus();
    };
    r.search.addEventListener('input', () => {
      _paintSearchState();                       // đổi giao diện ngay, không chờ debounce
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(applyFilters, 250);
    });
    r.btnSearchClear.addEventListener('mousedown', (e) => e.preventDefault());   // không làm mất focus ô tìm
    r.btnSearchClear.addEventListener('click', clearSearch);
    // Esc trong ô tìm: đang có chữ → chỉ xoá chữ (không đóng modal / không thoát chọn nhiều)
    r.search.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && r.search.value) { e.preventDefault(); e.stopPropagation(); clearSearch(); }
    });

    // ── Modal form / xoá ──
    // Theo dõi form thêm/sửa đã bị thay đổi chưa. Container giữ nguyên giữa các lần mở,
    // nên chỉ gắn listener 1 lần và reset cờ mỗi khi mở form.
    const _markDirty = () => { r.container.dataset.dirty = '1'; };
    // Gõ vào ô tìm từ liên kết chưa tính là thay đổi (chọn từ mới tính)
    r.container.addEventListener('input', (e) => { if (!e.target.closest('.rel-search')) _markDirty(); });
    r.container.addEventListener('change', _markDirty);
    r.container.addEventListener('click', (e) => {
      if (e.target.closest('.form-group-chips .chip')) _markDirty();
    });
    const _isFormDirty = () => r.container.dataset.dirty === '1';

    const closeModal = () => {
      r.overlay.classList.remove('active');
      r.container.dataset.dirty = '';
    };
    // Đóng form do click ra ngoài / Esc: có dữ liệu chưa lưu thì hỏi trước.
    // Đi qua nút Hủy của form để gỡ phím tắt Ctrl+S mà mountForm đã gắn.
    const tryCloseModal = () => {
      if (_isFormDirty() && !confirm(UNSAVED_MSG)) return;
      const btnCancel = r.container.querySelector('.btn-cancel');
      btnCancel ? btnCancel.click() : closeModal();
    };
    const openModalForm = (id) => {
      r.container.dataset.dirty = '';
      r.overlay.classList.add('active');
      // Thêm từ mới khi đang lọc theo nhóm → chọn sẵn các nhóm đó
      const defaultGroupIds = id == null ? [..._fGroups].filter(g => g !== TV_NO_GROUP) : [];
      mountForm(r.container, id, () => { closeModal(); loadData(); }, closeModal, { defaultGroupIds });
    };
    const closeConfirm = () => { _delId = null; r.confirmOver.classList.remove('active'); };
    const openConfirm = (id) => {
      _delId = id;
      r.msg.textContent = `Xóa từ "${_byId(id)?.word ?? ''}"?`;
      r.confirmOver.classList.add('active');
    };

    $('btnOpenForm').addEventListener('click', () => openModalForm(null));
    $('btnCancelDelete').addEventListener('click', closeConfirm);
    // Xoá: server trước → thành công mới xoá ở máy → popup kết quả
    $('btnConfirmDelete').addEventListener('click', async () => {
      if (_delId === null) return;
      const btn = $('btnConfirmDelete'), btnNo = $('btnCancelDelete');
      const word = _byId(_delId)?.word ?? '';
      btn.disabled = btnNo.disabled = true; btn.textContent = 'Đang xóa...';
      LoadingModule.show();
      let _loading = true;
      const _hideLoading = () => { if (_loading) { _loading = false; LoadingModule.hide(); } };
      try {
        await remove(_byId(_delId)?.id ?? _delId);
        _hideLoading();
        closeConfirm();
        await loadData();
        await showResult('success', 'Đã xóa từ', `Đã xóa vĩnh viễn từ "${word}" khỏi Server và máy.`, 'tuvung-delete');
      } catch (err) {
        _hideLoading();
        closeConfirm();
        await showResult('error', 'Xóa thất bại',
          `Chưa xóa được từ "${word}" trên Server (${err?.message || err}). Dữ liệu trên máy giữ nguyên.`, 'tuvung-delete');
      } finally {
        _hideLoading();
        btn.disabled = btnNo.disabled = false; btn.textContent = 'Xóa';
      }
    });
    _bindOutsideClose(r.overlay, tryCloseModal);
    _bindOutsideClose(r.confirmOver, closeConfirm);

    // ── Chọn nhiều ──
    const _syncSelectionClasses = () => {
      r.list.querySelectorAll('.word-card').forEach(card =>
        card.classList.toggle('word-card--selected', _selected.has(card.dataset.id)));
    };
    function _updateBulkBar() {
      r.bulkBar.classList.toggle('d-none', !_bulkMode);
      document.body.classList.toggle('has-bulk', _bulkMode);
      r.list.classList.toggle('is-bulk', _bulkMode);
      r.btnBulk.classList.toggle('chip--active', _bulkMode);
      r.bulkCount.textContent = `Đã chọn ${_selected.size} từ`;
      ['bulkClear', 'bulkAddGroup', 'bulkRemoveGroup', 'bulkActivate', 'bulkDeactivate']
        .forEach(id => { $(id).disabled = !_selected.size; });
    }
    const setBulkMode = (on) => {
      _bulkMode = on;
      if (!on) { _selected.clear(); _syncSelectionClasses(); }
      _updateBulkBar();
    };
    r.btnBulk.addEventListener('click', () => setBulkMode(!_bulkMode));
    $('bulkExit').addEventListener('click', () => setBulkMode(false));
    $('bulkClear').addEventListener('click', () => { _selected.clear(); _syncSelectionClasses(); _updateBulkBar(); });
    $('bulkSelectAll').addEventListener('click', () => {
      _filtered.forEach(w => _selected.add(String(w.id)));
      _syncSelectionClasses(); _updateBulkBar();
    });

    // Server trước → thành công mới ghi máy → popup kết quả. Lỗi: giữ nguyên lựa chọn để thử lại.
    let _bulkBusy = false;
    const _runBulk = async (changes, doneMsg) => {
      if (_bulkBusy) return;
      const ids = [..._selected];
      if (!ids.length) return;
      _bulkBusy = true;
      LoadingModule.show();
      let _loading = true;
      const _hideLoading = () => { if (_loading) { _loading = false; LoadingModule.hide(); } };
      try {
        const n = await bulkUpdate(ids, changes);
        _selected.clear();
        await loadData();
        _hideLoading();
        await showResult('success', 'Đã cập nhật', doneMsg(n), 'tuvung-bulk');
      } catch (err) {
        _hideLoading();
        await showResult('error', 'Cập nhật hàng loạt thất bại',
          `Chưa lưu được lên Server (${err?.message || err}). Dữ liệu trên máy không thay đổi, ` +
          `${ids.length} từ vẫn đang được chọn — kiểm tra mạng/mật khẩu rồi thao tác lại.`, 'tuvung-bulk');
      } finally {
        _hideLoading();
        _bulkBusy = false;
      }
    };
    $('bulkActivate').addEventListener('click', () =>
      _runBulk({ setActive: true }, n => `Đã bật ${n} từ.`));
    $('bulkDeactivate').addEventListener('click', () =>
      _runBulk({ setActive: false }, n => `Đã tắt ${n} từ.`));

    // ── Modal chọn nhóm (gán / bỏ nhóm hàng loạt) ──
    const pickOver = $('groupPickOverlay'), pickChips = $('groupPickChips');
    let _pickMode = 'add';
    const openGroupPick = (mode) => {
      if (!_groups.length) { alert('Chưa có nhóm nào. Hãy tạo nhóm trước (nút "Quản lý nhóm" trên thanh tiêu đề).'); return; }
      _pickMode = mode;
      $('groupPickTitle').textContent = mode === 'add' ? 'Gán nhóm' : 'Bỏ nhóm';
      $('groupPickSubtitle').textContent = `${_selected.size} từ đang chọn`;
      $('groupPickHint').textContent = mode === 'add'
        ? 'Từ sẽ được THÊM vào các nhóm đã chọn (giữ nguyên nhóm cũ).'
        : 'Từ sẽ bị GỠ khỏi các nhóm đã chọn (không xoá từ).';
      pickChips.innerHTML = _groups.map(g => _groupChipHtml(g, false, 'chip--settings')).join('');
      pickOver.classList.add('active');
    };
    const closeGroupPick = () => pickOver.classList.remove('active');
    pickChips.addEventListener('click', (e) => {
      const c = e.target.closest('.chip'); if (c) c.classList.toggle('chip--active');
    });
    $('bulkAddGroup').addEventListener('click', () => openGroupPick('add'));
    $('bulkRemoveGroup').addEventListener('click', () => openGroupPick('remove'));
    $('btnCloseGroupPick').addEventListener('click', closeGroupPick);
    $('btnCancelGroupPick').addEventListener('click', closeGroupPick);
    _bindOutsideClose(pickOver, closeGroupPick);
    $('btnConfirmGroupPick').addEventListener('click', async () => {
      const gids = [...pickChips.querySelectorAll('.chip--active')].map(c => c.dataset.gid);
      if (!gids.length) { alert('Chọn ít nhất 1 nhóm.'); return; }
      closeGroupPick();
      const names = gids.map(id => _groupMap.get(id)?.name).join(', ');
      if (_pickMode === 'add') {
        await _runBulk({ addGroupIds: gids }, n => `Đã gán ${n} từ vào: ${names}.`);
      } else {
        await _runBulk({ removeGroupIds: gids }, n => `Đã gỡ ${n} từ khỏi: ${names}.`);
      }
    });

    // ── Click / double-click thẻ ──
    // ── Click thẻ từ: 1 lần = xem chi tiết (popup), đúp = sửa ──
    const DBLCLICK_WAIT_MS = 250;     // thời gian chờ để phân biệt click đơn / click đúp
    let _clickTimer = null;
    const _cancelPendingClick = () => { if (_clickTimer) { clearTimeout(_clickTimer); _clickTimer = null; } };
    // Mở popup chi tiết, kèm danh sách đang hiển thị (đã lọc) để nút Trước / Sau đi theo danh sách
    const _openDetail = (id) => {
      const entry = _byId(id);
      if (!entry) return;
      const listIds = _filtered.map(w => w.id);
      if (IS_EXT) {
        chrome.storage.local.set({ [PENDING_KEY]: entry, [PENDING_LIST_KEY]: listIds }, () => {
          chrome.runtime.sendMessage({ action: 'showTuvungPopupEntry' });
        });
      } else {
        Promise.all([_storageSet(PENDING_KEY, entry), _storageSet(PENDING_LIST_KEY, listIds)])
          .then(() => { location.href = 'tuvung.html?mode=popup&source=entry'; });
      }
    };
    r.list.addEventListener('click', (e) => {
      const card = e.target.closest('.word-card');
      if (_bulkMode) {
        if (!card) return;
        const id = card.dataset.id;
        _selected.has(id) ? _selected.delete(id) : _selected.add(id);
        card.classList.toggle('word-card--selected', _selected.has(id));
        _updateBulkBar();
        return;
      }
      const btnEdit = e.target.closest('.btn-icon-edit');
      const btnDel  = e.target.closest('.btn-icon-delete');
      if (btnEdit) { _cancelPendingClick(); openModalForm(_byId(btnEdit.dataset.id)?.id); return; }
      if (btnDel)  { _cancelPendingClick(); openConfirm(_byId(btnDel.dataset.id)?.id); return; }
      if (!card || e.target.closest('.btn-icon, a, input, button')) return;
      // Click 1 lần → xem chi tiết. Phải chờ một chút để phân biệt với click đúp (→ sửa):
      // lần click thứ 2 của cú click đúp (e.detail >= 2) sẽ huỷ lệnh xem chi tiết đang chờ.
      if (e.detail > 1) { _cancelPendingClick(); return; }
      _cancelPendingClick();
      const id = card.dataset.id;
      _clickTimer = setTimeout(() => { _clickTimer = null; _openDetail(id); }, DBLCLICK_WAIT_MS);
    });
    // Click đúp → mở form sửa
    r.list.addEventListener('dblclick', (e) => {
      if (_bulkMode) return;
      const card = e.target.closest('.word-card');
      if (!card || e.target.closest('.btn-icon, a, input, button')) return;
      _cancelPendingClick();
      window.getSelection?.()?.removeAllRanges();   // bỏ vùng bôi đen do click đúp
      const entry = _byId(card.dataset.id);
      if (entry) openModalForm(entry.id);
    });

    // ── Modal quản lý nhóm ──
    // Thêm / Sửa / Xoá nhóm: server trước → popup kết quả (giống thao tác với từ)
    const groupsOver = $('groupsOverlay'), groupList = $('groupList'), groupForm = $('groupForm');
    const swatches = $('groupColorSwatches');
    let _editingGroupId = null, _pickedColor = TV_GROUP_COLORS[0], _groupBusy = false;

    const _renderSwatches = () => {
      swatches.innerHTML = TV_GROUP_COLORS.map(c =>
        `<button type="button" class="color-swatch ${c === _pickedColor ? 'color-swatch--active' : ''}" data-color="${c}" style="--gc:${c}" title="${c}"></button>`
      ).join('');
    };

    const _resetGroupForm = () => {
      _editingGroupId = null;
      groupForm.reset();
      // Màu mặc định: màu đầu tiên chưa có nhóm nào dùng
      const used = new Set(_groups.map(g => g.color));
      _pickedColor = TV_GROUP_COLORS.find(c => !used.has(c)) || TV_GROUP_COLORS[_groups.length % TV_GROUP_COLORS.length];
      $('btnGroupSubmit').textContent = 'Thêm';
      $('btnGroupCancelEdit').classList.add('d-none');
      _renderSwatches();
      renderGroupList();
    };

    function renderGroupList() {
      if (!_groups.length) {
        groupList.innerHTML = '<div class="group-empty">Chưa có nhóm nào. Nhập tên ở trên để tạo nhóm đầu tiên.</div>';
        return;
      }
      const counts = new Map();
      _words.forEach(w => tvEffectiveGroupIds(w, _groupMap).forEach(id => counts.set(id, (counts.get(id) || 0) + 1)));
      groupList.innerHTML = _groups.map(g => `
        <div class="group-row ${g.id === _editingGroupId ? 'group-row--editing' : ''}"
             data-gid="${_esc(g.id)}" style="--gc:${_esc(g.color || '#c8a84b')}">
          <span class="group-dot"></span>
          <div class="group-info">
            <div class="group-name">${_esc(g.name)}</div>
            <div class="group-meta">${counts.get(g.id) || 0} từ${g.description ? ' · ' + _esc(g.description) : ''}</div>
          </div>
          <div class="group-row-actions">
            <button class="group-icon-btn" data-act="edit" title="Sửa">✏️</button>
            <button class="group-icon-btn group-icon-btn--danger" data-act="delete" title="Xoá nhóm">🗑️</button>
          </div>
        </div>`).join('');
    }

    // Chạy 1 thao tác nhóm: chặn bấm trùng, hiện loading, rồi popup kết quả
    const _runGroupOp = async (fn, okTitle, okMsg, failTitle) => {
      if (_groupBusy) return false;
      _groupBusy = true;
      const btn = $('btnGroupSubmit');
      btn.disabled = true;
      LoadingModule.show();
      let _loading = true;
      const _hideLoading = () => { if (_loading) { _loading = false; LoadingModule.hide(); } };
      try {
        await fn();
        await loadData();
        _hideLoading();
        await showResult('success', okTitle, okMsg, 'tuvung-group');
        return true;
      } catch (err) {
        _hideLoading();
        await showResult('error', failTitle,
          `${err?.message || err}. Dữ liệu trên máy không thay đổi.`, 'tuvung-group');
        return false;
      } finally {
        _hideLoading();
        btn.disabled = false;
        _groupBusy = false;
      }
    };

    const openGroups = () => { _resetGroupForm(); groupsOver.classList.add('active'); groupForm.elements.name.focus(); };
    const closeGroups = () => groupsOver.classList.remove('active');
    $('btnGroups').addEventListener('click', openGroups);
    $('btnCloseGroups').addEventListener('click', closeGroups);
    _bindOutsideClose(groupsOver, closeGroups);
    $('btnGroupCancelEdit').addEventListener('click', _resetGroupForm);

    swatches.addEventListener('click', (e) => {
      const s = e.target.closest('.color-swatch'); if (!s) return;
      _pickedColor = s.dataset.color; _renderSwatches();
    });

    groupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = groupForm.elements.name.value.trim();
      const description = groupForm.elements.description.value;
      const editing = _editingGroupId;
      const ok = await _runGroupOp(
        () => editing
          ? updateGroup(editing, { name, description, color: _pickedColor })
          : addGroup({ name, description, color: _pickedColor }),
        editing ? 'Đã lưu nhóm' : 'Đã thêm nhóm',
        `Nhóm "${name}" đã được lưu lên Server.`,
        editing ? 'Lưu nhóm thất bại' : 'Thêm nhóm thất bại');
      if (ok) _resetGroupForm();
      groupForm.elements.name.focus();
    });

    groupList.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-act]'); if (!btn) return;
      const gid = btn.closest('.group-row').dataset.gid;
      const g = _groupMap.get(gid); if (!g) return;
      const act = btn.dataset.act;
      if (act === 'edit') {
        _editingGroupId = gid;
        groupForm.elements.name.value = g.name;
        groupForm.elements.description.value = g.description || '';
        _pickedColor = g.color || TV_GROUP_COLORS[0];
        $('btnGroupSubmit').textContent = 'Lưu';
        $('btnGroupCancelEdit').classList.remove('d-none');
        _renderSwatches(); renderGroupList();
        groupForm.elements.name.focus();
      } else if (act === 'delete') {
        const n = _words.filter(w => tvEffectiveGroupIds(w, _groupMap).includes(gid)).length;
        if (!confirm(`Xoá nhóm "${g.name}"?\n${n} từ sẽ được gỡ khỏi nhóm này (KHÔNG xoá từ).`)) return;
        const ok = await _runGroupOp(() => deleteGroup(gid),
          'Đã xoá nhóm', `Đã xoá nhóm "${g.name}" và gỡ khỏi ${n} từ trên Server.`, 'Xoá nhóm thất bại');
        if (ok) {
          if (_editingGroupId === gid) _editingGroupId = null;
          _resetGroupForm();
        }
      }
    });

    await loadData();

    // ---- Cài đặt ----
    const settingsOverlay = $('settingsOverlay');
    const chkAutoPopup    = $('tvEnableAutoPopup');
    const inpAutoClose    = $('tvAutoCloseSec');
    const inpTimerMin     = $('tvTimerMinSec');
    const inpTimerMax     = $('tvTimerMaxSec');
    const autoCloseBadge  = $('tvAutoCloseDisplay');
    const timerRangeBadge = $('tvTimerRangeDisplay');
    const popupArea       = $('popupSettingsArea');
    const statusEl2       = $('tvSettingsStatus');
    const timerFill       = $('tvTimerFill');
    const _fmtSec = (s) => s >= 60 ? `${Math.floor(s/60)}p${s%60?` ${s%60}s`:''}` : `${s} giây`;
    const _flashSaved = () => {
      if (!statusEl2) return;
      statusEl2.textContent = '✓ Đã lưu'; statusEl2.style.opacity = '1';
      setTimeout(() => { statusEl2.style.opacity = '0'; }, 1800);
    };

    const _updateBadges = () => {
      if (autoCloseBadge) autoCloseBadge.textContent = _fmtSec(parseInt(inpAutoClose.value));
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
      popupArea.querySelectorAll('input[type="range"]').forEach(el => { el.disabled = !on; });
    };
    if (chkAutoPopup) chkAutoPopup.addEventListener('change', (e) => _applyPopupAreaState(e.target.checked));

    // Công tắc "Trường hiện sẵn khi mở popup" (bật = hiện sẵn; mặc định tắt hết)
    const revealBox = $('tvRevealFields');
    const _renderRevealFields = async () => {
      if (!revealBox) return;
      const on = new Set(await _getRevealDefaults());
      revealBox.innerHTML = TV_DISPLAY_FIELDS.map(f => `
        <div class="tv-setting-row">
          <span class="tv-setting-label-modal">${_esc(f.label)}</span>
          <label class="tv-switch">
            <input type="checkbox" data-field="${f.key}" ${on.has(f.key) ? 'checked' : ''} />
            <span class="tv-slider"></span>
          </label>
        </div>`).join('');
    };
    const _saveRevealFields = async () => {
      const keys = [...revealBox.querySelectorAll('input[data-field]:checked')].map(i => i.dataset.field);
      await _storageSet(TV_REVEAL_KEY, keys);
      _flashSaved();
    };
    revealBox?.addEventListener('change', (e) => { if (e.target.dataset.field) _saveRevealFields(); });
    $('btnRevealAllOn')?.addEventListener('click', () => {
      revealBox.querySelectorAll('input[data-field]').forEach(i => { i.checked = true; });
      _saveRevealFields();
    });
    $('btnRevealAllOff')?.addEventListener('click', () => {
      revealBox.querySelectorAll('input[data-field]').forEach(i => { i.checked = false; });
      _saveRevealFields();
    });

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
      _renderRevealFields();
      settingsOverlay.classList.add('active');
    };
    const closeSettings = () => settingsOverlay.classList.remove('active');
    $('btnSettings').addEventListener('click', openSettings);
    $('btnCloseSettings').addEventListener('click', closeSettings);
    _bindOutsideClose(settingsOverlay, closeSettings);

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
            _flashSaved();
          });
        });
      }, 500);
    };
    if (chkAutoPopup) chkAutoPopup.addEventListener('change', saveSettings);
    [inpAutoClose, inpTimerMin, inpTimerMax].forEach(el => {
      if (el) el.addEventListener('input', () => { _updateBadges(); saveSettings(); });
    });

    // ---- Xem từ bất kỳ (theo bộ lọc màn quản lý) ----
    $('btnDemo').addEventListener('click', async () => {
      if (IS_EXT) { chrome.runtime.sendMessage({ action: 'showTuvungPopup' }); return; }
      const entry = await getRandom();
      if (!entry) { await showResult('error', 'Không có từ phù hợp', 'Không có từ nào đang bật.'); return; }
      await _storageSet(PENDING_KEY, entry);
      location.href = 'tuvung.html?mode=popup&source=manual';
    });

    // ---- Đồng bộ từ Server ----
    const doPull = async () => {
      const dangCo = _words.length;
      const canhBao = dangCo
        ? `Tải dữ liệu từ Server và GHI ĐÈ toàn bộ ${dangCo} từ + danh sách nhóm đang có trên máy?`
        : 'Tải dữ liệu từ vựng từ Server về máy?';
      if (!confirm(canhBao)) return;
      try {
        const data = await pullFromServer();
        await loadData();
        const parts = [`${data.words.length} từ`, data.groups ? `${data.groups.length} nhóm` : null,
          data.relations ? `${data.relations.length} liên kết` : null].filter(Boolean);
        await showResult('success', 'Đồng bộ từ vựng xong',
          `Đã tải ${parts.join(', ')} từ Server về máy.`, 'tuvung-sync');
      } catch (err) {
        await showResult('error', 'Đồng bộ từ vựng thất bại', String(err?.message || err), 'tuvung-sync');
      }
    };
    $('btnPullServer').addEventListener('click', () => {
      StorageModule.get([CACHE_PASS], (res) => {
        const pass = res?.[CACHE_PASS] || '';
        if (!pass) { PasswordModule.openPasswordPopup(() => doPull()); return; }
        doPull();
      });
    });

    // ---- Phím tắt ----
    const _overlays = [pickOver, r.confirmOver, r.overlay, groupsOver, settingsOverlay];
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        r.search.focus();
        r.search.select();
        return;
      }
      if (e.key === 'Escape') {
        // Đóng modal trên cùng, hoặc thoát chế độ chọn nhiều
        const top = _overlays.find(o => o.classList.contains('active'));
        if (top === r.confirmOver) { closeConfirm(); return; }
        if (top === r.overlay) { tryCloseModal(); return; }   // có dữ liệu chưa lưu → hỏi trước
        if (top) { top.classList.remove('active'); return; }
        if (_bulkMode) setBulkMode(false);
      }
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
          // source: 'auto' (mặc định, có đếm ngược) | 'manual' (ngẫu nhiên) | 'entry' (theo danh sách)
          const src = params.get('source');
          const source = (src === 'manual' || src === 'entry') ? src : 'auto';
          await _runPopup(document.getElementById('standaloneContainer'), source, closeWin);
        }
      } else {
        if (sectionManager) {
          sectionManager.classList.remove('d-none');
          _initManager();
        }
      }
    });
  }

  return {
    getAll, getById, add, update, remove, bulkUpdate, getRandom, openAddForm, pullFromServer,
    getRelations, quickAdd,
    getGroups, addGroup, updateGroup, deleteGroup,
  };
})();