(function () {
    console.log("🚀 [Ext] Handle Facebook script loaded (v40 - Group Content Fix).");

    // === CONFIG PROXY API URL ===
    // Đọc MIN_SUMMARY_LENGTH từ config.js, nếu không có thì mặc định là 100
    const PROXY_URL = (typeof API !== 'undefined' && API) ? API : "PROXY_URL_NOT_FOUND_IN_CONFIG";
    const MIN_LENGTH = (typeof MIN_SUMMARY_LENGTH !== 'undefined') ? MIN_SUMMARY_LENGTH : 100;
    
    const ANCHOR_SELECTOR = '[aria-label="Hành động với bài viết này"]';
    const INJECTED_CLASS = "ext-summarize-btn";
    const PROCESSED_MARKER = "data-ext-summarize-processed";

    // === HÀM HIỂN THỊ POPUP ===
    /**
     * Mở cửa sổ pop-up để hiển thị nội dung tóm tắt hoặc thông báo lỗi.
     * @param {string} summaryContent Nội dung HTML/Text tóm tắt (hoặc lỗi).
     * @param {object} postInfo Metadata bài viết.
     * @param {boolean} isShortPost Cờ cho biết đây là thông báo bài viết ngắn.
     */
    const showSummaryPopup = (summaryContent, postInfo, isShortPost = false) => {
        try {
            const isError = summaryContent.includes("Lỗi");
            
            const popupWidth = 600, popupHeight = 500;
            const left = (window.screen.width / 2) - (popupWidth / 2);
            const top = (window.screen.height / 2) - (popupHeight / 2);
            const popup = window.open("", "summaryPopup", `width=${popupWidth},height=${popupHeight},top=${top},left=${left},scrollbars=yes,resizable=yes`);
            
            if (popup) {
                popup.document.open();
                
                // Chuẩn bị thông tin metadata (đã làm sạch)
                const metadata = `
                    <p style="border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px;">
                        <strong>Tác giả:</strong> ${postInfo.authorName} (<a href="${postInfo.authorUrl}" target="_blank">Link</a>)<br>
                        <strong>Nguồn:</strong> ${postInfo.groupName || 'Trang cá nhân/Fanpage'} ${postInfo.groupUrl ? `(<a href="${postInfo.groupUrl}" target="_blank">Link</a>)` : ''}<br>
                        <strong>Thời gian:</strong> ${postInfo.timeText}
                    </p>
                `;
                
                // Thay đổi style dựa trên trạng thái
                let titleText;
                let titleColor;
                let summaryBoxStyle;

                if (isError) {
                    titleText = "THÔNG BÁO LỖI";
                    titleColor = "#f00";
                    summaryBoxStyle = "background: #ffebeb; color: #cc0000; border: 1px solid #f00;";
                } else if (isShortPost) {
                    titleText = "THÔNG BÁO";
                    titleColor = "#ff9800"; // Màu cam cho cảnh báo
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
                console.warn("[Ext] Vui lòng cho phép cửa sổ pop-up để xem tóm tắt.");
            }
        } catch (e) { 
            console.error("[Ext] Lỗi khi mở popup:", e); 
        }
    };


// === HÀM GỌI PROXY AI ĐỂ TÓM TẮT ===
    /**
     * Gọi Google App Script để tóm tắt nội dung bài viết (an toàn).
     * @param {string} content Nội dung bài viết cần tóm tắt.
     * @param {string} postUrl URL của bài viết (để gửi lên làm 'code').
     * @returns {Promise<string>} Kết quả tóm tắt (hoặc thông báo lỗi).
     */
    const summarizePostContent = async (content, postUrl) => { // <-- THÊM postUrl
        // 1. Kiểm tra URL proxy
        if (!PROXY_URL || PROXY_URL === "PROXY_URL_NOT_FOUND_IN_CONFIG") {
            return "Lỗi cấu hình: Không tìm thấy URL Proxy (biến API trong config.js).";
        }
        
        // 2. Lấy giá trị 'pass' từ chrome.storage.local
        const pass = await new Promise(resolve => {
            // Cần có quyền 'storage' trong manifest.json
            chrome.storage.local.get(['pass'], (result) => resolve(result.pass || ''));
        });

        // 3. Chuẩn bị payload dưới dạng đối tượng JSON
        const payloadObject = {
            pass: pass,
            action: 'tomTatByAI',
            content: content,
            code: postUrl // <-- THÊM TRƯỜNG MỚI THEO YÊU CẦU
        };

        try {
            const response = await fetch(PROXY_URL, {
                method: 'POST',
                // Sử dụng JSON.stringify NHƯ TRONG handleYouTube.js
                // KHÔNG KHAI BÁO HEADERS
                body: JSON.stringify(payloadObject) 
            });

            if (!response.ok) {
                // Apps Script thường trả về 200, nhưng ta vẫn kiểm tra lỗi mạng
                return `Lỗi Proxy: Phản hồi không thành công (${response.status} ${response.statusText})`;
            }

            const result = await response.json();
            
            // === LOGIC XỬ LÝ KẾT QUẢ GIỐNG handleYouTube.js ===
            if (result.code !== 1) {
                // Lỗi API/Xác thực/logic từ App Script
                console.error("[Ext] Lỗi từ App Script/Gemini:", result.error, result.details);
                return `Lỗi tóm tắt AI (Code ${result.code}): ${result.error || result.details || 'Lỗi không xác định'}`;
            }

            // Nếu code = 1, lấy nội dung tóm tắt từ trường 'data' (đã được thống nhất)
            if (result.data) {
                // Chúng ta sẽ giả định nội dung tóm tắt là text thuần túy
                return result.data.replace(/\n/g, '<br>'); // Thay thế ký tự xuống dòng bằng <br> cho HTML
            } else {
                return "AI không thể tóm tắt nội dung này (kết quả thành công nhưng không có trường 'data').";
            }

        } catch (error) {
            console.error("[Ext] Lỗi trong quá trình fetch Proxy:", error);
            return `Lỗi kết nối đến Google App Script: ${error.message}`;
        }
    };

    /**
     * Hàm chính để quét và chèn nút.
     */
    let scanCounter = 0;
    const scanAndAttachFacebook = () => {
        scanCounter++;
        // console.log(`[Ext] Quét lần thứ ${scanCounter}...`);

        // 1. Tìm TẤT CẢ các nút "3 chấm" trên toàn trang
        const anchorButtons = document.querySelectorAll(ANCHOR_SELECTOR);

        if (anchorButtons.length === 0) {
            // console.log("[Ext] Không tìm thấy nút anchor (3 chấm) nào.");
            return;
        }

        anchorButtons.forEach((anchorButton, index) => {
            
            // 2. Leo cấp DOM để tìm container
            let targetContainer = null;
            let beforeElement = null;
            let wrapper = null;

            // TÌM THẤY NÚT "3 CHẤM"
            // Leo 2 cấp (div.button -> div.wrapper -> div.container)
            wrapper = anchorButton.parentElement;
            if (wrapper) wrapper = wrapper.parentElement; 

            if (wrapper && wrapper.parentElement) {
                targetContainer = wrapper.parentElement;
                // Chèn vào TRƯỚC wrapper của nút 3 chấm
                beforeElement = wrapper;
            } else {
                console.warn(`[Ext] ⚠️ Lỗi logic 3 chấm: Không tìm thấy container.`, anchorButton);
                return;
            }
            

            // 3. Kiểm tra xem container này đã được xử lý chưa
            if (!targetContainer || targetContainer.hasAttribute(PROCESSED_MARKER)) {
                // Container không hợp lệ HOẶC đã được xử lý
                return;
            }

            // 4. Đánh dấu container là đã xử lý
            targetContainer.setAttribute(PROCESSED_MARKER, "1");

            // 5. Chèn nút
            injectButton(targetContainer, beforeElement, index);
        });
    };

// === HÀM getPostInfo (ĐÃ SỬA LỖI FALLBACK) ===
    const getPostInfo = async (post) => {
        
        // === 1. LẤY TÁC GIẢ (VÀ GROUP) ===
        // (Giữ nguyên logic lấy author/group từ dòng 197 - 263... )
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
        
        // === 2. THỜI GIAN & URL BÀI VIẾT ===
        // (Giữ nguyên logic lấy thời gian từ dòng 265 - 307... )
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

        // === 3. NỘI DUNG (LOGIC TỰ ĐỘNG CLICK "XEM THÊM") ===
        let postContent = "";
        
        // --- THAY ĐỔI LỚN BẮT ĐẦU TỪ ĐÂY ---

 // (Bên trong hàm getPostInfo)

        // 1. TÌM MESSAGE BLOCK
        // Chúng ta sẽ gộp tất cả các selector có thể có vào một chuỗi
        const contentSelectors = [
            'div[data-ad-preview="message"]',                 // Selector cũ cho timeline
            'div[data-testid="post_message"]',                // Selector cũ cho group
            '[data-testid="story-text-content"]',             // Selector tiềm năng
            '[data-testid="post_text"]',                      // Selector tiềm năng mới
            
            // === THÊM SELECTOR MỚI VÀO ĐÂY ===
            'div[class="html-div xdj266r x14z9mp xat24cr x1lziwak x1l90r2v xv54qhq xf7dkkf x1iorvi4"]'
            
        ];
        
        let messageBlock = post.querySelector(contentSelectors.join(', '));
        
// ... (phần còn lại của code giữ nguyên)
        
        // 2. XỬ LÝ
        if (messageBlock) {
            // A. Tìm nút "Xem thêm" BÊN TRONG khối message
            const seeMoreButton = Array.from(messageBlock.querySelectorAll('div[role="button"]'))
                                      .find(btn => btn.innerText.includes("Xem thêm") || btn.innerText.includes("See more"));

            // B. Nếu tìm thấy -> click và chờ
            if (seeMoreButton) {
                console.log("[Ext] 'Xem thêm' detected. Clicking and waiting 500ms...");
                seeMoreButton.click();
                await new Promise(resolve => setTimeout(resolve, 500)); 
                console.log("[Ext] Waited 500ms. Now scraping expanded content.");
            }

            // C. (Sau khi đã click, hoặc nếu không có nút)
            const clone = messageBlock.cloneNode(true);

            // Xóa nút "Xem thêm" (phải làm TRƯỚC khi xử lý emoji)
            clone.querySelectorAll('div[role="button"]').forEach(button => {
                if (button.innerText.includes("Xem thêm") || button.innerText.includes("See more")) {
                    button.remove();
                }
            });

            // XỬ LÝ EMOJI
            clone.querySelectorAll('img[alt]').forEach(emoji => {
                if (emoji.alt) {
                    emoji.replaceWith(document.createTextNode(emoji.alt));
                } else {
                    emoji.remove();
                }
            });
            
            // XỬ LÝ XUỐNG DÒNG
            const paragraphDivs = clone.querySelectorAll('div[dir="auto"]');
            if (paragraphDivs.length > 0) {
                postContent = Array.from(paragraphDivs)
                    .map(p => p.innerText) 
                    .join('\n'); 
            } else {
                postContent = clone.innerText.trim(); 
            }
        } else {
            // 3. THẤT BẠI (ĐÃ XÓA LOGIC FALLBACK CŨ)
            console.error("[Ext] ⚠️ THẤT BẠI: Không thể tìm thấy khối nội dung (messageBlock). Cần cập nhật contentSelectors.");
            postContent = "Lỗi: Không tìm thấy khối nội dung. (Cần cập nhật selector cho phiên bản Facebook này)";
        }
        
        // 4. Trả về đối tượng
        return {
            authorName,
            authorUrl,
            groupName,
            groupUrl,
            timeText,
            postUrl,
            postContent: postContent.trim() // Đã có postContent (dữ liệu hoặc thông báo lỗi)
        };
    };

    /**
     * Hàm tạo và chèn nút
     */
    const injectButton = (targetContainer, beforeElement, index) => {
        
        const summarizeBtn = document.createElement("div");
        summarizeBtn.innerText = "Tóm Tắt";
        summarizeBtn.title = "Tóm tắt bài viết này (bởi Lập's Ext)";
        summarizeBtn.className = INJECTED_CLASS; // Thêm class

        Object.assign(summarizeBtn.style, {
            cursor: "pointer",
            padding: "8px",
            borderRadius: "6px",
            fontWeight: "bold",
            fontSize: "13px",
            color: "var(--primary-text-color, #050505)", // <-- THAY ĐỔI MÀU
            lineHeight: "1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
        });
        summarizeBtn.onmouseover = () => { summarizeBtn.style.backgroundColor = "var(--hover-overlay, #EBEDF0)"; }; // <-- Dùng màu hover của FB
        summarizeBtn.onmouseout = () => { summarizeBtn.style.backgroundColor = "transparent"; };

        // Sửa thành ASYNC function để có thể "await"
        summarizeBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log(`[Ext] Nút 'Tóm Tắt' được click!`);
            
            // 1. Thay đổi text nút và vô hiệu hóa
            const originalText = summarizeBtn.innerText;
            summarizeBtn.innerText = "Đang tóm tắt...";
            summarizeBtn.style.pointerEvents = 'none'; // Vô hiệu hóa nút

            // Leo lên tìm `div[aria-labelledby]` gần nhất, vì `div[role="article"]` không đáng tin cậy
            const post = targetContainer.closest('div[aria-labelledby]');
            if (!post) {
                console.error("[Ext] Không thể tìm thấy 'post' gốc (div[aria-labelledby]) khi click!");
                // Khôi phục nút
                summarizeBtn.innerText = originalText;
                summarizeBtn.style.pointerEvents = 'auto';
                return;
            }

            console.log("[Ext] Đang lấy thông tin bài viết (có thể mất 0.5s)...");
            
            // 2. Lấy thông tin bài viết (bao gồm nội dung)
            const postInfo = await getPostInfo(post);
            console.log(`[Ext] Thông tin bài viết thu thập được:`, postInfo);

            // 3. KIỂM TRA ĐỘ DÀI
            const postContentLength = postInfo.postContent.length;
            
            if (postContentLength < MIN_LENGTH) {
                const shortMessage = `Bài viết này quá ngắn (${postContentLength} ký tự, giới hạn là ${MIN_LENGTH} ký tự). Không cần tóm tắt.`;
                console.warn(`[Ext] ⚠️ ${shortMessage}`);
                showSummaryPopup(shortMessage, postInfo, true); // True báo hiệu bài viết ngắn
                
                // Khôi phục nút
                summarizeBtn.innerText = originalText;
                summarizeBtn.style.pointerEvents = 'auto';
                return; // Dừng xử lý
            }

// ... (bên trong summarizeBtn.onclick) ...

            // 4. Gọi AI thông qua Proxy
            let summaryText = 'Không thể tóm tắt.';
            
            if (postInfo.postContent && postContentLength > 50) { // Chỉ tóm tắt nếu nội dung đủ dài (safety check)
                console.log(`[Ext] Đang gửi ${postContentLength} ký tự nội dung đến Proxy App Script...`);
                
                // === SỬA DÒNG NÀY ===
                summaryText = await summarizePostContent(postInfo.postContent, postInfo.postUrl); // <-- THÊM postInfo.postUrl
            
            } else {
                 summaryText = 'Nội dung bài viết quá ngắn hoặc không tìm thấy để tóm tắt.';
            }

            // 5. HIỂN THỊ KẾT QUẢ TRONG POPUP

            // 5. HIỂN THỊ KẾT QUẢ TRONG POPUP
            // Luôn gọi showSummaryPopup, bất kể là kết quả tóm tắt hay lỗi
            showSummaryPopup(summaryText, postInfo); 
            
            // 6. Khôi phục nút
            summarizeBtn.innerText = originalText;
            summarizeBtn.style.pointerEvents = 'auto';
        };

        targetContainer.insertBefore(summarizeBtn, beforeElement);
        // console.log(`[Ext] ✅ Đã chèn nút 'Tóm Tắt' (Anchor #${index}).`); // Tắt bớt log
    }


    // 7. Sử dụng MutationObserver...
    console.log("[Ext] Đang tạo MutationObserver (v40)...");
    let debounceTimer;
    const observer = new MutationObserver((mutationsList) => {
        // Chỉ cần biết có thay đổi là quét
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(scanAndAttachFacebook, 300); // Tăng debounce
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // 8. Chạy quét lần đầu sau 1.5 giây (chờ trang tải)
    console.log("[Ext] Chờ 1.5s để quét lần đầu...");
    setTimeout(scanAndAttachFacebook, 1500);

})();