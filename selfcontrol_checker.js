// selfcontrol_checker.js
// Inject overlay cảnh báo vào tab khi SelfControl chưa bật

(function () {
    const OVERLAY_ID = '__laps_sc_overlay__';

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
                <div style="font-size: 52px; margin-bottom: 12px;">🔒</div>
                <h2 style="margin: 0 0 10px; font-size: 1.3em; color: #c62828;">
                    SelfControl chưa được bật!
                </h2>
                <p style="margin: 0 0 20px; color: #555; font-size: 0.95em; line-height: 1.6;">
                    Một hoặc nhiều website trong danh sách kiểm tra vẫn đang <strong>truy cập được</strong>.<br>
                    Hãy bật <strong>SelfControl</strong> trước khi tiếp tục.
                </p>
                <div id="__laps_sc_site_list__" style="
                    background: #fce4ec;
                    border-radius: 8px;
                    padding: 10px 14px;
                    margin-bottom: 24px;
                    font-size: 0.88em;
                    color: #b71c1c;
                    text-align: left;
                    line-height: 1.8;
                "></div>
                <button id="__laps_sc_close_btn__" style="
                    background: #e53935;
                    color: #fff;
                    border: none;
                    border-radius: 8px;
                    padding: 10px 28px;
                    font-size: 0.95em;
                    font-weight: bold;
                    cursor: pointer;
                    transition: background 0.15s;
                ">Đã bật SelfControl rồi, kiểm tra lại</button>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById('__laps_sc_close_btn__').addEventListener('mouseenter', function () {
            this.style.background = '#c62828';
        });
        document.getElementById('__laps_sc_close_btn__').addEventListener('mouseleave', function () {
            this.style.background = '#e53935';
        });

        // Khi bấm nút → báo background kiểm tra lại
        document.getElementById('__laps_sc_close_btn__').addEventListener('click', () => {
            removeOverlay();
            chrome.runtime.sendMessage({ action: 'scCheckNow' });
        });
    }

    function removeOverlay() {
        const el = document.getElementById(OVERLAY_ID);
        if (el) el.remove();
    }

    function updateSiteList(unblockedSites) {
        const el = document.getElementById('__laps_sc_site_list__');
        if (!el) return;
        el.innerHTML = unblockedSites.map(s => `⚠️ <strong>${s}</strong> — chưa bị chặn`).join('<br>');
    }

    // Lắng nghe lệnh từ background
    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === 'scShowOverlay') {
            createOverlay();
            updateSiteList(request.unblockedSites || []);
        }
        if (request.action === 'scHideOverlay') {
            removeOverlay();
        }
    });
})();