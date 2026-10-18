// ================================================================
// TUVUNG_CORE.JS — Logic dùng chung giữa tuvung.js và background.js
// (nhóm từ vựng + quy tắc chọn từ cho popup). Chỉ sửa ở đây để
// 2 phía không bao giờ lệch nhau.
// ================================================================

// Danh sách nhóm: [{ id, name, color, description }]
// (Đã bỏ bật/tắt nhóm và thứ tự nhóm — nhóm chỉ dùng để phân loại / lọc)
export const TV_GROUPS_KEY       = 'tuvung_groups';
// Id giả đại diện cho "Chưa phân nhóm"
export const TV_NO_GROUP         = '__none__';

export const TV_GROUP_COLORS = [
  '#c8a84b', '#2980b9', '#8e44ad', '#16a085',
  '#e67e22', '#c0392b', '#27ae60', '#7f8c8d',
];

/** Chuẩn hoá mảng groupIds: nhận mảng hoặc chuỗi "a,b", bỏ rỗng + trùng */
export const tvNormalizeGroupIds = (v) => {
  const arr = Array.isArray(v) ? v : String(v || '').split(',');
  return [...new Set(arr.map(x => String(x || '').trim()).filter(Boolean))];
};

/** Map id → group, để tra nhanh */
export const tvBuildGroupMap = (groups) =>
  new Map((groups || []).map(g => [String(g.id), g]));

/**
 * Nhóm "thực" của 1 từ (bỏ id của nhóm đã bị xoá).
 * Trả về [] nếu từ chưa thuộc nhóm nào → coi như TV_NO_GROUP.
 */
export const tvEffectiveGroupIds = (word, groupMap) =>
  tvNormalizeGroupIds(word?.groupIds).filter(id => groupMap.has(id));

/**
 * Từ có được đưa vào popup không?
 *  - Từ phải đang bật (isActive)
 *  - selected rỗng/null: không giới hạn theo nhóm
 *  - selected khác rỗng: từ chưa phân nhóm cần có TV_NO_GROUP trong selected;
 *    từ có nhóm cần thuộc ít nhất 1 nhóm trong selected
 * @param {Set<string>|null} selected  null/rỗng = không giới hạn theo nhóm
 */
export const tvIsEligible = (word, groupMap, selected) => {
  if (!word || word.isActive === false) return false;
  const hasSel = selected && selected.size > 0;
  if (!hasSel) return true;
  const gids = tvEffectiveGroupIds(word, groupMap);
  if (!gids.length) return selected.has(TV_NO_GROUP);
  return gids.some(id => selected.has(id));
};

/** Sắp xếp nhóm theo tên (A → Z, theo tiếng Việt) */
export const tvSortGroups = (groups) =>
  [...(groups || [])].sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), 'vi', { sensitivity: 'base' }));

// ================================================================
// LIÊN KẾT TỪ: gần nghĩa (synonym) / dễ nhầm lẫn (confusing)
// Danh sách liên kết lưu ở storage key TV_RELATIONS_KEY:
//   [{ id, type, wordId, relatedWordId, note }]
// Quan hệ 2 CHIỀU: mỗi cặp chỉ 1 bản ghi, đọc theo cả 2 phía
// (A gần nghĩa B ⇒ mở B cũng thấy A).
// ================================================================
export const TV_RELATIONS_KEY = 'tuvung_relations';
export const TV_REL_SYNONYM   = 'synonym';
export const TV_REL_CONFUSING = 'confusing';
export const TV_REL_TYPES     = [TV_REL_SYNONYM, TV_REL_CONFUSING];

/** Liên kết r có dính tới từ wordId không (ở phía nào cũng được) */
export const tvRelInvolves = (r, wordId) => {
  const id = String(wordId);
  return String(r?.wordId) === id || String(r?.relatedWordId) === id;
};

/**
 * Các liên kết của 1 từ (theo cả 2 chiều), bỏ trùng + bỏ tự liên kết.
 * @param {string|null} type  null = mọi loại
 * @returns [{ relId, type, otherId, note }]
 */
export const tvRelationsOf = (relations, wordId, type = null) => {
  const id = String(wordId);
  const out = [], seen = new Set();
  (relations || []).forEach(r => {
    if (!r || (type && r.type !== type) || !TV_REL_TYPES.includes(r.type)) return;
    const a = String(r.wordId), b = String(r.relatedWordId);
    const other = a === id ? b : (b === id ? a : null);
    if (!other || other === id) return;
    const key = r.type + '|' + other;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ relId: r.id, type: r.type, otherId: other, note: String(r.note || '') });
  });
  return out;
};

