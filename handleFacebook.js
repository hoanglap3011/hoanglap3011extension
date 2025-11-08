(function () {
    console.log("🚀 [Ext] Handle Facebook script loaded (v42 - Centralized Config).");

    // === 1. CONFIG & CONSTANTS ===
    
    // Lấy từ config.js
    const PROXY_URL = (typeof API !== 'undefined' && API) ? API : "PROXY_URL_NOT_FOUND_IN_CONFIG";
    const MIN_LENGTH = (typeof MIN_SUMMARY_LENGTH !== 'undefined') ? MIN_SUMMARY_LENGTH : 100;

    /**
     * Đối tượng cấu hình tập trung.
     * Mọi thay đổi về selector, thời gian, text... đều nên được thực hiện ở đây.
     */
    const CONFIG = {
        // Selectors
        ANCHOR_SELECTOR: '[aria-label="Hành động với bài viết này"]',
        INJECTED_CLASS: "ext-summarize-btn",
        PROCESSED_MARKER: "data-ext-summarize-processed",
        
        // Files
        BLOCKLIST_FILE_NAME: 'facebook_blocklist.json',
        
        // Timers (tính bằng mili-giây)
        DEBOUNCE_TIME: 300,        // Thời gian chờ sau khi DOM thay đổi
        INITIAL_SCAN_DELAY: 1500,  // Thời gian chờ quét lần đầu
        SEE_MORE_CLICK_DELAY: 500, // Thời gian chờ sau khi click "Xem thêm"
        
        // Logic
        HEADER_SCAN_LENGTH: 200,   // Số ký tự quét ở đầu bài viết để block
        
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
        try {
            const url = chrome.runtime.getURL(CONFIG.BLOCKLIST_FILE_NAME);
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`File blocklist not found: ${response.statusText}`);
            }
            
            g_blockList = await response.json();
            console.log("[Ext] Tải blocklist thành công:", g_blockList);
            
        } catch (error) {
            // ĐÃ CHUYỂN SANG CONSOLE.LOG
            console.log(`[Ext] LỖI: Không thể tải ${CONFIG.BLOCKLIST_FILE_NAME}.`, error);
            console.log("[Ext] Hãy đảm bảo file này tồn tại ở thư mục gốc của extension.");
        }
    }

    /**
     * Hàm chính, quét tìm bài đăng mới.
     */
    let scanCounter = 0;
    const scanAndAttachFacebook = () => {
        scanCounter++;
        // Dùng CONFIG
        const anchorButtons = document.querySelectorAll(CONFIG.ANCHOR_SELECTOR);
        if (anchorButtons.length === 0) return;

        anchorButtons.forEach((anchorButton, index) => {
            const post = anchorButton.closest('div[aria-labelledby]');
            
            // Dùng CONFIG
            if (!post || post.hasAttribute(CONFIG.PROCESSED_MARKER)) {
                return;
            }
            
            // Dùng CONFIG
            post.setAttribute(CONFIG.PROCESSED_MARKER, "1");

            if (shouldBlockPost(post)) {
                post.style.display = 'none';
                return;
            }
            
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


// Dán đoạn code này vào file handleFacebook.js,
// thay thế hoàn toàn cho hàm shouldBlockPost CŨ

    /**
     * Kiểm tra xem bài đăng có nên bị ẩn không.
     * PHIÊN BẢN ĐÃ SỬA LỖI:
     * - Ưu tiên đọc text từ 'aria-labelledby' để lấy chính xác tiêu đề khối.
     * - Chỉ dùng innerText.substring(200) làm phương án dự phòng.
     */
    function shouldBlockPost(post) {
        if (g_blockList.length === 0) return false; 

        let textToScan = '';

        // --- BẮT ĐẦU LOGIC MỚI (Độ ưu tiên cao) ---
        // Lấy chính xác phần tử tiêu đề mà khối này tham chiếu tới.
        // Đây là cách đáng tin cậy nhất, tránh race condition.
        const labelId = post.getAttribute('aria-labelledby');
        if (labelId) {
            const labelEl = document.getElementById(labelId);
            if (labelEl) {
                // Lấy text của chính xác tiêu đề đó (VD: "Reels", "Nam Dinh FC")
                textToScan = labelEl.innerText;
            }
        }
        // --- KẾT THÚC LOGIC MỚI ---

        // Nếu logic mới ở trên không tìm thấy text (dự phòng),
        // chúng ta mới dùng đến logic cũ (kém tin cậy hơn).
        if (!textToScan) {
            // Dùng CONFIG
            textToScan = (post.innerText || '').substring(0, CONFIG.HEADER_SCAN_LENGTH);
        }

        // Chạy kiểm tra blocklist trên 'textToScan' đã được tinh chỉnh
        const isBlocked = g_blockList.some(keyword => textToScan.includes(keyword));

        if (isBlocked) {
            // Dùng textToScan để log cho chính xác
            console.log("[Ext] Phát hiện khối cần ẩn. Đang ẩn:", textToScan.replace(/\n/g, " "));
        }
        return isBlocked;
    }
    /**
     * Tạo và chèn nút "Tóm Tắt".
     */
    const injectButton = (targetContainer, beforeElement, post, index) => {
        
        const summarizeBtn = document.createElement("div");
        summarizeBtn.innerText = "Tóm Tắt";
        summarizeBtn.title = "Tóm tắt bài viết này (bởi Lập's Ext)";
        // Dùng CONFIG
        summarizeBtn.className = CONFIG.INJECTED_CLASS;

        Object.assign(summarizeBtn.style, {
            cursor: "pointer", padding: "8px", borderRadius: "6px",
            fontWeight: "bold", fontSize: "13px",
            color: "var(--primary-text-color, #050505)",
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
                
                // ĐÃ CHUYỂN SANG CONSOLE.LOG
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

    /**
     * HÀM CHÍNH: Lấy tất cả thông tin bài viết
     */
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

    /**
     * HÀM CON 1: Lấy thông tin Tác giả và Nhóm
     */
    function _getAuthorAndGroup(post) {
        // ... (Logic hàm này không đổi) ...
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

    /**
     * HÀM CON 2: Lấy thông tin Thời gian và URL bài viết
     */
    function _getTimeAndUrl(post) {
        // ... (Logic hàm này không đổi) ...
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

    /**
     * HÀM CON 3: Lấy nội dung bài viết (với logic click "Xem thêm")
     */
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
                // Dùng CONFIG
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
            // ĐÃ CHUYỂN SANG CONSOLE.LOG
            console.log("[Ext] ⚠️ THẤT BẠI: Không thể tìm thấy khối nội dung (messageBlock). Cần cập nhật contentSelectors.");
            postContent = "Lỗi: Không tìm thấy khối nội dung. (Cần cập nhật selector cho phiên bản Facebook này)";
        }
        
        return postContent.trim();
    };

    // === 5. API & UI UTILITIES (Các hàm tiện ích) ===
    
    /**
     * Gọi Google App Script để tóm tắt nội dung.
     */
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
                // ĐÃ CHUYỂN SANG CONSOLE.LOG
                console.log("[Ext] LỖI từ App Script/Gemini:", result.error, result.details);
                return `Lỗi tóm tắt AI (Code ${result.code}): ${result.error || result.details || 'Lỗi không xác định'}`;
            }

            if (result.data) {
                return result.data.replace(/\n/g, '<br>');
            } else {
                return "AI không thể tóm tắt nội dung này (kết quả thành công nhưng không có trường 'data').";
            }

        } catch (error) {
            // ĐÃ CHUYỂN SANG CONSOLE.LOG
            console.log("[Ext] LỖI trong quá trình fetch Proxy:", error);
            return `Lỗi kết nối đến Google App Script: ${error.message}`;
        }
    };
    
    /**
     * Mở cửa sổ pop-up để hiển thị nội dung tóm tắt.
     */
    const showSummaryPopup = (summaryContent, postInfo, isShortPost = false) => {
        try {
            const isError = summaryContent.includes("Lỗi");
            
            // Dùng CONFIG
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
                // ĐÃ CHUYỂN SANG CONSOLE.LOG
                console.log("[Ext] Vui lòng cho phép cửa sổ pop-up để xem tóm tắt.");
            }
        } catch (e) { 
            // ĐÃ CHUYỂN SANG CONSOLE.LOG
            console.log("[Ext] LỖI khi mở popup:", e); 
        }
    };

// === 6. INITIALIZATION (KHỞI CHẠY) ===
    
    console.log("[Ext] Đang tạo MutationObserver (v42 - Fixed Race Condition)...");
    
    // 1. Chạy hàm tải blocklist ngay lập tức
    loadBlocklist(); 
    
    // 2. Chạy quét lần đầu ngay lập tức
    //    (Vì chúng ta đã đổi sang 'document_end', DOM đã sẵn sàng)
    scanAndAttachFacebook();

    // 3. Tạo MutationObserver
    let debounceTimer;
    const observer = new MutationObserver((mutationsList) => {
        clearTimeout(debounceTimer);
        // Vẫn dùng debounce để tránh quét quá nhiều khi trang thay đổi liên tục
        debounceTimer = setTimeout(scanAndAttachFacebook, CONFIG.DEBOUNCE_TIME);
    });

    // 4. Bắt đầu quan sát
    observer.observe(document.body, { childList: true, subtree: true });
    
})();