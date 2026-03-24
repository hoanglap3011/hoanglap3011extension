// == RUNNER ==
(function() {
    const storage = {
        isExtension: () => typeof chrome !== 'undefined' && chrome.storage?.local,
        get: (keys, cb) => {
            if (storage.isExtension()) {
                chrome.storage.local.get(keys, cb);
            } else {
                const result = {};
                result[Array.isArray(keys) ? keys[0] : keys] = null;
                cb(result);
            }
        }
    };
    storage.get(SETTINGS_KEY, (data) => {
        const settings = { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };
        if (settings.fbEnableSummarize || settings.fbEnableBlockByKeyword) {
            initializeFacebookHandler(settings);
        }
    });
})();


function initializeFacebookHandler(settings) {
    console.log("🚀 [Ext] Facebook script loaded. Settings:", settings);

    const PROXY_URL = (typeof API !== 'undefined' && API) ? API : "PROXY_URL_NOT_FOUND";
    const MIN_LENGTH = (typeof MIN_SUMMARY_LENGTH !== 'undefined') ? MIN_SUMMARY_LENGTH : 100;

    const CONFIG = {
        // -------------------------------------------------------
        // ANCHOR SELECTORS — nút "..." trên bài viết
        // Khi hỏng: F12 → hover nút "..." → inspect → copy aria-label → thêm vào đây
        // -------------------------------------------------------
        ANCHOR_SELECTORS: [
            '[aria-label="Hành động với bài viết này"]',
            '[aria-label="Actions for this post"]',
            '[aria-label="Thêm hành động"]',
            '[aria-label="More actions"]',
            '[aria-label="More"]',
        ],

        // -------------------------------------------------------
        // POST SELECTOR — outermost card container
        // Debug 2026-03-24: nút "..." nằm 9 cấp bên trong card.
        // class x1n2onr6 có trên outermost card nhưng KHÔNG có trên
        // nested card con → dùng để filter nested.
        // Khi hỏng: chạy đoạn debug "9 cấp" → xem +9 có class gì mới.
        // -------------------------------------------------------
        POST_SELECTOR: 'div.x1n2onr6[style*="--card-corner-radius"]',

        // -------------------------------------------------------
        // Vị trí inject nút Tóm Tắt (tính từ nút "..." đi lên)
        // +3 = row chứa nút "...", +2 = wrapper bên trong row đó
        // Khi hỏng: chạy debug "9 cấp", tìm row chứa Like/Comment/Share
        // -------------------------------------------------------
        INJECT_ROW_DEPTH: 3,      // targetContainer = đi lên 3 cấp từ anchorBtn
        INJECT_BEFORE_DEPTH: 2,   // beforeElement  = đi lên 2 cấp từ anchorBtn

        // -------------------------------------------------------
        CONTENT_SELECTORS: [
            'div[data-ad-preview="message"]',
            'div[data-testid="post_message"]',
            '[data-testid="story-text-content"]',
            'div[dir="auto"][style*="text-align"]',
        ],

        KEYWORDS_STORAGE_KEY: 'fbBlockKeywordsList',
        INJECTED_CLASS: "ext-summarize-btn",
        PROCESSED_MARKER: "data-ext-processed",
        DEBOUNCE_TIME: 400,
        INITIAL_SCAN_DELAY: 1500,
        SEE_MORE_CLICK_DELAY: 600,
        HEADER_SCAN_LENGTH: 300,
        POPUP_WIDTH: 600,
        POPUP_HEIGHT: 500
    };

    let g_blockList = [];

    // === HELPERS ===

    function getAncestor(el, depth) {
        let cur = el;
        for (let i = 0; i < depth; i++) {
            cur = cur?.parentElement;
        }
        return cur;
    }

    function findAnchorButton(post) {
        for (const selector of CONFIG.ANCHOR_SELECTORS) {
            const btn = post.querySelector(selector);
            if (btn) return btn;
        }
        // Heuristic: tìm div có aria-haspopup="menu" không có text
        const menuBtns = post.querySelectorAll('[aria-haspopup="menu"]');
        for (const btn of menuBtns) {
            if ((btn.innerText?.trim().length || 0) < 5) return btn;
        }
        return null;
    }

    // === BLOCKLIST ===

    // DEFAULT_FB_KEYWORDS được định nghĩa trong config.js (load trước)
    async function loadBlocklist() {
        return new Promise(resolve => {
            chrome.storage.local.get(CONFIG.KEYWORDS_STORAGE_KEY, (data) => {
                const raw = data[CONFIG.KEYWORDS_STORAGE_KEY];
                if (raw === undefined) {
                    // Lần đầu chạy: seed default vào storage luôn
                    const defaultRaw = DEFAULT_FB_KEYWORDS.join('\n');
                    chrome.storage.local.set({ [CONFIG.KEYWORDS_STORAGE_KEY]: defaultRaw });
                    g_blockList = [...DEFAULT_FB_KEYWORDS];
                    console.log("[Ext] Blocklist: dùng default, đã seed vào storage.");
                } else {
                    g_blockList = raw.split('\n').map(s => s.trim()).filter(s => s.length > 0);
                    console.log("[Ext] Blocklist loaded from storage:", g_blockList);
                }
                resolve();
            });
        });
    }

    function scanAndBlockModules() {
        if (g_blockList.length === 0) return;
        document.querySelectorAll(CONFIG.POST_SELECTOR).forEach(module => {
            if (module.style.display === 'none') return;
            // Bỏ qua nested card
            if (module.parentElement?.closest(CONFIG.POST_SELECTOR)) return;
            const headerText = (module.innerText || '').substring(0, CONFIG.HEADER_SCAN_LENGTH);
            if (g_blockList.some(kw => headerText.includes(kw))) {
                module.style.display = 'none';
                console.log("[Ext] Ẩn khối:", headerText.substring(0, 60).replace(/\n/g, " "));
            }
        });
    }

    // === SUMMARIZE BUTTON ===

    const scanAndAttachSummarizeButtons = () => {
        document.querySelectorAll(CONFIG.POST_SELECTOR).forEach((post, index) => {
            if (post.hasAttribute(CONFIG.PROCESSED_MARKER)) return;

            // Bỏ qua nested card
            if (post.parentElement?.closest(CONFIG.POST_SELECTOR)) return;

            // Bỏ qua các khối bị block (Reels, Gợi ý, v.v.) — không cần nút Tóm Tắt
            const headerText = (post.innerText || '').substring(0, CONFIG.HEADER_SCAN_LENGTH);
            if (g_blockList.some(kw => headerText.includes(kw))) return;

            const anchorBtn = findAnchorButton(post);
            if (!anchorBtn) return;

            post.setAttribute(CONFIG.PROCESSED_MARKER, "1");

            const targetContainer = getAncestor(anchorBtn, CONFIG.INJECT_ROW_DEPTH);
            const beforeElement   = getAncestor(anchorBtn, CONFIG.INJECT_BEFORE_DEPTH);

            if (targetContainer && beforeElement) {
                injectButton(targetContainer, beforeElement, post);
            }
        });
    };

    const injectButton = (targetContainer, beforeElement, post) => {
        const btn = document.createElement("div");
        btn.innerText = "Tóm Tắt";
        btn.title = "Tóm tắt bài viết này (Lập's Ext)";
        btn.className = CONFIG.INJECTED_CLASS;
        Object.assign(btn.style, {
            cursor: "pointer", padding: "8px", borderRadius: "6px",
            fontWeight: "bold", fontSize: "13px",
            color: "var(--primary-icon, #65676B)",
            lineHeight: "1", display: "flex",
            alignItems: "center", justifyContent: "center"
        });
        btn.onmouseover = () => { btn.style.backgroundColor = "var(--hover-overlay, #EBEDF0)"; };
        btn.onmouseout  = () => { btn.style.backgroundColor = "transparent"; };

        btn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const orig = btn.innerText;
            btn.innerText = "Đang tóm tắt...";
            btn.style.pointerEvents = 'none';

            const postInfo = await getPostInfo(post);

            if (postInfo.postContent.length < MIN_LENGTH) {
                showSummaryPopup(
                    `Bài viết quá ngắn (${postInfo.postContent.length} ký tự, giới hạn ${MIN_LENGTH}).`,
                    postInfo, true
                );
            } else {
                const summary = await summarizePostContent(postInfo.postContent, postInfo.postUrl);
                showSummaryPopup(summary, postInfo);
            }

            btn.innerText = orig;
            btn.style.pointerEvents = 'auto';
        };

        targetContainer.insertBefore(btn, beforeElement);
    };

    // === DATA SCRAPING ===

    const getPostInfo = async (post) => {
        const authorInfo  = _getAuthorAndGroup(post);
        const timeInfo    = _getTimeAndUrl(post);
        const postContent = await _getPostContent(post);
        return { ...authorInfo, ...timeInfo, postContent };
    };

    function cleanUrl(url) {
        if (!url?.startsWith('http')) return url || '';
        try { const u = new URL(url); return u.origin + u.pathname; } catch { return url; }
    }

    function _getAuthorAndGroup(post) {
        let authorName = 'Không tìm thấy tác giả', authorUrl = '';
        let groupName = null, groupUrl = null;

        // Thử aria-labelledby trước (phòng khi FB dùng lại)
        const labelId = post.getAttribute('aria-labelledby');
        const labelEl = labelId ? document.getElementById(labelId) : null;
        if (labelEl) {
            const link = labelEl.querySelector('a');
            if (link && (link.href.includes('/groups/') || link.href.includes('/gaming/'))) {
                groupName = labelEl.innerText.trim();
                groupUrl  = link.href;
                const aLink = post.querySelector('a[href*="/user/"][tabindex="0"], a[href*="?id="][tabindex="0"]');
                if (aLink) { authorName = aLink.innerText.trim(); authorUrl = aLink.href; }
            } else if (link) {
                authorName = labelEl.innerText.trim(); authorUrl = link.href;
            } else {
                authorName = labelEl.innerText.trim();
            }
        }

        // Fallback
        if (authorName === 'Không tìm thấy tác giả') {
            const el = post.querySelector('h4 a, strong a, a[role="link"][tabindex="0"]');
            if (el) { authorName = el.innerText.trim(); authorUrl = el.href; }
        }

        return { authorName, authorUrl: cleanUrl(authorUrl), groupName, groupUrl: cleanUrl(groupUrl) };
    }

    function _getTimeAndUrl(post) {
        let timeText = 'Không tìm thấy thời gian', postUrl = '';
        const links = post.querySelectorAll('a[href*="/posts/"], a[href*="?story_fbid="], a[href*="/videos/"], a[href*="/watch/"]');
        if (links.length > 0) {
            const link = links[links.length - 1];
            postUrl = link.href;
            let el = link, depth = 0;
            while (el && depth < 5) {
                if (el.title?.length > 5)                       { timeText = el.title; break; }
                if (el.getAttribute('aria-label')?.length > 5)  { timeText = el.getAttribute('aria-label'); break; }
                el = el.parentElement; depth++;
            }
            if (timeText === 'Không tìm thấy thời gian' && link.innerText) {
                timeText = link.innerText.trim();
            }
        }
        return { timeText, postUrl: cleanUrl(postUrl) };
    }

    async function _getPostContent(post) {
        let messageBlock = null;

        for (const sel of CONFIG.CONTENT_SELECTORS) {
            messageBlock = post.querySelector(sel);
            if (messageBlock) break;
        }

        // Heuristic: div[dir="auto"] có text dài nhất
        if (!messageBlock) {
            let maxLen = 0;
            post.querySelectorAll('div[dir="auto"]').forEach(el => {
                const len = el.innerText?.trim().length || 0;
                if (len > maxLen && len > 50) { maxLen = len; messageBlock = el; }
            });
            if (messageBlock) console.log("[Ext] Dùng heuristic content block — cân nhắc cập nhật CONTENT_SELECTORS.");
        }

        if (!messageBlock) {
            console.warn("[Ext] ⚠️ Không tìm thấy content block.");
            return "Lỗi: Không tìm thấy nội dung bài viết.";
        }

        // Click "Xem thêm"
        const seeMore = Array.from(messageBlock.querySelectorAll('div[role="button"]'))
            .find(b => b.innerText.includes("Xem thêm") || b.innerText.includes("See more"));
        if (seeMore) {
            seeMore.click();
            await new Promise(r => setTimeout(r, CONFIG.SEE_MORE_CLICK_DELAY));
        }

        const clone = messageBlock.cloneNode(true);
        clone.querySelectorAll('div[role="button"]').forEach(b => {
            if (b.innerText.includes("Xem thêm") || b.innerText.includes("See more")) b.remove();
        });
        clone.querySelectorAll('img[alt]').forEach(img => img.replaceWith(document.createTextNode(img.alt || '')));

        const paras = clone.querySelectorAll('div[dir="auto"]');
        return (paras.length > 0
            ? Array.from(paras).map(p => p.innerText).join('\n')
            : clone.innerText.trim()
        ).trim();
    }

    // === API & UI ===

    const getApiPass = async () => {
        try {
            const result = await chrome.storage.local.get(CACHE_PASS);
            if (result[CACHE_PASS]) {
                return result[CACHE_PASS];
            }
        } catch (e) {
            console.error(`[Ext] Lỗi khi đọc '${CACHE_PASS}' từ storage:`, e);
        }
        return null;
    };

    const summarizePostContent = async (content, postUrl) => {
        if (!PROXY_URL || PROXY_URL === "PROXY_URL_NOT_FOUND")
            return "Lỗi cấu hình: Không tìm thấy URL Proxy trong config.js.";

        const pass = await getApiPass();
        if (!pass) {
            alert("Cảnh báo: Bạn chưa cấu hình mật khẩu API trong cài đặt. Vui lòng kiểm tra lại!");
            return;
        }

        try {
            const res = await fetch(PROXY_URL, {
                method: 'POST',
                body: JSON.stringify({ pass, action: 'tomTatByAI', content, code: postUrl })
            });
            if (!res.ok) return `Lỗi Proxy: ${res.status} ${res.statusText}`;
            const result = await res.json();
            if (result.code !== 1) return `Lỗi AI (Code ${result.code}): ${result.error || result.details || 'Không rõ'}`;
            return result.data ? result.data.replace(/\n/g, '<br>') : "AI không trả về dữ liệu.";
        } catch (err) {
            return `Lỗi kết nối: ${err.message}`;
        }
    };

    const showSummaryPopup = (summaryContent, postInfo, isShortPost = false) => {
        try {
            const isError = summaryContent.includes("Lỗi");
            const { POPUP_WIDTH: w, POPUP_HEIGHT: h } = CONFIG;
            const popup = window.open("", "summaryPopup",
                `width=${w},height=${h},top=${(screen.height-h)/2},left=${(screen.width-w)/2},scrollbars=yes,resizable=yes`);
            if (!popup) { console.warn("[Ext] Popup bị chặn."); return; }

            const meta = `<p style="border-bottom:1px solid #ddd;padding-bottom:5px;margin-bottom:10px;">
                <strong>Tác giả:</strong> ${postInfo.authorName} ${postInfo.authorUrl ? `(<a href="${postInfo.authorUrl}" target="_blank">Link</a>)` : ''}<br>
                <strong>Nguồn:</strong> ${postInfo.groupName || 'Trang cá nhân/Fanpage'} ${postInfo.groupUrl ? `(<a href="${postInfo.groupUrl}" target="_blank">Link</a>)` : ''}<br>
                <strong>Thời gian:</strong> ${postInfo.timeText}
            </p>`;

            const [title, color, boxStyle] = isError
                ? ["THÔNG BÁO LỖI",  "#f00",    "background:#ffebeb;color:#cc0000;border:1px solid #f00;"]
                : isShortPost
                ? ["THÔNG BÁO",      "#ff9800", "background:#fff8e1;color:#ff9800;border:1px solid #ff9800;"]
                : ["Kết Quả Tóm Tắt (Gemini AI)", "#1877f2", "background:#f0f2f5;color:#333;"];

            popup.document.open();
            popup.document.write(`<html><head>
                <title>${title} - ${postInfo.authorName}</title>
                <style>
                    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:20px;line-height:1.6;background:#fff;color:#333}
                    h2{color:${color};margin-top:0;padding-bottom:10px;border-bottom:2px solid ${color}}
                    .box{padding:15px;border-radius:8px;white-space:pre-wrap;word-wrap:break-word;${boxStyle}}
                </style></head><body>
                <h2>${title}</h2>
                ${(isError || isShortPost) ? '' : meta}
                <div class="box">${summaryContent}</div>
            </body></html>`);
            popup.document.close();
            popup.focus();
        } catch (e) { console.warn("[Ext] Lỗi popup:", e); }
    };

    // === INITIALIZATION ===
    // Load blocklist TRƯỚC, rồi mới khởi động tất cả — đảm bảo g_blockList
    // luôn có data trước khi bất kỳ scan nào chạy (kể cả nút Tóm Tắt)
    loadBlocklist().then(() => {

        if (settings.fbEnableBlockByKeyword) scanAndBlockModules();
        if (settings.fbEnableSummarize) {
            setTimeout(scanAndAttachSummarizeButtons, CONFIG.INITIAL_SCAN_DELAY);
        }

        let debounceTimer;
        const observer = new MutationObserver(() => {
            if (settings.fbEnableBlockByKeyword) scanAndBlockModules();
            if (settings.fbEnableSummarize) {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(scanAndAttachSummarizeButtons, CONFIG.DEBOUNCE_TIME);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

    });

} // initializeFacebookHandler