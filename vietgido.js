// --- Config ---
const API_URL = 'https://your-api-url.com/submit';
const API_TYPE_URL = 'https://script.google.com/macros/s/AKfycbyTicNGnI3QhPNpnePqZb52jPFdgrMOZeu7CGWDYV3DYV_KUA1SwUwf3xOgSsKgQn4v/exec';
const CACHE_KEY_DANH_MUC = 'selectedDanhMuc';
const CACHE_KEY_AUTO_NEXT = 'autoNextSwitchState';

let entryCount = 0;
const quillInstances = new Map();
let currentCategoryHeaders = null;

// --- DOM helpers ---
const $ = id => document.getElementById(id);
const setBtnContent = (id, text) => { const el = $(id); if (el) el.textContent = text; };

function setChoicesPlaceholder(selectElement, text) {
    if (!selectElement) return;
    const choicesContainer = selectElement.closest('.choices');
    const placeholderEl = choicesContainer?.querySelector('.choices__placeholder');
    if (placeholderEl) {
        placeholderEl.textContent = text;
    }
}

// ==========================================================
// --- CÁC HÀM TRỢ GIÚP (HELPER FUNCTIONS) ---
// ==========================================================

/**
 * Tạo một trình soạn thảo Quill hoàn chỉnh, bao gồm cả lớp bọc và mã sửa lỗi focus.
 * @param {HTMLElement} parentContainer - Element để chứa trình soạn thảo.
 * @param {object} options - Các tùy chọn cho Quill (VD: placeholder).
 * @returns {object} - Trả về đối tượng Quill đã được khởi tạo.
 */
function createQuillEditor(parentContainer, options = {}) {
    const wrapper = document.createElement('div');
    const editorContainer = document.createElement('div');
    editorContainer.className = 'editor-container';
    const editorDiv = document.createElement('div');
    
    editorContainer.appendChild(editorDiv);
    wrapper.appendChild(editorContainer);
    parentContainer.appendChild(wrapper);

    const quillInstance = new Quill(editorDiv, {
        theme: 'snow',
        placeholder: options.placeholder || 'Nhập nội dung...',
        modules: options.modules || { toolbar: [['bold','italic','underline'], [{list:'ordered'},{list:'bullet'}], [{indent:'-1'},{indent:'+1'}], ['clean']] }
    });

    setupQuillFocusFix(quillInstance, wrapper);
    
    return quillInstance;
}

/**
 * [PHIÊN BẢN ĐÚNG]
 * Sửa lỗi focus của Quill bằng logic đơn giản và hiệu quả nhất đã được xác nhận.
 * @param {object} quillInstance - Đối tượng Quill editor.
 * @param {HTMLElement} wrapperElement - Phần tử lớp bọc bên ngoài.
 */
function setupQuillFocusFix(quillInstance, wrapperElement) {
    if (!quillInstance || !wrapperElement) return;

    wrapperElement.addEventListener('click', (e) => {
        // LOGIC ĐÚNG: Nếu mục tiêu click không phải là một dòng chữ (thẻ P),
        // chúng ta giả định đó là vùng trống và thực hiện focus.
        if (e.target.tagName !== 'P') {
            setTimeout(() => {
                quillInstance.focus();
                quillInstance.setSelection(quillInstance.getLength(), 0, 'user');
            }, 0);
        }
    });
}


// --- Storage helpers ---
const isExtensionEnv = () => typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
const getStorage = (keys, cb) => {
  if (isExtensionEnv()) {
    chrome.storage.local.get(keys, cb);
  } else {
    const result = {};
    (Array.isArray(keys) ? keys : [keys]).forEach(k => result[k] = JSON.parse(localStorage.getItem(k) || 'null'));
    cb(result);
  }
};
const setStorage = (obj, cb) => {
  if (isExtensionEnv()) {
    chrome.storage.local.set(obj, cb);
  } else {
    Object.entries(obj).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
    cb && cb();
  }
};


