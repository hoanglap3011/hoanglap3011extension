(function() {
    const storage = {
        isExtension: () => typeof chrome !== 'undefined' && chrome.storage?.local,
        get: (keys, cb) => {
            if (storage.isExtension()) {
                chrome.storage.local.get(keys, cb);
            } else {
                const result = {};
                result[Array.isArray(keys) ? keys[0] : keys] = null;
                cb(result);
            }
        }
    };
    storage.get(SETTINGS_KEY, (data) => {
        const settings = { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };
        if (settings.sbEnable) {
            initSummaryBox(settings);
        }
    });
})();

function initSummaryBox() {
        if (document.getElementById('lp-summary-box-container')) return;

        const container = document.createElement('div');
        container.id = 'lp-summary-box-container';
        document.body.appendChild(container);
        const shadow = container.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
            #lp-box {
                position: fixed; z-index: 2147483647;
                background: white; border: 1px solid #ccc;
                border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex; flex-direction: column; overflow: hidden;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                min-width: 200px; min-height: 100px;
            }
            .header {
                background: #f8f9fa; padding: 8px 12px; cursor: move;
                display: flex; justify-content: space-between; align-items: center;
                border-bottom: 1px solid #eee; user-select: none;
            }
            .title { font-weight: 600; font-size: 13px; color: #444; }
            .btns button {
                border: none; background: none; cursor: pointer;
                padding: 0 5px; font-size: 16px; color: #888;
            }
            .btns button:hover { color: #000; }
            #content { padding: 12px; flex: 1; overflow-y: auto; font-size: 14px; color: #333; }
            
            /* Thư nhỏ thành thanh bar */
            #lp-box.minimized {
                width: 220px !important; height: 38px !important;
                bottom: 10px !important; right: 10px !important;
                top: auto !important; left: auto !important;
            }
            #lp-box.minimized #content, #lp-box.minimized .resizer { display: none; }
            
            .resizer {
                width: 12px; height: 12px; position: absolute;
                right: 0; bottom: 0; cursor: nwse-resize;
                background: linear-gradient(135deg, transparent 50%, #ccc 50%);
            }
        `;
        shadow.appendChild(style);

        const lpBox = document.createElement('div');
        lpBox.id = 'lp-box';
        
        // Load trạng thái cũ
        chrome.storage.local.get(['summaryBoxState'], (res) => {
            const s = res.summaryBoxState || { top: '20px', right: '20px', width: '300px', height: '200px', isMin: false };
            Object.assign(lpBox.style, { top: s.top, right: s.right, left: s.left, width: s.width, height: s.height });
            if(s.isMin) {
                lpBox.classList.add('minimized');
                lpBox.querySelector('#btn-max').style.display = 'inline';
                lpBox.querySelector('#btn-min').style.display = 'none';
            }
        });

        lpBox.innerHTML = `
            <div class="header">
                <span class="title">✨ Tóm tắt trang</span>
                <div class="btns">
                    <button id="btn-min" title="Thu nhỏ">_</button>
                    <button id="btn-max" title="Phóng to" style="display:none">▢</button>
                    <button id="btn-close" title="Đóng">×</button>
                </div>
            </div>
            <div id="content">Đang tải dữ liệu...</div>
            <div class="resizer"></div>
        `;
        shadow.appendChild(lpBox);

        // --- Event Handlers ---
        const btnMin = lpBox.querySelector('#btn-min');
        const btnMax = lpBox.querySelector('#btn-max');
        const btnClose = lpBox.querySelector('#btn-close');

        const save = () => {
            chrome.storage.local.set({ summaryBoxState: {
                top: lpBox.style.top, right: lpBox.style.right, left: lpBox.style.left,
                width: lpBox.style.width, height: lpBox.style.height,
                isMin: lpBox.classList.contains('minimized')
            }});
        };

        btnMin.onclick = () => {
            lpBox.classList.add('minimized');
            btnMin.style.display = 'none'; btnMax.style.display = 'inline';
            save();
        };
        btnMax.onclick = () => {
            lpBox.classList.remove('minimized');
            btnMin.style.display = 'inline'; btnMax.style.display = 'none';
            save();
        };
        btnClose.onclick = () => container.remove();

        // Kéo thả
        lpBox.querySelector('.header').onmousedown = (e) => {
            if (lpBox.classList.contains('minimized')) return;
            let startX = e.clientX, startY = e.clientY;
            let startLeft = lpBox.offsetLeft, startTop = lpBox.offsetTop;
            
            const onMove = (ev) => {
                lpBox.style.left = (startLeft + ev.clientX - startX) + 'px';
                lpBox.style.top = (startTop + ev.clientY - startY) + 'px';
                lpBox.style.right = 'auto';
            };
            document.onmousemove = onMove;
            document.onmouseup = () => { document.onmousemove = null; save(); };
        };

        // Resize
        lpBox.querySelector('.resizer').onmousedown = (e) => {
            e.preventDefault();
            let startW = lpBox.offsetWidth, startH = lpBox.offsetHeight;
            let startX = e.clientX, startY = e.clientY;

            const onResize = (ev) => {
                lpBox.style.width = (startW + ev.clientX - startX) + 'px';
                lpBox.style.height = (startH + ev.clientY - startY) + 'px';
            };
            document.onmousemove = onResize;
            document.onmouseup = () => { document.onmousemove = null; save(); };
        };
    }

