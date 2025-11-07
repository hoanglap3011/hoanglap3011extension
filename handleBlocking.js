(async function() {
    const BLOCKLIST_FILE = 'website_blocklist.json';
    let g_siteBlocklist = [];
    
    // Thêm ID cho container để kiểm tra
    const BLOCKER_CONTAINER_ID = 'my-ext-blocker-container'; 

    /**
     * Tải danh sách chặn (không đổi)
     */
    async function loadBlocklist() {
        try {
            const url = chrome.runtime.getURL(BLOCKLIST_FILE);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error("Không tìm thấy file blocklist");
            }
            g_siteBlocklist = await response.json();
        } catch (e) {
            console.log("[Ext Blocker] Lỗi tải blocklist:", e);
        }
    }

    /**
     * Tiêm HTML đè lên trang (đã thêm ID vào container)
     */
    function injectBlocker() {
        const message = "Chặn là có lý do. Hãy tập trung vào công việc của bạn.";
        const html = `
        <html lang="vi">
        <head>
            <title>Trang đã bị chặn</title>
            <meta charset="UTF-8">
            <style>
                html, body {
                    background: #121212; color: #E0E0E0;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    display: flex; justify-content: center; align-items: center;
                    height: 100vh; margin: 0; padding: 0;
                    text-align: center; overflow: hidden;
                }
                .container {
                    border: 1px dashed #FF5555; padding: 40px 60px;
                    border-radius: 12px; background: #1E1E1E;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                }
                h1 { font-size: 24px; color: #FF8A80; margin-top: 0; }
                p { font-size: 16px; }
            </style>
        </head>
        <body>
            <div class="container" id="${BLOCKER_CONTAINER_ID}">
                <h1>Trang này đã bị chặn</h1>
                <p>${message}</p>
            </div>
        </body>
        </html>
        `;
        
        document.documentElement.innerHTML = html;
    }

    // --- Logic chính ---

    await loadBlocklist();
    if (g_siteBlocklist.length === 0) return; 

    const currentHostname = window.location.hostname;
    
    const isBlocked = g_siteBlocklist.some(domain => 
        currentHostname === domain || 
        currentHostname.endsWith('.' + domain)
    );

    if (isBlocked) {
        console.log(`[Ext Blocker] Đang chặn ${currentHostname}`);

        // === BẮT ĐẦU SỬA LỖI RACE CONDITION ===

        // 1. Dừng tải tất cả tài nguyên (scripts, images) của trang ngay lập tức
        // Đây là chìa khóa để chặn logo Instagram
        window.stop();

        // 2. Tiêm HTML chặn (lần đầu tiên)
        injectBlocker();

        // 3. Tạo một MutationObserver để "canh gác" trang
        //    Phòng trường hợp script của trang (như Instagram) cố gắng
        //    vẽ lại UI đè lên màn hình chặn của chúng ta.
        const observer = new MutationObserver((mutations) => {
            // Kiểm tra xem trang có còn là của chúng ta không
            if (!document.getElementById(BLOCKER_CONTAINER_ID)) {
                console.log("[Ext Blocker] Trang web cố gắng ghi đè. Đang chặn lại...");
                // Nếu không, chặn lại một lần nữa
                window.stop();
                injectBlocker();
            }
        });

        // Bắt đầu quan sát toàn bộ tài liệu
        observer.observe(document.documentElement, {
            childList: true, // Theo dõi việc thêm/bớt con
            subtree: true    // Theo dõi toàn bộ cây DOM
        });
        
        // === KẾT THÚC SỬA LỖI ===
    }
})();