// --- UI Init & Event Handling ---
document.addEventListener('DOMContentLoaded', () => {
  setBtnContent('addBtn', '+');
  setBtnContent('submitBtn', '💾');
  setBtnContent('updateDanhMucBtn', '🔄');

  $('addBtn')?.addEventListener('click', addEntry);
  $('submitBtn')?.addEventListener('click', submitData);
  $('btnSavePass')?.addEventListener('click', savePass);

  $('updateDanhMucBtn')?.addEventListener('click', () => {
    const select = $('danhMucSelect');
    const key = $('txtPass')?.value.trim();

    if (!key) {
        updateCategoriesFromAPI({ force: true });
        return;
    }
    
    setChoicesPlaceholder(select, 'Đang tải...');
    
    updateCategoriesFromAPI({ force: true }).then(success => {
        setChoicesPlaceholder(select, 'Chọn một danh mục...');
        
        if (success) {
            $('addBtn').disabled = false;
            $('submitBtn').disabled = false;
            getStorage('danhMuc', data => {
                const firstCategory = data?.danhMuc?.[0]?.name;
                if (firstCategory && select && select.choices) {
                    select.choices.setChoiceByValue(String(firstCategory));
                }
                
                applyTheme(firstCategory || null);

                buildEntriesForSelected(firstCategory || null);
            });
        } else {
            initDanhMucSelect();
        }
    });
  });

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!target) return;

    const actionButton = target.closest('button');
    if (actionButton) {
        const entryId = actionButton.dataset.entryId;
        if (!entryId) return;

        if (actionButton.classList.contains('remove-entry')) {
            $(`vg-entry-${entryId}`)?.remove();
            Array.from(quillInstances.keys()).forEach(k => {
                if (k.startsWith(`${entryId}-`) || k === String(entryId)) {
                    quillInstances.delete(k);
                }
            });
            updateEntryNumbers();
        }

        if (actionButton.classList.contains('toggle-toolbar')) {
            $(`vg-entry-${entryId}`)?.classList.toggle('no-toolbar');
        }
    }
  });

  // --- START: LOGIC MỚI - LƯU/TẢI TRẠNG THÁI CÔNG TẮC ---
  const autoNextSwitch = $('autoNextTheLoaiBietOnSwtich');
  if (autoNextSwitch) {
    // Tải trạng thái đã lưu khi mở trang
    getStorage(CACHE_KEY_AUTO_NEXT, data => {
        if (data[CACHE_KEY_AUTO_NEXT] !== null && typeof data[CACHE_KEY_AUTO_NEXT] !== 'undefined') {
            autoNextSwitch.checked = data[CACHE_KEY_AUTO_NEXT];
        }
    });
    // Lưu trạng thái khi có thay đổi
    autoNextSwitch.addEventListener('change', (event) => {
        setStorage({ [CACHE_KEY_AUTO_NEXT]: event.target.checked });
    });
  }
  // --- END: LOGIC MỚI ---

  showPass();
  initDanhMucSelect();
});



// --- Theme ---
function applyTheme(selectedValue) {
    const target = document.body;
    if (!target) return;

    target.classList.remove('theme-biet-on', 'theme-thanh-tuu', 'theme-cam-xuc');

    if (selectedValue === 'Biết Ơn') {
        target.classList.add('theme-biet-on');
    } else if (selectedValue === 'Thành Tựu') {
        target.classList.add('theme-thanh-tuu');
    } else if (selectedValue === 'Cảm Xúc') {
        target.classList.add('theme-cam-xuc');
    }
}


