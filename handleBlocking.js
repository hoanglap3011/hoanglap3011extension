(async function() {
    const BLOCKLIST_FILE = 'website_blocklist.json';
    const BLOCKER_CONTAINER_ID = 'my-ext-blocker-container';
    const STORAGE_KEY = 'daily_usage_data';
    
    let g_blockRules = [];
    let g_checkInterval = null;

    // --- CÁC HÀM TIỆN ÍCH ---

    // Đổi "HH:MM" -> Tổng số giây
    function parseDurationToSeconds(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return (hours * 3600) + (minutes * 60);
    }

    // Lấy ngày hiện tại (YYYY-MM-DD) để check reset
    function getTodayString() {
        return new Date().toLocaleDateString('en-CA'); // Định dạng YYYY-MM-DD
    }

    // Tải file cấu hình json
    async function loadBlocklist() {
        try {
            const url = chrome.runtime.getURL(BLOCKLIST_FILE);
            const response = await fetch(url);
            g_blockRules = await response.json();
        } catch (e) {
            console.log("[Ext Blocker] Lỗi tải blocklist:", e);
        }
    }

    // Hàm chặn trang (giữ nguyên UI cũ của bạn)
    function triggerBlock(messageCustom) {
        // Ngắt Interval đếm giờ để không chạy ngầm nữa
        if (g_checkInterval) clearInterval(g_checkInterval);

        // Dừng tải trang
        window.stop();

        const message = messageCustom || "Đã hết thời gian cho phép trong ngày. Hãy quay lại làm việc.";
        const html = `
        <html lang="vi">
        <head>
            <title>Hết giờ!</title>
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
                <h1>Giới hạn thời gian</h1>
                <p>${message}</p>
            </div>
        </body>
        </html>
        `;

        document.documentElement.innerHTML = html;

        // Observer chống ghi đè (Anti-bypass)
        const observer = new MutationObserver(() => {
            if (!document.getElementById(BLOCKER_CONTAINER_ID)) {
                window.stop();
                document.documentElement.innerHTML = html;
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    // --- LOGIC CHÍNH ---

    await loadBlocklist();
    if (!g_blockRules || g_blockRules.length === 0) return;

    const currentHostname = window.location.hostname;

    // Tìm rule phù hợp với domain hiện tại
    // (So khớp: currentHostname có chứa hoặc bằng url trong config)
    const matchedRule = g_blockRules.find(rule => 
        currentHostname === rule.url || currentHostname.endsWith('.' + rule.url)
    );

    // Nếu trang này không nằm trong danh sách thì bỏ qua
    if (!matchedRule) return;

    const maxSeconds = parseDurationToSeconds(matchedRule.duration);
    const domainKey = matchedRule.url; // Dùng cái này làm key lưu trong storage

    console.log(`[Ext Blocker] Giám sát: ${domainKey}, Giới hạn: ${maxSeconds}s`);

    // Nếu giới hạn là 0 giây -> Chặn luôn (giống code cũ)
    if (maxSeconds <= 0) {
        triggerBlock("Trang web này nằm trong danh sách chặn.");
        return;
    }

    // -- XỬ LÝ ĐẾM GIỜ --

    // Lấy dữ liệu từ storage
    chrome.storage.local.get([STORAGE_KEY], (result) => {
        let data = result[STORAGE_KEY] || { date: getTodayString(), usage: {} };
        const today = getTodayString();

        // 1. Kiểm tra Reset ngày mới
        if (data.date !== today) {
            console.log("[Ext Blocker] Ngày mới! Reset bộ đếm.");
            data = { date: today, usage: {} };
            chrome.storage.local.set({ [STORAGE_KEY]: data });
        }

        // Lấy thời gian đã dùng (nếu chưa có thì bằng 0)
        let currentUsage = data.usage[domainKey] || 0;

        // 2. Kiểm tra ngay lúc vừa vào trang
        if (currentUsage >= maxSeconds) {
            triggerBlock(`Bạn đã dùng hết ${matchedRule.duration} cho trang này hôm nay.`);
            return;
        }

        // 3. Bắt đầu đếm (Interval 1 giây)
        g_checkInterval = setInterval(() => {
            // Logic "Cách B": Chỉ đếm khi Tab Visible và Window Focus
            if (document.visibilityState === 'visible' && document.hasFocus()) {
                currentUsage++;
                
                // Cập nhật vào biến cục bộ để hiển thị log (nếu cần)
                // console.log(`[Ext Blocker] ${domainKey}: ${currentUsage}/${maxSeconds}s`);

                // Kiểm tra vượt quá giới hạn
                if (currentUsage >= maxSeconds) {
                    // Lưu lần cuối trước khi chặn
                    saveUsage(domainKey, currentUsage, today);
                    triggerBlock(`Bạn đã dùng hết ${matchedRule.duration}. Mai quay lại nhé!`);
                } else {
                    // Lưu định kỳ (để tránh mất dữ liệu nếu tắt trình duyệt đột ngột)
                    // Lưu mỗi giây là an toàn nhất cho local storage
                    saveUsage(domainKey, currentUsage, today);
                }
            }
        }, 1000);
    });

    // Hàm lưu xuống Storage
    function saveUsage(domain, seconds, dateStr) {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            let data = result[STORAGE_KEY] || { date: dateStr, usage: {} };
            
            // Đảm bảo vẫn đúng ngày (phòng trường hợp treo máy qua đêm)
            if (data.date !== dateStr) {
                data = { date: dateStr, usage: {} };
            }

            data.usage[domain] = seconds;
            chrome.storage.local.set({ [STORAGE_KEY]: data });
        });
    }

})();