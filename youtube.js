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
 * NÚT "TẢI VIDEO" (bật/tắt bằng setting ytEnableDownloadButton)
 * Luồng: nút → background.js → helper local (ytdl-helper/ytdl_server.py) → yt-dlp.
 * Helper chưa cài: hiện bảng hướng dẫn, tự tải bộ cài đúng hệ điều hành về Downloads.
 * ===================================================================
 */
function initializeDownloadButton() {
    const BUTTON_ID = 'my-ext-download-btn';
    const PANEL_ID = 'my-ext-download-panel';
    const LABEL_DEFAULT = '⬇️ Tải video';
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

    // ==================== Nút ====================

    function ensureButton() {
        const existing = document.getElementById(BUTTON_ID);
        if (location.pathname !== '/watch') {
            existing?.remove();
            closePanel();
            return;
        }
        if (existing) return;

        const btn = document.createElement('button');
        btn.id = BUTTON_ID;
        btn.textContent = LABEL_DEFAULT;
        Object.assign(btn.style, {
            position: 'fixed', bottom: '20px', right: '20px', zIndex: '9999',
            padding: '8px 16px', border: 'none', borderRadius: '18px',
            background: '#065fd4', color: 'white',
            fontSize: '14px', fontWeight: '500', cursor: 'pointer',
        });
        btn.addEventListener('click', onDownloadClick);
        document.body.appendChild(btn);
        if (currentJobId) setButton('⏳ Đang tải...', true);
    }

    function setButton(text, disabled) {
        const btn = document.getElementById(BUTTON_ID);
        if (!btn) return;
        btn.textContent = text;
        btn.disabled = disabled;
        btn.style.opacity = disabled ? '0.8' : '1';
    }

    async function onDownloadClick() {
        closePanel();
        setButton('⏳ Đang gửi...', true);
        const res = await send({ action: 'ytdlStart', url: location.href });
        if (res?.ok) {
            trackJob(res.id);
        } else if (res?.noHelper) {
            setButton(LABEL_DEFAULT, false);
            showSetupPanel();
        } else {
            setButton(LABEL_DEFAULT, false);
            showPanel(`❌ ${res?.error || 'Lỗi không rõ'}`);
        }
    }

    // ==================== Theo dõi tiến trình ====================

    function trackJob(id) {
        currentJobId = id;
        clearInterval(pollTimer);
        pollTimer = setInterval(async () => {
            const job = await send({ action: 'ytdlStatus', id });
            if (!job) return;
            if (job.status === 'downloading') {
                setButton(`⏳ ${Math.round(job.percent || 0)}%`, true);
                return;
            }
            clearInterval(pollTimer);
            currentJobId = null;
            setButton(LABEL_DEFAULT, false);
            if (job.status === 'done') {
                showPanel(`✅ Đã tải xong:\n${job.file}`, { revealId: id });
            } else {
                showPanel(`❌ Tải lỗi:\n${job.error || 'không rõ nguyên nhân'}`);
            }
        }, 1000);
    }

    // ==================== Bảng thông báo / cài đặt ====================

    function closePanel() {
        document.getElementById(PANEL_ID)?.remove();
    }

    function createPanel() {
        closePanel();
        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        Object.assign(panel.style, {
            position: 'fixed', bottom: '64px', right: '20px', zIndex: '9999',
            maxWidth: '340px', padding: '14px', borderRadius: '10px',
            background: '#212121', color: '#fff',
            fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-wrap',
            wordBreak: 'break-all', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        });
        document.body.appendChild(panel);
        return panel;
    }

    function panelButton(label, onClick) {
        const b = document.createElement('button');
        b.textContent = label;
        Object.assign(b.style, {
            margin: '8px 8px 0 0', padding: '6px 12px', border: 'none',
            borderRadius: '14px', background: '#065fd4', color: 'white',
            fontSize: '13px', cursor: 'pointer',
        });
        b.addEventListener('click', onClick);
        return b;
    }

    function showPanel(text, opts = {}) {
        const panel = createPanel();
        panel.appendChild(document.createTextNode(text));
        panel.appendChild(document.createElement('br'));
        if (opts.revealId) {
            panel.appendChild(panelButton('📂 Mở thư mục', () =>
                send({ action: 'ytdlReveal', id: opts.revealId })));
        }
        panel.appendChild(panelButton('Đóng', closePanel));
    }

    function showSetupPanel() {
        const os = detectOS();
        const panel = createPanel();
        panel.appendChild(document.createTextNode(
            '⚠️ Helper tải video chưa chạy trên máy này.\n\n' +
            'Trình duyệt không cho phép extension tự cài phần mềm, nên cần chạy bộ cài 1 lần:\n' +
            '1. Bấm "Tải bộ cài" (1 file về Downloads)\n' +
            `2. Mở ${os === 'windows' ? 'PowerShell' : 'Terminal'} chạy:\n${SETUP_COMMANDS[os]}\n` +
            '3. Xong quay lại đây bấm "Kiểm tra lại"'
        ));
        panel.appendChild(document.createElement('br'));

        const status = document.createElement('div');
        panel.appendChild(panelButton('📥 Tải bộ cài', async () => {
            const r = await send({ action: 'ytdlGetSetup', os });
            status.textContent = r?.ok ? '✅ Đã tải bộ cài về Downloads' : '❌ Tải bộ cài lỗi';
        }));
        panel.appendChild(panelButton('🔄 Kiểm tra lại', async () => {
            const r = await send({ action: 'ytdlPing' });
            status.textContent = r?.ok
                ? '✅ Helper đã chạy! Bấm Tải video lại nhé.'
                : '❌ Vẫn chưa thấy helper — kiểm tra bước cài đặt.';
        }));
        panel.appendChild(panelButton('Đóng', closePanel));
        status.style.marginTop = '8px';
        panel.appendChild(status);
    }

    // YouTube là SPA: chuyển trang không reload nên phải nghe event điều hướng
    window.addEventListener('yt-navigate-finish', ensureButton);
    ensureButton();
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