// === CONFIG ===
const API = 'https://script.google.com/macros/s/AKfycbzxkH-kuFG-USCxrvUUbBfnu1f26CI4iP7ZVkVAt2azjHmKh_SNixJsvXDFX3-cC-C6Vg/exec';
const CACHE_DANH_MUC = 'selectedDanhMuc';
const CACHE_AUTO_NEXT = 'autoNextSwitchState';

// === STATE ===
let entryCount = 0;
const quillInstances = new Map();
let currentCategoryConfig = null; // Lưu toàn bộ config của category đang chọn

// === HELPERS ===
const $ = id => document.getElementById(id);

const storage = {
  isExtension: () => typeof chrome !== 'undefined' && chrome.storage?.local,
  
  get: (keys, cb) => {
    if (storage.isExtension()) {
      chrome.storage.local.get(keys, cb);
    } else {
      const result = {};
      (Array.isArray(keys) ? keys : [keys]).forEach(k => 
        result[k] = JSON.parse(localStorage.getItem(k) || 'null')
      );
      cb(result);
    }
  },
  
  set: (obj, cb) => {
    if (storage.isExtension()) {
      chrome.storage.local.set(obj, cb);
    } else {
      Object.entries(obj).forEach(([k, v]) => 
        localStorage.setItem(k, JSON.stringify(v))
      );
      cb?.();
    }
  }
};

// === QUILL EDITOR ===
function createQuillEditor(container, placeholder = 'Nhập nội dung...') {
  const wrapper = document.createElement('div');
  const editorDiv = document.createElement('div');
  editorDiv.className = 'editor-container';
  
  wrapper.appendChild(editorDiv);
  container.appendChild(wrapper);

  const quill = new Quill(editorDiv, {
    theme: 'snow',
    placeholder,
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ indent: '-1' }, { indent: '+1' }],
        ['clean']
      ]
    }
  });

  // Fix focus issue
  wrapper.addEventListener('click', e => {
    if (e.target.tagName !== 'P') {
      setTimeout(() => {
        quill.focus();
        quill.setSelection(quill.getLength(), 0, 'user');
      }, 0);
    }
  });

  return quill;
}

// === THEME ===
// NEW: Thêm một thẻ <style> vào <head> để chứa style động
let dynamicThemeStyle = document.getElementById('dynamic-theme-style');
if (!dynamicThemeStyle) {
  dynamicThemeStyle = document.createElement('style');
  dynamicThemeStyle.id = 'dynamic-theme-style';
  document.head.appendChild(dynamicThemeStyle);
}

// UPDATED: Thêm logic đặc biệt để tô màu cho emoji trái tim đỏ
function generateEmojiBackground(emojis) {
  if (!emojis) return 'none';

  const emojiArray = [...emojis];

  // --- Cấu hình cho tile ---
  const TILE_SIZE = 400;
  const EMOJI_COUNT = 8;
  const MAX_TRIES = 20;

  const placedEmojis = [];

  const isColliding = (rect1, rect2) => {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  };

  for (let i = 0; i < EMOJI_COUNT; i++) {
    let currentEmoji, tries = 0;
    
    while (tries < MAX_TRIES) {
      const fontSize = Math.floor(Math.random() * 30) + 25;
      const angle = Math.floor(Math.random() * 70) - 35;
      const opacity = (Math.random() * 0.4 + 0.3).toFixed(2);
      
      const rect = {
        x: Math.random() * (TILE_SIZE - fontSize),
        y: Math.random() * (TILE_SIZE - fontSize),
        width: fontSize + 10,
        height: fontSize + 10,
      };

      let hasCollision = false;
      for (const placed of placedEmojis) {
        if (isColliding(rect, placed.rect)) {
          hasCollision = true;
          break;
        }
      }

      if (!hasCollision) {
        const randomEmoji = emojiArray[Math.floor(Math.random() * emojiArray.length)];

        currentEmoji = {
          rect: rect,
          emoji: randomEmoji,
          x: rect.x + fontSize / 2,
          y: rect.y + fontSize / 2,
          fontSize: fontSize,
          angle: angle,
          opacity: opacity,
        };
        placedEmojis.push(currentEmoji);
        break;
      }
      
      tries++;
    }
  }

  const textElements = placedEmojis
    .map(p => {
      // 💡 LOGIC MỚI BẮT ĐẦU TỪ ĐÂY
      // Kiểm tra xem emoji có phải là trái tim không
      const isRedHeart = (p.emoji === '❤️' || p.emoji === '❤');
      // Nếu là trái tim, thêm thuộc tính fill="red". Nếu không, để trống.
      const fillAttribute = isRedHeart ? 'fill="red"' : '';

      return `<text x="${p.x}" y="${p.y}" font-size="${p.fontSize}" opacity="${p.opacity}" transform="rotate(${p.angle} ${p.x} ${p.y})" text-anchor="middle" dominant-baseline="central" ${fillAttribute}>${p.emoji}</text>`;
      // 💡 KẾT THÚC LOGIC MỚI
    })
    .join('');

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${TILE_SIZE}' height='${TILE_SIZE}'>${textElements}</svg>`;

  const encodedSvg = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');

  return `url("data:image/svg+xml,${encodedSvg}")`;
}

