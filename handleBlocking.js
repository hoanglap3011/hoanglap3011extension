(async function() {
    const BLOCKER_CONTAINER_ID = 'my-ext-blocker-container';
    const NOTI_ID = 'my-ext-timer-notification';
    const STORAGE_KEY = 'daily_usage_data';
    
    let g_blockRules = [];
    let g_checkInterval = null;
    let g_currentDomainKey = null;
    let g_maxSeconds = 0;
    let g_allowedFrames = null;

    // --- 1. UTILITIES ---

    function formatTime(totalSeconds) {
        if (totalSeconds >= Number.MAX_SAFE_INTEGER) return "∞";
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const mStr = minutes.toString().padStart(2, '0');
        const sStr = seconds.toString().padStart(2, '0');
        if (hours > 0) return `${hours}:${mStr}:${sStr}`;
        return `${mStr}:${sStr}`;
    }

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
            return currentMins >= (startH * 60 + startM) && currentMins < (endH * 60 + endM);
        });
    }

    // --- 2. PARSE BLOCKLIST TỪ STORAGE ---
    // Cú pháp mỗi dòng: url | duration(HH:MM) | allowed_frames(HH:MM-HH:MM,...)
    // Dòng bắt đầu bằng # là comment, dòng trống bị bỏ qua.
    function parseBlocklistText(text) {
        const rules = [];
        const lines = (text || '').split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            const parts = trimmed.split('|').map(s => s.trim());
            const url = parts[0];
            if (!url) continue;

            const duration = parts[1] || null;
            const framesRaw = parts[2] || null;
            const allowed_frames = framesRaw
                ? framesRaw.split(',').map(s => s.trim()).filter(Boolean)
                : null;

            rules.push({ url, duration, allowed_frames });
        }
        return rules;
    }

    // --- 3. LOAD BLOCKLIST TỪ STORAGE ---
    async function loadBlocklist() {
        return new Promise(resolve => {
            // WEBSITE_BLOCKLIST_KEY được định nghĩa trong config.js
            // Nhưng handleBlocking.js chạy ở document_start TRƯỚC config.js
            // nên dùng string literal thay vì hằng số
            const KEY = 'websiteBlocklist';
            const DEFAULT = `# Chặn vĩnh viễn\ntiktok.com\n\n# Giới hạn thời gian + khung giờ\nvnexpress.net | 00:10 | 12:00-14:00\n\n# Chỉ giới hạn thời gian\nvoz.vn | 00:10`;

            chrome.storage.local.get(KEY, (data) => {
                const raw = data[KEY];
                if (raw === undefined) {
                    // Lần đầu: seed default vào storage
                    chrome.storage.local.set({ [KEY]: DEFAULT });
                    g_blockRules = parseBlocklistText(DEFAULT);
                } else {
                    g_blockRules = parseBlocklistText(raw);
                }
                resolve();
            });
        });
    }

    // --- 4. UI THÔNG BÁO ---

    function showUsageNotification(currentUsage, maxSeconds) {
        const oldNoti = document.getElementById(NOTI_ID);
        if (oldNoti) oldNoti.remove();

        let messageHTML = '';
        if (maxSeconds >= Number.MAX_SAFE_INTEGER) {
            messageHTML = `
                <div style="font-weight:bold;color:#4CAF50;">Được phép truy cập</div>
                <div style="font-size:12px;margin-top:4px;">Trong khung giờ quy định</div>`;
        } else {
            const remaining = maxSeconds - currentUsage;
            const percent = Math.min(100, (currentUsage / maxSeconds) * 100);
            let color = '#4CAF50';
            if (percent > 50) color = '#FFC107';
            if (percent > 85) color = '#FF5252';
            messageHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                    <span style="font-size:12px;color:#aaa;">Thời gian còn lại</span>
                    <span style="font-weight:bold;color:${color};font-size:14px;">${formatTime(remaining)}</span>
                </div>
                <div style="width:100%;background:#444;height:4px;border-radius:2px;">
                    <div style="width:${percent}%;background:${color};height:100%;border-radius:2px;transition:width 0.5s;"></div>
                </div>
                <div style="font-size:10px;color:#888;margin-top:4px;text-align:right;">
                    Tổng giới hạn: ${formatTime(maxSeconds)}
                </div>`;
        }

        const div = document.createElement('div');
        div.innerHTML = `
            <div id="${NOTI_ID}" style="
                position:fixed;bottom:20px;right:20px;z-index:2147483647;
                background:#1E1E1E;color:#E0E0E0;padding:15px;width:220px;
                border-radius:8px;box-shadow:0 4px 15px rgba(0,0,0,0.5);
                font-family:-apple-system,sans-serif;border:1px solid #333;
                animation:slideInKeyframe 0.5s ease-out;pointer-events:none;">
                <style>
                    @keyframes slideInKeyframe { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
                    @keyframes fadeOutKeyframe { to{opacity:0;visibility:hidden} }
                </style>
                ${messageHTML}
            </div>`;
        document.body.appendChild(div.firstElementChild);

        setTimeout(() => {
            const el = document.getElementById(NOTI_ID);
            if (el) {
                el.style.animation = "fadeOutKeyframe 1s forwards";
                setTimeout(() => el.remove(), 1000);
            }
        }, 5000);
    }

    // --- 5. LOGIC CHẶN ---

    function triggerBlock(messageCustom) {
        if (g_checkInterval) clearInterval(g_checkInterval);
        const noti = document.getElementById(NOTI_ID);
        if (noti) noti.remove();

        window.stop();
        if (document.getElementById(BLOCKER_CONTAINER_ID)) return;

        const message = messageCustom || "Đã hết thời gian cho phép.";
        const html = `
        <html lang="vi"><head>
            <title>Truy cập bị chặn</title><meta charset="UTF-8">
            <style>
                html,body{background:#121212;color:#E0E0E0;font-family:-apple-system,sans-serif;
                    display:flex;justify-content:center;align-items:center;height:100vh;margin:0;}
                .container{border:1px dashed #FF5555;padding:40px;border-radius:12px;background:#1E1E1E;text-align:center;}
                h1{color:#FF8A80;margin-top:0;}
            </style>
        </head><body>
            <div class="container" id="${BLOCKER_CONTAINER_ID}">
                <h1>Truy cập bị chặn</h1>
                <p>${message}</p>
            </div>
        </body></html>`;

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

    // --- 6. KHỞI CHẠY ---

    async function initCheck() {
        // Kiểm tra switch bật/tắt toàn bộ tính năng
        const enabled = await new Promise(resolve => {
            chrome.storage.local.get('LapsExtensionSettings', (data) => {
                const s = data['LapsExtensionSettings'] || {};
                resolve(s.enableWebsiteBlocker !== false); // mặc định true
            });
        });
        if (!enabled) return;

        await loadBlocklist();
        if (!g_blockRules || g_blockRules.length === 0) return;

        const currentHostname = window.location.hostname;
        const matchedRule = g_blockRules.find(rule =>
            currentHostname === rule.url || currentHostname.endsWith('.' + rule.url)
        );
        if (!matchedRule) return;

        g_currentDomainKey = matchedRule.url;
        g_allowedFrames = matchedRule.allowed_frames;

        if (matchedRule.duration) {
            g_maxSeconds = parseDurationToSeconds(matchedRule.duration);
        } else {
            g_maxSeconds = (g_allowedFrames && g_allowedFrames.length > 0)
                ? Number.MAX_SAFE_INTEGER
                : 0;
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

            showUsageNotification(localCounter, maxSeconds);

            g_checkInterval = setInterval(() => {
                if (document.visibilityState === 'visible' && document.hasFocus()) {
                    if (g_allowedFrames && !isCurrentTimeAllowed(g_allowedFrames)) {
                        saveUsageSafe(domainKey, localCounter, today);
                        triggerBlock("Đã hết khung giờ cho phép truy cập.");
                        return;
                    }
                    localCounter++;
                    saveUsageSafe(domainKey, localCounter, today);
                    if (localCounter >= maxSeconds) {
                        triggerBlock("Hết thời lượng sử dụng trong ngày!");
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