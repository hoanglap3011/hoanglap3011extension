// =================================================================
// --- VIETGIDO APPLICATION MODULE ---
// =================================================================
const VietGidoApp = {
  // --- Cấu hình & Hằng số ---
  config: {
    API: API,
    API_ACTION_ADD_VIETGIDO: API_ACTION_ADD_VIETGIDO,
    API_ACTION_GET_DANHMUC_QUOTES: API_ACTION_GET_DANHMUC_QUOTES,
    CACHE_DANH_MUC: CACHE_DANH_MUC,
    CACHE_AUTO_NEXT: CACHE_AUTO_NEXT,
    CACHE_SHOW_TOOLBAR: CACHE_SHOW_TOOLBAR,
    CACHE_HIDE_UNREQUIRED: CACHE_HIDE_UNREQUIRED,
    CACHE_QUOTES: CACHE_QUOTES,
    CACHE_PASS: CACHE_PASS,
  },

  // --- Trạng thái của ứng dụng ---
  state: {
    entryCount: 0,
    quillInstances: new Map(),
    currentCategoryConfig: null,
    // animationId: null
  },

  // --- Cache các DOM element ---
  dom: {},

  /**
   * Khởi tạo ứng dụng
   */
  init() {
    // --- THÊM MỚI TẠI ĐÂY ---
    // Khởi tạo Loading Overlay Utility
    const getStorageFunc = StorageUtil.get;
    LoadingOverlayUtil.init({
      getStorageFunc: getStorageFunc,
      cacheQuotesKey: this.config.CACHE_QUOTES
    });
    // --- KẾT THÚC THÊM MỚI ---    
    this.cacheDomElements();
    this.setupEventListeners();
    this.state.urlParams = new URLSearchParams(window.location.search);
    this.loadInitialState();
    this.initDanhMucSelect();
  },

  // =================================================================
  // --- SETUP & KHỞI TẠO ---
  // =================================================================
  cacheDomElements() {
    const ids = ['danhMucSelect', 'entriesContainer', 'addBtn', 'submitBtn', 'updateDanhMucBtn', 'autoNextTheLoaiBietOnSwtich', 'loadingOverlay', 'loadingQuote', 'congratsOverlay', 'confettiCanvas',
      'toggleAllToolbarsSwitch' // <-- THÊM ID MỚI VÀO ĐÂY
      , 'autoHideUnRequiredFieldSwtich'
    ];
    ids.forEach(id => this.dom[id] = document.getElementById(id));
    this.dom.lottieMainPlayer = document.getElementById('lottie-main-player');
  },

  setupEventListeners() {
    this.dom.addBtn?.addEventListener('click', this.handlers.addEntry.bind(this));
    this.dom.submitBtn?.addEventListener('click', this.handlers.submitData.bind(this));
    this.dom.updateDanhMucBtn?.addEventListener('click', this.handlers.updateCategories.bind(this));
    this.dom.danhMucSelect?.addEventListener('change', this.handlers.onCategoryChange.bind(this));
    document.addEventListener('click', this.handlers.onDocumentClick.bind(this));

    if (this.dom.autoNextTheLoaiBietOnSwtich) {
      this.dom.autoNextTheLoaiBietOnSwtich.addEventListener('change', e => {
        StorageUtil.set({ [this.config.CACHE_AUTO_NEXT]: e.target.checked });
      });
    }

    if (this.dom.toggleAllToolbarsSwitch) {
      this.dom.toggleAllToolbarsSwitch.addEventListener('change', this.handlers.onToggleAllToolbars.bind(this));
    }

    if (this.dom.autoHideUnRequiredFieldSwtich) {
      this.dom.autoHideUnRequiredFieldSwtich.addEventListener('change', this.handlers.onToggleHideUnrequired.bind(this));
    }
  },

  loadInitialState() {
    StorageUtil.get(this.config.CACHE_AUTO_NEXT, data => {
      if (this.dom.autoNextTheLoaiBietOnSwtich && data[this.config.CACHE_AUTO_NEXT] != null) {
        this.dom.autoNextTheLoaiBietOnSwtich.checked = data[this.config.CACHE_AUTO_NEXT];
      }
    });

    StorageUtil.get(this.config.CACHE_SHOW_TOOLBAR, data => {
      // Mặc định là OFF (ẩn toolbar) để duy trì hành vi cũ
      let show = data[this.config.CACHE_SHOW_TOOLBAR];
      if (show == null) {
        show = false;
      }
      if (this.dom.toggleAllToolbarsSwitch) {
        this.dom.toggleAllToolbarsSwitch.checked = show;
      }
      // Áp dụng trạng thái lên UI khi tải trang
      this.ui.applyToolbarVisibility.call(this, show);
    });

    StorageUtil.get(this.config.CACHE_HIDE_UNREQUIRED, data => {
      let hideUnrequired = data[this.config.CACHE_HIDE_UNREQUIRED];
      // Mặc định là 'true' (checked) theo file HTML
      if (hideUnrequired == null) {
        hideUnrequired = true;
      }

      if (this.dom.autoHideUnRequiredFieldSwtich) {
        this.dom.autoHideUnRequiredFieldSwtich.checked = hideUnrequired;
      }
      // Áp dụng trạng thái lên UI
      this.ui.applyFieldVisibility.call(this, hideUnrequired);
    });
  },

  initDanhMucSelect() {
    if (!this.dom.danhMucSelect) return;

    // 1. Đọc tham số 'danhMuc' từ state (đã lưu ở hàm init)
    const paramDanhMuc = this.state.urlParams.get('danhMuc');

    if (window.Choices && !this.dom.danhMucSelect.choices) {
      this.dom.danhMucSelect.choices = new Choices(this.dom.danhMucSelect, {
        removeItemButton: false, shouldSort: false, placeholder: true, placeholderValue: 'Chọn một danh mục...'
      });
      this.dom.danhMucSelect.addEventListener('search', this.handlers.onCategorySearch.bind(this));
    }

    StorageUtil.get('danhMuc', data => {
      const categories = data?.danhMuc || [];
      if (categories.length > 0) {
        this.render.populateCategories.call(this, categories);

        // 2. LOGIC MỚI: Ưu tiên tham số URL
        if (paramDanhMuc) {
          const targetCategory = categories.find(c => c.table === paramDanhMuc);
          if (targetCategory) {
            // Tìm thấy -> Set giá trị từ URL và bỏ qua cache
            this.dom.danhMucSelect.choices?.setChoiceByValue(targetCategory.table);
            this.render.buildEntriesForSelected.call(this, targetCategory.table);
            this.ui.applyTheme.call(this, targetCategory);
            // Cập nhật cache thành giá trị mới này luôn
            StorageUtil.set({ [this.config.CACHE_DANH_MUC]: targetCategory.table });
            this.ui.setButtonsState.call(this, true);
            return; // Xong việc, không cần chạy logic cache cũ
          }
          // Nếu không tìm thấy (param bị sai), cứ để nó chạy logic cache cũ ở dưới
        }

        // 3. LOGIC CŨ (chạy khi không có paramDanhMuc hoặc paramDanhMuc bị sai)
        StorageUtil.get(this.config.CACHE_DANH_MUC, cache => {
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
        this.dom.danhMucSelect.choices?.setChoices([
          { value: '', label: 'Cần cập nhật danh sách danh mục', disabled: true }
        ], 'value', 'label', true);
        this.ui.setButtonsState.call(this, false, true);
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
      StorageUtil.set({ [this.config.CACHE_DANH_MUC]: value });
      StorageUtil.get('danhMuc', data => {
        const category = (data?.danhMuc || []).find(c => c.table === value);
        this.ui.applyTheme.call(this, category);
      });
    },

    onCategorySearch(e) {
      if (e.detail.value?.toLowerCase() === 'showpass') {

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
      }
    },

    async submitData() {
      const data = await this.data.collectData.call(this);
      const error = this.data.validateData.call(this, data);

      if (error) {
        this.ui.showNotification.call(this, error, 'error');
        return;
      }

      LoadingOverlayUtil.show(); // <-- THÊM DÒNG NÀY
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
        LoadingOverlayUtil.hide();
        this.ui.setButtonsState.call(this, true);
      }
    },

    addEntry() {
      this.render.addEntry.call(this);
    },



    // Thay thế toàn bộ hàm này trong VietGidoApp.handlers
    async updateCategories() {
      this.ui.setButtonsState.call(this, false);
      LoadingOverlayUtil.show();

      const oldSelectedValue = this.dom.danhMucSelect?.value;
      let success = false; // Dùng để theo dõi trạng thái cuối cùng

      try {
        if (this.dom.danhMucSelect?.choices) {
          const placeholder = this.dom.danhMucSelect.parentElement.querySelector('.choices__placeholder');
          if (placeholder) placeholder.textContent = 'Đang tải...';
        }

        // Gọi hàm lấy dữ liệu, 'success' sẽ là true/false
        success = await this.data.updateCategoriesFromAPI.call(this);

        if (this.dom.danhMucSelect?.choices) {
          const placeholder = this.dom.danhMucSelect.parentElement.querySelector('.choices__placeholder');
          if (placeholder) placeholder.textContent = 'Chọn một danh mục...';
        }

        if (success) {
          StorageUtil.get('danhMuc', data => {
            const newCategories = data?.danhMuc || [];
            let targetCategory = newCategories.find(c => c.table === oldSelectedValue) || newCategories[0];

            if (targetCategory) {
              this.dom.danhMucSelect.choices.setChoiceByValue(String(targetCategory.table));
              this.ui.applyTheme.call(this, targetCategory);
              this.render.buildEntriesForSelected.call(this, targetCategory.table);
              if (oldSelectedValue !== targetCategory.table) {
                StorageUtil.set({ [this.config.CACHE_DANH_MUC]: targetCategory.table });
              }
            } else {
              StorageUtil.set({ [this.config.CACHE_DANH_MUC]: null });
              this.ui.applyTheme.call(this, null);
              this.render.buildEntriesForSelected.call(this, null);
            }
          });
        }
      } catch (err) {
        // Mặc dù updateCategoriesFromAPI đã tự xử lý lỗi,
        // chúng ta vẫn log ở đây để đề phòng
        console.error("Lỗi trong quá trình updateCategories:", err);
        success = false;
      } finally {
        LoadingOverlayUtil.hide();
        // 3. Cập nhật trạng thái nút dựa trên 'success'
        this.ui.setButtonsState.call(this, success, true);
      }
    },
    onToggleAllToolbars(e) {
      const isChecked = e.target.checked;
      StorageUtil.set({ [this.config.CACHE_SHOW_TOOLBAR]: isChecked });
      this.ui.applyToolbarVisibility.call(this, isChecked);
    },
    onToggleHideUnrequired(e) {
      const hideUnrequired = e.target.checked; // ON (checked) = true = Ẩn
      StorageUtil.set({ [this.config.CACHE_HIDE_UNREQUIRED]: hideUnrequired });
      this.ui.applyFieldVisibility.call(this, hideUnrequired);
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

      StorageUtil.get('danhMuc', data => {
        const categories = data?.danhMuc || [];
        const category = categories.find(c => c?.table === categoryName);
        this.state.currentCategoryConfig = category ? { ...category, header: category.header || [] } : null;
        this.render.addEntry.call(this);
      });
    },

    addEntry() {
      this.state.entryCount++;
      const entry = document.createElement('div');
      entry.className = 'vg-entry';
      entry.id = `vg-entry-${this.state.entryCount}`;
      entry.innerHTML = `
                <div class="vg-entry-header">
                  <div class="vg-entry-number"></div>
                  <div class="vg-entry-actions">
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

      // --- LOGIC TỰ ĐỘNG ĐIỀN DỮ LIỆU ---
      const effectiveHeaderConfig = { ...headerConfig };
      const columnName = effectiveHeaderConfig.column || '';
      // Lấy giá trị từ URL param dựa trên tên cột
      const urlValue = this.state.urlParams.get(columnName);

      if (urlValue !== null) {
        // Ghi đè giá trị 'preset' bằng giá trị từ URL
        effectiveHeaderConfig.preset = urlValue;
      }
      // --- KẾT THÚC LOGIC TỰ ĐỘNG ĐIỀN ---

      // 5. Sử dụng 'effectiveHeaderConfig' (đã có thể bị ghi đè)
      switch (effectiveHeaderConfig.type) {
        case 'checkbox':
          this.render._createCheckboxField.call(this, field, control, entryId, effectiveHeaderConfig, fieldIndex);
          break;
        case 'selectbox':
          // Hàm này sẽ tự động chọn 'youtube' vì preset đã được gán
          this.render._createSelectField.call(this, control, effectiveHeaderConfig);
          break;
        case 'date':
          this.render._createDateField.call(this, control, effectiveHeaderConfig);
          break;
        case 'time':
          this.render._createTimeField.call(this, control, effectiveHeaderConfig);
          break;
        case 'number':
          this.render._createNumberField.call(this, control, effectiveHeaderConfig);
          break;
        case 'money':
          this.render._createMoneyField.call(this, control, effectiveHeaderConfig);
          break;
        case 'richtext':
          const quill = this.render._createQuillEditor.call(this, control, effectiveHeaderConfig);
          this.state.quillInstances.set(`${entryId}-${fieldIndex}`, quill);
          break;
        case 'textarea':
          this.render._createTextAreaField.call(this, control, effectiveHeaderConfig);
          break;
        case 'stepper': // Đổi từ 'updown'
          this.render._createStepperField.call(this, field, control, entryId, effectiveHeaderConfig, fieldIndex); // Đổi tên hàm
          break;
        case 'text':
        default:
          // Hàm này sẽ tự động điền shortUrl vào 'title' và 'code'
          this.render._createTextField.call(this, control, effectiveHeaderConfig);
          break;
      }
      return field;
    },

    _createCheckboxField(field, control, entryId, headerConfig, fieldIndex) {
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
      checkbox.id = `checkbox-${entryId}-${fieldIndex}`;
      label.htmlFor = checkbox.id;

      // UPDATED: Thêm logic preset
      if (headerConfig.preset) {
        checkbox.checked = (headerConfig.preset === true || String(headerConfig.preset).toLowerCase() === 'true');
      }

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
      placeholder.selected = true; // Mặc định chọn placeholder
      select.appendChild(placeholder);

      (headerConfig.set || '').split(';').map(v => v.trim()).filter(Boolean).forEach(v => {
        const option = document.createElement('option');
        option.value = option.textContent = v;
        select.appendChild(option);
      });

      // UPDATED: Thêm logic preset
      // Gán giá trị preset. Trình duyệt sẽ tự động chọn option khớp
      if (headerConfig.preset) {
        select.value = headerConfig.preset;
      }

      control.appendChild(select);
      setTimeout(() => {
        if (window.Choices && !select.choices) {
          new Choices(select, { removeItemButton: false, shouldSort: false });
        }
      }, 50);
    },

    // --- THAY THẾ TOÀN BỘ HÀM NÀY (ĐỔI TÊN HÀM VÀ ID BÊN TRONG) ---
    _createStepperField(field, control, entryId, headerConfig, fieldIndex) {
      // 1. Tạo Label
      const label = document.createElement('label');
      label.className = 'vg-field-label';
      label.textContent = headerConfig.column || '';
      if (headerConfig.required) {
        const requiredSpan = document.createElement('span');
        requiredSpan.className = 'required-indicator';
        requiredSpan.textContent = '*';
        label.appendChild(requiredSpan);
      }

      // 2. Lấy giá trị khởi tạo từ preset, mặc định là 0
      let initialValue = parseInt(headerConfig.preset, 10);
      if (isNaN(initialValue)) {
        initialValue = 0;
      }

      // 3. Tạo cấu trúc HTML cho stepper
      const stepper = document.createElement('div');
      stepper.className = 'stepper';

      // Đổi tên ID
      const inputId = `stepper-input-${entryId}-${fieldIndex}`;
      const displayId = `stepper-display-${entryId}-${fieldIndex}`;
      stepper.dataset.targetInput = inputId;
      stepper.dataset.targetDisplay = displayId;

      stepper.innerHTML = `
        <button type="button" class="stepper-btn" data-step="-1">-</button>
        <span id="${displayId}">${initialValue}</span>
        <input type="hidden" id="${inputId}" value="${initialValue}">
        <button type="button" class="stepper-btn" data-step="1">+</button>
      `;

      // 4. Gắn logic từ habit.js (bao gồm nhấn giữ và rung)
      let stepperInterval = null;
      const intervalSpeed = 100;
      const input = stepper.querySelector(`#${inputId}`);
      const display = stepper.querySelector(`#${displayId}`);

      const updateStep = (button) => {
        const stepAmount = parseInt(button.dataset.step);
        let currentValue = parseInt(input.value);
        let newValue = currentValue + stepAmount;
        if (newValue < 0) newValue = 0; // Vẫn cho phép giá trị 0

        input.value = newValue;
        display.innerText = newValue;

        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }

      const startStepping = (event) => {
        event.preventDefault();
        const buttonElement = event.currentTarget;
        updateStep(buttonElement);
        stepperInterval = setInterval(() => {
          updateStep(buttonElement);
        }, intervalSpeed);
      }

      const stopStepping = () => {
        if (stepperInterval) {
          clearInterval(stepperInterval);
          stepperInterval = null;
        }
      }

      const buttons = stepper.querySelectorAll('.stepper-btn');
      buttons.forEach(button => {
        button.addEventListener('mousedown', startStepping);
        button.addEventListener('touchstart', startStepping, { passive: false });
        button.addEventListener('mouseup', stopStepping);
        button.addEventListener('mouseleave', stopStepping);
        button.addEventListener('touchend', stopStepping);
        button.addEventListener('touchcancel', stopStepping);
      });

      // 5. Gắn vào DOM
      field.insertBefore(label, control);
      control.appendChild(stepper);
      field.classList.add('vg-field--stepper');
    },
    // --- KẾT THÚC HÀM ĐÃ ĐỔI TÊN ---

    // UPDATED: Hàm được viết lại hoàn toàn
    _createDateField(control, headerConfig) {
      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      dateInput.className = 'vg-input';

      const preset = headerConfig.preset;
      if (preset) {
        if (String(preset).toLowerCase() === 'now') {
          // Xử lý 'now'
          const now = new Date();
          now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
          dateInput.value = now.toISOString().slice(0, 10);
        } else {
          // Xử lý giá trị cụ thể (ví dụ: "2025-10-22")
          dateInput.value = preset;
        }
      }
      // Nếu không có preset, value sẽ rỗng (theo yêu cầu)

      control.appendChild(dateInput);
    },
    // UPDATED: Hàm được viết lại hoàn toàn
    _createTimeField(control, headerConfig) {
      const timeInput = document.createElement('input');
      timeInput.type = 'time';
      timeInput.className = 'vg-input';

      const preset = headerConfig.preset;
      if (preset) {
        if (String(preset).toLowerCase() === 'now') {
          // Xử lý 'now'
          const now = new Date();
          const hours = String(now.getHours()).padStart(2, '0');
          const minutes = String(now.getMinutes()).padStart(2, '0');
          timeInput.value = `${hours}:${minutes}`;
        } else {
          // Xử lý giá trị cụ thể (ví dụ: "12:30")
          timeInput.value = preset;
        }
      }
      // Nếu không có preset, value sẽ rỗng (theo yêu cầu)

      control.appendChild(timeInput);
    },

    _createNumberField(control, headerConfig) {
      const numberInput = document.createElement('input');
      numberInput.type = 'number';
      numberInput.placeholder = this.helpers.getPlaceholderText(headerConfig);
      numberInput.className = 'vg-input';

      // UPDATED: Thêm logic preset
      if (headerConfig.preset) {
        numberInput.value = headerConfig.preset;
      }

      control.appendChild(numberInput);
    },

    _createMoneyField(control, headerConfig) {
      const moneyInput = document.createElement('input');
      moneyInput.type = 'text';
      moneyInput.inputMode = 'numeric';
      moneyInput.placeholder = this.helpers.getPlaceholderText(headerConfig);
      moneyInput.className = 'vg-input';

      // UPDATED: Thêm logic preset
      if (headerConfig.preset) {
        moneyInput.value = headerConfig.preset;
      }

      control.appendChild(moneyInput);
      new Cleave(moneyInput, {
        numeral: true,
        numeralThousandsGroupStyle: 'thousand',
        delimiter: '.',
        numeralDecimalScale: 0,
        numeralDecimalMark: ','
      });
    },
    _createTextField(control, headerConfig) {
      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.placeholder = this.helpers.getPlaceholderText(headerConfig);
      textInput.className = 'vg-input';

      // UPDATED: Thêm logic preset
      if (headerConfig.preset) {
        textInput.value = headerConfig.preset;
      }

      control.appendChild(textInput);
    },

    _createTextAreaField(control, headerConfig) {
      const textArea = document.createElement('textarea');
      textArea.rows = 4;
      textArea.placeholder = this.helpers.getPlaceholderText(headerConfig);
      textArea.className = 'vg-input';

      // UPDATED: Thêm logic preset
      if (headerConfig.preset) {
        textArea.value = headerConfig.preset;
      }

      control.appendChild(textArea);
    },

    // UPDATED: Thay đổi chữ ký hàm và thêm logic preset
    _createQuillEditor(container, headerConfig) {
      // Lấy placeholder từ helper
      const placeholder = this.helpers.getPlaceholderText(headerConfig);

      const wrapper = document.createElement('div');
      const editorDiv = document.createElement('div');
      editorDiv.className = 'editor-container';
      wrapper.appendChild(editorDiv);
      container.appendChild(wrapper);

      const quill = new Quill(editorDiv, {
        theme: 'snow',
        placeholder, // Sử dụng placeholder đã tính toán
        modules: {
          toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], [{ indent: '-1' }, { indent: '+1' }], ['clean']]
        }
      });

      // UPDATED: Thêm logic preset
      if (headerConfig.preset) {
        // Gán nội dung HTML từ preset vào Quill
        quill.pasteHTML(headerConfig.preset);
      }

      return quill;
    }
  },

  // =================================================================
  // --- DATA (Thu thập & xác thực) ---
  // =================================================================
  data: {
    async collectData() {
      const passData = await new Promise(resolve => StorageUtil.get(this.config.CACHE_PASS, resolve));
      const pass = passData[this.config.CACHE_PASS] || '';

      const selectedCategoryName = this.dom.danhMucSelect?.value;
      const categories = await new Promise(resolve => StorageUtil.get('danhMuc', data => resolve(data.danhMuc || [])));
      const selectedCategory = categories.find(c => c.table === selectedCategoryName);

      const entries = Array.from(this.dom.entriesContainer.querySelectorAll('.vg-entry')).map((entry, idx) => {
        const entryId = Number(entry.id.split('-')[2]);
        const fields = Array.from(entry.querySelectorAll('.vg-field')).map((fieldNode, fieldIdx) => {
          const type = fieldNode.dataset.headerType;
          let value;

          if (type === 'richtext') {
            const quill = this.state.quillInstances.get(`${entryId}-${fieldIdx}`);
            const rawValue = quill?.root.innerHTML || '';
            value = (rawValue.trim() === '<p><br></p>') ? '' : rawValue;
          }
          else if (type === 'selectbox') {
            value = fieldNode.querySelector('select')?.value || '';
          } else if (type === 'checkbox') {
            value = fieldNode.querySelector('input[type=checkbox]')?.checked || false;
          } else if (type === 'money') {
            value = (fieldNode.querySelector('input')?.value || '').replace(/\D/g, '');
          } else {
            // UPDATED: Sửa selector để bắt cả 'input' và 'textarea'
            const inputElement = fieldNode.querySelector('input, textarea');
            value = inputElement?.value || '';
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
        pass: pass,
        danhMuc: selectedCategoryName,
        duLieu: entries,
        action: this.config.API_ACTION_ADD_VIETGIDO
      };
    },
    validateData(data) {
      if (data.duLieu.length === 0) return 'Vui lòng thêm ít nhất một vùng!';
      for (let i = 0; i < data.duLieu.length; i++) {
        const entry = data.duLieu[i];
        for (const field of entry.fields) {
          if (field.required) {
            if (field.type === 'richtext' && (!field.value || field.value.trim() === '<p><br></p>')) {
              return `Vui lòng nhập nội dung cho trường "${field.column}" ở vùng ${i + 1}!`;
            }
            if ((field.type === 'text' || field.type === 'textarea') && !field.value) {
              return `Vui lòng nhập nội dung cho trường "${field.column}" ở vùng ${i + 1}!`;
            }
            if (field.type === 'selectbox' && !field.value) {
              return `Vui lòng chọn giá trị cho trường "${field.column}" ở vùng ${i + 1}!`;
            }

            if (field.type === 'stepper') {
              const numericValue = parseInt(field.value, 10);
              // Kiểm tra nếu không phải là số HOẶC nhỏ hơn hoặc bằng 0
              if (isNaN(numericValue) || numericValue <= 0) {
                return `Vui lòng nhập giá trị lớn hơn 0 cho trường "${field.column}" ở vùng ${i + 1}!`;
              }
            }
          }
        }
      }
      return null;
    },

    async updateCategoriesFromAPI() {
      const passData = await new Promise(resolve => StorageUtil.get(this.config.CACHE_PASS, resolve));
      const pass = (passData[this.config.CACHE_PASS] || '').trim();

      if (!pass) return false;

      try {
        const response = await fetch(this.config.API, {
          method: 'POST',
          body: JSON.stringify({ pass: pass, action: this.config.API_ACTION_GET_DANHMUC_QUOTES })
        });
        if (!response.ok) throw new Error(`Lỗi mạng: ${response.statusText}`);
        const resp = await response.json();
        if (resp?.code !== 1) throw new Error(resp?.error || 'Server trả về lỗi.');

        // --- CẬP NHẬT LOGIC TỪ ĐÂY ---
        let payload = (typeof resp.data === 'string') ? JSON.parse(resp.data) : resp.data;

        // Payload giờ là 1 object { danhMuc: [], quotes: [] }
        if (typeof payload !== 'object' || payload === null) {
          throw new Error('Dữ liệu trả về không hợp lệ.');
        }

        const categories = payload.danhMuc;
        const quotes = payload.quotes; // Lấy mảng quotes mới

        if (!Array.isArray(categories)) {
          throw new Error('Dữ liệu "danhMuc" trả về không phải là mảng.');
        }

        // Lưu cả hai vào cache
        await new Promise(resolve => StorageUtil.set({
          danhMuc: categories,
          [this.config.CACHE_QUOTES]: quotes || [] // Lưu cả quotes
        }, resolve));

        this.ui.showNotification.call(this, 'Đã cập nhật danh sách danh mục & quotes!', 'success');

        // Chỉ populate categories như cũ
        this.render.populateCategories.call(this, categories);
        return true;
        // --- KẾT THÚC CẬP NHẬT ---
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
    setButtonsState: function (enabled, keepUpdateBtn = enabled) {
      if (!this.dom) return; // Add guard clause
      const app = this.dom.addBtn ? this : VietGidoApp; // Get correct context

      app.dom.addBtn.disabled = !enabled;
      app.dom.submitBtn.disabled = !enabled;
      app.dom.updateDanhMucBtn.disabled = !keepUpdateBtn;
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

// --- THAY THẾ TOÀN BỘ HÀM NÀY ---
    showNotification(message, type = 'info', duration = 3000) {
      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      notification.textContent = message;
      document.body.appendChild(notification);
      requestAnimationFrame(() => notification.classList.add('show'));
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }, duration); // SỬ DỤNG DURATION MỚI
    },
    // --- KẾT THÚC THAY THẾ ---



// --- THAY THẾ TOÀN BỘ HÀM NÀY ---
    showCongrats() {
      const overlay = this.dom.congratsOverlay;
      const player = this.dom.lottieMainPlayer;
      const effects = this.helpers.lottieAnimations;

      if (!overlay || !player || effects.length === 0) return;

      // 1. HIỂN THỊ THÔNG BÁO THÀNH CÔNG (3 GIÂY)
      this.ui.showNotification.call(this, '🎉 Chúc mừng! Đã lưu thành công! 🎉', 'success', 3000);
      
      // === THÊM HIỆU ỨNG RUNG TẠI ĐÂY ===
      if (navigator.vibrate) {
          navigator.vibrate(200); // Rung 200ms để nhấn mạnh thành công
      }
      // ===================================

      // 2. Chọn ngẫu nhiên 1 hiệu ứng và tải
      const effect = effects[Math.floor(Math.random() * effects.length)];
      player.load(effect.src); 

      // 3. Hiển thị overlay và chạy (Lottie 5 GIÂY)
      overlay.style.display = 'flex';
      
      player.classList.add('lottie-full-screen');
      
      player.style.display = 'block';
      setTimeout(() => { 
        player.style.opacity = 1;
        player.stop(); 
        player.play(); 
      }, 50);

      // 4. Đặt hẹn giờ để đóng Lottie (5 GIÂY)
      setTimeout(() => {
        overlay.style.display = 'none';
        
        player.stop();
        player.style.opacity = 0;
        player.style.display = 'none';
        player.classList.remove('lottie-full-screen');
        
      }, 5000); // Kéo dài hiệu ứng Lottie ra 5 giây
    },
    // --- KẾT THÚC THAY THẾ ---


    // THÊM MỚI HÀM NÀY
    applyToolbarVisibility(show) {
      if (this.dom.entriesContainer) {
        // 'hide-all-toolbars' là class chúng ta định nghĩa trong CSS
        // toggle(className, force)
        // Nếu show = true, force = false -> class bị xóa (toolbar hiện)
        // Nếu show = false, force = true -> class được thêm (toolbar ẩn)
        this.dom.entriesContainer.classList.toggle('hide-all-toolbars', !show);
      }
    },

    // THÊM MỚI TẠI ĐÂY
    applyFieldVisibility(hideUnrequired) {
      if (this.dom.entriesContainer) {
        // --- LOGIC ĐÃ ĐẢO NGƯỢC ---
        // hideUnrequired = true (ON) -> Thêm class 'hide-unrequired-fields'
        // hideUnrequired = false (OFF) -> Xóa class
        this.dom.entriesContainer.classList.toggle('hide-unrequired-fields', hideUnrequired);
      }
    }
  },

  // =================================================================
  // --- HELPERS (Hàm hỗ trợ) ---
  // =================================================================
  helpers: {
    lottieAnimations: [
      {
        src: 'library/lottie/Fireworks.json', // Tên file của bạn
      },
      {
        src: 'library/lottie/Trophy.json',
      },
      {
        src: 'library/lottie/done.json',
      }
    ],

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







  }
};

// Khởi chạy ứng dụng khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  VietGidoApp.init();
});