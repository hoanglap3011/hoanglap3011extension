(async function () {
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
        } catch (e) {}
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
            console.error(`[Ext] Lỗi khi đọc '${CACHE_QUOTES}' từ chrome.storage:`, e); 
        }
        return defaultQuote;
    };
    const getApiPass = async () => {
        try {
            // DÙNG HẰNG SỐ
            const result = await chrome.storage.local.get(CACHE_PASS);
            
            // DÙNG HẰNG SỐ
            if (result[CACHE_PASS] !== undefined) { 
                return result[CACHE_PASS]; 
            }
        } catch (e) { 
            console.error(`[Ext] Lỗi khi đọc '${CACHE_PASS}' từ storage:`, e); 
        }
        return "hihi"; 
    };

    // Định nghĩa ID (Đã loại bỏ NEW_SUMMARY_BUTTON_ID)
    const PARENT_CONTAINER_SELECTOR = "div#related";
    const MY_BOX_ID = "my-custom-youtube-box";
    const CONTENT_ELEMENT_ID = "my-ext-content-display"; 
    const SUMMARY_BUTTON_ID = "my-ext-summary-button";
    const QUOTES_BUTTON_ID = "my-ext-quotes-button";
    const KEY_BUTTON_ID = "my-ext-key-button";
    const MODAL_ID = "my-ext-key-modal", MODAL_BACKDROP_ID = "my-ext-key-modal-backdrop";
    const MODAL_INPUT_ID = "my-ext-key-input", MODAL_SAVE_ID = "my-ext-key-save", MODAL_CLOSE_ID = "my-ext-key-close";

    // ... (Các hàm helper setMainButtonsDisabled, setModalControlsDisabled, onSaveKeyClick, onCloseKeyClick, showKeyPopup, showSummaryPopup giữ nguyên) ...
    const setMainButtonsDisabled = (disabled) => {
        const summaryButton = document.getElementById(SUMMARY_BUTTON_ID);
        const quotesButton = document.getElementById(QUOTES_BUTTON_ID);
        const keyButton = document.getElementById(KEY_BUTTON_ID);
        if (summaryButton) summaryButton.disabled = disabled;
        if (quotesButton) quotesButton.disabled = disabled;
        if (keyButton) keyButton.disabled = disabled;
    };
    const setModalControlsDisabled = (disabled) => {
        const saveButton = document.getElementById(MODAL_SAVE_ID);
        const closeButton = document.getElementById(MODAL_CLOSE_ID);
        const backdrop = document.getElementById(MODAL_BACKDROP_ID);
        const input = document.getElementById(MODAL_INPUT_ID);
        if (saveButton) saveButton.disabled = disabled;
        if (closeButton) closeButton.disabled = disabled;
        if (input) input.disabled = disabled;
        if (backdrop) backdrop.onclick = disabled ? null : onCloseKeyClick;
    };
    const onSaveKeyClick = async () => {
        const input = document.getElementById(MODAL_INPUT_ID);
        const saveButton = document.getElementById(MODAL_SAVE_ID);
        if (!input || !saveButton) return;
        
        setModalControlsDisabled(true);
        saveButton.innerHTML = `<div class="my-ext-button-loader"></div>`;
        
        try {
            // DÙNG CÚ PHÁP [Computed Property Name]
            await chrome.storage.local.set({ [CACHE_PASS]: input.value });
            
            saveButton.textContent = "Đã lưu!";
            setTimeout(onCloseKeyClick, 1000);
        } catch (e) {
            console.error(`[Ext] Lỗi khi lưu '${CACHE_PASS}':`, e);
            saveButton.textContent = "Lỗi!";
            setTimeout(() => {
                setModalControlsDisabled(false); 
                saveButton.innerHTML = "Lưu";
            }, 2000);
        }
    };
    const onCloseKeyClick = () => {
        const modal = document.getElementById(MODAL_ID);
        const backdrop = document.getElementById(MODAL_BACKDROP_ID);
        if (modal) modal.style.display = "none";
        if (backdrop) backdrop.style.display = "none";
        const saveButton = document.getElementById(MODAL_SAVE_ID);
        if (saveButton) saveButton.innerHTML = "Lưu"; 
        setModalControlsDisabled(false); 
    };
    const showKeyPopup = async () => {
        let modal = document.getElementById(MODAL_ID);
        let backdrop = document.getElementById(MODAL_BACKDROP_ID);
        if (!modal) {
            backdrop = document.createElement("div");
            backdrop.id = MODAL_BACKDROP_ID;
            Object.assign(backdrop.style, {
                position: "fixed", top: "0", left: "0", width: "100vw", height: "100vh",
                background: "rgba(0, 0, 0, 0.5)", zIndex: "9998", display: "none"
            });
            backdrop.onclick = onCloseKeyClick;
            modal = document.createElement("div");
            modal.id = MODAL_ID;
            Object.assign(modal.style, {
                position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                background: "var(--yt-spec-background-secondary, #fff)",
                color: "var(--yt-spec-text-primary, #000)",
                padding: "20px", borderRadius: "12px", zIndex: "9999",
                fontFamily: "Roboto, Arial, sans-serif", minWidth: "300px",
                border: "1px solid var(--yt-spec-divider, #ddd)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)", display: "none"
            });
            modal.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h4 style="margin: 0; font-size: 18px; font-weight: bold;">Nhập API Key</h4>
                    <button id="${MODAL_CLOSE_ID}" style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--yt-spec-text-secondary);">&times;</button>
                </div>
                <input id="${MODAL_INPUT_ID}" type="password" placeholder="Nhập key của bạn..." style="
                    width: calc(100% - 20px); padding: 10px; font-size: 14px; margin-bottom: 15px;
                    border: 1px solid var(--yt-spec-divider); border-radius: 8px;
                    background: var(--yt-spec-background-primary); color: var(--yt-spec-text-primary);
                ">
                <button id="${MODAL_SAVE_ID}" class="my-ext-button">Lưu</button>
            `;
            document.body.appendChild(backdrop);
            document.body.appendChild(modal);
            modal.querySelector(`#${MODAL_SAVE_ID}`).onclick = onSaveKeyClick;
            modal.querySelector(`#${MODAL_CLOSE_ID}`).onclick = onCloseKeyClick;
        }
        backdrop.style.display = "block";
        modal.style.display = "block";
        const input = document.getElementById(MODAL_INPUT_ID);
        const currentPass = await getApiPass();
        if (currentPass !== "hihi") { input.value = currentPass; } else { input.value = ""; }
        input.focus();
    };
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
        } catch (e) { console.error("[Ext] Lỗi khi mở popup:", e); }
    };



