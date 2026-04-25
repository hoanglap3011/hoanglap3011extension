import { StorageModule } from './StorageModule.js';
export const PasswordModule = (function () {
    // 1. Định nghĩa CSS dưới dạng chuỗi (từ password.css)
    const css = `
        #pwd-modal-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.5);
            display: none; justify-content: center; align-items: center; z-index: 10000;
        }
        .pwd-modal-content {
            background: #f4f7f6; padding: 25px; border-radius: 12px;
            width: 350px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            font-family: sans-serif; text-align: center; position: relative;
        }
        .pwd-modal-content h3 { margin: 0 0 15px; color: #053d8b; font-size: 1.2rem; }
        .pwd-modal-content label { display: block; text-align: left; margin-bottom: 8px; font-weight: 500; }
        .pwd-modal-content input {
            width: 100%; padding: 12px; margin-bottom: 20px; border: 1px solid #ccc;
            border-radius: 8px; box-sizing: border-box; font-size: 16px;
        }
        .pwd-btn-save {
            width: 100%; padding: 12px; background: #053d8b; color: white;
            border: none; border-radius: 8px; cursor: pointer; font-weight: bold;
        }
        .pwd-btn-save:disabled { background: #ccc; }
        .pwd-close {
            position: absolute; top: 10px; right: 15px; cursor: pointer; font-size: 20px; color: #999;
        }
        .pwd-msg { color: green; margin-top: 10px; display: none; font-size: 14px; }
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
        document.body.insertAdjacentHTML('beforeend', html);
        initEvents();
    }

    function initEvents() {
        const overlay = document.getElementById('pwd-modal-overlay');
        const closeBtn = document.getElementById('pwd-close-btn');
        const saveBtn = document.getElementById('pwd-save-btn');
        const input = document.getElementById('pwd-input');

        closeBtn.onclick = () => overlay.style.display = 'none';
        
        // Đóng khi click ra ngoài overlay
        overlay.onclick = (e) => {
            if (e.target === overlay) overlay.style.display = 'none';
        };

        saveBtn.onclick = () => {
            const val = input.value;
            if (!val) return;

            saveBtn.disabled = true;
            saveBtn.textContent = "Đang lưu...";

            StorageModule.set({ [CACHE_PASS]: val }, () => {
                const msg = document.getElementById('pwd-message');
                msg.style.display = 'block';
                saveBtn.textContent = "Đã lưu!";
                
                setTimeout(() => {
                    overlay.style.display = 'none';
                    saveBtn.disabled = false;
                    saveBtn.textContent = "Lưu thay đổi";
                    msg.style.display = 'none';
                }, 1000);
            });
        };

        input.onkeyup = (e) => {
            if (e.key === 'Enter') saveBtn.click();
        };
    }

    function openPasswordPopup() {
        injectCSS();
        createModalHTML();
        
        const overlay = document.getElementById('pwd-modal-overlay');
        const input = document.getElementById('pwd-input');
        
        overlay.style.display = 'flex';
        
        // Load mật khẩu cũ
        StorageModule.get([CACHE_PASS], (result) => {
            if (result[CACHE_PASS]) {
                input.value = result[CACHE_PASS];
            }
            input.focus();
        });
    }

    return { openPasswordPopup };
})();