// --- Danh Mục (Category) Selection ---
function initDanhMucSelect() {
  const select = $('danhMucSelect');
  if (!select) return;

  if (window.Choices && !select.choices) {
    select.choices = new Choices(select, {
        removeItemButton: false,
        shouldSort: false,
        placeholder: true,
        placeholderValue: 'Chọn một danh mục...',
    });
    select.addEventListener('search', function(event) {
        if (event.detail.value && event.detail.value.toLowerCase() === 'showpass') {
            const divPassword = $('divPassword');
            if (divPassword && divPassword.style.display === 'none') {
                togglePasswordInput();
                $('txtPass')?.focus();
            }
            setTimeout(() => select.choices.clearInput(), 50);
        }
    });
  }

  if (!select.dataset.hasChangeListener) {
    select.addEventListener('change', () => {
      const selectedValue = select.value;
      buildEntriesForSelected(selectedValue);
      applyTheme(selectedValue);
      // --- START: LOGIC MỚI - LƯU DANH MỤC ĐƯỢC CHỌN ---
      setStorage({ [CACHE_KEY_DANH_MUC]: selectedValue });
      // --- END: LOGIC MỚI ---
    });
    select.dataset.hasChangeListener = 'true';
  }

  getStorage('danhMuc', data => {
    const categories = data?.danhMuc || [];
    if (categories.length > 0) {
      populateDanhMucSelectFromData(categories);

      // --- START: LOGIC MỚI - TẢI DANH MỤC ĐÃ LƯU ---
      getStorage(CACHE_KEY_DANH_MUC, cache => {
        const savedDanhMuc = cache[CACHE_KEY_DANH_MUC];
        const firstCategory = categories[0]?.name;
        // Ưu tiên danh mục đã lưu, nếu không có thì dùng danh mục đầu tiên trong danh sách
        const targetDanhMuc = savedDanhMuc && categories.some(c => c.name === savedDanhMuc) ? savedDanhMuc : firstCategory;

        if (targetDanhMuc) {
            buildEntriesForSelected(targetDanhMuc);
            if(select.choices) select.choices.setChoiceByValue(targetDanhMuc);
            applyTheme(targetDanhMuc);
        }
      });
      // --- END: LOGIC MỚI ---
      
      $('addBtn').disabled = false;
      $('submitBtn').disabled = false;
    } else {
      $('entriesContainer').innerHTML = '';
      if (select.choices) {
        select.choices.setChoices([{ value: '', label: 'Cần cập nhật danh sách danh mục', disabled: true }], 'value', 'label', true);
      }
      $('addBtn').disabled = true;
      $('submitBtn').disabled = true;
    }
  });
}

function populateDanhMucSelectFromData(dataArray) {
  const select = $('danhMucSelect');
  if (!select || !select.choices) return;

  const choicesData = (Array.isArray(dataArray) ? dataArray : []).map(item => ({
    value: item?.name || JSON.stringify(item),
    label: item?.name || "Unnamed Category"
  }));
  
  select.choices.setChoices(choicesData, 'value', 'label', true);
}

// --- Entry & Field Creation ---
function buildEntriesForSelected(name) {
  const container = $('entriesContainer');
  if (container) container.innerHTML = '';
  entryCount = 0;
  quillInstances.clear();

  if (!name) {
    currentCategoryHeaders = null;
    addEntry();
    return;
  }
  
  getStorage('danhMuc', data => {
    const categories = data?.danhMuc || [];
    const selectedCategory = categories.find(it => it && it.name === name);
    if (!selectedCategory) {
      currentCategoryHeaders = null;
    } else {
      currentCategoryHeaders = (selectedCategory.header || []).slice().sort((a, b) => (a.index || 0) - (b.index || 0));
    }
    addEntry();
  });
}

