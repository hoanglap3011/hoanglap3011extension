/**
 * ===================================================================
 * HÀM XỬ LÝ YOUTUBE CHÍNH
 * (Hầu hết code gốc được đưa vào hàm này)
 * ===================================================================
 */
async function initializeYouTubeHandler(settings) {

    // (API constants nạp từ config.js)

    // Hàm tiêm CSS (Không thay đổi)
    const injectLoaderCSS = () => {
        const styleId = "my-ext-loader-style";
        if (document.getElementById(styleId)) return;
        const css = `
            .my-ext-button-loader {
                display: inline-block; 
                border: 3px solid rgba(255, 255, 255, 0.3);
                border-top: 3px solid #fff;
                border-radius: 50%;
                width: 14px; 
                height: 14px;
                animation: my-ext-spin 0.8s linear infinite;
                vertical-align: middle; 
                margin: -2px 0;
            }
            @keyframes my-ext-spin { 
                100% { transform: rotate(360deg); } 
            }
            .my-ext-button {
                padding: 8px 16px; border: none; background: #065fd4;
                color: white; border-radius: 18px; cursor: pointer;
                font-size: 14px; font-weight: 500;
                transition: background-color 0.2s ease, opacity 0.2s ease;
                min-width: 60px; 
                text-align: center;
            }
            .my-ext-button:hover:not(:disabled) { background: #0552b0; }
            .my-ext-button:disabled {
                background: #9E9E9E; color: #F5F5F5;
                cursor: not-allowed; opacity: 0.7;
            }
        `;
        const style = document.createElement("style");
        style.id = styleId; style.textContent = css;
        document.head.appendChild(style);
    };
    injectLoaderCSS();

    // ... (Các hàm helper getShortYouTubeUrl, getRandomQuote, getApiPass giữ nguyên) ...
    const getShortYouTubeUrl = (longUrl) => {
        try {
            const urlObj = new URL(longUrl);
            const videoId = urlObj.searchParams.get("v");
            if (videoId) { return `https://youtu.be/${videoId}`; }
        } catch (e) { }
        return longUrl;
    };
    const getRandomQuote = async () => {
        const defaultQuote = `<i style="color: var(--yt-spec-text-secondary);">Đang xử lý yêu cầu...</i>`;
        try {
            // DÙNG HẰNG SỐ
            const result = await chrome.storage.local.get(CACHE_QUOTES);

            // DÙNG HẰNG SỐ
            if (!result[CACHE_QUOTES]) return defaultQuote;

            // DÙNG HẰNG SỐ
            const quotesArray = result[CACHE_QUOTES];

            if (Array.isArray(quotesArray) && quotesArray.length > 0) {
                const randomIndex = Math.floor(Math.random() * quotesArray.length);
                return `<i style="color: var(--yt-spec-text-secondary); text-align: center; display: block;">${quotesArray[randomIndex]}</i>`;
            }
        } catch (e) {
        }
        return defaultQuote;
    };
    const getApiPass = async () => {
        try {
            const result = await chrome.storage.local.get(CACHE_PASS);
            if (result[CACHE_PASS]) {
                return result[CACHE_PASS];
            }
        } catch (e) {
        }
        return null;
    };

    const PARENT_CONTAINER_SELECTOR = "div#related";

    const showSummaryPopup = (summaryContent) => {
        try {
            const popupWidth = 600, popupHeight = 400;
            const left = (window.screen.width / 2) - (popupWidth / 2);
            const top = (window.screen.height / 2) - (popupHeight / 2);
            const popup = window.open("", "summaryPopup", `width=${popupWidth},height=${popupHeight},top=${top},left=${left},scrollbars=yes,resizable=yes`);
            if (popup) {
                popup.document.open();
                popup.document.write(`<html><head><title>Tóm tắt nội dung</title><style>body { font-family: Roboto, Arial, sans-serif; padding: 15px; line-height: 1.6; background: #f9f9f9; color: #333; }</style></head><body></body></html>`);
                const contentDiv = popup.document.createElement("div");
                contentDiv.innerHTML = summaryContent; // Use innerHTML to render HTML content
                popup.document.body.appendChild(contentDiv);
                popup.document.close();
                popup.focus();
            } else { alert("Vui lòng cho phép cửa sổ pop-up để xem tóm tắt."); }
        } catch (e) {}
    };

    const HOMEPAGE_MESSAGE_ID = "my-ext-homepage-message-box";

    /**
     * HÀM MỚI: Ẩn video gợi ý ở Sidebar (Trang Watch)
     * Lưu ý: Ta không ẩn toàn bộ #related vì Box của Extension nằm trong đó.
     * Ta chỉ ẩn các component con của YouTube.
     */
    const injectRelatedHider = () => {
        const styleId = "my-ext-related-hider";
        if (document.getElementById(styleId)) return;

        const css = `
            /* Ẩn danh sách video tiếp theo */
            #related ytd-watch-next-secondary-results-renderer {
                display: none !important;
            }
            /* Ẩn danh sách video gợi ý dạng item section (đề phòng youtube đổi cấu trúc) */
            #related ytd-item-section-renderer {
                display: none !important;
            }
        `;
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = css;
        document.head.appendChild(style);
    };

    /**
     * HÀM MỚI 1: Tiêm CSS vĩnh viễn, chỉ
     * ảnh hưởng đến trang chủ.
     */
    const injectPermanentHomepageHider = () => {
        const styleId = "my-ext-permanent-homepage-hider";
        // Nếu đã tiêm rồi thì bỏ qua
        if (document.getElementById(styleId)) return;

        const css = `
            /* Ẩn lưới video CHỈ KHI nó nằm trong trang chủ */
            ytd-browse[page-subtype="home"] ytd-rich-grid-renderer {
                display: none !important;
            }
            
            /* Ẩn kệ video CHỈ KHI nó nằm trong trang chủ */
            ytd-browse[page-subtype="home"] ytd-rich-shelf-renderer {
                display: none !important;
            }

            /* Ẩn filter CHỈ KHI nó nằm trong trang chủ */
            ytd-browse[page-subtype="home"] #chips {
                display: none !important;
            }
        `;
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = css;
        document.head.appendChild(style);
    };

    /**
     * HÀM MỚI 2: Chỉ tạo box thông điệp (đã tách ra)
     */
    const createMessageBox = () => {
        const messageBox = document.createElement("div");
        messageBox.id = HOMEPAGE_MESSAGE_ID;

    Object.assign(messageBox.style, {
        color: 'var(--yt-spec-text-primary)',        // ✅ bỏ fallback hardcode
        padding: '40px 20px', margin: '16px 0', textAlign: 'center',
        fontSize: '18px', fontWeight: '500', lineHeight: '1.6',
        background: 'var(--yt-spec-base-background)',  // ✅ dùng base background (theo theme)
        borderRadius: '12px', border: '1px dashed var(--yt-spec-10-minute-badging-background)',
    });

        messageBox.innerHTML = `
            Thời gian, năng lượng và cuộc sống là hữu hạn.<br>
            Mỗi lựa chọn hôm nay đều ảnh hưởng đến ngày mai.<br><br>
            <strong style="font-size: 20px; color: var(--yt-spec-call-to-action);">
            Hãy làm chủ YouTube. Đừng để nó làm chủ mình</strong><br><br>
            Sử dụng nó một cách thông minh để phục vụ cho mục tiêu của bạn.
        `;
        return messageBox;
    }

    /**
     * HÀM MỚI 3 (Sửa): Chỉ tiêm THÔNG ĐIỆP, không tiêm CSS
     */
    const injectHomepageMessage = () => {
        if (document.getElementById(HOMEPAGE_MESSAGE_ID)) return;

        // Selector phải thật cụ thể để tìm đúng nơi
        const gridRenderer = document.querySelector('ytd-browse[page-subtype="home"] ytd-rich-grid-renderer');

        if (gridRenderer && gridRenderer.parentNode) {
            const messageBox = createMessageBox();
            gridRenderer.parentNode.prepend(messageBox);
        } else {
            // Nếu không tìm thấy, thử lại sau 0.5s (phòng khi DOM chưa tải)
            setTimeout(injectHomepageMessage, 500);
        }
    };

    /**
     * HÀM MỚI 4 (Sửa): Chỉ gỡ THÔNG ĐIỆP, không gỡ CSS
     */
    const removeHomepageMessage = () => {
        const messageBox = document.getElementById(HOMEPAGE_MESSAGE_ID);
        if (messageBox) {
            messageBox.remove();
        }
    };

    /**
     * HÀM MỚI 5: Hàm kiểm tra (gọi hàm 3 và 4)
     */
    const checkHomepageVisibility = () => {
        // HÀM NÀY SẼ CHỈ CHẠY NẾU settings.ytEnableHomepageHider = true
        if (window.location.pathname === "/") {
            injectHomepageMessage();
        } else {
            removeHomepageMessage();
        }
    };


    /**
      * HÀM MỚI (ĐÃ NÂNG CẤP VÀ SỬA LỖI): Tiêm CSS VÀ Thêm thông điệp
      * (Hàm này có vẻ LẶP LẠI logic với hàm 1, 2, 3. 
      * Hàm injectPermanentHomepageHider (1) và checkHomepageVisibility (5) có vẻ là
      * cách tiếp cận đúng. Tôi sẽ bỏ qua hàm injectHomepageHider và removeHomepageHider
      * bị trùng lặp bên dưới này, vì code ở trên (1-5) có vẻ đã đúng
      * logic chống flash + chèn message.)
      */
    /*
    const injectHomepageHider = () => { ... };
    const removeHomepageHider = () => { ... };
    */
    // (Đã bỏ qua 2 hàm trùng lặp ở trên)



    /**
     * HÀM MỚI: Lấy tiêu đề video từ DOM
     */
    const getVideoTitle = () => {
        // Selector phổ biến nhất cho tiêu đề trên trang xem video
        const titleElement = document.querySelector('h1.style-scope.ytd-watch-metadata yt-formatted-string');
        return titleElement ? titleElement.textContent.trim() : 'Không tìm thấy tiêu đề video';
    };


    // ... (Giữ nguyên các phần code khác của file youtube.js) ...

    /**
     * HÀM MỚI: Tự động click vào Extension NotebookLM
     * Logic: Click nút chính -> Nghỉ 100ms -> Click nút "Create New Notebook"
     */
    const triggerNotebookExtension = async () => {
        try {
            // 1. Tìm nút chính (.ytlm-add-button)
            const container = document.querySelector('.ytlm-add-button');

            if (container) {
                // Click vào button con bên trong (nếu có) hoặc click chính container
                const mainButton = container.querySelector('button, div[role="button"]') || container;
                mainButton.click();

                // 2. Chờ 100ms để menu con kịp "sẵn sàng" (dù là render mới hay chỉ hiện lên)
                await new Promise(r => setTimeout(r, 100));

                // 3. Tìm nút "Create New Notebook" dựa trên data-type bạn cung cấp
                // Selector này tìm trong toàn bộ trang (document) vì menu con thường được gắn vào cuối body
                const createBtn = document.querySelector('[data-type="create-notebook"]');

                if (createBtn) {
                    createBtn.click();
                    return true;
                } else {
                    // FALLBACK: Nếu sau 100ms chưa thấy, thử chờ thêm 1 giây (phòng trường hợp máy lag render chậm)
                    await new Promise(r => setTimeout(r, 1000));

                    const createBtnRetry = document.querySelector('[data-type="create-notebook"]');
                    if (createBtnRetry) {
                        createBtnRetry.click();
                        return true;
                    } else {
                        return false;
                    }
                }
            } else {
                return false;
            }
        } catch (e) {
            return false;
        }
    };

    /**
     * CẬP NHẬT: openVietGidoFlow
     */
    const openVietGidoFlow = async (shortUrl, videoTitle) => {
        // 1. Tự động thao tác Extension NotebookLM (Click tạo mới)
        await triggerNotebookExtension();

        // 3. Mở tab Vietgido
        chrome.runtime.sendMessage(
            {
                action: "openVietGidoTab",
                data: {
                    danhMuc: 'Tóm Tắt - Recap',
                    category: 'youtube',
                    title: videoTitle,
                    code: shortUrl
                }
            },
            (response) => {
                if (chrome.runtime.lastError) {
                } else {
                }
            }
        );
    };

    // 1. Tiêm CSS chống flash Trang chủ (NẾU ĐƯỢC BẬT)
    if (settings.ytEnableHomepageHider) {
        injectPermanentHomepageHider();
    }

    // [MỚI] 2. Tiêm CSS ẩn Sidebar Video (NẾU ĐƯỢC BẬT)
    if (settings.ytEnableHideRelated) {
        injectRelatedHider();
    }


    // 2. Tạo Observer tổng
    const observer = new MutationObserver(() => {
        if (settings.ytEnableHomepageHider) checkHomepageVisibility();
    });

    // 3. Bắt đầu quan sát
    observer.observe(document.body, { childList: true, subtree: true });

    // 4. Chạy lần đầu khi tải trang
    setTimeout(() => {
        if (settings.ytEnableHomepageHider) checkHomepageVisibility();
    }, 1000);

} // <-- Dấu ngoặc đóng hàm initializeYouTubeHandler