// ... (Ngay sau hàm showSummaryPopup) ...

    const HOMEPAGE_MESSAGE_ID = "my-ext-homepage-message-box";

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
        console.log("[Ext] Đã tiêm CSS vĩnh viễn (chống flash) cho trang chủ.");
    };

    /**
     * HÀM MỚI 2: Chỉ tạo box thông điệp (đã tách ra)
     */
    const createMessageBox = () => {
        const messageBox = document.createElement("div");
        messageBox.id = HOMEPAGE_MESSAGE_ID;
        
        Object.assign(messageBox.style, {
            color: 'var(--yt-spec-text-primary, #030303)',
            padding: '40px 20px', margin: '16px 0', textAlign: 'center',
            fontSize: '18px', fontWeight: '500', lineHeight: '1.6',
            background: 'var(--yt-spec-background-secondary, #f9f9f9)',
            borderRadius: '12px', border: '1px dashed var(--yt-spec-divider, #ddd)',
        });

        messageBox.innerHTML = `
            Thời gian, năng lượng và cuộc sống là hữu hạn.<br>
            Mỗi lựa chọn hôm nay đều ảnh hưởng đến ngày mai.<br><br>
            <strong style="font-size: 20px; color: var(--yt-spec-call-to-action, #065fd4);">Hãy làm chủ YouTube.</strong><br>
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
        if (window.location.pathname === "/") {
            injectHomepageMessage();
        } else {
            removeHomepageMessage();
        }
    };


/**
     * HÀM MỚI (ĐÃ NÂNG CẤP VÀ SỬA LỖI): Tiêm CSS VÀ Thêm thông điệp
     */
    const injectHomepageHider = () => {
        const styleId = "my-ext-homepage-hider-style";
        
        // --- 1. Tiêm CSS (Như cũ) ---
        if (!document.getElementById(styleId)) {
            const css = `
                /* Ẩn toàn bộ lưới video gợi ý trên trang chủ */
                ytd-rich-grid-renderer { display: none !important; }
                /* Ẩn các "kệ" video (như Shorts, Tin tức, v.v.) */
                ytd-rich-shelf-renderer { display: none !important; }
                /* (Tùy chọn) Ẩn luôn thanh filter (Tất cả, Âm nhạc, Trò chơi...) */
                #chips { display: none !important; }
            `;
            const style = document.createElement("style");
            style.id = styleId;
            style.textContent = css;
            document.head.appendChild(style);
        }

        // --- 2. Thêm Thông Điệp (Logic Mới) ---
        // Nếu thông điệp đã tồn tại, không làm gì cả
        if (document.getElementById(HOMEPAGE_MESSAGE_ID)) return;

        // --- BẮT ĐẦU SỬA LỖI ---
        // Cách tiếp cận mới: Tìm chính phần tử lưới video (mà chúng ta đang ẩn).
        // Thông điệp sẽ được chèn vào TRƯỚC phần tử này.
        const gridRenderer = document.querySelector('ytd-rich-grid-renderer');

        if (gridRenderer && gridRenderer.parentNode) {
            // Cách làm tốt nhất: Chèn thông điệp vào cha của gridRenderer
            const messageBox = createMessageBox();
            gridRenderer.parentNode.prepend(messageBox);

        } else {
            // Dự phòng: Nếu không thấy gridRenderer, thử lại selector cũ nhưng bỏ (>)
            const fallbackContainer = document.querySelector('ytd-browse[page-subtype="home"] #contents');
            if (fallbackContainer) {
                const messageBox = createMessageBox();
                fallbackContainer.prepend(messageBox);
            } else {
                console.error("[Ext] Không tìm thấy vị trí (gridRenderer hoặc #contents) để chèn thông điệp.");
            }
        }
        // --- KẾT THÚC SỬA LỖI ---
    };

    /**
     * HÀM MỚI (ĐÃ NÂNG CẤP): Gỡ bỏ CSS VÀ Thông điệp
     */
    const removeHomepageHider = () => {
        // --- 1. Gỡ bỏ CSS (Như cũ) ---
        const styleId = "my-ext-homepage-hider-style";
        const styleElement = document.getElementById(styleId);
        if (styleElement) {
            styleElement.remove();
        }

        // --- 2. Gỡ bỏ Thông Điệp (Logic Mới) ---
        const messageBox = document.getElementById(HOMEPAGE_MESSAGE_ID);
        if (messageBox) {
            messageBox.remove();
        }
    };



    
    /**
     * HÀM MỚI: Lấy tiêu đề video từ DOM
     */
    const getVideoTitle = () => {
        // Selector phổ biến nhất cho tiêu đề trên trang xem video
        const titleElement = document.querySelector('h1.style-scope.ytd-watch-metadata yt-formatted-string');
        return titleElement ? titleElement.textContent.trim() : 'Không tìm thấy tiêu đề video';
    };

    /**
     * HÀM MỚI: Tích hợp logic mở tab từ Content Script (Gửi message)
     */
    const openVietGidoFlow = (shortUrl, videoTitle) => {
        // Gửi các tham số thô tới Background Script
        chrome.runtime.sendMessage(
            { 
                action: "openVietGidoTab", 
                data: { 
                    danhMuc: 'Tóm Tắt',
                    category: 'youtube',
                    title: videoTitle, 
                    code: shortUrl
                }
            },
            (response) => {
                if (chrome.runtime.lastError) {
                    console.error("[Ext] Lỗi khi gửi tin nhắn:", chrome.runtime.lastError.message);
                } else {
                    console.log("[Ext] Background đã nhận yêu cầu:", response?.status);
                }
            }
        );
    };

    /**
     * CẬP NHẬT: fetchSummary
     * - Thêm logic kiểm tra lỗi và chuyển sang openVietGidoFlow.
     * - Sử dụng tiêu đề video thay vì shortUrl.
     */
    const fetchSummary = async (shortUrl) => {
        const contentBox = document.getElementById(CONTENT_ELEMENT_ID);
        const button = document.getElementById(SUMMARY_BUTTON_ID); 
        const videoTitle = getVideoTitle(); // Lấy tiêu đề video
        
        if (!contentBox) return;

        setMainButtonsDisabled(true); 
        if (button) button.innerHTML = `<div class="my-ext-button-loader"></div>`; 
        contentBox.innerHTML = await getRandomQuote(); 
        const currentPass = await getApiPass();
        
        let apiError = false; // Biến cờ để theo dõi lỗi API
        let hasContent = false; // Biến cờ để theo dõi nội dung
        
        try {
            const response = await fetch(API, {
                method: "POST",
                body: JSON.stringify({
                    code: shortUrl, action: API_ACTION_GET_SUMMARY_BY_CODE, pass: currentPass
                })
            });

            if (!response.ok) {
                throw new Error("Lỗi mạng hoặc API");
            }
            
            const data = await response.json();
            contentBox.innerHTML = ""; 
            
            if (data.code == 1) {
                const linksData = data.data; 
                const linkStyle = `color: #065fd4; text-decoration: none; font-weight: 500; cursor: pointer;`;
                
                // Kiểm tra nội dung tóm tắt
                if (linksData.summary || linksData.notebooklm || linksData.mindomo) {
                    hasContent = true;
                    
                    if (linksData.summary) {
                        const summaryLink = document.createElement("a");
                        summaryLink.textContent = "Summary";
                        summaryLink.href = "#"; 
                        summaryLink.style.cssText = linkStyle;
                        summaryLink.onclick = (e) => { e.preventDefault(); showSummaryPopup(linksData.summary); };
                        contentBox.appendChild(summaryLink);
                    }
                    if (linksData.notebooklm) {
                        const notebookLink = document.createElement("a");
                        notebookLink.textContent = "NotebookLM";
                        notebookLink.href = linksData.notebooklm;
                        notebookLink.target = "_blank";
                        notebookLink.style.cssText = linkStyle;
                        contentBox.appendChild(notebookLink);
                    }
                    if (linksData.mindomo) {
                        const mindomoLink = document.createElement("a");
                        mindomoLink.textContent = "Mindomo";
                        mindomoLink.href = linksData.mindomo;
                        mindomoLink.target = "_blank";
                        mindomoLink.style.cssText = linkStyle;
                        contentBox.appendChild(mindomoLink);
                    }
                }

                if (!hasContent) {
                    // Nếu API trả về thành công (code=1) nhưng data rỗng
                    contentBox.innerHTML = `<span style="color: var(--yt-spec-text-secondary);">Không có dữ liệu.</span>`; 
                }

            } else {
                // API trả về lỗi (code != 1)
                apiError = true;
                contentBox.innerHTML = `<span style="color: #f00;">${data.error || 'Lỗi không xác định'}</span>`;
            }
        
        } catch (error) {
            console.error("[Ext] Lỗi khi fetch summary:", error);
            apiError = true;
            contentBox.innerHTML = `<span style="color: #f00;">Đã xảy ra lỗi</span>`;
        } finally {
            // --- LOGIC MỚI: TỰ ĐỘNG CHUYỂN NGHIỆP VỤ ---
            // Nếu có lỗi API hoặc không có nội dung, tự động chuyển sang tạo mới
            if (apiError || !hasContent) {
                console.log("[Ext] Không có dữ liệu hoặc lỗi API. Tự động chuyển sang tạo mới.");
                openVietGidoFlow(shortUrl, videoTitle);
            }
            // ------------------------------------------

            setMainButtonsDisabled(false); 
            if (button) button.innerHTML = "Tóm tắt"; 
        }
    };
    const fetchQuotes = async (shortUrl, button) => {
        if (!button) return;
        
        const contentBox = document.getElementById(CONTENT_ELEMENT_ID);
        if (!contentBox) return;

        setMainButtonsDisabled(true);
        button.innerHTML = `<div class="my-ext-button-loader"></div>`;
        contentBox.innerHTML = await getRandomQuote();

        const currentPass = await getApiPass();
        let statusText = "Quotes";

        try {
            const response = await fetch(API, {
                method: "POST",
                body: JSON.stringify({
                    code: shortUrl, action: API_ACTION_GET_QUOTES, pass: currentPass
                })
            });
            if (!response.ok) throw new Error("Lỗi mạng hoặc API");
            
            const data = await response.json();
            if (data.code == 1) {
                // DÙNG CÚ PHÁP [Computed Property Name]
                await chrome.storage.local.set({ [CACHE_QUOTES]: data.data });
                
                console.log(`[Ext] Đã lưu '${CACHE_QUOTES}' mới vào storage.`);
                statusText = "Đã lưu!";
            } else {
                console.error("[Ext] API trả lỗi khi lấy quotes:", data.error);
                statusText = "Lỗi API";
            }
        } catch (error) {
            console.error("[Ext] Lỗi khi fetch quotes:", error);
            statusText = "Lỗi mạng";
        } finally {
            if (button) button.textContent = statusText; 
            setTimeout(() => {
                setMainButtonsDisabled(false);
                if (button) button.innerHTML = "Quotes"; 
                if (contentBox) {
                     contentBox.innerHTML = `<i style="color: var(--yt-spec-text-secondary);">Nhấn 'Tóm tắt' để tải.</i>`;
                }
            }, 2000);
        }
    };

    // =======================================================
    // --- BẮT ĐẦU CẬP NHẬT ---
    // =======================================================
    /**
     * CẬP NHẬT: createMyNewBox (Đã loại bỏ nút "Tóm Tắt Mới")
     */
    const createMyNewBox = () => { 
        if (document.getElementById(MY_BOX_ID)) return null;
        
        const myBox = document.createElement("div");
        myBox.id = MY_BOX_ID;
        
        Object.assign(myBox.style, {
            border: "2px solid #065fd4", borderRadius: "12px", padding: "16px",
            margin: "0 0 16px 0", background: "var(--yt-spec-background-secondary)", 
            color: "var(--yt-spec-text-primary)", fontFamily: "Roboto, Arial, sans-serif",
            fontSize: "14px", zIndex: "10",
            display: 'flex', flexDirection: 'column',
            height: YOUTUBE_PANEL_FIXED_HEIGHT, 
            maxHeight: "40vh"
        });
        
        myBox.style.setProperty("order", "-999", "important");

        myBox.innerHTML = `
            <h3 style="
                margin: 0 0 10px 0; font-size: 16px; font-weight: bold;
                flex-shrink: 0;
            ">Extension của Lập</h3>
            
            <div id="${CONTENT_ELEMENT_ID}" style="
                margin: 0 0 12px 0; 
                display: flex; 
                flex-direction: column; 
                gap: 10px;
                flex: 1;                 
                overflow-y: auto;        
                min-height: 20px;        
                padding-right: 5px; 
            ">
            <i style="color: var(--yt-spec-text-secondary);">Nhấn 'Tóm tắt' để tải.</i>
            </div>
            
            <div style="
                display: flex; gap: 10px; flex-wrap: wrap;
                flex-shrink: 0;
            ">
                <button id="${SUMMARY_BUTTON_ID}" class="my-ext-button">Tóm tắt</button>
                <button id="${QUOTES_BUTTON_ID}" class="my-ext-button">Quotes</button>
                <button id="${KEY_BUTTON_ID}" class="my-ext-button">Key</button>
            </div>
        `;
        return myBox;
    };
    // =======================================================
    // --- KẾT THÚC CẬP NHẬT ---
    // =======================================================

    // Hàm: scanAndInject (Đã xóa logic nút Tóm Tắt Mới cũ)
    const scanAndInject = () => {
        const currentUrl = window.location.href;
        const shortUrl = getShortYouTubeUrl(currentUrl); 
        let myBox = document.getElementById(MY_BOX_ID);
        const parentContainer = document.querySelector(PARENT_CONTAINER_SELECTOR);
        if (!parentContainer) return; 

        parentContainer.style.setProperty("display", "flex", "important");
        parentContainer.style.setProperty("flex-direction", "column", "important");

        if (!myBox) {
            myBox = createMyNewBox(); 
            if (!myBox) return;
            parentContainer.prepend(myBox);
            myBox.dataset.currentUrl = shortUrl; 
            console.log("[Ext] Đã chèn box MỚI.");
        } else {
            const storedUrl = myBox.dataset.currentUrl || "";
            if (storedUrl !== shortUrl) {
                myBox.dataset.currentUrl = shortUrl;
                const contentBox = myBox.querySelector(`#${CONTENT_ELEMENT_ID}`);
                if (contentBox) {
                    contentBox.innerHTML = `<i style="color: var(--yt-spec-text-secondary);">Nhấn 'Tóm tắt' để tải.</i>`;
                }
                const summaryButton = myBox.querySelector(`#${SUMMARY_BUTTON_ID}`);
                if (summaryButton) summaryButton.innerHTML = "Tóm tắt";
                const quotesButton = myBox.querySelector(`#${QUOTES_BUTTON_ID}`);
                if (quotesButton) quotesButton.innerHTML = "Quotes";
                setMainButtonsDisabled(false); 
                console.log("[Ext] Phát hiện URL mới, đã reset box.");
            }
        }
        
        const summaryButton = myBox.querySelector(`#${SUMMARY_BUTTON_ID}`);
        if (summaryButton) {
             summaryButton.onclick = () => {
                console.log("[Ext] Người dùng nhấn 'Tóm tắt'.");
                // Logic chính nằm trong fetchSummary
                fetchSummary(shortUrl); 
            };
        }
        const quotesButton = myBox.querySelector(`#${QUOTES_BUTTON_ID}`);
        if (quotesButton) {
            quotesButton.onclick = () => {
                console.log("[Ext] Người dùng nhấn 'Quotes'.");
                fetchQuotes(shortUrl, quotesButton);
            };
        }
        const keyButton = myBox.querySelector(`#${KEY_BUTTON_ID}`);
        if (keyButton) {
            keyButton.onclick = () => {
                console.log("[Ext] Người dùng nhấn 'Key'.");
                showKeyPopup();
            };
        }
    };

// --- BẮT ĐẦU CẬP NHẬT PHẦN KHỞI CHẠY ---

    // 1. Tiêm CSS chống flash NGAY LẬP TỨC
    injectPermanentHomepageHider();

    // 2. Tạo Observer tổng
    const observer = new MutationObserver((mutations) => {
        // Logic cho trang xem video (/watch)
        if (window.location.pathname === "/watch") {
            setTimeout(scanAndInject, 300);
        }
        
        // Logic cho trang chủ (/)
        checkHomepageVisibility();
    });

    // 3. Bắt đầu quan sát
    observer.observe(document.body, { childList: true, subtree: true });

    // 4. Chạy lần đầu khi tải trang
    setTimeout(() => {
         if (window.location.pathname === "/watch") {
            scanAndInject();
         }
         checkHomepageVisibility();
    }, 1000);

})();