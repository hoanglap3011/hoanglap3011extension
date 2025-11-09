// == 2. TRÌNH KHỞI CHẠY (RUNNER) ==
// Hàm này sẽ lấy cài đặt và chỉ chạy logic chính nếu được phép
(function() {
    // Tự định nghĩa lại hàm get storage (giống vietgido.js)
    const storage = {
        isExtension: () => typeof chrome !== 'undefined' && chrome.storage?.local,
        get: (keys, cb) => {
            if (storage.isExtension()) {
                chrome.storage.local.get(keys, cb);
            } else {
                // Fallback nếu chạy ngoài extension (ví dụ: testing)
                const result = {};
                const key = Array.isArray(keys) ? keys[0] : keys;
                // Giả định giá trị mặc định nếu không có localStorage
                result[key] = null; 
                cb(result);
            }
        }
    };
    
    // THAY ĐỔI: Lấy cài đặt từ SETTINGS_KEY (config.js)
    storage.get(SETTINGS_KEY, (data) => {
        // THAY ĐỔI: Dùng DEFAULT_SETTINGS và data[SETTINGS_KEY] (config.js)
        const settings = { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };

        // QUAN TRỌNG:
        // THAY ĐỔI: Dùng key mới (fbEnableSummarize, fbEnableBlockByKeyword)
        if (settings.fbEnableSummarize || settings.fbEnableBlockByKeyword) {
            // Truyền 'settings' vào hàm logic chính
            initializeFacebookHandler(settings);
        } else {
            console.log("🚀 [Ext] Facebook: Cả hai tính năng 'Tóm Tắt' và 'Ẩn Khối' đều bị tắt. Script sẽ không chạy.");
        }
    });
})();


// == 3. LOGIC XỬ LÝ CHÍNH CỦA FACEBOOK ==
// (Đây chính là toàn bộ file handleFacebook.js cũ của bạn,
// được bọc trong một hàm tên là initializeFacebookHandler
// và nhận 'settings' làm tham số)