/**
 * ===================================================================
 * BOX "TẢI VIDEO" (bật/tắt bằng setting ytEnableDownloadButton)
 * Luồng: box → background.js → helper local (ytdl-helper/ytdl_server.py) → yt-dlp.
 * UI là popup cùng kiểu Box Tóm Tắt (summaryBox.js): kéo-thả, co giãn,
 * thu nhỏ, nhớ vị trí — mọi trạng thái (hướng dẫn cài, tiến trình, kết quả)
 * đều hiển thị trong nội dung box thay vì các bảng nổi rời rạc.
 * ===================================================================
 */
function initializeDownloadButton() {
    const CONTAINER_ID = 'lp-download-box-container';
    if (document.getElementById(CONTAINER_ID)) return;

    let pollTimer = null;
    let currentJobId = null;

    const send = (msg) => new Promise(resolve =>
        chrome.runtime.sendMessage(msg, r => resolve(chrome.runtime.lastError ? null : r)));

    function detectOS() {
        const p = navigator.platform.toLowerCase();
        if (p.includes('win')) return 'windows';
        if (p.includes('mac')) return 'mac';
        return 'linux';
    }

    const SETUP_COMMANDS = {
        mac:     'python3 ~/Downloads/ytdl_server.py install',
        linux:   'python3 ~/Downloads/ytdl_server.py install',
        windows: 'python "$env:USERPROFILE\\Downloads\\ytdl_server.py" install',
    };

    // ==================== Dựng box (cùng kiểu Box Tóm Tắt) ====================

    const container = document.createElement('div');
    container.id = CONTAINER_ID;
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
        #content {
            padding: 12px; flex: 1; overflow-y: auto;
            font-size: 14px; color: #333;
            display: flex; flex-direction: column; gap: 8px;
        }
        /* Thu nhỏ neo cạnh Box Tóm Tắt (box đó nằm ở góc phải dưới cùng) */
        #lp-box.minimized {
            width: 220px !important; height: 38px !important;
            bottom: 10px !important; right: 240px !important;
            top: auto !important; left: auto !important;
        }
        #lp-box.minimized #content,
        #lp-box.minimized .footer,
        #lp-box.minimized .rz { display: none; }
        /* Tay nắm co giãn ở 4 cạnh + 4 góc */
        .rz { position: absolute; z-index: 10; }
        .rz-n  { top: 0; left: 12px; right: 12px; height: 5px; cursor: ns-resize; }
        .rz-s  { bottom: 0; left: 12px; right: 12px; height: 5px; cursor: ns-resize; }
        .rz-e  { right: 0; top: 12px; bottom: 12px; width: 5px; cursor: ew-resize; }
        .rz-w  { left: 0; top: 12px; bottom: 12px; width: 5px; cursor: ew-resize; }
        .rz-ne { top: 0; right: 0; width: 12px; height: 12px; cursor: nesw-resize; }
        .rz-nw { top: 0; left: 0; width: 12px; height: 12px; cursor: nwse-resize; }
        .rz-sw { bottom: 0; left: 0; width: 12px; height: 12px; cursor: nesw-resize; }
        .rz-se {
            bottom: 0; right: 0; width: 12px; height: 12px; cursor: nwse-resize;
            background: linear-gradient(135deg, transparent 50%, #ccc 50%);
        }
        .footer {
            padding: 8px 12px; border-top: 1px solid #eee;
            display: flex; gap: 8px; flex-shrink: 0;
        }
        .btn-action {
            padding: 6px 14px; border: none; background: #065fd4;
            color: white; border-radius: 16px; cursor: pointer;
            font-size: 13px; font-weight: 500;
        }
        .btn-action:hover:not(:disabled) { background: #0552b0; }
        .btn-action:disabled { background: #9e9e9e; cursor: not-allowed; }
        .loader {
            display: inline-block; border: 2px solid rgba(255,255,255,0.3);
            border-top: 2px solid #fff; border-radius: 50%;
            width: 12px; height: 12px;
            animation: spin 0.8s linear infinite; vertical-align: middle;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        a.yt-link {
            color: #065fd4; text-decoration: none; font-weight: 500;
            display: block; padding: 4px 0;
            border-bottom: 1px dashed #eee;
        }
        a.yt-link:hover { text-decoration: underline; }
        .file-path { word-break: break-all; color: #555; font-size: 13px; }
        .bar {
            height: 8px; background: #eee; border-radius: 4px; overflow: hidden;
        }
        .bar-fill {
            height: 100%; width: 0; background: #065fd4;
            transition: width 0.4s ease;
        }
        .pct-label { color: #888; font-style: italic; font-size: 13px; }
        .setup-guide { white-space: pre-wrap; word-break: break-word; font-size: 13px; }
        .setup-cmd {
            display: block; background: #f1f3f4; border-radius: 6px;
            padding: 6px 8px; margin: 4px 0; font-size: 12px;
            word-break: break-all; user-select: all;
        }
    `;
    shadow.appendChild(style);

    const lpBox = document.createElement('div');
    lpBox.id = 'lp-box';

    chrome.storage.local.get(['downloadBoxState'], (res) => {
        const s = res.downloadBoxState || { top: '80px', right: '20px', width: '320px', height: '210px' };
        Object.assign(lpBox.style, { top: s.top, right: s.right, left: s.left, width: s.width, height: s.height });
        if (s.isMin) lpBox.classList.add('minimized');
    });

    lpBox.innerHTML = `
        <div class="header">
            <span class="title">⬇️ Tải video</span>
            <div class="btns">
                <button id="btn-min" title="Thu nhỏ">_</button>
                <button id="btn-max" title="Phóng to" style="display:none">▢</button>
                <button id="btn-close" title="Đóng">×</button>
            </div>
        </div>
        <div id="content"></div>
        <div class="footer">
            <button class="btn-action" id="btn-download">⬇️ Tải video</button>
        </div>
    `;
    shadow.appendChild(lpBox);

    const saveBoxState = () => {
        chrome.storage.local.set({ downloadBoxState: {
            top: lpBox.style.top, right: lpBox.style.right, left: lpBox.style.left,
            width: lpBox.style.width, height: lpBox.style.height,
            isMin: lpBox.classList.contains('minimized')
        }});
    };

    const btnMin   = lpBox.querySelector('#btn-min');
    const btnMax   = lpBox.querySelector('#btn-max');
    const btnClose = lpBox.querySelector('#btn-close');

    btnMin.onclick = () => { lpBox.classList.add('minimized'); btnMin.style.display = 'none'; btnMax.style.display = 'inline'; saveBoxState(); };
    btnMax.onclick = () => { lpBox.classList.remove('minimized'); btnMin.style.display = 'inline'; btnMax.style.display = 'none'; saveBoxState(); };
    btnClose.onclick = () => { clearInterval(pollTimer); container.remove(); };

    lpBox.querySelector('.header').onmousedown = (e) => {
        if (lpBox.classList.contains('minimized')) return;
        let startX = e.clientX, startY = e.clientY;
        let startLeft = lpBox.offsetLeft, startTop = lpBox.offsetTop;
        const onMove = (ev) => {
            lpBox.style.left = (startLeft + ev.clientX - startX) + 'px';
            lpBox.style.top  = (startTop  + ev.clientY - startY) + 'px';
            lpBox.style.right = 'auto';
        };
        document.onmousemove = onMove;
        document.onmouseup = () => { document.onmousemove = null; saveBoxState(); };
    };

    // Co giãn từ cạnh/góc bất kỳ; kéo cạnh trái/trên thì bù vị trí để mép đối diện đứng yên
    const startResize = (e, dirs) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX, startY = e.clientY;
        const startW = lpBox.offsetWidth, startH = lpBox.offsetHeight;
        const startL = lpBox.offsetLeft,  startT = lpBox.offsetTop;
        const MIN_W = 200, MIN_H = 100;
        lpBox.style.left = startL + 'px'; lpBox.style.top = startT + 'px'; lpBox.style.right = 'auto';
        document.onmousemove = (ev) => {
            const dx = ev.clientX - startX, dy = ev.clientY - startY;
            if (dirs.includes('e')) lpBox.style.width  = Math.max(MIN_W, startW + dx) + 'px';
            if (dirs.includes('s')) lpBox.style.height = Math.max(MIN_H, startH + dy) + 'px';
            if (dirs.includes('w')) {
                const w = Math.max(MIN_W, startW - dx);
                lpBox.style.width = w + 'px';
                lpBox.style.left  = (startL + startW - w) + 'px';
            }
            if (dirs.includes('n')) {
                const h = Math.max(MIN_H, startH - dy);
                lpBox.style.height = h + 'px';
                lpBox.style.top    = (startT + startH - h) + 'px';
            }
        };
        document.onmouseup = () => { document.onmousemove = null; saveBoxState(); };
    };
    ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach(dir => {
        const h = document.createElement('div');
        h.className = `rz rz-${dir}`;
        h.onmousedown = (e) => startResize(e, dir);
        lpBox.appendChild(h);
    });

    const contentEl = lpBox.querySelector('#content');
    const btnDownload = lpBox.querySelector('#btn-download');

    // ==================== Các trạng thái hiển thị ====================

    const setStatus = (msg) => { contentEl.innerHTML = `<i style="color:#888">${msg}</i>`; };

    const resetButton = () => {
        btnDownload.disabled = false;
        btnDownload.textContent = '⬇️ Tải video';
    };

    function showIdle() {
        setStatus("Nhấn 'Tải video' để tải video này về thư mục Downloads.");
        resetButton();
    }

    // Kết quả/lỗi chứa text tùy ý từ yt-dlp → dựng bằng textContent, không innerHTML
    function showDone(file, id) {
        contentEl.innerHTML = '';
        const ok = document.createElement('div');
        ok.style.color = '#2e7d32';
        ok.textContent = '✅ Đã tải xong:';
        const path = document.createElement('div');
        path.className = 'file-path';
        path.textContent = file || '';
        const a = document.createElement('a');
        a.className = 'yt-link';
        a.textContent = '📂 Mở thư mục';
        a.href = '#';
        a.onclick = (e) => { e.preventDefault(); send({ action: 'ytdlReveal', id }); };
        contentEl.append(ok, path, a);
    }

    // Thanh tiến trình: dựng 1 lần rồi chỉ cập nhật số + độ rộng,
    // để CSS transition kéo mượt giữa các lần poll
    function showProgress(pct) {
        let wrap = contentEl.querySelector('.dl-progress');
        if (!wrap) {
            contentEl.innerHTML = '';
            wrap = document.createElement('div');
            wrap.className = 'dl-progress';
            const label = document.createElement('div');
            label.className = 'pct-label';
            const bar = document.createElement('div');
            bar.className = 'bar';
            const fill = document.createElement('div');
            fill.className = 'bar-fill';
            bar.appendChild(fill);
            wrap.append(label, bar);
            contentEl.appendChild(wrap);
        }
        wrap.querySelector('.pct-label').textContent = pct >= 100
            ? 'Đang xử lý (ghép video/âm thanh)...'
            : `Đang tải... ${pct}%`;
        wrap.querySelector('.bar-fill').style.width = Math.min(pct, 100) + '%';
    }

    function showError(msg) {
        contentEl.innerHTML = '';
        const head = document.createElement('div');
        head.style.color = 'red';
        head.textContent = '❌ Tải lỗi:';
        const detail = document.createElement('div');
        detail.className = 'file-path';
        detail.textContent = msg || 'không rõ nguyên nhân';
        contentEl.append(head, detail);
    }

    function actionButton(label, onClick) {
        const b = document.createElement('button');
        b.className = 'btn-action';
        b.textContent = label;
        b.onclick = onClick;
        return b;
    }

    function showSetup() {
        const os = detectOS();
        contentEl.innerHTML = '';

        const guide = document.createElement('div');
        guide.className = 'setup-guide';
        guide.textContent =
            '⚠️ Helper tải video chưa chạy trên máy này.\n' +
            'Trình duyệt không cho phép extension tự cài phần mềm, nên cần chạy bộ cài 1 lần:\n' +
            '1. Bấm "Tải bộ cài" (1 file về Downloads)\n' +
            `2. Mở ${os === 'windows' ? 'PowerShell' : 'Terminal'} chạy lệnh:`;
        const cmd = document.createElement('code');
        cmd.className = 'setup-cmd';
        cmd.textContent = SETUP_COMMANDS[os];
        const step3 = document.createElement('div');
        step3.className = 'setup-guide';
        step3.textContent = '3. Xong quay lại đây bấm "Kiểm tra lại"';

        const status = document.createElement('div');
        status.className = 'setup-guide';

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
        row.appendChild(actionButton('📥 Tải bộ cài', async () => {
            const r = await send({ action: 'ytdlGetSetup', os });
            status.textContent = r?.ok ? '✅ Đã tải bộ cài về Downloads' : '❌ Tải bộ cài lỗi';
        }));
        row.appendChild(actionButton('🔄 Kiểm tra lại', async () => {
            const r = await send({ action: 'ytdlPing' });
            if (r?.ok) showIdle();
            else status.textContent = '❌ Vẫn chưa thấy helper — kiểm tra bước cài đặt.';
        }));

        contentEl.append(guide, cmd, step3, row, status);
    }

    // ==================== Tải + theo dõi tiến trình ====================

    async function onDownloadClick() {
        btnDownload.disabled = true;
        btnDownload.innerHTML = '<span class="loader"></span>';
        setStatus('Đang gửi yêu cầu...');
        const res = await send({ action: 'ytdlStart', url: location.href });
        if (res?.ok) {
            trackJob(res.id);
        } else if (res?.noHelper) {
            resetButton();
            showSetup();
        } else {
            resetButton();
            showError(res?.error || 'Lỗi không rõ');
        }
    }

    function trackJob(id) {
        currentJobId = id;
        clearInterval(pollTimer);
        setStatus('Đang phân tích video...');
        // yt-dlp tải video 0→100% rồi tải audio lại từ 0→100% rồi ghép file —
        // giữ % không tụt lùi để thanh chạy một mạch; chạm 100% là giai đoạn audio/ghép
        let shownPct = 0;
        pollTimer = setInterval(async () => {
            const job = await send({ action: 'ytdlStatus', id });
            if (!job) return;
            if (job.status === 'downloading') {
                // nút giữ nguyên vòng xoay — phần trăm chỉ hiện trong nội dung box
                shownPct = Math.max(shownPct, Math.round(job.percent || 0));
                if (shownPct > 0) showProgress(shownPct);
                return;
            }
            clearInterval(pollTimer);
            currentJobId = null;
            resetButton();
            if (job.status === 'done') showDone(job.file, id);
            else showError(job.error);
        }, 500);
    }

    btnDownload.onclick = onDownloadClick;

    // ==================== Điều hướng SPA ====================

    // YouTube chuyển trang không reload → chỉ hiện box trên trang xem video;
    // đang tải dở thì giữ nguyên nội dung để theo dõi tiếp
    function onNavigate() {
        if (location.pathname === '/watch') {
            lpBox.style.display = '';
            if (!currentJobId) showIdle();
        } else {
            lpBox.style.display = 'none';
        }
    }
    window.addEventListener('yt-navigate-finish', onNavigate);
    onNavigate();
}


/**
 * ===================================================================
 * TRÌNH KHỞI CHẠY (RUNNER)
 * Đọc cài đặt chung (SETTINGS_KEY + DEFAULT_SETTINGS từ config.js),
 * mỗi tính năng bật độc lập theo switch riêng trong màn Options.
 * ===================================================================
 */
(function () {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(SETTINGS_KEY, (data) => {
            const settings = { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };

            if (settings.ytEnableHomepageHider || settings.ytEnableHideRelated) {
                initializeYouTubeHandler(settings);
            }
            if (settings.ytEnableDownloadButton) {
                initializeDownloadButton();
            }
        });
    } else {
        // Fallback: chạy ngoài môi trường extension thì dùng cài đặt mặc định để test
        // (bỏ nút tải video vì cần chrome.runtime)
        initializeYouTubeHandler(DEFAULT_SETTINGS);
    }
})();