// ================================================================
// BỘ LỌC MÀN QUẢN LÝ — lưu ở storage (TV_FILTER_KEY) để F5 vẫn còn,
// đồng thời là bộ lọc chọn từ cho POPUP NGẪU NHIÊN (tuvung.js + background.js).
// Mỗi chiều lọc là 1 mảng giá trị đã chọn. Mảng rỗng = KHÔNG lọc (= chọn tất cả).
// Trong cùng 1 chiều: khớp BẤT KỲ giá trị đã chọn. Giữa các chiều: phải khớp TẤT CẢ.
//   groups : id nhóm | TV_NO_GROUP
//   pos    : từ loại | TV_NO_GROUP ("Chưa rõ")
//   status : 'on' | 'off'
//   syn, conf, example, exampleMeaning, note, image : 'yes' | 'no'
// ================================================================
export const TV_FILTER_KEY = 'tvManagerFilter';
export const TV_FILTER_DIMS = ['groups', 'pos', 'status', 'syn', 'conf', 'example', 'exampleMeaning', 'note', 'image'];

// Các chiều lọc dạng Có / Không: key → cách kiểm tra "có giá trị"
export const TV_YN_FILTERS = [
  { key: 'syn',            label: 'Từ gần nghĩa' },
  { key: 'conf',           label: 'Từ dễ nhầm lẫn' },
  { key: 'example',        label: 'Ví dụ',        field: 'example' },
  { key: 'exampleMeaning', label: 'Nghĩa ví dụ',  field: 'exampleMeaning' },
  { key: 'note',           label: 'Ghi chú',      field: 'note' },
  { key: 'image',          label: 'Ảnh',          field: 'imageUrl' },
];

/** Chuẩn hoá object lọc đọc từ storage → { dim: string[] } đủ mọi chiều */
export const tvNormalizeFilter = (raw) => {
  const out = {};
  TV_FILTER_DIMS.forEach(d => {
    const v = raw && Array.isArray(raw[d]) ? raw[d] : [];
    out[d] = [...new Set(v.map(x => String(x)))];
  });
  return out;
};

/** Có chiều nào đang lọc không */
export const tvFilterIsActive = (filter) =>
  TV_FILTER_DIMS.some(d => (filter?.[d] || []).length > 0);

/** Map id từ → Set loại liên kết đang có (theo cả 2 chiều) */
export const tvBuildRelTypeMap = (relations) => {
  const m = new Map();
  const add = (id, t) => { if (!m.has(id)) m.set(id, new Set()); m.get(id).add(t); };
  (relations || []).forEach(r => {
    if (!r || !TV_REL_TYPES.includes(r.type)) return;
    const a = String(r.wordId), b = String(r.relatedWordId);
    if (!a || !b || a === b) return;
    add(a, r.type); add(b, r.type);
  });
  return m;
};

/**
 * Chuẩn bị ngữ cảnh lọc (tính 1 lần, dùng cho cả kho).
 * @param {{groups, relations, filter}} p   relTypeMap có thể truyền sẵn để tái dùng
 */
export const tvBuildFilterCtx = ({ groups, relations, filter, relTypeMap }) => {
  const f = tvNormalizeFilter(filter);
  const sets = {};
  TV_FILTER_DIMS.forEach(d => { sets[d] = new Set(f[d]); });
  return {
    groupMap: tvBuildGroupMap(groups),
    relTypeMap: relTypeMap || tvBuildRelTypeMap(relations),
    sets,
    active: tvFilterIsActive(f),
  };
};

/** Giá trị Có/Không của 1 từ theo chiều key */
export const tvYesNoOf = (word, key, relTypeMap) => {
  if (key === 'syn' || key === 'conf') {
    const t = relTypeMap?.get(String(word?.id));
    return t && t.has(key === 'syn' ? TV_REL_SYNONYM : TV_REL_CONFUSING) ? 'yes' : 'no';
  }
  const def = TV_YN_FILTERS.find(x => x.key === key);
  return def && String(word?.[def.field] ?? '').trim() ? 'yes' : 'no';
};

/** Từ có khớp bộ lọc không. skipDims: bỏ qua một số chiều (vd ['groups'] khi popup tự xử lý nhóm) */
export const tvMatchFilter = (word, ctx, skipDims = null) => {
  if (!word || !ctx) return false;
  const s = ctx.sets;
  const skip = (d) => skipDims && skipDims.includes(d);
  if (!skip('groups') && s.groups.size) {
    const gids = tvEffectiveGroupIds(word, ctx.groupMap);
    const ok = gids.length ? gids.some(id => s.groups.has(id)) : s.groups.has(TV_NO_GROUP);
    if (!ok) return false;
  }
  if (!skip('pos') && s.pos.size && !s.pos.has(word.partOfSpeech || TV_NO_GROUP)) return false;
  if (!skip('status') && s.status.size && !s.status.has(word.isActive === false ? 'off' : 'on')) return false;
  for (const { key } of TV_YN_FILTERS) {
    if (skip(key) || !s[key].size) continue;
    if (!s[key].has(tvYesNoOf(word, key, ctx.relTypeMap))) return false;
  }
  return true;
};

/**
 * Từ có được đưa vào POPUP NGẪU NHIÊN không:
 *  - Quy tắc nền (tvIsEligible): từ đang bật, nhóm lấy theo bộ lọc "Nhóm" ở màn quản lý
 *  - Và khớp các chiều lọc còn lại của màn quản lý
 */
export const tvIsPopupEligible = (word, ctx) =>
  tvIsEligible(word, ctx.groupMap, ctx.sets.groups) && tvMatchFilter(word, ctx, ['groups']);