// NEW HELPER: Hàm chuyển đổi mã màu HEX sang RGBA
function hexToRgba(hex, alpha = 1) {
  if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    return hex; // Trả về màu ban đầu nếu không phải là mã hex hợp lệ
  }

  let c = hex.substring(1).split('');
  if (c.length === 3) {
    c = [c[0], c[0], c[1], c[1], c[2], c[2]];
  }
  c = '0x' + c.join('');
  
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// UPDATED: Truyền cả chuỗi emoji vào hàm generateEmojiBackground
function applyTheme(categoryConfig) {
  document.body.className = document.body.className.replace(/theme-\S+/g, '');

  if (!categoryConfig) {
    dynamicThemeStyle.innerHTML = '';
    return;
  }

  const baseColor = categoryConfig.color || '#ffffff';
  // 💡 DÒNG THAY ĐỔI: Lấy cả chuỗi emojis thay vì chỉ ký tự đầu tiên
  const emojis = categoryConfig.emojis || null;

  const gradientLayer = `linear-gradient(to right, ${baseColor}, ${hexToRgba(baseColor, 0)}, ${baseColor})`;
  // 💡 DÒNG THAY ĐỔI: Truyền cả chuỗi 'emojis'
  const emojiLayer = generateEmojiBackground(emojis);

  const finalBackgroundImage = emojiLayer !== 'none' 
    ? `${emojiLayer}, ${gradientLayer}` 
    : gradientLayer;

  const cssRule = `
    body {
      background-image: ${finalBackgroundImage} !important;
      background-repeat: repeat, repeat !important;
      background-color: #f5f5f5 !important;
    }
  `;
  
  dynamicThemeStyle.innerHTML = cssRule;
}

// === CATEGORY SELECT ===
function initDanhMucSelect() {
  const select = $('danhMucSelect');
  if (!select) return;

  // Initialize Choices.js
  if (window.Choices && !select.choices) {
    select.choices = new Choices(select, {
      removeItemButton: false,
      shouldSort: false,
      placeholder: true,
      placeholderValue: 'Chọn một danh mục...'
    });

    // Easter egg: type "showpass" to reveal password input
    select.addEventListener('search', e => {
      if (e.detail.value?.toLowerCase() === 'showpass') {
        togglePasswordInput();
        $('txtPass')?.focus();
        setTimeout(() => select.choices.clearInput(), 50);
      }
    });
  }

  // Handle category change
  if (!select.dataset.hasChangeListener) {
    select.addEventListener('change', () => {
      const value = select.value;
      buildEntriesForSelected(value);
      storage.get('danhMuc', data => { // MODIFIED: Lấy config để apply theme
        const categories = data?.danhMuc || [];
        const category = categories.find(c => c.table === value);
        applyTheme(category);
      });
      storage.set({ [CACHE_DANH_MUC]: value });
    });
    select.dataset.hasChangeListener = 'true';
  }

  // Load categories
  storage.get('danhMuc', data => {
    const categories = data?.danhMuc || [];
    
    if (categories.length > 0) {
      populateCategories(categories);
      
      // Load saved or first category
      storage.get(CACHE_DANH_MUC, cache => {
        const saved = cache[CACHE_DANH_MUC];
        const firstCategory = categories[0];
        const targetCategory = categories.find(c => c.table === saved) || firstCategory;

        if (targetCategory) { // MODIFIED: Dùng targetCategory
          buildEntriesForSelected(targetCategory.table);
          select.choices?.setChoiceByValue(targetCategory.table);
          applyTheme(targetCategory); // MODIFIED: Truyền cả object config
        }
      });
      
      $('addBtn').disabled = false;
      $('submitBtn').disabled = false;
    } else {
      $('entriesContainer').innerHTML = '';
      select.choices?.setChoices([{
        value: '',
        label: 'Cần cập nhật danh sách danh mục',
        disabled: true
      }], 'value', 'label', true);
      
      $('addBtn').disabled = true;
      $('submitBtn').disabled = true;
    }
  });
}