function _createFieldNode(entryId, header, fieldIndex) {
  const fieldWrapper = document.createElement('div');
  fieldWrapper.className = 'vg-field';
  fieldWrapper.dataset.headerName = header.name || '';
  fieldWrapper.dataset.headerIndex = header.index || fieldIndex + 1;

  const controlWrap = document.createElement('div');
  controlWrap.className = 'vg-field-control';
  fieldWrapper.appendChild(controlWrap);

  const listData = header.listData || [];

  if (listData.length === 2 && listData.includes('TRUE') && listData.includes('FALSE')) {
    fieldWrapper.classList.add('vg-field--switch');

    const labelText = document.createElement('label');
    labelText.className = 'vg-field-label';
    labelText.textContent = header.name || '';
    
    const switchLabel = document.createElement('label');
    switchLabel.className = 'switch';
    
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = `checkbox-${entryId}-${fieldIndex}`;
    
    labelText.htmlFor = cb.id;

    const slider = document.createElement('span');
    slider.className = 'slider';

    switchLabel.appendChild(cb);
    switchLabel.appendChild(slider);
    controlWrap.appendChild(switchLabel);

    fieldWrapper.appendChild(labelText);
  } else if (listData.length > 0) {
    const sel = document.createElement('select');
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = header.name || 'Chọn giá trị';
    placeholder.disabled = true;
    placeholder.selected = true;
    sel.appendChild(placeholder);
    listData.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o); });
    controlWrap.appendChild(sel);

    sel.addEventListener('change', (e) => {
        const currentField = e.target.closest('.vg-field');
        if (!currentField) return;

        setTimeout(() => {
            let nextField = currentField.nextElementSibling;
            while(nextField && !nextField.classList.contains('vg-field')) {
                nextField = nextField.nextElementSibling;
            }

            if (nextField) {
                const nextSelect = nextField.querySelector('select');
                const nextEditor = nextField.querySelector('.ql-editor');

                if (nextSelect && nextSelect.choices) {
                    nextSelect.choices.showDropdown();
                } else if (nextEditor) {
                    nextEditor.focus();
                }
            }
        }, 0);
    });
    
    setTimeout(() => {
      if (window.Choices && !sel.choices) {
        new Choices(sel, { removeItemButton: false, shouldSort: false });
      }
    }, 50);
  } else {
    const q = createQuillEditor(controlWrap, {
        placeholder: header.name?.trim() || 'Nhập nội dung...'
    });
    quillInstances.set(`${entryId}-${fieldIndex}`, q);
  }
  return fieldWrapper;
}

function addEntry() {
  entryCount++;
  const container = $('entriesContainer');
  if (!container) return;

  const entryDiv = document.createElement('div');
  entryDiv.className = 'vg-entry no-toolbar';
  entryDiv.id = `vg-entry-${entryCount}`;

  entryDiv.innerHTML = `
    <div class="vg-entry-header">
      <div class="vg-entry-number">${container.children.length + 1}</div>
      <div class="vg-entry-actions">
        <button class="toggle-toolbar" data-entry-id="${entryCount}" type="button" aria-label="Hiện/Ẩn thanh công cụ">▤</button>
        <button class="remove-entry" data-entry-id="${entryCount}" type="button" aria-label="Xóa vùng này">X</button>
      </div>
    </div>
    <div class="vg-entry-body"></div>
  `;
  
  const bodyDiv = entryDiv.querySelector('.vg-entry-body');

  if (Array.isArray(currentCategoryHeaders) && currentCategoryHeaders.length) {
    currentCategoryHeaders.forEach((h, idx) => bodyDiv.appendChild(_createFieldNode(entryCount, h, idx)));
  } else {
    const q = createQuillEditor(bodyDiv);
    quillInstances.set(String(entryCount), q);
  }

  container.appendChild(entryDiv);
  updateEntryNumbers();
  
  if ($('autoNextTheLoaiBietOnSwtich')?.checked && $('danhMucSelect')?.value === 'Biết Ơn') {
    const theLoaiHeader = currentCategoryHeaders?.find(h => h.name === 'Thể Loại');
    const options = theLoaiHeader?.listData;

    if (options && options.length > 0) {
      const selectElement = entryDiv.querySelector('.vg-field[data-header-name="Thể Loại"] select');
      
      if (selectElement) {
        const numOptions = options.length;
        const entryIndex = container.children.length;
        const optionIndexToSelect = (entryIndex - 1) % numOptions;
        const valueToSelect = options[optionIndexToSelect];

        selectElement.value = valueToSelect;
        
        const currentField = selectElement.closest('.vg-field');
        setTimeout(() => {
            let nextField = currentField.nextElementSibling;
            while(nextField && !nextField.classList.contains('vg-field')) {
                nextField = nextField.nextElementSibling;
            }
            if (nextField) {
                const nextEditor = nextField.querySelector('.ql-editor');
                if (nextEditor) {
                    nextEditor.focus();
                }
            }
        }, 100);
        return;
      }
    }
  }

  // Logic focus mặc định
  setTimeout(() => {
    const firstEditor = entryDiv.querySelector('.ql-editor');
    if (firstEditor) {
        firstEditor.focus();
    }
  }, 200);
}


