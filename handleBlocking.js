(async function() {
    const BLOCKLIST_FILE = 'website_blocklist.json';
    const BLOCKER_CONTAINER_ID = 'my-ext-blocker-container';
    const NOTI_ID = 'my-ext-timer-notification'; // ID cho popup thông báo
    const STORAGE_KEY = 'daily_usage_data';
    
    let g_blockRules = [];
    let g_checkInterval = null;
    let g_currentDomainKey = null;
    let g_maxSeconds = 0;
    let g_allowedFrames = null;

    // --- 1. MODULE UI & TIỆN ÍCH ---

    // Chuyển đổi giây sang định dạng MM:SS hoặc HH:MM:SS
    function formatTime(totalSeconds) {
        if (totalSeconds >= Number.MAX_SAFE_INTEGER) return "∞";
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        const mStr = minutes.toString().padStart(2, '0');
        const sStr = seconds.toString().padStart(2, '0');
        
        if (hours > 0) {
            return `${hours}:${mStr}:${sStr}`;
        }
        return `${mStr}:${sStr}`;
    }

    // Parse "HH:MM" thành giây
    function parseDurationToSeconds(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return (hours * 3600) + (minutes * 60);
    }

    function getTodayString() {
        return new Date().toLocaleDateString('en-CA'); 
    }

    function isCurrentTimeAllowed(frames) {
        if (!frames || frames.length === 0) return true;
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();

        return frames.some(frame => {
            const [start, end] = frame.split('-');
            const [startH, startM] = start.split(':').map(Number);
            const [endH, endM] = end.split(':').map(Number);
            const startTotalMins = startH * 60 + startM;
            const endTotalMins = endH * 60 + endM;
            return currentMins >= startTotalMins && currentMins < endTotalMins;
        });
    }

    // --- 2. MODULE HIỂN THỊ THÔNG BÁO (TOAST) ---

    function showUsageNotification(currentUsage, maxSeconds) {
        // Xóa thông báo cũ nếu có
        const oldNoti = document.getElementById(NOTI_ID);
        if (oldNoti) oldNoti.remove();

        const remaining = maxSeconds - currentUsage;
        let messageHTML = '';

        // Xử lý nội dung hiển thị tùy theo chế độ
        if (maxSeconds >= Number.MAX_SAFE_INTEGER) {
            // Trường hợp chỉ dùng Time Frame (Không giới hạn duration)
            messageHTML = `
                <div style="font-weight: bold; color: #4CAF50;">Được phép truy cập</div>
                <div style="font-size: 12px; margin-top: 4px;">Trong khung giờ quy định</div>
            `;
        } else {
            // Trường hợp có giới hạn thời gian
            const percent = Math.min(100, (currentUsage / maxSeconds) * 100);
            let color = '#4CAF50'; // Xanh (An toàn)
            if (percent > 50) color = '#FFC107'; // Vàng (Cảnh báo)
            if (percent > 85) color = '#FF5252'; // Đỏ (Nguy hiểm)

            messageHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                    <span style="font-size: 12px; color: #aaa;">Thời gian còn lại</span>
                    <span style="font-weight: bold; color: ${color}; font-size: 14px;">${formatTime(remaining)}</span>
                </div>
                <div style="width: 100%; background: #444; height: 4px; border-radius: 2px;">
                    <div style="width: ${percent}%; background: ${color}; height: 100%; border-radius: 2px; transition: width 0.5s;"></div>
                </div>
                <div style="font-size: 10px; color: #888; margin-top: 4px; text-align: right;">
                    Tổng giới hạn: ${formatTime(maxSeconds)}
                </div>
            `;
        }

        const html = `
            <div id="${NOTI_ID}" style="
                position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
                background: #1E1E1E; color: #E0E0E0;
                padding: 15px; width: 220px;
                border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                font-family: -apple-system, sans-serif; border: 1px solid #333;
                animation: slideInKeyframe 0.5s ease-out;
                pointer-events: none; /* Để bấm xuyên qua được */
            ">
                <style>
                    @keyframes slideInKeyframe {
                        from { transform: translateX(100%); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                    }
                    @keyframes fadeOutKeyframe {
                        to { opacity: 0; visibility: hidden; }
                    }
                </style>
                ${messageHTML}
            </div>
        `;

        // Chèn vào DOM
        const div = document.createElement('div');
        div.innerHTML = html;
        document.body.appendChild(div.firstElementChild);

        // Tự động ẩn sau 5 giây
        setTimeout(() => {
            const el = document.getElementById(NOTI_ID);
            if (el) {
                el.style.animation = "fadeOutKeyframe 1s forwards";
                setTimeout(() => el.remove(), 1000); // Xóa hẳn khỏi DOM sau khi fade
            }
        }, 5000);
    }

    // --- 3. LOGIC CHẶN & ĐẾM ---

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
        
        // Xóa notification nếu đang hiện
        const noti = document.getElementById(NOTI_ID);
        if (noti) noti.remove();

        window.stop();
        if (document.getElementById(BLOCKER_CONTAINER_ID)) return;

        const message = messageCustom || "Đã hết thời gian cho phép.";
        const html = `
        <html lang="vi">
        <head>
            <title>Truy cập bị chặn</title>
            <meta charset="UTF-8">
            <style>
                html, body {
                    background: #121212; color: #E0E0E0;
                    font-family: -apple-system, sans-serif;
                    display: flex; justify-content: center; align-items: center;
                    height: 100vh; margin: 0;
                }
                .container {
                    border: 1px dashed #FF5555; padding: 40px;
                    border-radius: 12px; background: #1E1E1E; text-align: center;
                }
                h1 { color: #FF8A80; margin-top: 0; }
            </style>
        </head>
        <body>
            <div class="container" id="${BLOCKER_CONTAINER_ID}">
                <h1>Truy cập bị chặn</h1>
                <p>${message}</p>
            </div>
        </body>
        </html>
        `;

        document.documentElement.innerHTML = html;
        const observer = new MutationObserver(() => {
            if (!document.getElementById(BLOCKER_CONTAINER_ID)) {
                window.stop();
                document.documentElement.innerHTML = html;
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    function saveUsageSafe(domain, secondsToAdd, dateStr) {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            let data = result[STORAGE_KEY] || { date: dateStr, usage: {} };
            if (data.date !== dateStr) data = { date: dateStr, usage: {} };
            
            const currentDbValue = data.usage[domain] || 0;
            data.usage[domain] = Math.max(currentDbValue, secondsToAdd);
            chrome.storage.local.set({ [STORAGE_KEY]: data });
        });
    }

    async function initCheck() {
        await loadBlocklist();
        if (!g_blockRules || g_blockRules.length === 0) return;

        const currentHostname = window.location.hostname;
        const matchedRule = g_blockRules.find(rule => 
            currentHostname === rule.url || currentHostname.endsWith('.' + rule.url)
        );

        if (!matchedRule) return;

        g_currentDomainKey = matchedRule.url;
        g_allowedFrames = matchedRule.allowed_frames; 

        // Xử lý Logic Duration
        if (matchedRule.duration) {
            g_maxSeconds = parseDurationToSeconds(matchedRule.duration);
        } else {
            if (g_allowedFrames && g_allowedFrames.length > 0) {
                g_maxSeconds = Number.MAX_SAFE_INTEGER; 
            } else {
                g_maxSeconds = 0;
            }
        }
        
        if (g_maxSeconds <= 0) {
            triggerBlock("Trang web này nằm trong danh sách chặn vĩnh viễn.");
            return;
        }

        if (g_allowedFrames && !isCurrentTimeAllowed(g_allowedFrames)) {
            triggerBlock(`Chỉ được phép truy cập trong khung giờ: ${g_allowedFrames.join(', ')}`);
            return;
        }

        startCounting();
    }

    function startCounting() {
        if (g_checkInterval) clearInterval(g_checkInterval);

        const domainKey = g_currentDomainKey;
        const maxSeconds = g_maxSeconds;
        const today = getTodayString();

        chrome.storage.local.get([STORAGE_KEY], (result) => {
            let data = result[STORAGE_KEY] || { date: today, usage: {} };
            if (data.date !== today) {
                data = { date: today, usage: {} }; 
                chrome.storage.local.set({ [STORAGE_KEY]: data });
            }

            let localCounter = data.usage[domainKey] || 0;

            if (localCounter >= maxSeconds) {
                triggerBlock("Đã hết thời lượng sử dụng trong ngày.");
                return;
            }

            // --- HIỂN THỊ THÔNG BÁO KHI VỪA VÀO ---
            // Chỉ hiện nếu trang chưa bị chặn
            showUsageNotification(localCounter, maxSeconds);
            // ---------------------------------------

            g_checkInterval = setInterval(() => {
                if (document.visibilityState === 'visible' && document.hasFocus()) {
                    
                    if (g_allowedFrames && !isCurrentTimeAllowed(g_allowedFrames)) {
                        saveUsageSafe(domainKey, localCounter, today);
                        triggerBlock("Đã hết khung giờ cho phép truy cập.");
                        return;
                    }

                    localCounter++;
                    
                    if (localCounter >= maxSeconds) {
                        saveUsageSafe(domainKey, localCounter, today);
                        triggerBlock("Hết thời lượng sử dụng trong ngày!");
                    } else {
                        saveUsageSafe(domainKey, localCounter, today);
                    }
                }
            }, 1000);
        });
    }

    initCheck();

    window.addEventListener('pageshow', (event) => {
        if (event.persisted) initCheck();
    });

    window.addEventListener('focus', () => {
        if (g_currentDomainKey && g_maxSeconds > 0) initCheck(); 
    });

})();