// UPDATED: Sửa lỗi duplicate giá trị khi cập nhật danh mục
function populateCategories(categories) {
  const select = $('danhMucSelect');
  if (!select?.choices) return;

  // DÒNG THÊM VÀO ĐỂ SỬA LỖI
  // Dọn dẹp hoàn toàn danh sách lựa chọn và các mục đã chọn trước khi thêm mới
  select.choices.clearStore();

  const choices = categories.map(c => ({
    value: c?.table || '',
    label: c?.table || 'Unnamed Category'
  }));
  
  // Tham số cuối `true` (replaceChoices) sẽ xóa các lựa chọn cũ, 
  // nhưng clearStore() đảm bảo dọn dẹp triệt để hơn.
  select.choices.setChoices(choices, 'value', 'label', true);
}

// === ENTRY CREATION ===
function buildEntriesForSelected(categoryName) {
  const container = $('entriesContainer');
  if (container) container.innerHTML = '';
  
  entryCount = 0;
  quillInstances.clear();

  if (!categoryName) {
    currentCategoryConfig = null;
    addEntry();
    return;
  }

  storage.get('danhMuc', data => {
    const categories = data?.danhMuc || [];
    const category = categories.find(c => c?.table === categoryName);
    
    if (!category) {
      currentCategoryConfig = null;
    } else {
      // Lưu toàn bộ config và sort headers theo stt
      currentCategoryConfig = {
        ...category,
        header: (category.header || []).slice().sort((a, b) => {
          const sttA = parseInt(a.stt) || 0;
          const sttB = parseInt(b.stt) || 0;
          return sttA - sttB;
        })
      };
    }
    
    addEntry();
  });
}