function updateEntryNumbers() {
  document.querySelectorAll('.vg-entry-number').forEach((num, i) => {
    num.textContent = i + 1;
  });
}

// --- Password logic ---
function savePass() {
  const pass = $('txtPass')?.value;
  if (!pass) return alert('Vui lòng nhập pass');
  setStorage({ KEY: pass }, togglePasswordInput);
}
function togglePasswordInput() {
  const divPassword = $('divPassword');
  if (divPassword) {
    const isHidden = divPassword.style.display === 'none';
    divPassword.style.display = isHidden ? 'block' : 'none';
    if (isHidden) showPass();
  }
}
function showPass() { getStorage('KEY', r => { if ($('txtPass')) $('txtPass').value = r.KEY || ''; }); }

// --- Data Submission ---
function collectData() {
  const entries = [];
  document.querySelectorAll('.vg-entry').forEach((entry, idx) => {
    const entryId = Number(entry.id.split('-')[2]);
    const fields = [];
    const fieldNodes = entry.querySelectorAll('.vg-field');

    if (fieldNodes.length > 0) {
      fieldNodes.forEach((f, fi) => {
        const headerName = f.dataset.headerName || '';
        const headerIndex = Number(f.dataset.headerIndex);
        if (f.querySelector('.ql-editor')) {
          const q = quillInstances.get(`${entryId}-${fi}`);
          fields.push({ index: headerIndex, name: headerName, type: 'quill', text: q?.getText().trim() || '', html: q?.root.innerHTML || '' });
        } else if (f.querySelector('select')) {
          const sel = f.querySelector('select');
          fields.push({ index: headerIndex, name: headerName, type: 'select', value: sel.value });
        } else if (f.querySelector('input[type=checkbox]')) {
          const cb = f.querySelector('input[type=checkbox]');
          fields.push({ index: headerIndex, name: headerName, type: 'checkbox', checked: cb.checked });
        }
      });
    } else {
      const q = quillInstances.get(String(entryId));
      if (q) fields.push({ index: 1, name: '', type: 'quill', text: q.getText().trim(), html: q.root.innerHTML });
    }
    entries.push({ soThuTu: idx + 1, fields });
  });

  const selectedDanhMuc = $('danhMucSelect')?.value;

  return { 
    tongSoMuc: entries.length, 
    thoiGianTao: new Date().toISOString(), 
    key: $('txtPass')?.value,
    danhMuc: selectedDanhMuc,
    duLieu: entries 
  };
}

function validateData(data) {
  if (data.duLieu.length === 0) return 'Vui lòng thêm ít nhất một vùng!';
  for (let i = 0; i < data.duLieu.length; i++) {
    const ent = data.duLieu[i];
    for (const f of ent.fields) {
      if (f.type === 'quill' && !f.text.trim()) {
        return `Vui lòng nhập nội dung cho vùng ${i + 1}, trường "${f.name || f.index}"!`;
      }
      if (f.type === 'select' && !f.value) {
        return `Vui lòng chọn giá trị cho vùng ${i + 1}, trường "${f.name || f.index}"!`;
      }
    }
  }
  return null;
}

