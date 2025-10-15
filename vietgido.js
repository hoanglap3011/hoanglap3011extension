// =================================================================
// --- VIETGIDO APPLICATION MODULE ---
// =================================================================
const VietGidoApp = {
  // --- Cấu hình & Hằng số ---
  config: {
    API: 'https://script.google.com/macros/s/AKfycbzZoNlP98YZVhHNh7HkO2MT0ToHzIB6wHD92sXD_opDD_RZti3UAJWe2CxZ_Jggje6czg/exec',
    CACHE_DANH_MUC: 'selectedDanhMuc',
    CACHE_AUTO_NEXT: 'autoNextSwitchState',
    QUOTES: [
      "Cách duy nhất để làm một công việc tuyệt vời là yêu những gì bạn làm.",
      "Tương lai thuộc về những người tin vào vẻ đẹp của những giấc mơ.",
      "Hãy là sự thay đổi mà bạn muốn thấy trên thế giới.",
      "Hành trình vạn dặm bắt đầu bằng một bước chân.",
      "Đừng đếm ngày, hãy làm cho mỗi ngày đều đáng giá."
    ]
  },

  // --- Trạng thái của ứng dụng ---
  state: {
    entryCount: 0,
    quillInstances: new Map(),
    currentCategoryConfig: null,
    confettiAnimationId: null
  },

  // --- Cache các DOM element ---
  dom: {},

  /**
   * Khởi tạo ứng dụng
   */
  init() {
    this.cacheDomElements();
    this.setupEventListeners();
    this.loadInitialState();
    this.initDanhMucSelect();
  },

  // =================================================================
  // --- SETUP & KHỞI TẠO ---
  // =================================================================
  cacheDomElements() {
    const ids = ['danhMucSelect', 'entriesContainer', 'addBtn', 'submitBtn', 'updateDanhMucBtn', 'txtPass', 'divPassword', 'btnSavePass', 'autoNextTheLoaiBietOnSwtich', 'loadingOverlay', 'loadingQuote', 'congratsOverlay', 'confettiCanvas'];
    ids.forEach(id => this.dom[id] = document.getElementById(id));
  },

  setupEventListeners() {
    this.dom.addBtn?.addEventListener('click', this.handlers.addEntry.bind(this));
    this.dom.submitBtn?.addEventListener('click', this.handlers.submitData.bind(this));
    this.dom.btnSavePass?.addEventListener('click', this.handlers.savePass.bind(this));
    this.dom.updateDanhMucBtn?.addEventListener('click', this.handlers.updateCategories.bind(this));
    this.dom.danhMucSelect?.addEventListener('change', this.handlers.onCategoryChange.bind(this));
    document.addEventListener('click', this.handlers.onDocumentClick.bind(this));

    if (this.dom.autoNextTheLoaiBietOnSwtich) {
      this.dom.autoNextTheLoaiBietOnSwtich.addEventListener('change', e => {
        this.helpers.storage.set({ [this.config.CACHE_AUTO_NEXT]: e.target.checked });
      });
    }
  },

  loadInitialState() {
    this.helpers.storage.get(this.config.CACHE_AUTO_NEXT, data => {
      if (this.dom.autoNextTheLoaiBietOnSwtich && data[this.config.CACHE_AUTO_NEXT] != null) {
        this.dom.autoNextTheLoaiBietOnSwtich.checked = data[this.config.CACHE_AUTO_NEXT];
      }
    });
    this.helpers.storage.get('KEY', r => {
      if (this.dom.txtPass) this.dom.txtPass.value = r.KEY || '';
    });
  },

  initDanhMucSelect() {
    if (!this.dom.danhMucSelect) return;

    if (window.Choices && !this.dom.danhMucSelect.choices) {
      this.dom.danhMucSelect.choices = new Choices(this.dom.danhMucSelect, {
        removeItemButton: false, shouldSort: false, placeholder: true, placeholderValue: 'Chọn một danh mục...'
      });
      this.dom.danhMucSelect.addEventListener('search', this.handlers.onCategorySearch.bind(this));
    }

    this.helpers.storage.get('danhMuc', data => {
      const categories = data?.danhMuc || [];
      if (categories.length > 0) {
        this.render.populateCategories.call(this, categories);
        this.helpers.storage.get(this.config.CACHE_DANH_MUC, cache => {
          const saved = cache[this.config.CACHE_DANH_MUC];
          const targetCategory = categories.find(c => c.table === saved) || categories[0];
          if (targetCategory) {
            this.dom.danhMucSelect.choices?.setChoiceByValue(targetCategory.table);
            this.render.buildEntriesForSelected.call(this, targetCategory.table);
            this.ui.applyTheme.call(this, targetCategory);
          }
        });
        this.ui.setButtonsState.call(this, true);
      } else {
        this.dom.danhMucSelect.choices?.setChoices([{ value: '', label: 'Cần cập nhật danh sách danh mục', disabled: true }], 'value', 'label', true);
        this.ui.setButtonsState(false, true); // <-- Sửa ở đây
      }
    });
  },

  // =================================================================
  // --- HANDLERS (Xử lý sự kiện) ---
  // =================================================================
  handlers: {
    onCategoryChange() {
      const value = this.dom.danhMucSelect.value;
      this.render.buildEntriesForSelected.call(this, value);
      this.helpers.storage.set({ [this.config.CACHE_DANH_MUC]: value });
      this.helpers.storage.get('danhMuc', data => {
        const category = (data?.danhMuc || []).find(c => c.table === value);
        this.ui.applyTheme.call(this, category);
      });
    },

    onCategorySearch(e) {
      if (e.detail.value?.toLowerCase() === 'showpass') {
        this.ui.togglePasswordInput.call(this);
        this.dom.txtPass?.focus();
        setTimeout(() => this.dom.danhMucSelect.choices.clearInput(), 50);
      }
    },

    onDocumentClick(e) {
      const btn = e.target.closest('button[data-entry-id]');
      if (!btn) return;

      const entryId = btn.dataset.entryId;
      const entryElement = document.getElementById(`vg-entry-${entryId}`);

      if (btn.classList.contains('remove-entry')) {
        entryElement?.remove();
        Array.from(this.state.quillInstances.keys()).forEach(k => {
          if (k.startsWith(`${entryId}-`) || k === String(entryId)) {
            this.state.quillInstances.delete(k);
          }
        });
        this.render.updateEntryNumbers.call(this);
      } else if (btn.classList.contains('toggle-toolbar')) {
        entryElement?.classList.toggle('no-toolbar');
      }
    },

    async submitData() {
      const data = await this.data.collectData.call(this);
      const error = this.data.validateData.call(this, data);

      if (error) {
        this.ui.showNotification.call(this, error, 'error');
        return;
      }

      this.ui.showLoadingOverlay.call(this);
      this.ui.setButtonsState.call(this, false);

      try {
        const response = await fetch(this.config.API, { method: 'POST', body: JSON.stringify(data) });
        if (!response.ok) throw new Error(`Lỗi mạng: ${response.statusText}`);
        const result = await response.json();
        if (result?.code !== 1) throw new Error(result?.error || 'Lỗi không xác định từ server');

        this.render.buildEntriesForSelected.call(this, this.dom.danhMucSelect?.value);
        this.ui.showCongrats.call(this);
      } catch (err) {
        this.ui.showNotification.call(this, `❌ Lỗi: ${err.message}`, 'error');
      } finally {
        this.ui.hideLoadingOverlay.call(this);
        this.ui.setButtonsState.call(this, true);
      }
    },

    addEntry() {
      this.render.addEntry.call(this);
    },

    savePass() {
      const pass = this.dom.txtPass?.value;
      if (!pass) {
        alert('Vui lòng nhập pass');
        return;
      }
      this.helpers.storage.set({ KEY: pass }, this.ui.togglePasswordInput.bind(this));
    },

    // Thay thế toàn bộ hàm này trong VietGidoApp.handlers
    async updateCategories() {
      this.ui.setButtonsState.call(this, false);
      const oldSelectedValue = this.dom.danhMucSelect?.value;
      if (this.dom.danhMucSelect?.choices) {
        const placeholder = this.dom.danhMucSelect.parentElement.querySelector('.choices__placeholder');
        if (placeholder) placeholder.textContent = 'Đang tải...';
      }

      const success = await this.data.updateCategoriesFromAPI.call(this);

      if (this.dom.danhMucSelect?.choices) {
        const placeholder = this.dom.danhMucSelect.parentElement.querySelector('.choices__placeholder');
        if (placeholder) placeholder.textContent = 'Chọn một danh mục...';
      }

      if (success) {
        this.helpers.storage.get('danhMuc', data => {
          const newCategories = data?.danhMuc || [];
          let targetCategory = newCategories.find(c => c.table === oldSelectedValue) || newCategories[0];

          if (targetCategory) {
            this.dom.danhMucSelect.choices.setChoiceByValue(String(targetCategory.table));
            this.ui.applyTheme.call(this, targetCategory);
            this.render.buildEntriesForSelected.call(this, targetCategory.table);
            if (oldSelectedValue !== targetCategory.table) {
              this.helpers.storage.set({ [this.config.CACHE_DANH_MUC]: targetCategory.table });
            }
          } else {
            this.helpers.storage.set({ [this.config.CACHE_DANH_MUC]: null });
            this.ui.applyTheme.call(this, null);
            this.render.buildEntriesForSelected.call(this, null);
          }
        });
      }

      // Dòng đã được sửa lỗi
      this.ui.setButtonsState.call(this, success, true);
    }
  },

  // =================================================================
  // --- RENDER (Cập nhật giao diện) ---
  // =================================================================
  render: {
    populateCategories(categories) {
      const select = this.dom.danhMucSelect;
      if (!select?.choices) return;
      select.choices.clearStore();
      const choices = categories.map(c => ({ value: c?.table || '', label: c?.table || 'Unnamed Category' }));
      select.choices.setChoices(choices, 'value', 'label', true);
    },

    buildEntriesForSelected(categoryName) {
      if (this.dom.entriesContainer) this.dom.entriesContainer.innerHTML = '';
      this.state.entryCount = 0;
      this.state.quillInstances.clear();

      if (!categoryName) {
        this.state.currentCategoryConfig = null;
        this.render.addEntry.call(this);
        return;
      }

      this.helpers.storage.get('danhMuc', data => {
        const categories = data?.danhMuc || [];
        const category = categories.find(c => c?.table === categoryName);
        this.state.currentCategoryConfig = category ? { ...category, header: category.header || [] } : null;
        this.render.addEntry.call(this);
      });
    },

    addEntry() {
      this.state.entryCount++;
      const entry = document.createElement('div');
      entry.className = 'vg-entry no-toolbar';
      entry.id = `vg-entry-${this.state.entryCount}`;
      entry.innerHTML = `
                <div class="vg-entry-header">
                  <div class="vg-entry-number"></div>
                  <div class="vg-entry-actions">
                    <button class="toggle-toolbar" data-entry-id="${this.state.entryCount}" type="button">▤</button>
                    <button class="remove-entry" data-entry-id="${this.state.entryCount}" type="button">X</button>
                  </div>
                </div>
                <div class="vg-entry-body"></div>`;

      const body = entry.querySelector('.vg-entry-body');
      const headers = this.state.currentCategoryConfig?.header || [];

      if (headers.length > 0) {
        headers.forEach((headerConfig, i) => {
          body.appendChild(this.render._createField.call(this, this.state.entryCount, headerConfig, i));
        });
      } else {
        const quill = this.render._createQuillEditor.call(this, body);
        this.state.quillInstances.set(String(this.state.entryCount), quill);
      }

      this.dom.entriesContainer.appendChild(entry);
      this.render.updateEntryNumbers.call(this);

      this.helpers.handleAutoSelectBietOn.call(this, entry, this.state.currentCategoryConfig);

      setTimeout(() => entry.querySelector('.ql-editor')?.focus(), 200);
    },

    updateEntryNumbers() {
      this.dom.entriesContainer.querySelectorAll('.vg-entry-number').forEach((num, i) => {
        num.textContent = i + 1;
      });
    },

    _createField(entryId, headerConfig, fieldIndex) {
      const field = document.createElement('div');
      field.className = 'vg-field';
      field.dataset.headerColumn = headerConfig.column || '';
      field.dataset.headerType = headerConfig.type || 'text';
      field.dataset.headerRequired = headerConfig.required || false;

      const control = document.createElement('div');
      control.className = 'vg-field-control';
      field.appendChild(control);

      switch (headerConfig.type) {
        case 'checkbox':
          this.render._createCheckboxField.call(this, field, control, entryId, headerConfig);
          break;
        case 'selectbox':
          this.render._createSelectField.call(this, control, headerConfig);
          break;
        case 'date':
          this.render._createDateField.call(this, control);
          break;
        case 'time':
          this.render._createTimeField.call(this, control);
          break;
        case 'number':
          this.render._createNumberField.call(this, control, headerConfig);
          break;
        case 'money':
          this.render._createMoneyField.call(this, control, headerConfig);
          break;
        default: // 'text'
          const quill = this.render._createQuillEditor.call(this, control, this.helpers.getPlaceholderText(headerConfig));
          this.state.quillInstances.set(`${entryId}-${fieldIndex}`, quill);
      }
      return field;
    },

    _createCheckboxField(field, control, entryId, headerConfig) {
      field.classList.add('vg-field--switch');
      const label = document.createElement('label');
      label.className = 'vg-field-label';
      label.textContent = headerConfig.column || '';
      if (headerConfig.required) {
        const requiredSpan = document.createElement('span');
        requiredSpan.className = 'required-indicator';
        requiredSpan.textContent = '*';
        label.appendChild(requiredSpan);
      }
      const switchLabel = document.createElement('label');
      switchLabel.className = 'switch';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `checkbox-${entryId}-${this.state.entryCount}`;
      label.htmlFor = checkbox.id;
      const slider = document.createElement('span');
      slider.className = 'slider';
      switchLabel.append(checkbox, slider);
      control.appendChild(switchLabel);
      field.appendChild(label);
    },

    _createSelectField(control, headerConfig) {
      const select = document.createElement('select');
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = this.helpers.getPlaceholderText(headerConfig);
      placeholder.disabled = true;
      placeholder.selected = true;
      select.appendChild(placeholder);
      (headerConfig.set || '').split(';').map(v => v.trim()).filter(Boolean).forEach(v => {
        const option = document.createElement('option');
        option.value = option.textContent = v;
        select.appendChild(option);
      });
      control.appendChild(select);
      setTimeout(() => {
        if (window.Choices && !select.choices) {
          new Choices(select, { removeItemButton: false, shouldSort: false });
        }
      }, 50);
    },


    // NEW: Hàm tạo trường nhập ngày tháng năm
    _createDateField(control) {
      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      dateInput.className = 'vg-input';

      // Tạo giá trị mặc định là ngày hiện tại theo định dạng "YYYY-MM-DD"
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      dateInput.value = now.toISOString().slice(0, 10);

      control.appendChild(dateInput);
    },


    _createTimeField(control) {
      const timeInput = document.createElement('input');
      // THAY ĐỔI 1: Đổi type từ 'datetime-local' thành 'time'
      timeInput.type = 'time';
      timeInput.className = 'vg-input';

      // THAY ĐỔI 2: Tạo giá trị mặc định theo định dạng "HH:mm"
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');

      timeInput.value = `${hours}:${minutes}`;

      control.appendChild(timeInput);
    },


    _createNumberField(control, headerConfig) {
      const numberInput = document.createElement('input');
      numberInput.type = 'number';
      numberInput.placeholder = this.helpers.getPlaceholderText(headerConfig);
      numberInput.className = 'vg-input';
      control.appendChild(numberInput);
    },

    _createMoneyField(control, headerConfig) {
      const moneyInput = document.createElement('input');
      moneyInput.type = 'text';
      moneyInput.inputMode = 'numeric';
      moneyInput.placeholder = this.helpers.getPlaceholderText(headerConfig);
      moneyInput.className = 'vg-input';
      control.appendChild(moneyInput);
      new Cleave(moneyInput, {
        numeral: true,
        numeralThousandsGroupStyle: 'thousand',
        delimiter: '.',
        numeralDecimalScale: 0,
        numeralDecimalMark: ','
      });
    },

    _createQuillEditor(container, placeholder = 'Nhập nội dung...') {
      const wrapper = document.createElement('div');
      const editorDiv = document.createElement('div');
      editorDiv.className = 'editor-container';
      wrapper.appendChild(editorDiv);
      container.appendChild(wrapper);
      return new Quill(editorDiv, {
        theme: 'snow',
        placeholder,
        modules: {
          toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], [{ indent: '-1' }, { indent: '+1' }], ['clean']]
        }
      });
    }
  },

  // =================================================================
  // --- DATA (Thu thập & xác thực) ---
  // =================================================================
  data: {
    async collectData() {
      const selectedCategoryName = this.dom.danhMucSelect?.value;
      const categories = await new Promise(resolve => this.helpers.storage.get('danhMuc', data => resolve(data.danhMuc || [])));
      const selectedCategory = categories.find(c => c.table === selectedCategoryName);

      const entries = Array.from(this.dom.entriesContainer.querySelectorAll('.vg-entry')).map((entry, idx) => {
        const entryId = Number(entry.id.split('-')[2]);
        const fields = Array.from(entry.querySelectorAll('.vg-field')).map((fieldNode, fieldIdx) => {
          const type = fieldNode.dataset.headerType;
          let value;

          if (type === 'text') {
            const quill = this.state.quillInstances.get(`${entryId}-${fieldIdx}`);
            const rawValue = quill?.root.innerHTML || '';
            // Nếu vùng soạn thảo trống, gửi đi chuỗi rỗng thay vì '<p><br></p>'
            value = (rawValue.trim() === '<p><br></p>') ? '' : rawValue;
          }
          else if (type === 'selectbox') {
            value = fieldNode.querySelector('select')?.value || '';
          } else if (type === 'checkbox') {
            value = fieldNode.querySelector('input[type=checkbox]')?.checked || false;
          } else if (type === 'money') {
            value = (fieldNode.querySelector('input')?.value || '').replace(/\D/g, '');
          } else {
            value = fieldNode.querySelector('input')?.value || '';

          }
          return {
            column: fieldNode.dataset.headerColumn,
            value,
            type,
            required: fieldNode.dataset.headerRequired === 'true'
          };
        });
        return { soThuTu: idx + 1, fields };
      });

      return {
        id: selectedCategory ? selectedCategory.id : null,
        thoiGianTao: new Date().toISOString(),
        pass: this.dom.txtPass?.value,
        danhMuc: selectedCategoryName,
        duLieu: entries,
        action: 'add'
      };
    },

    validateData(data) {
      if (data.duLieu.length === 0) return 'Vui lòng thêm ít nhất một vùng!';
      for (let i = 0; i < data.duLieu.length; i++) {
        const entry = data.duLieu[i];
        for (const field of entry.fields) {
          if (field.required) {
            if (field.type === 'text' && (!field.value || field.value.trim() === '<p><br></p>')) {
              return `Vui lòng nhập nội dung cho trường "${field.column}" ở vùng ${i + 1}!`;
            }
            if (field.type === 'selectbox' && !field.value) {
              return `Vui lòng chọn giá trị cho trường "${field.column}" ở vùng ${i + 1}!`;
            }
          }
        }
      }
      return null;
    },

    async updateCategoriesFromAPI() {
      const key = this.dom.txtPass?.value.trim();
      if (!key) return false;

      try {
        const response = await fetch(this.config.API, {
          method: 'POST',
          body: JSON.stringify({ pass: key, action: 'getDanhMuc' })
        });
        if (!response.ok) throw new Error(`Lỗi mạng: ${response.statusText}`);
        const resp = await response.json();
        if (resp?.code !== 1) throw new Error(resp?.error || 'Server trả về lỗi.');

        let payload = (typeof resp.data === 'string') ? JSON.parse(resp.data) : resp.data;
        if (!Array.isArray(payload)) throw new Error('Dữ liệu trả về không hợp lệ.');

        await new Promise(resolve => this.helpers.storage.set({ danhMuc: payload }, resolve));
        this.ui.showNotification.call(this, 'Đã cập nhật danh sách danh mục!', 'success');
        this.render.populateCategories.call(this, payload);
        return true;
      } catch (err) {
        this.ui.showNotification.call(this, `Lỗi: ${err.message}`, 'error');
        return false;
      }
    }
  },

  // =================================================================
  // --- UI (Hiệu ứng & giao diện) ---
  // =================================================================
  ui: {
    setButtonsState(enabled, keepUpdateBtn = enabled) {
      this.dom.addBtn.disabled = !enabled;
      this.dom.submitBtn.disabled = !enabled;
      this.dom.updateDanhMucBtn.disabled = !keepUpdateBtn;
    },

    togglePasswordInput() {
      const isHidden = this.dom.divPassword.style.display === 'none';
      this.dom.divPassword.style.display = isHidden ? 'block' : 'none';
      if (isHidden) {
        this.helpers.storage.get('KEY', r => {
          if (this.dom.txtPass) this.dom.txtPass.value = r.KEY || '';
        });
      }
    },

    applyTheme(categoryConfig) {
      let dynamicThemeStyle = document.getElementById('dynamic-theme-style');
      if (!dynamicThemeStyle) {
        dynamicThemeStyle = document.createElement('style');
        dynamicThemeStyle.id = 'dynamic-theme-style';
        document.head.appendChild(dynamicThemeStyle);
      }

      if (!categoryConfig || !categoryConfig.color) {
        dynamicThemeStyle.innerHTML = '';
        return;
      }
      const baseColor = categoryConfig.color;
      const emojis = categoryConfig.emojis || null;
      const gradientLayer = `linear-gradient(to right, ${baseColor}, ${this.helpers.hexToRgba(baseColor, 0)}, ${baseColor})`;
      const emojiLayer = this.helpers.generateEmojiBackground(emojis);
      const finalBackgroundImage = emojiLayer !== 'none' ? `${emojiLayer}, ${gradientLayer}` : gradientLayer;
      dynamicThemeStyle.innerHTML = `body { background-image: ${finalBackgroundImage} !important; background-repeat: repeat, repeat !important; background-color: #f5f5f5 !important; }`;
    },

    showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      notification.textContent = message;
      document.body.appendChild(notification);
      requestAnimationFrame(() => notification.classList.add('show'));
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    },

    showLoadingOverlay() {
      const randomQuote = this.config.QUOTES[Math.floor(Math.random() * this.config.QUOTES.length)];
      this.dom.loadingQuote.textContent = randomQuote;
      this.dom.loadingOverlay.classList.add('visible');
    },

    hideLoadingOverlay() {
      this.dom.loadingOverlay.classList.remove('visible');
    },

    showCongrats() {
      if (!this.dom.congratsOverlay || !this.dom.confettiCanvas) return;
      this.dom.congratsOverlay.style.display = 'flex';
      this.helpers.startConfetti.call(this, this.dom.confettiCanvas);
      setTimeout(() => {
        this.dom.congratsOverlay.style.display = 'none';
        this.helpers.stopConfetti.call(this);
      }, 2200);
    }
  },

  // =================================================================
  // --- HELPERS (Hàm hỗ trợ) ---
  // =================================================================
  helpers: {
    storage: {
      isExtension: () => typeof chrome !== 'undefined' && chrome.storage?.local,
      get(keys, cb) {
        if (this.isExtension()) {
          chrome.storage.local.get(keys, cb);
        } else {
          const result = {};
          (Array.isArray(keys) ? keys : [keys]).forEach(k =>
            result[k] = JSON.parse(localStorage.getItem(k) || 'null')
          );
          cb(result);
        }
      },
      set(obj, cb) {
        if (this.isExtension()) {
          chrome.storage.local.set(obj, cb);
        } else {
          Object.entries(obj).forEach(([k, v]) =>
            localStorage.setItem(k, JSON.stringify(v))
          );
          cb?.();
        }
      }
    },

    formatMoney(value) {
      const cleanValue = String(value).replace(/\D/g, '');
      return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    },

    getPlaceholderText(headerConfig) {
      return (headerConfig.column || '') + (headerConfig.required ? ' *' : '');
    },

    handleAutoSelectBietOn(entryElement, categoryConfig) {
      const categoryName = VietGidoApp.dom.danhMucSelect?.value;
      if (!VietGidoApp.dom.autoNextTheLoaiBietOnSwtich?.checked || categoryName !== 'Biết Ơn') return;

      const danhMucHeader = categoryConfig?.header?.find(h => h.column === 'Danh Mục');
      if (danhMucHeader?.type !== 'selectbox') return;

      const setValues = (danhMucHeader.set || '').split(';').map(v => v.trim()).filter(Boolean);
      if (setValues.length === 0) return;

      const select = entryElement.querySelector('.vg-field[data-header-column="Danh Mục"] select');
      if (!select) return;

      const entryIndex = VietGidoApp.dom.entriesContainer.children.length;
      const optionIndex = (entryIndex - 1) % setValues.length;
      select.value = setValues[optionIndex];
    },

    hexToRgba(hex, alpha = 1) {
      if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) return hex;
      let c = hex.substring(1).split('');
      if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
      c = '0x' + c.join('');
      return `rgba(${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}, ${alpha})`;
    },

    generateEmojiBackground(emojis) {
      if (!emojis) return 'none';
      const emojiArray = [...emojis];
      const TILE_SIZE = 400, EMOJI_COUNT = 8, MAX_TRIES = 20;
      const placedEmojis = [];
      const isColliding = (r1, r2) => (r1.x < r2.x + r2.width && r1.x + r1.width > r2.x && r1.y < r2.y + r2.height && r1.y + r1.height > r2.y);

      for (let i = 0; i < EMOJI_COUNT; i++) {
        let tries = 0;
        while (tries < MAX_TRIES) {
          const fontSize = Math.floor(Math.random() * 30) + 25;
          const rect = { x: Math.random() * (TILE_SIZE - fontSize), y: Math.random() * (TILE_SIZE - fontSize), width: fontSize + 10, height: fontSize + 10 };
          if (!placedEmojis.some(p => isColliding(rect, p.rect))) {
            placedEmojis.push({
              rect,
              emoji: emojiArray[Math.floor(Math.random() * emojiArray.length)],
              x: rect.x + fontSize / 2,
              y: rect.y + fontSize / 2,
              fontSize,
              angle: Math.floor(Math.random() * 70) - 35,
              opacity: (Math.random() * 0.4 + 0.3).toFixed(2),
            });
            break;
          }
          tries++;
        }
      }
      const textElements = placedEmojis.map(p => {
        const isRedHeart = (p.emoji === '❤️' || p.emoji === '❤');
        const fillAttribute = isRedHeart ? 'fill="red"' : '';
        return `<text x="${p.x}" y="${p.y}" font-size="${p.fontSize}" opacity="${p.opacity}" transform="rotate(${p.angle} ${p.x} ${p.y})" text-anchor="middle" dominant-baseline="central" ${fillAttribute}>${p.emoji}</text>`;
      }).join('');
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${TILE_SIZE}' height='${TILE_SIZE}'>${textElements}</svg>`;
      return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22')}")`;
    },

    startConfetti(canvas) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const colors = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa'];
      const particles = Array.from({ length: 100 }, () => ({
        x: Math.random() * canvas.width, y: Math.random() * -canvas.height, r: Math.random() * 6 + 4,
        d: Math.random() * 40 + 10, color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 10, tiltAngle: 0, tiltAngleIncremental: Math.random() * 0.07 + 0.05
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
          if (p.y > canvas.height) { p.x = Math.random() * canvas.width; p.y = -10; }
        });
        this.state.confettiAnimationId = requestAnimationFrame(draw);
      };
      draw();
    },

    stopConfetti() {
      if (this.state.confettiAnimationId) {
        cancelAnimationFrame(this.state.confettiAnimationId);
      }
      const canvas = VietGidoApp.dom.confettiCanvas;
      if (canvas) {
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }
};

// Khởi chạy ứng dụng khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  VietGidoApp.init();
});