// UPDATED: Sửa đổi hàm createField
function createField(entryId, headerConfig, fieldIndex) {
  const field = document.createElement('div');
  field.className = 'vg-field';
  field.dataset.headerColumn = headerConfig.column || '';
  field.dataset.headerStt = headerConfig.stt || fieldIndex + 1;
  field.dataset.headerType = headerConfig.type || 'text';
  // NEW: Lưu trạng thái required vào dataset
  field.dataset.headerRequired = headerConfig.required || false; 

  const control = document.createElement('div');
  control.className = 'vg-field-control';
  field.appendChild(control);

  const type = headerConfig.type || 'text';
  const columnName = headerConfig.column || '';
  const isRequired = headerConfig.required || false;

  // Checkbox/Switch
  if (type === 'checkbox') {
    field.classList.add('vg-field--switch');

    const label = document.createElement('label');
    label.className = 'vg-field-label';
    label.textContent = columnName;

    // NEW: Thêm dấu * nếu bắt buộc
    if (isRequired) {
      const requiredSpan = document.createElement('span');
      requiredSpan.className = 'required-indicator';
      requiredSpan.textContent = '*';
      label.appendChild(requiredSpan);
    }
    
    const switchLabel = document.createElement('label');
    switchLabel.className = 'switch';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `checkbox-${entryId}-${fieldIndex}`;
    label.htmlFor = checkbox.id;

    const slider = document.createElement('span');
    slider.className = 'slider';

    switchLabel.append(checkbox, slider);
    control.appendChild(switchLabel);
    field.appendChild(label);
  }
  // Selectbox
  else if (type === 'selectbox') {
    const select = document.createElement('select');
    const placeholder = document.createElement('option');
    placeholder.value = '';
    // NEW: Thêm dấu * vào placeholder
    placeholder.textContent = columnName + (isRequired ? ' *' : '');
    placeholder.disabled = true;
    placeholder.selected = true;
    
    select.appendChild(placeholder);
    
    const setValues = (headerConfig.set || '')
      .split(';')
      .map(v => v.trim())
      .filter(v => v);
    
    setValues.forEach(v => {
      const option = document.createElement('option');
      option.value = option.textContent = v;
      select.appendChild(option);
    });
    
    control.appendChild(select);

    select.addEventListener('change', e => {
      const currentField = e.target.closest('.vg-field');
      setTimeout(() => {
        let next = currentField?.nextElementSibling;
        while (next && !next.classList.contains('vg-field')) {
          next = next.nextElementSibling;
        }
        
        if (next) {
          const nextSelect = next.querySelector('select');
          const nextEditor = next.querySelector('.ql-editor');
          
          if (nextSelect?.choices) {
            nextSelect.choices.showDropdown();
          } else if (nextEditor) {
            nextEditor.focus();
          }
        }
      }, 0);
    });

    setTimeout(() => {
      if (window.Choices && !select.choices) {
        new Choices(select, { removeItemButton: false, shouldSort: false });
      }
    }, 50);
  }
  // Text (Quill editor)
  else {
    // NEW: Thêm dấu * vào placeholder
    const placeholderText = columnName + (isRequired ? ' *' : '');
    const quill = createQuillEditor(control, placeholderText);
    quillInstances.set(`${entryId}-${fieldIndex}`, quill);
  }

  return field;
}

function addEntry() {
  entryCount++;
  const container = $('entriesContainer');
  if (!container) return;

  const entry = document.createElement('div');
  entry.className = 'vg-entry no-toolbar';
  entry.id = `vg-entry-${entryCount}`;
  entry.innerHTML = `
    <div class="vg-entry-header">
      <div class="vg-entry-number">${container.children.length + 1}</div>
      <div class="vg-entry-actions">
        <button class="toggle-toolbar" data-entry-id="${entryCount}" type="button">▤</button>
        <button class="remove-entry" data-entry-id="${entryCount}" type="button">X</button>
      </div>
    </div>
    <div class="vg-entry-body"></div>
  `;

  const body = entry.querySelector('.vg-entry-body');

  // Add fields based on category config
  if (currentCategoryConfig?.header?.length) {
    currentCategoryConfig.header.forEach((h, i) => {
      body.appendChild(createField(entryCount, h, i));
    });
  } else {
    const quill = createQuillEditor(body);
    quillInstances.set(String(entryCount), quill);
  }

  container.appendChild(entry);
  updateEntryNumbers();

  // Auto-select "Danh Mục" for "Biết Ơn" category (giữ nguyên logic cũ nhưng dùng field mới)
  const categoryName = $('danhMucSelect')?.value;
  if ($('autoNextTheLoaiBietOnSwtich')?.checked && categoryName === 'Biết Ơn') {
    // Tìm field "Danh Mục" (trước đây là "Thể Loại")
    const danhMucHeader = currentCategoryConfig?.header?.find(h => h.column === 'Danh Mục');
    
    if (danhMucHeader?.type === 'selectbox') {
      const setValues = (danhMucHeader.set || '')
        .split(';')
        .map(v => v.trim())
        .filter(v => v);

      if (setValues.length > 0) {
        const select = entry.querySelector('.vg-field[data-header-column="Danh Mục"] select');
        
        if (select) {
          const entryIndex = container.children.length;
          const optionIndex = (entryIndex - 1) % setValues.length;
          select.value = setValues[optionIndex];

          // Focus next field
          setTimeout(() => {
            const currentField = select.closest('.vg-field');
            let next = currentField?.nextElementSibling;
            while (next && !next.classList.contains('vg-field')) {
              next = next.nextElementSibling;
            }
            next?.querySelector('.ql-editor')?.focus();
          }, 100);
          return;
        }
      }
    }
  }

  // Default focus
  setTimeout(() => entry.querySelector('.ql-editor')?.focus(), 200);
}

