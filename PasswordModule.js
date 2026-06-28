// Plain script (no import/export) — loaded via <script src> in HTML and manifest
var PasswordModule = (function () {
    let _onSavedCallback = null;

    const css = `
        #pwd-modal-overlay {
            position: fixed !important;
            top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
            width: 100vw !important; height: 100vh !important;
            background: rgba(0,0,0,0.5) !important; background-color: rgba(0,0,0,0.5) !important;
            display: none; justify-content: center !important; align-items: center !important;
            z-index: 2147483647 !important;
        }
        #pwd-modal-overlay.active { display: flex !important; }
        .pwd-modal-content {
            all: initial;
            display: block !important;
            background: #f4f7f6 !important; padding: 25px !important; border-radius: 12px !important;
            width: 350px !important; box-shadow: 0 10px 25px rgba(0,0,0,0.2) !important;
            font-family: sans-serif !important; text-align: center !important; position: relative !important;
            box-sizing: border-box !important;
        }
        .pwd-modal-content h3 { display: block !important; margin: 0 0 15px !important; color: #053d8b !important; font-size: 19px !important; font-weight: bold !important; }
        .pwd-modal-content label { display: block !important; text-align: left !important; margin-bottom: 8px !important; font-weight: 500 !important; font-size: 14px !important; color: #333 !important; }
        .pwd-modal-content input {
            display: block !important; width: 100% !important; padding: 12px !important; margin-bottom: 20px !important;
            border: 1px solid #ccc !important; border-radius: 8px !important; box-sizing: border-box !important;
            font-size: 16px !important; font-family: sans-serif !important; color: #333 !important; background: #fff !important;
        }
        .pwd-btn-save {
            display: block !important; width: 100% !important; padding: 12px !important; background: #053d8b !important; color: white !important;
            border: none !important; border-radius: 8px !important; cursor: pointer !important; font-weight: bold !important;
            font-size: 14px !important; font-family: sans-serif !important;
        }
        .pwd-btn-save:disabled { background: #ccc !important; }
        .pwd-close {
            position: absolute !important; top: 10px !important; right: 15px !important;
            cursor: pointer !important; font-size: 20px !important; color: #999 !important;
            background: none !important; border: none !important; line-height: 1 !important;
        }
        .pwd-msg { color: green !important; margin-top: 10px !important; display: none !important; font-size: 14px !important; }
        .pwd-msg.show { display: block !important; }
    `;

    function injectCSS() {
        if (document.getElementById('pwd-util-style')) return;
        const style = document.createElement('style');
        style.id = 'pwd-util-style';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function createModalHTML() {
        if (document.getElementById('pwd-modal-overlay')) return;
        const html = `
            <div id="pwd-modal-overlay">
                <div class="pwd-modal-content">
                    <span class="pwd-close" id="pwd-close-btn">&times;</span>
                    <h3>Cấu hình bảo mật</h3>
                    <div class="input-group">
                        <label for="pwd-input">Password:</label>
                        <input type="password" id="pwd-input" placeholder="Nhập key tại đây...">
                    </div>
                    <button id="pwd-save-btn" class="pwd-btn-save">Lưu thay đổi</button>
                    <div id="pwd-message" class="pwd-msg">✅ Đã lưu thành công!</div>
                </div>
            </div>
        `;
        document.documentElement.insertAdjacentHTML('beforeend', html);
        initEvents();
    }

    function initEvents() {
        const overlay = document.getElementById('pwd-modal-overlay');
        const closeBtn = document.getElementById('pwd-close-btn');
        const saveBtn = document.getElementById('pwd-save-btn');
        const input = document.getElementById('pwd-input');

        closeBtn.onclick = () => { _onSavedCallback = null; overlay.classList.remove('active'); };
        overlay.onclick = (e) => {
            if (e.target === overlay) { _onSavedCallback = null; overlay.classList.remove('active'); }
        };

        saveBtn.onclick = () => {
            const val = input.value;
            if (!val) return;
            saveBtn.disabled = true;
            saveBtn.textContent = 'Đang lưu...';
            chrome.storage.local.set({ [CACHE_PASS]: val }, () => {
                const msg = document.getElementById('pwd-message');
                msg.classList.add('show');
                saveBtn.textContent = 'Đã lưu!';
                const cb = _onSavedCallback;
                _onSavedCallback = null;
                if (cb) cb(val);
                setTimeout(() => {
                    overlay.classList.remove('active');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Lưu thay đổi';
                    msg.classList.remove('show');
                }, 1000);
            });
        };

        input.onkeyup = (e) => { if (e.key === 'Enter') saveBtn.click(); };
    }

    function openPasswordPopup(onSaved) {
        _onSavedCallback = (typeof onSaved === 'function') ? onSaved : null;
        injectCSS();
        createModalHTML();
        const overlay = document.getElementById('pwd-modal-overlay');
        const input = document.getElementById('pwd-input');
        overlay.classList.add('active');
        chrome.storage.local.get(CACHE_PASS, (result) => {
            if (result[CACHE_PASS]) input.value = result[CACHE_PASS];
            input.focus();
        });
    }

    return { openPasswordPopup };
})();
