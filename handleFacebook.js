(function () {
    console.log("🚀 [Ext] Handle Facebook script loaded (v19 - Fix URL & Line Breaks).");

    // === CÁC SELECTOR CHÍNH XÁC TỪ V4 DEBUG ===
    // CHỈ quét tìm nút "3 chấm" theo yêu cầu
    const ANCHOR_SELECTOR = '[aria-label="Hành động với bài viết này"]';
    
    // Class để đánh dấu nút của chúng ta
    const INJECTED_CLASS = "ext-summarize-btn";
    // Thuộc tính để đánh dấu container đã được xử lý
    const PROCESSED_MARKER = "data-ext-summarize-processed";

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

    /**
     * Tách logic lấy thông tin bài viết ra hàm riêng
     * Hàm này là ASYNC để xử lý "Xem thêm"
     */
    const getPostInfo = async (post) => {
        
        // === SỬA LỖI 1: LẤY TÁC GIẢ ===
        let authorName = 'Không tìm thấy tác giả';
        let authorUrl = 'Không tìm thấy URL tác giả';
        let authorEl = null;

        // Method 1: Dùng aria-labelledby (Đáng tin cậy nhất)
        const authorLabelId = post.getAttribute('aria-labelledby');
        if (authorLabelId) {
            const labelEl = document.getElementById(authorLabelId); // Đây là element có ID
            if (labelEl) {
                authorEl = labelEl.querySelector('a'); // Thử tìm thẻ <a> bên trong
                if (authorEl) {
                    authorName = authorEl.innerText.trim();
                    authorUrl = authorEl.href;
                } else {
                    authorName = labelEl.innerText.trim(); // Fallback nếu không có thẻ <a>
                }
            }
        }

        // Method 2: Fallback về logic cũ nếu Method 1 thất bại
        if (authorName === 'Không tìm thấy tác giả') {
            authorEl = post.querySelector('h4 a, strong a'); // Bỏ bớt selector không đáng tin cậy
            if (authorEl) {
                 authorName = authorEl.innerText.trim();
                 authorUrl = authorEl.href;
            }
        }

        // === SỬA LỖI authorUrl (Loại bỏ tracking params) ===
        if (authorUrl && authorUrl.startsWith('http')) {
            try {
                const url = new URL(authorUrl);
                authorUrl = url.origin + url.pathname; // Chỉ lấy domain + path
            } catch (e) {
                console.warn("[Ext] Không thể parse authorUrl, dùng giá trị gốc.", e);
            }
        }
        
        // 2. Thời gian & URL Bài viết
        const timeEl = post.querySelector('a[href*="/posts/"], a[href*="?story_fbid="], a[href*="/videos/"], a[href*="/watch/"]');
        const timeText = timeEl ? timeEl.innerText.trim() : 'Không tìm thấy thời gian';
        let postUrl = timeEl ? timeEl.href : 'Không tìm thấy URL bài viết';

        // Tương tự, làm sạch postUrl
        if (postUrl && postUrl.startsWith('http')) {
             try {
                const url = new URL(postUrl);
                postUrl = url.origin + url.pathname; 
            } catch (e) {
                console.warn("[Ext] Không thể parse postUrl, dùng giá trị gốc.", e);
            }
        }

        // 3. Nội dung (LOGIC MỚI - TỰ ĐỘNG CLICK "XEM THÊM")
        let postContent = "";
        const messageBlock = post.querySelector('div[data-ad-preview="message"]');
        
        if (messageBlock) {
            // A. Tìm nút "Xem thêm" BÊN TRONG khối message
            const seeMoreButton = Array.from(messageBlock.querySelectorAll('div[role="button"]'))
                                      .find(btn => btn.innerText.includes("Xem thêm") || btn.innerText.includes("See more"));

            // B. Nếu tìm thấy -> click và chờ
            if (seeMoreButton) {
                console.log("[Ext] 'Xem thêm' detected. Clicking and waiting 500ms...");
                seeMoreButton.click();
                // Chờ 500ms để Facebook mở rộng nội dung
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

            // === SỬA LỖI 2: XỬ LÝ EMOJI ===
            // Thay thế tất cả <img> emoji bằng ký tự 'alt' của chúng
            clone.querySelectorAll('img[alt]').forEach(emoji => {
                if (emoji.alt) {
                    // Thay thế <img> bằng một text node chứa nội dung 'alt'
                    emoji.replaceWith(document.createTextNode(emoji.alt));
                } else {
                    // Xóa img nếu không có alt để tránh rác
                    emoji.remove();
                }
            });
            
            // === SỬA LỖI 3: XỬ LÝ XUỐNG DÒNG ===
            // Facebook dùng các <div dir="auto"> cho mỗi dòng/đoạn.
            // Lấy text của từng div và join lại bằng ký tự xuống dòng.
            const paragraphDivs = clone.querySelectorAll('div[dir="auto"]');
            if (paragraphDivs.length > 0) {
                postContent = Array.from(paragraphDivs)
                    .map(p => p.innerText) // Không .trim() ở đây để giữ thụt đầu dòng (nếu có)
                    .join('\n'); // Nối lại bằng dấu xuống dòng thật
            } else {
                // Fallback nếu cấu trúc khác (ví dụ: không có 'div[dir="auto"]' lồng nhau)
                postContent = clone.innerText.trim(); 
            }

        } else {
            // Fallback về logic cũ nếu không tìm thấy 'messageBlock'
            console.warn("[Ext] Không tìm thấy 'data-ad-preview=\"message\"'. Dùng logic cũ.");
            const contentElements = post.querySelectorAll('div[dir="auto"]');
            contentElements.forEach(el => {
                const role = el.getAttribute('role');
                const hasSeeMore = el.querySelector('div[role="button"]');
                if (role !== 'button' && !hasSeeMore) {
                    postContent += el.innerText + "\n";
                }
            });
            postContent = postContent.trim();
        }
        
        // 4. Trả về đối tượng
        return {
            authorName,
            authorUrl,
            timeText,
            postUrl,
            postContent: postContent || "Không tìm thấy nội dung text."
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
            
            // Leo lên tìm `div[aria-labelledby]` gần nhất, vì `div[role="article"]` không đáng tin cậy
            const post = targetContainer.closest('div[aria-labelledby]');
            if (!post) {
                console.error("[Ext] Không thể tìm thấy 'post' gốc (div[aria-labelledby]) khi click!");
                return;
            }

            console.log("[Ext] Đang lấy thông tin bài viết (có thể mất 0.5s)...");
            // Gọi hàm async và chờ kết quả
            const postInfo = await getPostInfo(post);

            console.log("[Ext] Thông tin bài viết:", postInfo);
        };

        targetContainer.insertBefore(summarizeBtn, beforeElement);
        // console.log(`[Ext] ✅ Đã chèn nút 'Tóm Tắt' (Anchor #${index}).`); // Tắt bớt log
    }


    // 7. Sử dụng MutationObserver...
    console.log("[Ext] Đang tạo MutationObserver (v19)...");
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