function updateEntryNumbers() {
  document.querySelectorAll('.vg-entry-number').forEach((num, i) => {
    num.textContent = i + 1;
  });
}

// UPDATED: Chuyển thành hàm async để lấy 'id' từ cache
async function collectData() {
  // Dùng Promise để xử lý việc đọc cache bất đồng bộ
  return new Promise(resolve => {
    const selectedCategoryName = $('danhMucSelect')?.value;

    // Đọc cache để lấy danh sách đầy đủ các danh mục
    storage.get('danhMuc', cacheData => {
      const categories = cacheData?.danhMuc || [];
      // Tìm danh mục đang được chọn để lấy id
      const selectedCategory = categories.find(c => c.table === selectedCategoryName);
      const categoryId = selectedCategory ? selectedCategory.id : null;

      // --- Phần thu thập dữ liệu còn lại giữ nguyên như cũ ---
      const entries = [];
      document.querySelectorAll('.vg-entry').forEach((entry, idx) => {
        const entryId = Number(entry.id.split('-')[2]);
        const fields = [];
        const fieldNodes = entry.querySelectorAll('.vg-field');

        if (fieldNodes.length > 0) {
          fieldNodes.forEach((f, fi) => {
            const column = f.dataset.headerColumn || '';
            const type = f.dataset.headerType || 'text';
            let fieldValue;

            if (type === 'text') {
              const quill = quillInstances.get(`${entryId}-${fi}`);
              fieldValue = quill?.root.innerHTML || '';
            } else if (type === 'selectbox') {
              fieldValue = f.querySelector('select')?.value || '';
            } else if (type === 'checkbox') {
              fieldValue = f.querySelector('input[type=checkbox]')?.checked || false;
            }

            fields.push({
              column: column,
              value: fieldValue
            });
          });
        } else {
          const quill = quillInstances.get(String(entryId));
          if (quill) {
            fields.push({
              column: '',
              value: quill.root.innerHTML
            });
          }
        }

        entries.push({ soThuTu: idx + 1, fields });
      });

      // Tạo đối tượng JSON cuối cùng
      const payload = {
        id: categoryId, // 💡 THAM SỐ MỚI ĐƯỢC THÊM VÀO
        thoiGianTao: new Date().toISOString(),
        pass: $('txtPass')?.value,
        danhMuc: selectedCategoryName,
        duLieu: entries,
        action: 'add'
      };
      
      // Trả về kết quả sau khi đã hoàn tất
      resolve(payload);
    });
  });
}

// UPDATED: Sửa đổi hoàn toàn hàm validateData
function validateData(data) {
  if (data.duLieu.length === 0) {
    return 'Vui lòng thêm ít nhất một vùng!';
  }

  for (let i = 0; i < data.duLieu.length; i++) {
    const entry = data.duLieu[i];
    for (const field of entry.fields) {
      // Chỉ kiểm tra các trường được đánh dấu là bắt buộc
      if (field.required) {
        if (field.type === 'text' && !field.text.trim()) {
          return `Vui lòng nhập nội dung cho trường "${field.column}" ở vùng ${i + 1}!`;
        }
        if (field.type === 'selectbox' && !field.value) {
          return `Vui lòng chọn giá trị cho trường "${field.column}" ở vùng ${i + 1}!`;
        }
        // Có thể thêm kiểm tra cho checkbox nếu cần, ví dụ: if (field.type === 'checkbox' && !field.checked)
      }
    }
  }

  return null; // Không có lỗi
}