function initializeFacebookHandler(settings) {
    // THAY ĐỔI: 'settings' bây giờ là đối tượng cài đặt chung
    console.log("🚀 [Ext] Handle Facebook script loaded (Configurable v1). Settings:", settings);

    // === 1. CONFIG & CONSTANTS ===
    
    // Lấy từ config.js
    const PROXY_URL = (typeof API !== 'undefined' && API) ? API : "PROXY_URL_NOT_FOUND_IN_CONFIG";
    const MIN_LENGTH = (typeof MIN_SUMMARY_LENGTH !== 'undefined') ? MIN_SUMMARY_LENGTH : 100;

    const CONFIG = {
        // Selectors
        ANCHOR_SELECTOR: '[aria-label="Hành động với bài viết này"]',
        INJECTED_CLASS: "ext-summarize-btn",
        PROCESSED_MARKER: "data-ext-summarize-processed",
        
        // (Lưu ý: Chúng ta không cần SPECIFIC_BLOCK_SELECTORS cho Story ở đây nữa
        // vì nó đã được xử lý bằng CSS trong file handleFacebook_init.js)

        // Files
        BLOCKLIST_FILE_NAME: 'facebook_blocklist.json',
        
        // Timers
        DEBOUNCE_TIME: 300,        
        INITIAL_SCAN_DELAY: 1500,  
        SEE_MORE_CLICK_DELAY: 500, 
        
        // Logic
        HEADER_SCAN_LENGTH: 200,   
        
        // UI
        POPUP_WIDTH: 600,
        POPUP_HEIGHT: 500
    };
    
    // === 2. APPLICATION STATE ===
    
    /** @type {string[]} */
    let g_blockList = []; // Biến toàn cục lưu danh sách đen

    // === 3. CORE LOGIC (LOGIC CHÍNH & ĐIỀU PHỐI) ===
    
    /**
     * Tải danh sách từ khóa đen từ file JSON.
     */
    async function loadBlocklist() {
        // Hàm này chỉ cần chạy nếu tính năng 'Ẩn theo từ khóa' được bật
        // (Kiểm tra này đã được thực hiện ở phần khởi chạy)
        try {
            const url = chrome.runtime.getURL(CONFIG.BLOCKLIST_FILE_NAME);
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`File blocklist not found: ${response.statusText}`);
            }
            
            g_blockList = await response.json();
            console.log("[Ext] Tải blocklist thành công:", g_blockList);
            
        } catch (error) {
            console.log(`[Ext] LỖI: Không thể tải ${CONFIG.BLOCKLIST_FILE_NAME}.`, error);
        }
    }

    /**
     * Quét và ẩn các module không mong muốn (Reels, Bạn có thể biết...)
     * Hàm này chỉ chạy nếu settings.fbEnableBlockByKeyword = true
     */
    function scanAndBlockModules() {
        if (g_blockList.length === 0) return;

        // (Lưu ý: Chúng ta đã XÓA logic ẩn Story bằng selector
        // vì nó đã được xử lý bằng CSS)

        // 1. Ẩn bằng keyword (Logic cũ của bạn)
        const allModules = document.querySelectorAll('div[aria-labelledby]');

        allModules.forEach(module => {
            if (module.style.display === 'none') {
                return;
            }
            if (shouldBlockPost(module)) {
                module.style.display = 'none';
            }
        });
    }    

    /**
     * Quét tìm bài đăng mới để GẮN NÚT TÓM TẮT.
     * Hàm này chỉ chạy nếu settings.fbEnableSummarize = true
     */
    let scanCounter = 0;
    const scanAndAttachSummarizeButtons = () => {
        scanCounter++;
        const anchorButtons = document.querySelectorAll(CONFIG.ANCHOR_SELECTOR);
        if (anchorButtons.length === 0) return;

        anchorButtons.forEach((anchorButton, index) => {
            const post = anchorButton.closest('div[aria-labelledby]');
            
            if (!post || post.hasAttribute(CONFIG.PROCESSED_MARKER)) {
                return;
            }
            
            post.setAttribute(CONFIG.PROCESSED_MARKER, "1");

            // LƯU Ý: Logic block bài đăng đã được chuyển
            // sang scanAndBlockModules() và chạy riêng rẽ.
            // Chúng ta KHÔNG block ở đây nữa.
            
            let targetContainer = null, beforeElement = null, wrapper = null;
            wrapper = anchorButton.parentElement;
            if (wrapper) wrapper = wrapper.parentElement;
            if (wrapper && wrapper.parentElement) {
                targetContainer = wrapper.parentElement;
                beforeElement = wrapper;
            }

            if (targetContainer) {
                injectButton(targetContainer, beforeElement, post, index);
            }
        });
    };

    /**
     * Kiểm tra xem bài đăng có nên bị ẩn không.
     */
    function shouldBlockPost(post) {
        if (g_blockList.length === 0) return false; 

        const headerText = (post.innerText || '').substring(0, CONFIG.HEADER_SCAN_LENGTH);
        const isBlocked = g_blockList.some(keyword => headerText.includes(keyword));

        if (isBlocked) {
            console.log("[Ext] Phát hiện khối cần ẩn. Đang ẩn:", headerText.replace(/\n/g, " "));
        }
        return isBlocked;
    }

    /**
     * Tạo và chèn nút "Tóm Tắt".
     */
    const injectButton = (targetContainer, beforeElement, post, index) => {
        // ... (Toàn bộ nội dung hàm injectButton của bạn giữ nguyên) ...
        // ... (Không cần thay đổi gì ở đây) ...
        const summarizeBtn = document.createElement("div");
        summarizeBtn.innerText = "Tóm Tắt";
        summarizeBtn.title = "Tóm tắt bài viết này (bởi Lập's Ext)";
        // Dùng CONFIG
        summarizeBtn.className = CONFIG.INJECTED_CLASS;

        Object.assign(summarizeBtn.style, {
            cursor: "pointer", padding: "8px", borderRadius: "6px",
            fontWeight: "bold", fontSize: "13px",
            
            // =======================================================
            // --- BẮT ĐẦU THAY ĐỔI ---
            // Đổi từ 'var(--primary-text-color, #050505)' sang 'var(--primary-icon)'
            // để màu tự động khớp với theme (giống nút ... và các icon khác)
            color: "var(--primary-icon)",
            // --- KẾT THÚC THAY ĐỔI ---
            // =======================================================

            lineHeight: "1", display: "flex",
            alignItems: "center", justifyContent: "center"
        });
        summarizeBtn.onmouseover = () => { summarizeBtn.style.backgroundColor = "var(--hover-overlay, #EBEDF0)"; };
        summarizeBtn.onmouseout = () => { summarizeBtn.style.backgroundColor = "transparent"; };

        summarizeBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const originalText = summarizeBtn.innerText;
            summarizeBtn.innerText = "Đang tóm tắt...";
            summarizeBtn.style.pointerEvents = 'none';

            console.log("[Ext] Đang lấy thông tin bài viết (có thể mất 0.5s)...");
            const postInfo = await getPostInfo(post);
            console.log(`[Ext] Thông tin bài viết thu thập được:`, postInfo);

            const postContentLength = postInfo.postContent.length;
            if (postContentLength < MIN_LENGTH) {
                const shortMessage = `Bài viết này quá ngắn (${postContentLength} ký tự, giới hạn là ${MIN_LENGTH} ký tự). Không cần tóm tắt.`;
                
                console.log(`[Ext] ⚠️ ${shortMessage}`);
                showSummaryPopup(shortMessage, postInfo, true);
                
                summarizeBtn.innerText = originalText;
                summarizeBtn.style.pointerEvents = 'auto';
                return;
            }

            console.log(`[Ext] Đang gửi ${postContentLength} ký tự nội dung đến Proxy App Script...`);
            const summaryText = await summarizePostContent(postInfo.postContent, postInfo.postUrl);
            
            showSummaryPopup(summaryText, postInfo); 
            
            summarizeBtn.innerText = originalText;
            summarizeBtn.style.pointerEvents = 'auto';
        };

        targetContainer.insertBefore(summarizeBtn, beforeElement);
    };

    // === 4. DATA SCRAPING (CÀO DỮ LIỆU) ===
    // ... (Toàn bộ các hàm getPostInfo, _getAuthorAndGroup, _getTimeAndUrl, _getPostContent
    // ...  giữ nguyên y hệt như file cũ của bạn) ...
    const getPostInfo = async (post) => {
        const authorInfo = _getAuthorAndGroup(post);
        const timeInfo = _getTimeAndUrl(post);
        const postContent = await _getPostContent(post); 

        return {
            ...authorInfo,
            ...timeInfo,
            postContent
        };
    };
    function _getAuthorAndGroup(post) {
        let authorName = 'Không tìm thấy tác giả';
        let authorUrl = 'Không tìm thấy URL tác giả';
        let groupName = null;
        let groupUrl = null;

        const authorLabelId = post.getAttribute('aria-labelledby');
        if (authorLabelId) {
            const labelEl = document.getElementById(authorLabelId); 
            if (labelEl) {
                const mainLinkEl = labelEl.querySelector('a');
                
                if (mainLinkEl && (mainLinkEl.href.includes('/groups/') || mainLinkEl.href.includes('/gaming/'))) {
                    groupName = labelEl.innerText.trim();
                    groupUrl = mainLinkEl.href;

                    const authorLinkEl = post.querySelector('a[href*="/user/"][tabindex="0"], a[href*="?id="][tabindex="0"]');
                    if (authorLinkEl) {
                        authorName = authorLinkEl.innerText.trim();
                        authorUrl = authorLinkEl.href;
                    } else {
                        authorName = "Không tìm thấy tác giả (trong group)";
                    }
                } else if (mainLinkEl) {
                    authorName = labelEl.innerText.trim();
                    authorUrl = mainLinkEl.href;
                } else {
                    authorName = labelEl.innerText.trim();
                }
            }
        }

        if (authorName === 'Không tìm thấy tác giả') {
            const authorEl = post.querySelector('h4 a, strong a'); 
            if (authorEl) {
                 authorName = authorEl.innerText.trim();
                 authorUrl = authorEl.href;
            }
        }

        if (authorUrl && authorUrl.startsWith('http')) {
            try {
                const url = new URL(authorUrl);
                authorUrl = url.origin + url.pathname; 
            } catch (e) { /* Bỏ qua lỗi */ }
        }
        if (groupUrl && groupUrl.startsWith('http')) {
            try {
                const url = new URL(groupUrl);
                groupUrl = url.origin + url.pathname; 
            } catch (e) { /* Bỏ qua lỗi */ }
        }
        
        return { authorName, authorUrl, groupName, groupUrl };
    }
    function _getTimeAndUrl(post) {
        let timeText = 'Không tìm thấy thời gian';
        let postUrl = 'Không tìm thấy URL bài viết';
        let timeEl = null;

        const timeEls = post.querySelectorAll('a[href*="/posts/"], a[href*="?story_fbid="], a[href*="/videos/"], a[href*="/watch/"]');
        
        if (timeEls.length > 0) {
            timeEl = timeEls[timeEls.length - 1]; 
            postUrl = timeEl.href; 
            let found = false;
            let currentEl = timeEl;
            let count = 0;
            while (currentEl && count < 5) {
                if (currentEl.title && currentEl.title.length > 5) {
                    timeText = currentEl.title;
                    found = true;
                    break;
                }
                if (currentEl.getAttribute('aria-label') && currentEl.getAttribute('aria-label').length > 5) {
                    timeText = currentEl.getAttribute('aria-label');
                    found = true;
                    break;
                }
                currentEl = currentEl.parentElement;
                count++;
            }
            if (!found) {
                const allChildren = timeEl.querySelectorAll('*');
                for(const child of allChildren) {
                    if (child.title && child.title.length > 5) { 
                        timeText = child.title;
                        found = true;
                        break;
                    }
                    if (child.getAttribute('aria-label') && child.getAttribute('aria-label').length > 5) {
                        timeText = child.getAttribute('aria-label');
                        found = true;
                        break;
                    }
                }
            }
            if (!found && timeEl.innerText.length > 0) {
                 timeText = timeEl.innerText.trim();
            }
        }
        if (postUrl && postUrl.startsWith('http')) {
             try {
                const url = new URL(postUrl);
                postUrl = url.origin + url.pathname; 
            } catch (e) { /* Bỏ qua lỗi */ }
        }

        return { timeText, postUrl };
    }
    async function _getPostContent(post) {
        let postContent = "";
        
        const contentSelectors = [
            'div[data-ad-preview="message"]',
            'div[data-testid="post_message"]',
            '[data-testid="story-text-content"]',
            '[data-testid="post_text"]',
            'div[class="html-div xdj266r x14z9mp xat24cr x1lziwak x1l90r2v xv54qhq xf7dkkf x1iorvi4"]'
        ];
        
        let messageBlock = post.querySelector(contentSelectors.join(', '));
        
        if (messageBlock) {
            const seeMoreButton = Array.from(messageBlock.querySelectorAll('div[role="button"]'))
                                      .find(btn => btn.innerText.includes("Xem thêm") || btn.innerText.includes("See more"));

            if (seeMoreButton) {
                console.log("[Ext] 'Xem thêm' detected. Clicking...");
                seeMoreButton.click();
                await new Promise(resolve => setTimeout(resolve, CONFIG.SEE_MORE_CLICK_DELAY)); 
            }

            const clone = messageBlock.cloneNode(true);

            clone.querySelectorAll('div[role="button"]').forEach(button => {
                if (button.innerText.includes("Xem thêm") || button.innerText.includes("See more")) {
                    button.remove();
                }
            });

            clone.querySelectorAll('img[alt]').forEach(emoji => {
                if (emoji.alt) {
                    emoji.replaceWith(document.createTextNode(emoji.alt));
                } else {
                    emoji.remove();
                }
            });
            
            const paragraphDivs = clone.querySelectorAll('div[dir="auto"]');
            if (paragraphDivs.length > 0) {
                postContent = Array.from(paragraphDivs)
                    .map(p => p.innerText) 
                    .join('\n');
            } else {
                postContent = clone.innerText.trim();
            }
        } else {
            console.log("[Ext] ⚠️ THẤT BẠI: Không thể tìm thấy khối nội dung (messageBlock). Cần cập nhật contentSelectors.");
            postContent = "Lỗi: Không tìm thấy khối nội dung. (Cần cập nhật selector cho phiên bản Facebook này)";
        }
        
        return postContent.trim();
    };


    // === 5. API & UI UTILITIES (Các hàm tiện ích) ===
    // ... (Toàn bộ hàm summarizePostContent và showSummaryPopup
    // ...  giữ nguyên y hệt như file cũ của bạn) ...
    const summarizePostContent = async (content, postUrl) => {
        if (!PROXY_URL || PROXY_URL === "PROXY_URL_NOT_FOUND_IN_CONFIG") {
            return "Lỗi cấu hình: Không tìm thấy URL Proxy (biến API trong config.js).";
        }
        
        const pass = await new Promise(resolve => {
            chrome.storage.local.get(['pass'], (result) => resolve(result.pass || ''));
        });

        const payloadObject = { pass: pass, action: 'tomTatByAI', content: content, code: postUrl };

        try {
            const response = await fetch(PROXY_URL, {
                method: 'POST',
                body: JSON.stringify(payloadObject) 
            });

            if (!response.ok) {
                return `Lỗi Proxy: Phản hồi không thành công (${response.status} ${response.statusText})`;
            }

            const result = await response.json();
            
            if (result.code !== 1) {
                console.log("[Ext] LỖI từ App Script/Gemini:", result.error, result.details);
                return `Lỗi tóm tắt AI (Code ${result.code}): ${result.error || result.details || 'Lỗi không xác định'}`;
            }

            if (result.data) {
                return result.data.replace(/\n/g, '<br>');
            } else {
                return "AI không thể tóm tắt nội dung này (kết quả thành công nhưng không có trường 'data').";
            }

        } catch (error) {
            console.log("[Ext] LỖI trong quá trình fetch Proxy:", error);
            return `Lỗi kết nối đến Google App Script: ${error.message}`;
        }
    };
    const showSummaryPopup = (summaryContent, postInfo, isShortPost = false) => {
        try {
            const isError = summaryContent.includes("Lỗi");
            
            const popupWidth = CONFIG.POPUP_WIDTH, popupHeight = CONFIG.POPUP_HEIGHT;
            const left = (window.screen.width / 2) - (popupWidth / 2);
            const top = (window.screen.height / 2) - (popupHeight / 2);
            const popup = window.open("", "summaryPopup", `width=${popupWidth},height=${popupHeight},top=${top},left=${left},scrollbars=yes,resizable=yes`);
            
            if (popup) {
                popup.document.open();
                
                const metadata = `
                    <p style="border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px;">
                        <strong>Tác giả:</strong> ${postInfo.authorName} (<a href="${postInfo.authorUrl}" target="_blank">Link</a>)<br>
                        <strong>Nguồn:</strong> ${postInfo.groupName || 'Trang cá nhân/Fanpage'} ${postInfo.groupUrl ? `(<a href="${postInfo.groupUrl}" target="_blank">Link</a>)` : ''}<br>
                        <strong>Thời gian:</strong> ${postInfo.timeText}
                    </p>
                `;
                
                let titleText, titleColor, summaryBoxStyle;

                if (isError) {
                    titleText = "THÔNG BÁO LỖI";
                    titleColor = "#f00";
                    summaryBoxStyle = "background: #ffebeb; color: #cc0000; border: 1px solid #f00;";
                } else if (isShortPost) {
                    titleText = "THÔNG BÁO";
                    titleColor = "#ff9800";
                    summaryBoxStyle = "background: #fff8e1; color: #ff9800; border: 1px solid #ff9800;";
                } else {
                    titleText = "Kết Quả Tóm Tắt (Gemini AI)";
                    titleColor = "#1877f2";
                    summaryBoxStyle = "background: #f0f2f5; color: #333;";
                }

                popup.document.write(`
                    <html>
                    <head>
                        <title>${titleText} - ${postInfo.authorName}</title>
                        <style>
                            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; line-height: 1.6; background: #fff; color: #333; }
                            h2 { color: ${titleColor}; margin-top: 0; padding-bottom: 10px; border-bottom: 2px solid ${titleColor}; }
                            strong { font-weight: 600; }
                            p { margin: 8px 0; }
                            .summary-box { padding: 15px; border-radius: 8px; white-space: pre-wrap; word-wrap: break-word; ${summaryBoxStyle} }
                        </style>
                    </head>
                    <body>
                        <h2>${titleText}</h2>
                        ${(isError || isShortPost) ? '' : metadata} 
                        <div class="summary-box">${summaryContent}</div>
                    </body>
                    </html>
                `);
                popup.document.close();
                popup.focus();
            } else {
                console.log("[Ext] Vui lòng cho phép cửa sổ pop-up để xem tóm tắt.");
            }
        } catch (e) { 
            console.log("[Ext] LỖI khi mở popup:", e); 
        }
    };

    // === 6. INITIALIZATION (KHỞI CHẠY) ===
    
    console.log("[Ext] Đang khởi chạy các mô-đun đã được bật...");
    
    // 1. Tải blocklist (nếu được bật)
    // THAY ĐỔI: Dùng key mới (fbEnableBlockByKeyword)
    if (settings.fbEnableBlockByKeyword) {
        loadBlocklist(); 
    }
    
    // 2. Chạy quét lần đầu (vì đã ở document_end)
    // THAY ĐỔI: Dùng key mới (fbEnableBlockByKeyword)
    if (settings.fbEnableBlockByKeyword) {
        scanAndBlockModules();
    }
    // THAY ĐỔI: Dùng key mới (fbEnableSummarize)
    if (settings.fbEnableSummarize) {
        scanAndAttachSummarizeButtons();
    }

    // 3. Tạo MutationObserver
    let debounceTimer;
    const observer = new MutationObserver((mutationsList) => {
        
        // 1. CHẠY ẨN BLOCK NGAY LẬP TỨC (nếu được bật)
        // THAY ĐỔI: Dùng key mới (fbEnableBlockByKeyword)
        if (settings.fbEnableBlockByKeyword) {
            scanAndBlockModules(); 
        }

        // 2. DEBOUNCE VIỆC GẮN NÚT (nếu được bật)
        // THAY ĐỔI: Dùng key mới (fbEnableSummarize)
        if (settings.fbEnableSummarize) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                scanAndAttachSummarizeButtons();
            }, CONFIG.DEBOUNCE_TIME);
        }
    });

    // 4. Bắt đầu quan sát
    observer.observe(document.body, { childList: true, subtree: true });
    
} // <-- Dấu ngoặc này đóng hàm initializeFacebookHandler