async function submitData() {
  const data = collectData();
  const error = validateData(data);
  if (error) return showNotification(error, 'error');

  const btn = $('submitBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '🔄'; }

  console.log('Submitting data:', data);
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`Lỗi mạng: ${response.statusText}`);
    const result = await response.json();
    if (result?.code === 0) {
      showNotification(result.content || 'Đã lưu thành công!', 'success');
      clearForm();
      showCongrats();
    } else {
      throw new Error(result?.error || 'Lỗi không xác định từ server');
    }
  } catch (err) {
    showNotification(`❌ Lỗi: ${err.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '💾'; }
  }
}

function clearForm() {
  const selectedCategory = $('danhMucSelect')?.value;
  buildEntriesForSelected(selectedCategory);
}

// --- UI Feedback (Notification, Confetti) ---
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  requestAnimationFrame(() => notification.classList.add('show'));
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function showCongrats() {
  const overlay = $('congratsOverlay');
  const canvas = $('confettiCanvas');
  if (!overlay || !canvas) return;
  overlay.style.display = 'flex';
  startConfetti(canvas);
  setTimeout(() => {
    overlay.style.display = 'none';
    stopConfetti();
  }, 2200);
}

let confettiAnimationId = null;
function startConfetti(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa'];
  let particles = Array.from({ length: 100 }, () => ({
    x: Math.random() * canvas.width, y: Math.random() * -canvas.height, r: Math.random() * 6 + 4,
    d: Math.random() * 40 + 10, color: colors[Math.floor(Math.random() * colors.length)],
    tilt: Math.random() * 10 - 10, tiltAngle: 0, tiltAngleIncremental: (Math.random() * 0.07) + 0.05
  }));
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.lineWidth = p.r; ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 3, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.d / 3);
      ctx.stroke();
      p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
      p.x += Math.sin(0.01 * p.d);
      p.tiltAngle += p.tiltAngleIncremental;
      p.tilt = Math.sin(p.tiltAngle) * 15;
      if (p.y > canvas.height) { p.x = Math.random() * canvas.width; p.y = -10; }
    });
    confettiAnimationId = requestAnimationFrame(draw);
  };
  draw();
}
function stopConfetti() {
  if (confettiAnimationId) cancelAnimationFrame(confettiAnimationId);
  const c = $('confettiCanvas');
  if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
}

// --- API for Categories ---
async function updateCategoriesFromAPI(options = {}) {
  const { reloadAfter = false } = options;
  const btn = $('updateDanhMucBtn');

  const key = $('txtPass')?.value.trim();
  if (!key) {
      return false;
  }

  if (btn) { btn.disabled = true; }

  try {
    const response = await fetch(API_TYPE_URL, {
      method: 'POST',
      body: JSON.stringify({ key })
    });
    if (!response.ok) throw new Error(`Lỗi mạng: ${response.statusText}`);
    const resp = await response.json();

    if (resp?.code !== 0) {
      throw new Error(resp?.error || 'Server trả về lỗi nhưng không có thông báo.');
    }

    let payload = resp.content;
    if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch (e) { throw new Error('Dữ liệu từ server không hợp lệ.'); }
    }
    if (!Array.isArray(payload)) {
      throw new Error('Dữ liệu trả về không phải là một danh sách.');
    }
    
    setStorage({ danhMuc: payload }, () => {
      showNotification('Đã cập nhật danh sách danh mục!', 'success');
      populateDanhMucSelectFromData(payload);
      if (reloadAfter) setTimeout(() => location.reload(), 400);
    });
    return true;

  } catch (err) {
    showNotification(`Lỗi: ${err.message}`, 'error');
    return false;
  } finally {
    if (btn) { btn.disabled = false; }
  }
}