// UPDATED: Thêm 'await' khi gọi hàm collectData
async function submitData() {
  // 💡 THÊM 'await' VÀO ĐÂY
  const data = await collectData();
  const error = validateData(data);
  
  if (error) {
    showNotification(error, 'error');
    return;
  }

  const btn = $('submitBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '🔄';
  }

  // console.log(JSON.stringify(data));
  try {
    const response = await fetch(API, {
      method: 'POST',
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Lỗi mạng: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result?.code === 1) {
      // showNotification('Đã lưu thành công!', 'success');
      buildEntriesForSelected($('danhMucSelect')?.value);
      showCongrats();
    } else {
      throw new Error(result?.error || 'Lỗi không xác định từ server');
    }
  } catch (err) {
    showNotification(`❌ Lỗi: ${err.message}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '💾';
    }
  }
}

// === PASSWORD ===
function savePass() {
  const pass = $('txtPass')?.value;
  if (!pass) {
    alert('Vui lòng nhập pass');
    return;
  }
  storage.set({ KEY: pass }, togglePasswordInput);
}

function togglePasswordInput() {
  const div = $('divPassword');
  if (!div) return;
  
  const isHidden = div.style.display === 'none';
  div.style.display = isHidden ? 'block' : 'none';
  
  if (isHidden) {
    storage.get('KEY', r => {
      if ($('txtPass')) $('txtPass').value = r.KEY || '';
    });
  }
}

// === UPDATE CATEGORIES ===
// UPDATED: Xử lý trường hợp danh mục cũ bị xóa sau khi cập nhật
async function updateCategories() {
  const select = $('danhMucSelect');
  const key = $('txtPass')?.value.trim();

  if (!key) {
    // Giữ nguyên logic cũ nếu không có key
    updateCategoriesFromAPI();
    return;
  }
  
  // Lấy giá trị đang được chọn TRƯỚC KHI cập nhật
  const oldSelectedValue = select?.value;

  // Set loading state
  if (select?.choices) {
    const container = select.closest('.choices');
    const placeholder = container?.querySelector('.choices__placeholder');
    if (placeholder) placeholder.textContent = 'Đang tải...';
  }

  const success = await updateCategoriesFromAPI();

  // Reset placeholder
  if (select?.choices) {
    const container = select.closest('.choices');
    const placeholder = container?.querySelector('.choices__placeholder');
    if (placeholder) placeholder.textContent = 'Chọn một danh mục...';
  }

  if (success) {
    $('addBtn').disabled = false;
    $('submitBtn').disabled = false;
    
    storage.get('danhMuc', data => {
      const newCategories = data?.danhMuc || [];
      let targetCategory = null;

      if (newCategories.length > 0) {
        // Kiểm tra xem lựa chọn cũ có còn tồn tại trong danh sách mới không
        const oldCategoryStillExists = newCategories.some(c => c.table === oldSelectedValue);

        if (oldCategoryStillExists) {
          // Nếu còn, mục tiêu của chúng ta chính là nó
          targetCategory = newCategories.find(c => c.table === oldSelectedValue);
        } else {
          // Nếu không, mặc định chọn mục đầu tiên trong danh sách mới
          targetCategory = newCategories[0];
          // VÀ CẬP NHẬT CACHE VỚI GIÁ TRỊ MỚI NÀY
          storage.set({ [CACHE_DANH_MUC]: targetCategory.table });
        }
      }

      if (targetCategory) {
        // Cập nhật giao diện với danh mục hợp lệ
        select.choices.setChoiceByValue(String(targetCategory.table));
        applyTheme(targetCategory);
        buildEntriesForSelected(targetCategory.table);
      } else {
        // Xử lý trường hợp danh sách mới trả về rỗng
        storage.set({ [CACHE_DANH_MUC]: null }); // Xóa cache
        applyTheme(null);
        buildEntriesForSelected(null);
        $('addBtn').disabled = true;
        $('submitBtn').disabled = true;
      }
    });
  } else {
    // Nếu cập nhật thất bại, vẫn khởi tạo lại để tránh lỗi
    initDanhMucSelect();
  }
}

async function updateCategoriesFromAPI() {
  const key = $('txtPass')?.value.trim();
  if (!key) return false;

  const btn = $('updateDanhMucBtn');
  if (btn) btn.disabled = true;

  try {
    const response = await fetch(API, {
      method: 'POST',
      body: JSON.stringify({ pass: key, action: 'getDanhMuc' })
    });

    if (!response.ok) {
      throw new Error(`Lỗi mạng: ${response.statusText}`);
    }

    const resp = await response.json();

    if (resp?.code !== 1) {
      throw new Error(resp?.error || 'Server trả về lỗi.');
    }

    let payload = resp.data;
    if (typeof payload === 'string') {
      payload = JSON.parse(payload);
    }

    if (!Array.isArray(payload)) {
      throw new Error('Dữ liệu trả về không hợp lệ.');
    }

    return new Promise(resolve => {
      storage.set({ danhMuc: payload }, () => {
        showNotification('Đã cập nhật danh sách danh mục!', 'success');
        populateCategories(payload);
        resolve(true);
      });
    });
  } catch (err) {
    showNotification(`Lỗi: ${err.message}`, 'error');
    return false;
  } finally {
    if (btn) btn.disabled = false;
  }
}

// === UI FEEDBACK ===
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

// === CONFETTI ===
let confettiAnimationId = null;

function startConfetti(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa'];
  const particles = Array.from({ length: 100 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -canvas.height,
    r: Math.random() * 6 + 4,
    d: Math.random() * 40 + 10,
    color: colors[Math.floor(Math.random() * colors.length)],
    tilt: Math.random() * 10 - 10,
    tiltAngle: 0,
    tiltAngleIncremental: Math.random() * 0.07 + 0.05
  }));

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    particles.forEach(p => {
      ctx.beginPath();
      ctx.lineWidth = p.r;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 3, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.d / 3);
      ctx.stroke();

      p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
      p.x += Math.sin(0.01 * p.d);
      p.tiltAngle += p.tiltAngleIncremental;
      p.tilt = Math.sin(p.tiltAngle) * 15;

      if (p.y > canvas.height) {
        p.x = Math.random() * canvas.width;
        p.y = -10;
      }
    });

    confettiAnimationId = requestAnimationFrame(draw);
  };

  draw();
}

function stopConfetti() {
  if (confettiAnimationId) {
    cancelAnimationFrame(confettiAnimationId);
  }
  const canvas = $('confettiCanvas');
  if (canvas) {
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// === EVENT DELEGATION ===
document.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const entryId = btn.dataset.entryId;

  if (btn.classList.contains('remove-entry') && entryId) {
    $(`vg-entry-${entryId}`)?.remove();
    
    // Clean up Quill instances
    Array.from(quillInstances.keys()).forEach(k => {
      if (k.startsWith(`${entryId}-`) || k === String(entryId)) {
        quillInstances.delete(k);
      }
    });
    
    updateEntryNumbers();
  }

  if (btn.classList.contains('toggle-toolbar') && entryId) {
    $(`vg-entry-${entryId}`)?.classList.toggle('no-toolbar');
  }
});

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  // Set button content
  if ($('addBtn')) $('addBtn').textContent = '+';
  if ($('submitBtn')) $('submitBtn').textContent = '💾';
  if ($('updateDanhMucBtn')) $('updateDanhMucBtn').textContent = '🔄';

  // Event listeners
  $('addBtn')?.addEventListener('click', addEntry);
  $('submitBtn')?.addEventListener('click', submitData);
  $('btnSavePass')?.addEventListener('click', savePass);
  $('updateDanhMucBtn')?.addEventListener('click', updateCategories);

  // Load auto-next switch state
  const autoNextSwitch = $('autoNextTheLoaiBietOnSwtich');
  if (autoNextSwitch) {
    storage.get(CACHE_AUTO_NEXT, data => {
      if (data[CACHE_AUTO_NEXT] != null) {
        autoNextSwitch.checked = data[CACHE_AUTO_NEXT];
      }
    });
    
    autoNextSwitch.addEventListener('change', e => {
      storage.set({ [CACHE_AUTO_NEXT]: e.target.checked });
    });
  }

  // Load password
  storage.get('KEY', r => {
    if ($('txtPass')) $('txtPass').value = r.KEY || '';
  });

  // Initialize category select
  initDanhMucSelect();
});