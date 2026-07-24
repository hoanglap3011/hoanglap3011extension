// pip_reminder_checker.js
// Inject overlay cảnh báo vào tab khi chưa mở PiP của Neo Anchor
// (cùng pattern với selfcontrol_checker.js)

(function () {
    const OVERLAY_ID = '__laps_pip_overlay__';

    function createOverlay() {
        if (document.getElementById(OVERLAY_ID)) return;

        const overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 2147483647;
            background: rgba(15, 15, 15, 0.92);
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
            backdrop-filter: blur(6px);
        `;

        overlay.innerHTML = `
            <div style="
                background: #fff;
                border-radius: 16px;
                padding: 36px 40px;
                max-width: 420px;
                width: 90%;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                text-align: center;
            ">
                <div style="font-size: 52px; margin-bottom: 12px;">🎯</div>
                <h2 style="margin: 0 0 10px; font-size: 1.3em; color: #c62828;">
                    Chưa mở PiP!
                </h2>
                <p style="margin: 0 0 24px; color: #555; font-size: 0.95em; line-height: 1.6;">
                    Làm việc có ý thức: phải có <strong>task đang chạy</strong> hiển thị
                    trước mắt trong cửa sổ PiP của <strong>Neo Anchor</strong>.<br>
                    Hãy mở Neo Anchor — thao tác đầu tiên trong đó sẽ tự bật PiP.
                </p>
                <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                    <button id="__laps_pip_open_btn__" style="
                        background: #e53935;
                        color: #fff;
                        border: none;
                        border-radius: 8px;
                        padding: 10px 24px;
                        font-size: 0.95em;
                        font-weight: bold;
                        cursor: pointer;
                        transition: background 0.15s;
                    ">Mở Neo Anchor</button>
                    <button id="__laps_pip_recheck_btn__" style="
                        background: #fff;
                        color: #555;
                        border: 1px solid #ccc;
                        border-radius: 8px;
                        padding: 10px 24px;
                        font-size: 0.95em;
                        cursor: pointer;
                    ">Đã mở rồi, kiểm tra lại</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const openBtn = document.getElementById('__laps_pip_open_btn__');
        openBtn.addEventListener('mouseenter', function () { this.style.background = '#c62828'; });
        openBtn.addEventListener('mouseleave', function () { this.style.background = '#e53935'; });
        openBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'pipOpenAnchor' });
        });

        // Khi bấm nút → báo background kiểm tra lại
        document.getElementById('__laps_pip_recheck_btn__').addEventListener('click', () => {
            removeOverlay();
            chrome.runtime.sendMessage({ action: 'pipCheckNow' });
        });
    }

    function removeOverlay() {
        const el = document.getElementById(OVERLAY_ID);
        if (el) el.remove();
    }

    // Lắng nghe lệnh từ background
    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === 'pipShowOverlay') {
            createOverlay();
        }
        if (request.action === 'pipHideOverlay') {
            removeOverlay();
        }
    });
})();
