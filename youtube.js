/**
 * ===================================================================
 * HÀM XỬ LÝ YOUTUBE CHÍNH
 * (Hầu hết code gốc được đưa vào hàm này)
 * ===================================================================
 */
async function initializeYouTubeHandler(settings) {
    console.log("🚀 [Ext] Handle YouTube script loaded. Settings:", settings);

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


    const setMainButtonsDisabled = (disabled) => {
        const summaryButton = document.getElementById(SUMMARY_BUTTON_ID);
        if (summaryButton) summaryButton.disabled = disabled;

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

    const openPasswordPopup = () => {
        // Lấy URL tuyệt đối của file password.html trong extension
        const url = chrome.runtime.getURL('password.html');
        const popupWidth = 400;
        const popupHeight = 250;
        const left = (window.screen.width / 2) - (popupWidth / 2);
        const top = (window.screen.height / 2) - (popupHeight / 2);
        window.open(url, 'passwordPopup', `width=${popupWidth},height=${popupHeight},top=${top},left=${left},resizable=yes`);
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
        console.log("[Ext] Đã ẩn sidebar video gợi ý.");
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
                console.log("👉 [Ext] Đã click nút chính (.ytlm-add-button)");

                // 2. Chờ 100ms để menu con kịp "sẵn sàng" (dù là render mới hay chỉ hiện lên)
                await new Promise(r => setTimeout(r, 100));

                // 3. Tìm nút "Create New Notebook" dựa trên data-type bạn cung cấp
                // Selector này tìm trong toàn bộ trang (document) vì menu con thường được gắn vào cuối body
                const createBtn = document.querySelector('[data-type="create-notebook"]');

                if (createBtn) {
                    createBtn.click();
                    console.log("✅ [Ext] Đã click vào 'Create New Notebook'!");
                    return true;
                } else {
                    // FALLBACK: Nếu sau 100ms chưa thấy, thử chờ thêm 1 giây (phòng trường hợp máy lag render chậm)
                    console.log("⏳ [Ext] Chưa thấy menu, đang chờ thêm...");
                    await new Promise(r => setTimeout(r, 1000));

                    const createBtnRetry = document.querySelector('[data-type="create-notebook"]');
                    if (createBtnRetry) {
                        createBtnRetry.click();
                        console.log("✅ [Ext] Đã click (sau khi chờ thêm)!");
                        return true;
                    } else {
                        console.warn("⚠️ [Ext] Không tìm thấy menu 'Create New Notebook'.");
                        return false;
                    }
                }
            } else {
                console.warn("⚠️ [Ext] Không tìm thấy nút gốc Extension NotebookLM.");
                return false;
            }
        } catch (e) {
            console.error("❌ [Ext] Lỗi thao tác NotebookLM:", e);
            return false;
        }
    };

    /**
     * CẬP NHẬT: openVietGidoFlow
     */
    const openVietGidoFlow = async (shortUrl, videoTitle) => {
        // 1. Gửi tín hiệu kích hoạt tính năng tự động
        chrome.runtime.sendMessage({ action: "expectAutoFeatures" }, () => {
            console.log("🚩 [Ext] Đã gửi yêu cầu chạy cả Mindmap & Tóm tắt.");
        });

        // 2. Tự động thao tác Extension NotebookLM (Click tạo mới)
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
                    console.error("[Ext] Lỗi khi gửi tin nhắn:", chrome.runtime.lastError.message);
                } else {
                    console.log("[Ext] Background đã nhận yêu cầu mở tab:", response?.status);
                }
            }
        );
    };

    /**
     * ===================================================================
     * HÀM MỚI 1: LƯU DỮ LIỆU VÀO CSDL (Bước Save)
     * ===================================================================
     */
    async function saveDataToSystem(notebookId, youtubeUrl, videoTitle) {
        const contentBox = document.getElementById(CONTENT_ELEMENT_ID);
        console.log("💾 [Ext] Đang lưu dữ liệu vào CSDL...");

        const currentPass = await getApiPass(); // Lấy pass từ storage
        const notebookLink = `https://notebooklm.google.com/notebook/${notebookId}`;

        const payload = {
            "id": "12oOAZsOip5qUhAp5qg6_ObEA7EKWqEyYPqsMvdl4UPA",
            "thoiGianTao": new Date().toISOString(),
            "pass": currentPass,
            "danhMuc": "Tóm Tắt - Recap",
            "duLieu": [
                {
                    "soThuTu": 1,
                    "fields": [
                        {
                            "column": "category",
                            "value": "youtube",
                        },
                        {
                            "column": "title",
                            "value": videoTitle,
                        },
                        {
                            "column": "code",
                            "value": youtubeUrl,
                        },
                        {
                            "column": "notebooklm",
                            "value": notebookLink,
                        }
                    ]
                }
            ],
            "action": "addVietGiDo"
        }

        try {
            const response = await fetch(API, { method: 'POST', body: JSON.stringify(payload) });
            if (!response.ok) {
                contentBox.innerHTML = `<span style="color: var(--yt-spec-text-secondary);">Lỗi mạng: ${response.statusText}</span>`;
                return false;
            }
            const result = await response.json();
            if (result?.code !== 1) {
                contentBox.innerHTML = `<span style="color: var(--yt-spec-text-secondary);">${result?.error} || 'Lỗi không xác định từ server'</span>`;
                return false;
            }
            console.log("✅ [Ext] Lưu CSDL thành công!");
            return true;
        } catch (err) {
            contentBox.innerHTML = `<span style="color: var(--yt-spec-text-secondary);">❌ Lỗi: ${err.message}</span>`;
            return false;
        } 
    }

    /**
     * ===================================================================
     * HÀM MỚI 2: VẼ GIAO DIỆN LINK (Dùng chung)
     * ===================================================================
     */
    function renderNotebookUi(container, dataLinks) {
        container.innerHTML = ""; // Xóa nội dung cũ (ví dụ: "Đang tạo...")

        const linkStyle = `color: #065fd4; text-decoration: none; font-weight: 500; cursor: pointer; display: block; margin-bottom: 8px; padding: 5px 0; border-bottom: 1px dashed #eee;`;

        // 1. Link NotebookLM
        if (dataLinks.notebooklm) {
            const notebookLink = document.createElement("a");
            notebookLink.textContent = "📂 Mở NotebookLM";
            notebookLink.href = dataLinks.notebooklm;
            notebookLink.target = "_blank";
            notebookLink.style.cssText = linkStyle;
            container.appendChild(notebookLink);
        }

        // 2. Link Summary (Nếu có)
        if (dataLinks.summary) {
            const summaryLink = document.createElement("a");
            summaryLink.textContent = "📝 Xem Tóm tắt";
            summaryLink.href = "#";
            summaryLink.style.cssText = linkStyle;
            summaryLink.onclick = (e) => { e.preventDefault(); showSummaryPopup(dataLinks.summary); };
            container.appendChild(summaryLink);
        }

        // 3. Link Mindomo (Nếu có)
        if (dataLinks.mindomo) {
            const mindomoLink = document.createElement("a");
            mindomoLink.textContent = "🧠 Mở Mindmap";
            mindomoLink.href = dataLinks.mindomo;
            mindomoLink.target = "_blank";
            mindomoLink.style.cssText = linkStyle;
            container.appendChild(mindomoLink);
        }

        // Thêm một dòng nhỏ báo trạng thái
        const note = document.createElement("div");
        note.style.fontSize = "11px";
        note.style.color = "green";
        note.textContent = "✓ Dữ liệu đã sẵn sàng";
        container.appendChild(note);
    }

    const fetchSummary = async (shortUrl) => {
        const contentBox = document.getElementById(CONTENT_ELEMENT_ID);
        const button = document.getElementById(SUMMARY_BUTTON_ID);
        const videoTitle = getVideoTitle(); // Lấy tiêu đề video để lưu DB

        if (!contentBox) return;

        // 1. UI Loading
        setMainButtonsDisabled(true);
        if (button) button.innerHTML = `<div class="my-ext-button-loader"></div>`;
        contentBox.innerHTML = await getRandomQuote();

        let foundOldData = false;

        try {
            // --- BƯỚC 1: GỌI API ĐỂ CHECK DỮ LIỆU CŨ ---
            const currentPass = await getApiPass();
            console.log("📡 [Ext] Check dữ liệu cũ...");

            const response = await fetch(API, {
                method: "POST",
                body: JSON.stringify({
                    code: shortUrl,
                    action: API_ACTION_GET_SUMMARY_BY_CODE,
                    pass: currentPass
                })
            });

            if (response.ok) {
                const data = await response.json();

                // Nếu có dữ liệu cũ -> Hiển thị ngay
                if (data.code == 1 && data.data && (data.data.summary || data.data.notebooklm)) {
                    console.log("✅ [Ext] Tìm thấy dữ liệu cũ.");
                    foundOldData = true;

                    // Gọi hàm vẽ giao diện chung
                    renderNotebookUi(contentBox, data.data);

                    setMainButtonsDisabled(false);
                    if (button) button.innerHTML = "Tóm tắt";
                    return; // Xong việc
                }
            }
        } catch (error) {
            console.warn("⚠️ [Ext] Lỗi check API cũ:", error);
        }

        // --- BƯỚC 2: NẾU KHÔNG CÓ DỮ LIỆU -> TẠO MỚI ---
        if (!foundOldData) {
            console.log("🚀 [Ext] Tạo Notebook mới...");
            contentBox.innerHTML = `<span style="color: var(--yt-spec-text-secondary);">Đang khởi tạo NotebookLM...</span>`;

            try {
                // Gọi Background tạo Notebook
                chrome.runtime.sendMessage(
                    { action: "create_notebook_from_youtube", url: shortUrl },
                    async (response) => {

                        // --- XỬ LÝ KẾT QUẢ TRẢ VỀ ---

                        if (chrome.runtime.lastError) {
                            contentBox.innerHTML = `<span style="color: red;">Lỗi kết nối Extension!</span>`;
                        }
                        else if (response && response.success) {
                            const newNotebookId = response.notebookId;
                            const newNotebookLink = `https://notebooklm.google.com/notebook/${newNotebookId}`;

                            console.log("✅ [Ext] Tạo xong ID:", newNotebookId);

                            // --- BƯỚC 3: LƯU VÀO CSDL ---
                            contentBox.innerHTML = `<span style="color: var(--yt-spec-text-secondary);">Đang lưu vào hệ thống...</span>`;

                            // Gọi hàm lưu dữ liệu (chạy ngầm, không cần await nếu muốn nhanh, 
                            // nhưng await để chắc chắn lưu xong mới hiện link thì tốt hơn)
                            await saveDataToSystem(newNotebookId, shortUrl, videoTitle);

                            // --- BƯỚC 4: HIỂN THỊ LINK (Thay vì thông báo text) ---
                            // Giả lập object data giống API trả về để tái sử dụng hàm render
                            const newDataObject = {
                                notebooklm: newNotebookLink,
                                // summary: "Đang chờ xử lý...", // Có thể thêm placeholder nếu muốn
                                // mindomo: ...
                            };

                            // Vẽ lại giao diện y hệt như lúc có dữ liệu cũ
                            renderNotebookUi(contentBox, newDataObject);

                        } else {
                            contentBox.innerHTML = `<span style="color: red;">Lỗi: ${response?.error}</span>`;
                        }

                        setMainButtonsDisabled(false);
                        if (button) button.innerHTML = "Tóm tắt";
                    }
                );
            } catch (e) {
                console.error(e);
                contentBox.innerHTML = `<span style="color: red;">Lỗi Script</span>`;
                setMainButtonsDisabled(false);
                if (button) button.innerHTML = "Tóm tắt";
            }
        }
    };


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
            </div>
        `;
        return myBox;
    };
    // =======================================================
    // --- KẾT THÚC CẬP NHẬT ---
    // =======================================================

    // Hàm: scanAndInject
    const scanAndInject = () => {
        // HÀM NÀY SẼ CHỈ CHẠY NẾU settings.ytEnableSummaryBox = true

        const currentUrl = window.location.href;
        const shortUrl = getShortYouTubeUrl(currentUrl);
        let myBox = document.getElementById(MY_BOX_ID);
        const parentContainer = document.querySelector(PARENT_CONTAINER_SELECTOR);
        if (!parentContainer) return;

        parentContainer.style.setProperty("display", "flex", "important");
        parentContainer.style.setProperty("flex-direction", "column", "important");

        // Biến cờ để xác định xem có cần chạy auto-summary không
        let shouldAutoRun = false;

        if (!myBox) {
            myBox = createMyNewBox();
            if (!myBox) return;
            parentContainer.prepend(myBox);
            myBox.dataset.currentUrl = shortUrl;
            console.log("[Ext] Đã chèn box MỚI.");
            shouldAutoRun = true; // Box mới -> Cần chạy nếu auto bật
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
                setMainButtonsDisabled(false);
                console.log("[Ext] Phát hiện URL mới, đã reset box.");
                shouldAutoRun = true; // URL mới -> Cần chạy nếu auto bật
            }
        }

        const summaryButton = myBox.querySelector(`#${SUMMARY_BUTTON_ID}`);
        if (summaryButton) {
            summaryButton.onclick = () => {
                console.log("[Ext] Người dùng nhấn 'Tóm tắt'.");
                fetchSummary(shortUrl);
            };

            // --- LOGIC TỰ ĐỘNG TÓM TẮT ---
            if (shouldAutoRun && settings.ytEnableAutoSummarize) {
                console.log("[Ext] Chế độ Tự động tóm tắt kích hoạt -> Đang chạy...");
                // Gọi hàm tóm tắt ngay lập tức
                fetchSummary(shortUrl);
            }
        }
    };

    // --- BẮT ĐẦU CẬP NHẬT PHẦN KHỞI CHẠY ---

    // 1. Tiêm CSS chống flash Trang chủ (NẾU ĐƯỢC BẬT)
    if (settings.ytEnableHomepageHider) {
        injectPermanentHomepageHider();
    }

    // [MỚI] 2. Tiêm CSS ẩn Sidebar Video (NẾU ĐƯỢC BẬT)
    if (settings.ytEnableHideRelated) {
        injectRelatedHider();
    }


    // 2. Tạo Observer tổng
    const observer = new MutationObserver((mutations) => {

        // Logic cho trang xem video (/watch) (NẾU ĐƯỢC BẬT)
        if (settings.ytEnableSummaryBox && window.location.pathname === "/watch") {
            setTimeout(scanAndInject, 300);
        }

        // Logic cho trang chủ (/) (NẾU ĐƯỢC BẬT)
        if (settings.ytEnableHomepageHider) {
            checkHomepageVisibility();
        }
    });

    // 3. Bắt đầu quan sát
    observer.observe(document.body, { childList: true, subtree: true });

    // 4. Chạy lần đầu khi tải trang
    setTimeout(() => {
        if (settings.ytEnableSummaryBox && window.location.pathname === "/watch") {
            scanAndInject();
        }
        if (settings.ytEnableHomepageHider) {
            checkHomepageVisibility();
        }
    }, 1000);

} // <-- Dấu ngoặc đóng hàm initializeYouTubeHandler


/**
 * ===================================================================
 * TRÌNH KHỞI CHẠY (RUNNER) MỚI
 * (Đọc cài đặt và gọi hàm xử lý chính)
 * ===================================================================
 */
(function () {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        // Dùng SETTINGS_KEY chung từ config.js
        chrome.storage.local.get(SETTINGS_KEY, (data) => {
            // Dùng DEFAULT_SETTINGS chung từ config.js
            const settings = { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };

            // CẬP NHẬT ĐIỀU KIỆN IF: Chạy nếu bất kỳ tính năng nào được bật
            if (settings.ytEnableHomepageHider || settings.ytEnableSummaryBox || settings.ytEnableHideRelated) {
                initializeYouTubeHandler(settings);
            } else {
                console.log("🚀 [Ext] YouTube: Tất cả tính năng đều tắt.");
            }
        });
    } else {
        // Fallback: Nếu chạy ngoài môi trường extension,
        // chạy với cài đặt mặc định (để test)
        console.log("🚀 [Ext] YouTube: Đang chạy ở môi trường không phải extension, dùng cài đặt mặc định.");
        // (Dùng DEFAULT_SETTINGS từ config.js)
        initializeYouTubeHandler(DEFAULT_SETTINGS);
    }
})();