(async function() {
    const BLOCKLIST_FILE = 'website_blocklist.json';
    const BLOCKER_CONTAINER_ID = 'my-ext-blocker-container';
    const STORAGE_KEY = 'daily_usage_data';
    
    let g_blockRules = [];
    let g_checkInterval = null;
    let g_currentDomainKey = null;
    let g_maxSeconds = 0;

    // --- CÁC HÀM TIỆN ÍCH ---

    function parseDurationToSeconds(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return (hours * 3600) + (minutes * 60);
    }

    function getTodayString() {
        return new Date().toLocaleDateString('en-CA'); 
    }

    async function loadBlocklist() {
        try {
            const url = chrome.runtime.getURL(BLOCKLIST_FILE);
            const response = await fetch(url);
            g_blockRules = await response.json();
        } catch (e) {
            console.log("[Ext Blocker] Lỗi tải blocklist:", e);
        }
    }

    function triggerBlock(messageCustom) {
        if (g_checkInterval) clearInterval(g_checkInterval);
        window.stop();

        const message = messageCustom || "Đã hết thời gian cho phép. Quay lại làm việc đi!";
        
        // Kiểm tra xem đã chặn chưa để tránh render lại nhiều lần gây nháy
        if (document.getElementById(BLOCKER_CONTAINER_ID)) return;

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

        // Anti-bypass observer
        const observer = new MutationObserver(() => {
            if (!document.getElementById(BLOCKER_CONTAINER_ID)) {
                window.stop();
                document.documentElement.innerHTML = html;
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    // --- LOGIC LƯU TRỮ AN TOÀN (FIX BUG TỤT GIỜ) ---
    
    function saveUsageSafe(domain, secondsToAdd, dateStr) {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            let data = result[STORAGE_KEY] || { date: dateStr, usage: {} };
            
            if (data.date !== dateStr) {
                data = { date: dateStr, usage: {} };
            }

            // Lấy giá trị hiện tại trong DB
            const currentDbValue = data.usage[domain] || 0;
            
            // Logic mới: Chỉ cộng dồn hoặc lấy max, không ghi đè mù quáng
            // Ở đây ta tính toán: Giá trị mới = Max(Giá trị DB, Giá trị Local muốn lưu)
            // Tuy nhiên, vì biến secondsToAdd ở dưới đang là biến đếm tổng (currentUsage),
            // nên ta dùng Math.max để đảm bảo không bao giờ giảm đi.
            
            const newValue = Math.max(currentDbValue, secondsToAdd);

            data.usage[domain] = newValue;
            chrome.storage.local.set({ [STORAGE_KEY]: data });
        });
    }

    // --- LOGIC KHỞI TẠO VÀ ĐẾM ---

    async function initCheck() {
        await loadBlocklist();
        if (!g_blockRules || g_blockRules.length === 0) return;

        const currentHostname = window.location.hostname;
        const matchedRule = g_blockRules.find(rule => 
            currentHostname === rule.url || currentHostname.endsWith('.' + rule.url)
        );

        if (!matchedRule) return;

        g_currentDomainKey = matchedRule.url;
        g_maxSeconds = parseDurationToSeconds(matchedRule.duration);

        if (g_maxSeconds <= 0) {
            triggerBlock("Trang web này nằm trong danh sách chặn.");
            return;
        }

        startCounting();
    }

    function startCounting() {
        // Clear interval cũ nếu có để tránh chạy chồng chéo
        if (g_checkInterval) clearInterval(g_checkInterval);

        const domainKey = g_currentDomainKey;
        const maxSeconds = g_maxSeconds;
        const today = getTodayString();

        // Lấy dữ liệu mới nhất từ storage để đồng bộ biến đếm cục bộ
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            let data = result[STORAGE_KEY] || { date: today, usage: {} };
            
            if (data.date !== today) {
                data = { date: today, usage: {} }; // Reset nếu sang ngày mới
                chrome.storage.local.set({ [STORAGE_KEY]: data });
            }

            // Đồng bộ biến đếm cục bộ với DB
            let localCounter = data.usage[domainKey] || 0;

            // Kiểm tra ngay lập tức
            if (localCounter >= maxSeconds) {
                triggerBlock("Đã hết giờ ngay khi tải trang.");
                return;
            }

            // Bắt đầu interval đếm
            g_checkInterval = setInterval(() => {
                // Chỉ đếm khi tab active
                if (document.visibilityState === 'visible' && document.hasFocus()) {
                    localCounter++;
                    
                    if (localCounter >= maxSeconds) {
                        saveUsageSafe(domainKey, localCounter, today);
                        triggerBlock("Hết giờ rồi!");
                    } else {
                        // Lưu định kỳ mỗi giây, dùng hàm Safe để không bị ghi đè lùi
                        saveUsageSafe(domainKey, localCounter, today);
                    }
                }
            }, 1000);
        });
    }

    // --- XỬ LÝ SỰ KIỆN (FIX BUG BACK BUTTON) ---

    // Chạy lần đầu
    initCheck();

    // Lắng nghe sự kiện pageshow: Được kích hoạt ngay cả khi load từ BF Cache (Back/Forward)
    window.addEventListener('pageshow', (event) => {
        // Nếu trang được load từ cache (event.persisted = true)
        // Hoặc đơn giản là chạy lại logic check để đảm bảo an toàn
        if (event.persisted) {
            console.log("[Ext Blocker] Phát hiện Back/Forward navigation. Checking lại...");
            // Load lại config và check lại từ đầu
            initCheck();
        }
    });

    // Lắng nghe sự kiện focus lại cửa sổ để đồng bộ dữ liệu (phòng trường hợp mở 2 tab cùng lúc)
    window.addEventListener('focus', () => {
        if (g_currentDomainKey) {
             // Khi focus lại, nên lấy dữ liệu mới nhất từ storage
             // để tránh việc Tab A dùng hết giờ, quay lại Tab B vẫn còn giờ cũ
             startCounting(); 
        }
    });

})();