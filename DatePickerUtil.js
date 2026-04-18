// DatePickerUtil.js
const DatePickerUtil = (function () {
    let datepickerInstance = null;
    let inputEl = null;
    let currentCallback = null;
    let lastExecutionTime = 0;
    let isDeleting = false;

    // --- Helpers ---

    function _parseInput(value) {
        const match = value.match(/^(\d{2})[./](\d{2})[./](\d{4})$/);
        if (!match) return null;
        const [, d, m, y] = match.map(Number);
        if (m < 1 || m > 12 || d < 1 || y < 1900 || y > 2100) return null;
        const date = new Date(y, m - 1, d);
        return (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d)
            ? date : null;
    }

    function _shakeInput() {
        inputEl.style.outline = '2px solid red';
        setTimeout(() => { inputEl.style.outline = ''; }, 800);
    }

    function _setInputVisible(visible, rect) {
        if (visible) {
            Object.assign(inputEl.style, {
                display: 'block', opacity: '1', pointerEvents: 'auto', color: 'black',
                width: rect.width + 'px',
                top: (window.scrollY + rect.bottom) + 'px',
                left: (window.scrollX + rect.left) + 'px',
            });
        } else {
            Object.assign(inputEl.style, { display: 'none', opacity: '0', pointerEvents: 'none' });
        }
    }

    // Debounce: bỏ qua nếu gọi trong vòng 200ms
    function _throttledFire(date) {
        const now = Date.now();
        if (now - lastExecutionTime < 200) return;
        lastExecutionTime = now;
        if (currentCallback) currentCallback(date);
        datepickerInstance.hide();
    }

    // --- Event handlers ---

    function _getFocusedDateFromPicker() {
        // Đọc cell đang được focus (keyboard cursor) trong picker DOM
        const ts = document.querySelector('.datepicker-cell.day.focused')?.dataset.date;
        return ts ? new Date(parseInt(ts, 10)) : null;
    }

    function _onKeydown(e) {
        if (e.key === 'Enter') {
            // Ưu tiên parse từ input (gõ tay), fallback sang cell focused (keyboard navigation)
            const date = _parseInput(inputEl.value) || _getFocusedDateFromPicker();
            date ? _throttledFire(date) : _shakeInput();
            return;
        }

        isDeleting = (e.key === 'Backspace' || e.key === 'Delete');

        if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Escape'].includes(e.key)) return;

        if (!/^[\d./]$/.test(e.key)) { e.preventDefault(); return; }

        if (inputEl.value.length >= 10 && !window.getSelection().toString()) e.preventDefault();
    }

    function _onInput() {
        let v = inputEl.value
            .replace(/\//g, '.')       // / → .
            .replace(/[^\d.]/g, '')    // chỉ giữ số và .
            .replace(/\.{2,}/g, '.'); // không cho .. liền nhau

        // Tự động thêm dấu . sau dd và dd.mm (chỉ khi không đang xóa)
        if (!isDeleting && /^\d{2}(\.\d{2})?$/.test(v)) v += '.';

        if (inputEl.value !== v) inputEl.value = v;
        isDeleting = false;

        inputEl.style.color = (v.length === 10 && !_parseInput(v)) ? 'red' : 'black';
    }

    // --- Init ---

    function initInput() {
        if (inputEl) return;

        inputEl = document.createElement('input');
        Object.assign(inputEl, { type: 'text', className: 'form-control', placeholder: 'dd.mm.yyyy', maxLength: 10 });
        Object.assign(inputEl.style, { position: 'absolute', zIndex: '2000', display: 'none', opacity: '0', pointerEvents: 'none' });
        document.body.appendChild(inputEl);

        inputEl.addEventListener('keydown', _onKeydown);
        inputEl.addEventListener('input', _onInput);

        document.addEventListener('click', (e) => {
            if (e.target.closest('.datepicker-cell.day, .today-btn')) {
                setTimeout(() => {
                    const date = datepickerInstance.getDate();
                    if (date) _throttledFire(date);
                }, 50);
            }
        });
    }

    function pickDate(triggerElement, onSelectCallback) {
        initInput();
        currentCallback = onSelectCallback;
        inputEl.value = '';

        _setInputVisible(true, triggerElement.getBoundingClientRect());

        if (!datepickerInstance) {
            datepickerInstance = new Datepicker(inputEl, {
                buttonClass: 'btn',
                autohide: true,
                format: 'dd.mm.yyyy',
                language: 'vi',
                container: 'body',
                keyboardNavigation: true,
                updateOnBlur: false,
                todayBtn: true,
                todayBtnMode: 1,
                todayHighlight: true,
                weekStart: 1
            });

            inputEl.addEventListener('hide', () => _setInputVisible(false));
        }

        datepickerInstance.show();
        inputEl.focus();
    }

    return { pickDate };
})();
