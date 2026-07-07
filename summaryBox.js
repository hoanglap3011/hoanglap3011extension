(function() {
    chrome.storage.local.get([SETTINGS_KEY, SUMMARY_SITES_KEY], (data) => {
        const settings = { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };
        if (!settings.sbEnable) return;
        const excluded = (data[SUMMARY_SITES_KEY] ?? DEFAULT_SUMMARY_SITES)
            .split('\n')
            .map(s => s.trim().toLowerCase())
            .filter(Boolean);
        const hostname = window.location.hostname.replace(/^www\./, '');
        const isExcluded = excluded.some(s => hostname === s || hostname.endsWith('.' + s));
        if (!isExcluded) initSummaryBox();
    });
})();

function initSummaryBox() {
    if (document.getElementById('lp-summary-box-container')) return;

    // Các diễn đàn XenForo hỗ trợ tóm tắt thread (voz dùng route /t/, mặc định là /threads/)
    const FORUM_HOSTS = ['voz.vn', 'otofun.net.vn'];
    const THREAD_PATH_RE = /^\/(t|threads)\/[^/]+\.\d+/;
    const isForumHost = (hostname) => {
        const h = hostname.replace(/^www\./, '');
        return FORUM_HOSTS.some(f => h === f || h.endsWith('.' + f));
    };

    // Kiểm tra trang hiện tại có phải nội dung cần hiển thị box không
    const isContentPage = () => {
        const { hostname, pathname, search } = window.location;

        // YouTube: chỉ trang xem video cụ thể
        if (hostname.includes('youtube.com'))
            return pathname === '/watch' && !!new URLSearchParams(search).get('v');

        // Diễn đàn: chỉ trang thread cụ thể (không phải trang chủ/danh mục)
        if (isForumHost(hostname))
            return THREAD_PATH_RE.test(pathname);

        // Trang báo / blog: cần ít nhất 1 path segment
        const segments = pathname.split('/').filter(Boolean);
        if (segments.length < 1) return false;

        // Tín hiệu 1: JSON-LD khai báo là bài viết/video
        const hasArticleJsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).some(s => {
            try {
                const d = JSON.parse(s.textContent);
                const types = [].concat(Array.isArray(d) ? d.map(x => x['@type']) : d['@type']).join(',').toLowerCase();
                return /\b(article|newsarticle|blogposting|videoobject)\b/.test(types);
            } catch { return false; }
        });
        if (hasArticleJsonLd) return true;

        // Tín hiệu 2: OpenGraph article:published_time — đặc thù cho bài viết
        if (document.querySelector('meta[property="article:published_time"]')) return true;

        // Tín hiệu 3: URL kết thúc bằng numeric ID (phổ biến ở báo Việt Nam)
        const lastSegment = segments[segments.length - 1];
        if (/\d{4,}\.html?$/.test(lastSegment)) return true;

        return false;
    };

    // URL chuẩn hoá dùng làm khoá cache (chỉ gọi khi isContentPage() = true)
    const getNormalizedUrl = () => {
        const { hostname, pathname, search } = window.location;
        if (hostname.includes('youtube.com'))
            return `https://youtu.be/${new URLSearchParams(search).get('v')}`;
        if (isForumHost(hostname))
            return window.location.origin + pathname.replace(/\/page-\d+\/?$/, '').replace(/\/$/, '');
        return window.location.origin + pathname;
    };

    const container = document.createElement('div');
    container.id = 'lp-summary-box-container';
    document.body.appendChild(container);
    const shadow = container.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
        #lp-box {
            position: fixed; z-index: 2147483647;
            background: white; border: 1px solid #ccc;
            border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex; flex-direction: column; overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            min-width: 200px; min-height: 100px;
        }
        .header {
            background: #f8f9fa; padding: 8px 12px; cursor: move;
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid #eee; user-select: none;
        }
        .title { font-weight: 600; font-size: 13px; color: #444; }
        .btns button {
            border: none; background: none; cursor: pointer;
            padding: 0 5px; font-size: 16px; color: #888;
        }
        .btns button:hover { color: #000; }
        #content {
            padding: 12px; flex: 1; overflow-y: auto;
            font-size: 14px; color: #333;
            display: flex; flex-direction: column; gap: 8px;
        }
        #lp-box.minimized {
            width: 220px !important; height: 38px !important;
            bottom: 10px !important; right: 10px !important;
            top: auto !important; left: auto !important;
        }
        #lp-box.minimized #content,
        #lp-box.minimized .footer,
        #lp-box.minimized .rz { display: none; }
        /* Tay nắm co giãn ở 4 cạnh + 4 góc */
        .rz { position: absolute; z-index: 10; }
        .rz-n  { top: 0; left: 12px; right: 12px; height: 5px; cursor: ns-resize; }
        .rz-s  { bottom: 0; left: 12px; right: 12px; height: 5px; cursor: ns-resize; }
        .rz-e  { right: 0; top: 12px; bottom: 12px; width: 5px; cursor: ew-resize; }
        .rz-w  { left: 0; top: 12px; bottom: 12px; width: 5px; cursor: ew-resize; }
        .rz-ne { top: 0; right: 0; width: 12px; height: 12px; cursor: nesw-resize; }
        .rz-nw { top: 0; left: 0; width: 12px; height: 12px; cursor: nwse-resize; }
        .rz-sw { bottom: 0; left: 0; width: 12px; height: 12px; cursor: nesw-resize; }
        .rz-se {
            bottom: 0; right: 0; width: 12px; height: 12px; cursor: nwse-resize;
            background: linear-gradient(135deg, transparent 50%, #ccc 50%);
        }
        .footer {
            padding: 8px 12px; border-top: 1px solid #eee;
            display: flex; gap: 8px; flex-shrink: 0;
        }
        .btn-summary {
            padding: 6px 14px; border: none; background: #065fd4;
            color: white; border-radius: 16px; cursor: pointer;
            font-size: 13px; font-weight: 500;
        }
        .btn-summary:hover:not(:disabled) { background: #0552b0; }
        .btn-summary:disabled { background: #9e9e9e; cursor: not-allowed; }
        .loader {
            display: inline-block; border: 2px solid rgba(255,255,255,0.3);
            border-top: 2px solid #fff; border-radius: 50%;
            width: 12px; height: 12px;
            animation: spin 0.8s linear infinite; vertical-align: middle;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        a.yt-link {
            color: #065fd4; text-decoration: none; font-weight: 500;
            display: block; padding: 4px 0;
            border-bottom: 1px dashed #eee;
        }
        a.yt-link:hover { text-decoration: underline; }
    `;
    shadow.appendChild(style);

    const lpBox = document.createElement('div');
    lpBox.id = 'lp-box';

    chrome.storage.local.get(['summaryBoxState'], (res) => {
        const s = res.summaryBoxState || { top: '20px', right: '20px', width: '300px', height: '200px' };
        Object.assign(lpBox.style, { top: s.top, right: s.right, left: s.left, width: s.width, height: s.height });
        if (s.isMin) lpBox.classList.add('minimized');
    });

    lpBox.innerHTML = `
        <div class="header">
            <span class="title">✨ Tóm tắt</span>
            <div class="btns">
                <button id="btn-min" title="Thu nhỏ">_</button>
                <button id="btn-max" title="Phóng to" style="display:none">▢</button>
                <button id="btn-close" title="Đóng">×</button>
            </div>
        </div>
        <div id="content"><i style="color:#888">Đang tải...</i></div>
        <div class="footer" style="display:none">
            <button class="btn-summary" id="btn-fetch">Tóm tắt</button>
            <button class="btn-summary" id="btn-thread" style="display:none">Tóm tắt</button>
        </div>
    `;
    shadow.appendChild(lpBox);

    const saveBoxState = () => {
        chrome.storage.local.set({ summaryBoxState: {
            top: lpBox.style.top, right: lpBox.style.right, left: lpBox.style.left,
            width: lpBox.style.width, height: lpBox.style.height,
            isMin: lpBox.classList.contains('minimized')
        }});
    };

    const btnMin   = lpBox.querySelector('#btn-min');
    const btnMax   = lpBox.querySelector('#btn-max');
    const btnClose = lpBox.querySelector('#btn-close');

    btnMin.onclick = () => { lpBox.classList.add('minimized'); btnMin.style.display = 'none'; btnMax.style.display = 'inline'; saveBoxState(); };
    btnMax.onclick = () => { lpBox.classList.remove('minimized'); btnMin.style.display = 'inline'; btnMax.style.display = 'none'; saveBoxState(); };
    btnClose.onclick = () => container.remove();

    lpBox.querySelector('.header').onmousedown = (e) => {
        if (lpBox.classList.contains('minimized')) return;
        let startX = e.clientX, startY = e.clientY;
        let startLeft = lpBox.offsetLeft, startTop = lpBox.offsetTop;
        const onMove = (ev) => {
            lpBox.style.left = (startLeft + ev.clientX - startX) + 'px';
            lpBox.style.top  = (startTop  + ev.clientY - startY) + 'px';
            lpBox.style.right = 'auto';
        };
        document.onmousemove = onMove;
        document.onmouseup = () => { document.onmousemove = null; saveBoxState(); };
    };

    // Co giãn từ cạnh/góc bất kỳ; kéo cạnh trái/trên thì bù vị trí để mép đối diện đứng yên
    const startResize = (e, dirs) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX, startY = e.clientY;
        const startW = lpBox.offsetWidth, startH = lpBox.offsetHeight;
        const startL = lpBox.offsetLeft,  startT = lpBox.offsetTop;
        const MIN_W = 200, MIN_H = 100;
        // Chuyển sang định vị left/top để chỉnh vị trí không xung đột với neo "right"
        lpBox.style.left = startL + 'px'; lpBox.style.top = startT + 'px'; lpBox.style.right = 'auto';
        document.onmousemove = (ev) => {
            const dx = ev.clientX - startX, dy = ev.clientY - startY;
            if (dirs.includes('e')) lpBox.style.width  = Math.max(MIN_W, startW + dx) + 'px';
            if (dirs.includes('s')) lpBox.style.height = Math.max(MIN_H, startH + dy) + 'px';
            if (dirs.includes('w')) {
                const w = Math.max(MIN_W, startW - dx);
                lpBox.style.width = w + 'px';
                lpBox.style.left  = (startL + startW - w) + 'px';
            }
            if (dirs.includes('n')) {
                const h = Math.max(MIN_H, startH - dy);
                lpBox.style.height = h + 'px';
                lpBox.style.top    = (startT + startH - h) + 'px';
            }
        };
        document.onmouseup = () => { document.onmousemove = null; saveBoxState(); };
    };
    ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach(dir => {
        const h = document.createElement('div');
        h.className = `rz rz-${dir}`;
        h.onmousedown = (e) => startResize(e, dir);
        lpBox.appendChild(h);
    });

    const contentEl = lpBox.querySelector('#content');
    const btnFetch  = lpBox.querySelector('#btn-fetch');
    const btnThread = lpBox.querySelector('#btn-thread');
    const footer    = lpBox.querySelector('.footer');

    const isForumThread = () => isForumHost(window.location.hostname) && THREAD_PATH_RE.test(window.location.pathname);

    // ── Helper UI dùng chung ──
    const setStatus = (msg) => { contentEl.innerHTML = `<i style="color:#888">${msg}</i>`; };
    const setError  = (msg) => { contentEl.innerHTML = `<span style="color:red">Lỗi: ${msg}</span>`; };
    // Mỗi loại trang chỉ hiện 1 nút nên reset cả hai luôn an toàn
    const resetButtons = () => {
        btnFetch.disabled  = false; btnFetch.textContent  = 'Tóm tắt';
        btnThread.disabled = false; btnThread.textContent = 'Tóm tắt';
    };
    // sendMessage dạng promise; đọc lastError để Chrome không cảnh báo "Unchecked runtime.lastError"
    const sendBg = (msg) => new Promise(resolve =>
        chrome.runtime.sendMessage(msg, (resp) => { void chrome.runtime.lastError; resolve(resp); }));

    const getApiPass = () => new Promise(resolve => {
        chrome.storage.local.get(CACHE_PASS, r => resolve(r[CACHE_PASS] || null));
    });

    // In-memory write-through cache — avoids a redundant read on every setLocalEntry
    let memCache = null;
    const loadCache = () => new Promise(resolve => {
        if (memCache !== null) { resolve(memCache); return; }
        chrome.storage.local.get(CACHE_SUMMARY_DATA, r => {
            memCache = r[CACHE_SUMMARY_DATA] || {};
            resolve(memCache);
        });
    });
    const getLocalEntry = async (key) => (await loadCache())[key] || null;
    const setLocalEntry = async (key, data) => {
        const cache = await loadCache();
        cache[key] = { ...(cache[key] || {}), ...data };
        return new Promise(resolve => chrome.storage.local.set({ [CACHE_SUMMARY_DATA]: cache }, resolve));
    };
    // Background (hoặc tab khác) ghi cache → cập nhật memCache để không bị ghi đè bằng bản cũ
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[CACHE_SUMMARY_DATA])
            memCache = changes[CACHE_SUMMARY_DATA].newValue || {};
    });

    // --- Server sync ---
    const postApi = async (payload) => {
        try {
            const res = await fetch(API, { method: 'POST', body: JSON.stringify(payload) });
            const json = await res.json();
            return json?.code === 1;
        } catch (e) { return false; }
    };

    const getCategory = (url) => {
        if (url.startsWith('https://youtu.be/')) return 'youtube';
        try {
            const u = new URL(url);
            if (isForumHost(u.hostname) && THREAD_PATH_RE.test(u.pathname)) return 'thread';
        } catch (e) {}
        return 'url';
    };

    // Thông tin để background tự lưu cache + Google Sheet sau khi tạo notebook —
    // nhờ đó tiến trình vẫn hoàn tất kể cả khi rời trang giữa chừng
    const buildSaveMeta = async (shortUrl, title, pass) => ({
        shortUrl, title, pass,
        category: getCategory(shortUrl),
        existedBefore: !!(await getLocalEntry(shortUrl)),
        api: API
    });

const getPageTitle = () => {
        const ytTitle = document.querySelector('h1.style-scope.ytd-watch-metadata yt-formatted-string');
        return ytTitle ? ytTitle.textContent.trim() : document.title;
    };

    const renderLinks = (links) => {
        contentEl.innerHTML = '';
        if (links.notebooklm) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;border-bottom:1px dashed #eee;padding:4px 0';
            const a = document.createElement('a');
            a.className = 'yt-link'; a.style.borderBottom = 'none';
            a.textContent = '📂 Mở NotebookLM';
            a.href = '#';
            a.onclick = (e) => {
                e.preventDefault();
                const sourceUrl = getNormalizedUrl();
                chrome.runtime.sendMessage({ action: 'open_notebook', notebookUrl: links.notebooklm, sourceUrl });
            };
            row.appendChild(a);
            contentEl.appendChild(row);
        }
        if (links.summary) {
            const a = document.createElement('a');
            a.className = 'yt-link'; a.textContent = '📝 Xem Tóm tắt'; a.href = '#';
            a.onclick = (e) => { e.preventDefault(); showSummaryPopup(links.summary); };
            contentEl.appendChild(a);
        }
        if (links.mindomo) {
            const a = document.createElement('a');
            a.className = 'yt-link'; a.textContent = '🧠 Mở Mindmap';
            a.href = links.mindomo; a.target = '_blank';
            contentEl.appendChild(a);
        }
    };

    const showSummaryPopup = (html) => {
        const w = 600, h = 400;
        const popup = window.open('', 'summaryPopup',
            `width=${w},height=${h},top=${(screen.height-h)/2},left=${(screen.width-w)/2},scrollbars=yes,resizable=yes`);
        if (!popup) { alert('Vui lòng cho phép cửa sổ pop-up để xem tóm tắt.'); return; }
        popup.document.write(`<html><head><title>Tóm tắt</title><style>body{font-family:Roboto,Arial,sans-serif;padding:15px;line-height:1.6;background:#f9f9f9;color:#333}</style></head><body></body></html>`);
        const div = popup.document.createElement('div');
        div.innerHTML = html;
        popup.document.body.appendChild(div);
        popup.document.close(); popup.focus();
    };

    const createNotebook = async () => {
        const shortUrl = getNormalizedUrl();
        const pass = await getApiPass();
        if (!pass) { PasswordModule.openPasswordPopup(() => createNotebook()); return; }

        // Capture title before async — page may navigate while waiting
        const pageTitle = getPageTitle();

        btnFetch.disabled = true;
        btnFetch.innerHTML = '<span class="loader"></span>';
        setStatus('Đang khởi tạo NotebookLM...');

        const meta = await buildSaveMeta(shortUrl, pageTitle, pass);
        const response = await sendBg({ action: 'create_notebook', url: shortUrl, meta });
        if (!response?.success) {
            setError(response?.error || 'Không kết nối được');
            resetButtons();
            return;
        }
        // Việc lưu cache + Sheet do background đảm nhận; ở đây chỉ cập nhật UI
        renderLinks({ notebooklm: `https://notebooklm.google.com/notebook/${response.notebookId}` });
        footer.style.display = 'none';
    };

    // Notebook đã bị xóa trên NotebookLM: cảnh báo + hiện lại nút Tóm tắt,
    // giữ các link còn dùng được (tóm tắt văn bản / mindmap) nếu có
    const showDeletedNotice = (remaining) => {
        if (remaining?.summary || remaining?.mindomo) renderLinks(remaining);
        else contentEl.innerHTML = '';
        const note = document.createElement('div');
        note.innerHTML = '<span style="color:#e65100">⚠️ Notebook cũ đã bị xóa trên NotebookLM.<br>Nhấn "Tóm tắt" để tạo lại.</span>';
        contentEl.prepend(note);
        footer.style.display = '';
        resetButtons();
    };

    const checkLocalAndRender = async () => {
        const url = getNormalizedUrl();
        if (!url) return;
        const cached = await getLocalEntry(url);
        if (!cached || (!cached.notebooklm && !cached.summary)) return;
        // Hiển thị ngay từ cache, không chờ xác minh.
        // Entry còn nhưng notebooklm đã bị gỡ (phát hiện xoá trước đó) → vẫn cho bấm Tóm tắt lại
        renderLinks(cached);
        footer.style.display = cached.notebooklm ? 'none' : '';
        if (!cached.notebooklm) return;
        // Âm thầm kiểm tra notebook còn sống không; chết → gỡ link, hiện lại nút Tóm tắt
        sendBg({ action: 'verify_notebook', notebookUrl: cached.notebooklm }).then(resp => {
            if (resp?.exists !== false) return;
            if (url !== getNormalizedUrl()) return; // đã điều hướng SPA sang trang khác
            // Giữ entry (dấu hiệu hàng đã có trên Sheet), chỉ xoá giá trị notebooklm
            // ở cả cache local lẫn Google Sheet — các cột summary/mindomo giữ nguyên
            setLocalEntry(url, { notebooklm: null });
            getApiPass().then(pass => {
                if (pass) postApi({ action: 'updateSummaryNotebook', pass, code: url, notebooklm: '' });
            });
            showDeletedNotice({ ...cached, notebooklm: null });
        });
    };

    const getThreadPageUrls = async (threadUrl) => {
        const resp = await fetch(threadUrl);
        const html = await resp.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        let totalPages = 1;
        const lastJump = doc.querySelector('a.pageNav-jump--last');
        if (lastJump) {
            const m = (lastJump.getAttribute('href') || '').match(/page-(\d+)/);
            if (m) totalPages = parseInt(m[1]);
        } else {
            doc.querySelectorAll('.pageNav-page a').forEach(a => {
                const n = parseInt(a.textContent.trim());
                if (!isNaN(n) && n > totalPages) totalPages = n;
            });
        }
        const base = threadUrl.replace(/\/page-\d+\/?$/, '').replace(/\/$/, '');
        const urls = [base + '/'];
        for (let i = 2; i <= totalPages; i++)
            urls.push(`${base}/page-${i}`);
        return { urls, totalPages };
    };

    // Quy đổi emoticon voz → emoji unicode. Khớp chính xác trước, khớp chứa sau.
    const EMOJI_MAP = {
        // Bộ "Pò" (popopo/*) — emoticon đặc sản của voz
        "adore": "😍", "after_boom": "😵", "agree": "👍", "ah": "😮", "amazed": "😲",
        "angry": "😡", "bad_smelly": "🤢", "baffle": "😕", "beat_brick": "🧱",
        "beat_plaster": "🤕", "beat_shot": "🔫", "beated": "🤕", "beauty": "💅",
        "beg": "🙏", "big_smile": "😃", "bigsmile": "😃", "boss": "😎",
        "burn_joss_stick": "🕯️", "byebye": "👋", "canny": "😏", "chicken": "🐔",
        "choler": "😤", "cold": "🥶", "confident": "😌", "confuse": "😵‍💫",
        "cry": "😭", "doubt": "🤨", "dribble": "🤤", "embarrassed": "😳",
        "extreme_sexy_girl": "🔥", "feel_good": "😊", "go": "🏃", "haha": "🤣",
        "hell_boy": "😈", "hungry": "😋", "look_down": "😒", "matrix": "😎",
        "misdoubt": "🧐", "nosebleed": "😍", "oh": "😯", "ops": "😅", "oops": "😅",
        "pudency": "☺️", "rap": "🎤", "sad": "😔", "sexy_girl": "💃", "sexy": "😏",
        "shame": "😳", "smile": "🙂", "still_dreaming": "💤", "sure": "👌",
        "surrender": "🏳️", "sweat": "😓", "sweet_kiss": "😘", "tire": "😫",
        "too_sad": "😢", "waaaht": "😧", "what": "😦",
        "puke": "🤮", "gach": "🧱", "brick": "🧱", "chay": "🏃", "nobita": "🤓", "bye": "👋",
        // Smiley ký tự (popo/*)
        ":)": "🙂", ":(": "🙁", ":((": "😭", ":))": "😄", "=))": "🤣", "=((": "😭",
        ":d": "😁", ";)": "😉", ":p": "😛", ":o": "😮", ":-(": "🙁", ":-)": "🙂",
        // Bộ mặc định XenForo + tên tiếng Anh chung
        "confused": "😕", "cool": "😎", "mad": "😡", "rolleyes": "🙄", "eek": "😳",
        "sick": "🤮", "sleep": "😴", "love": "😍", "lol": "😂", "roflmao": "🤣",
        "sneaky": "😏", "unsure": "😬", "whistle": "😙", "wink": "😉",
        "fire": "🔥", "wave": "👋", "waving hand": "👋", "laugh": "😆", "grin": "😁",
        "joy": "😂", "rofl": "🤣", "thumbs up": "👍", "thumbs down": "👎",
        "heart eyes": "😍", "kissing heart": "😘", "heart": "❤️", "thinking": "🤔",
        "clap": "👏", "eyes": "👀", "party popper": "🎉", "slightly frowning": "🙁",
        "sweat smile": "😅", "pensive": "😔", "flushed": "😳", "scream": "😱",
        "rocket": "🚀", "light bulb": "💡", "bulb": "💡", "check mark": "✅",
        "white_check_mark": "✅", "cross mark": "❌", "warning": "⚠️"
    };

    const emoticonToEmoji = (img) => {
        const shortname = (img.getAttribute('data-shortname') || img.getAttribute('alt') || img.getAttribute('title') || '').trim();
        if (!shortname) return '';
        let label = shortname;
        if (label.startsWith(':') && label.endsWith(':') && label.length > 2) label = label.slice(1, -1).trim();
        const lookup = /[a-z]/i.test(label) ? label.toLowerCase() : label;
        if (EMOJI_MAP[lookup]) return EMOJI_MAP[lookup];
        for (const [key, emoji] of Object.entries(EMOJI_MAP))
            if (key.length >= 3 && lookup.includes(key)) return emoji;
        // Không có trong bảng: tên chữ giữ dạng :tên:, smiley ký tự (":((", "=]]"...)
        // giữ nguyên — tránh bọc thêm dấu hai chấm thành rác kiểu "::(:"
        return /^[\w -]+$/.test(label) ? ` :${label}: ` : ` ${label} `;
    };

    // Dọn markdown: bỏ ký tự ẩn, khoảng trắng thừa đầu/cuối dòng (thụt ≥4 dấu cách
    // sẽ bị markdown hiểu nhầm thành code block), gom dòng trống liên tiếp
    const mdClean = (s) => s
        .replace(/[​﻿]/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n');

    // Chuyển nội dung post (bbWrapper) sang markdown — voz chỉ dùng nhóm tag nhỏ
    const nodeToMarkdown = (node) => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent.replace(/\s+/g, ' ');
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        const kids = () => Array.from(node.childNodes).map(nodeToMarkdown).join('');
        switch (node.tagName) {
            case 'BR': return '\n';
            case 'B': case 'STRONG': { const t = kids().trim(); return t ? `**${t}**` : ''; }
            case 'I': case 'EM':     { const t = kids().trim(); return t ? `*${t}*` : ''; }
            case 'A': {
                const href = node.getAttribute('href') || '';
                const t = kids().trim();
                if (!t) return ''; // link chỉ bọc ảnh → bỏ
                if (!href || href.startsWith('javascript') || href.startsWith('#')) return t;
                const abs = new URL(href, window.location.origin).href;
                return t === abs ? abs : `[${t}](${abs})`;
            }
            // Emoticon → emoji unicode; ảnh nội dung alt chỉ là tên file rác → bỏ
            case 'IMG':
                return (node.classList.contains('smilie') || node.classList.contains('emoji') || node.hasAttribute('data-shortname'))
                    ? emoticonToEmoji(node) : '';
            case 'IFRAME': {
                const src = node.getAttribute('src') || node.getAttribute('data-src') || '';
                if (!/youtube\.com|youtu\.be/.test(src)) return '';
                const m = src.match(/\/(?:embed|v)\/([a-zA-Z0-9_-]{11})/);
                return m ? `\n[Video YouTube: https://www.youtube.com/watch?v=${m[1]}]\n` : '';
            }
            case 'NOSCRIPT': return ''; // bản sao ảnh lazy-load → gây trùng lặp
            case 'LI': return `- ${kids().trim()}\n`;
            case 'UL': case 'OL': return `\n${kids()}\n`;
            case 'H1': case 'H2': case 'H3': case 'H4': return `\n#### ${kids().trim()}\n`;
            case 'SCRIPT': case 'STYLE': return '';
            case 'BLOCKQUOTE': {
                // Quote → blockquote markdown, giữ ngữ cảnh ai trả lời ai (quote lồng nhau thành "> >")
                let who = node.getAttribute('data-quote');
                if (!who) {
                    // Theme không có data-quote (vd otofun): tên nằm trong tiêu đề quote "X nói:"
                    const attribution = node.querySelector('.bbCodeBlock-sourceJump, cite, .bbCodeBlock-title');
                    who = (attribution?.textContent || '').replace(/\s*(?:đã\s+)?(?:nói|said|wrote)\s*:?\s*$/i, '').trim();
                }
                node.querySelectorAll('.bbCodeBlock-title, .bbCodeBlock-expandLink, .bbCodeBlock-shrinkLink').forEach(el => el.remove());
                let qMd = mdClean(kids()).trim();
                if (qMd.length > 300) qMd = qMd.slice(0, 300).trimEnd() + '...'; // quote dài chỉ cần mở đầu, nội dung đầy đủ đã có ở post gốc
                const quoted = qMd.split('\n').map(l => l.trim() ? '> ' + l : '>').join('\n');
                // Dòng trống sau quote là bắt buộc: markdown coi dòng sát dưới blockquote
                // là phần tiếp của quote → nội dung trả lời sẽ bị dính vào quote
                return `\n\n> **${who ? 'Trả lời ' + who : 'Trích'}:**\n${quoted}\n\n`;
            }
            case 'DIV': case 'P': return `${kids()}\n`;
            default: return kids();
        }
    };

    // estBase: số bài ước tính đã qua ở các trang trước (~20 bài/trang),
    // dùng làm dự phòng khi không đọc được số # hiển thị trên diễn đàn
    const extractThreadPageText = (html, estBase) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const posts = [];
        let firstPostTime = '';
        doc.querySelectorAll('article.message--post').forEach((article, idx) => {
            const timeEl = article.querySelector('header.message-attribution time') || article.querySelector('time.u-dt');
            let postTime = timeEl?.getAttribute('title') || timeEl?.textContent.trim() || '';
            if (!postTime) {
                // Theme không dùng thẻ <time> (vd otofun): thời gian là text trong link attribution
                const attrLink = article.querySelector('.message-attribution-main a');
                postTime = attrLink?.textContent.replace(/\s+/g, ' ').trim() || 'Không rõ thời gian';
            }
            if (!firstPostTime) firstPostTime = postTime;

            const bb = article.querySelector('.message-body .bbWrapper');
            if (!bb) return;
            const body = mdClean(nodeToMarkdown(bb)).trim();
            if (!body) return;

            const author = article.getAttribute('data-author')
                || article.querySelector('.message-name a, a.username')?.textContent.trim() || 'Ẩn danh';
            let postNum = '';
            for (const a of article.querySelectorAll('ul.message-attribution-opposite--list li a')) {
                const t = a.textContent.trim();
                if (/^#\d+$/.test(t)) { postNum = t.slice(1); break; }
            }
            posts.push(
                `### Bài viết #${postNum || (estBase + idx + 1)}\n` +
                `- **Người gửi:** ${author}\n` +
                `- **Thời gian:** ${postTime}\n\n` +
                body
            );
        });
        return { md: posts.join('\n\n---\n\n'), firstPostTime };
    };

    const createThreadNotebook = async () => {
        const pass = await getApiPass();
        if (!pass) { PasswordModule.openPasswordPopup(() => createThreadNotebook()); return; }
        btnThread.disabled = true;
        btnThread.innerHTML = '<span class="loader"></span>';

        // Giai đoạn scrape sống trong tab này — rời trang là mất; cảnh báo trước khi rời.
        // Sau khi bàn giao cho background thì gỡ cảnh báo (background tự lo trọn gói).
        const unloadGuard = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', unloadGuard);

        try {
            setStatus('Đang kiểm tra thread...');
            const cleanUrl = window.location.origin + window.location.pathname;
            const { urls, totalPages } = await getThreadPageUrls(cleanUrl);

            if (totalPages > 300) {
                contentEl.innerHTML = `<span style="color:#e65100">⚠️ Thread có <b>${totalPages} trang</b> — quá dài để tải tự động.</span>`;
                resetButtons();
                return;
            }

            // Extension tự tải & bóc nội dung từng trang rồi gộp cả thread thành 1 nguồn
            // văn bản (để NotebookLM tự fetch voz hay bị chặn → "URL không hợp lệ").
            // Thread siêu dài mới phải tách Part để né trần ~500k từ/nguồn của NotebookLM.
            const threadTitle = (document.querySelector('h1.p-title-value')?.textContent
                || document.title.replace(/\s*\|\s*Page\s+\d+(\s*\|.*)?$/i, '').replace(/\s*\|\s*[^|]+$/, '')).trim();
            const MAX_PART_CHARS = 2500000;
            const parts = [];
            let cur = '';
            let threadStartDate = '';
            for (let i = 0; i < urls.length; i++) {
                setStatus(`Đang tải trang ${i + 1}/${totalPages}...`);
                const resp = await fetch(urls[i]);
                if (!resp.ok) throw new Error(`Tải trang ${i + 1} thất bại (${resp.status})`);
                const { md, firstPostTime } = extractThreadPageText(await resp.text(), i * 20);
                if (i === 0 && firstPostTime) threadStartDate = firstPostTime;
                if (md) {
                    const chunk = `## Trang ${i + 1}/${totalPages} — ${urls[i]}\n\n${md}`;
                    if (cur && cur.length + chunk.length > MAX_PART_CHARS) { parts.push(cur); cur = ''; }
                    cur += (cur ? '\n\n' : '') + chunk;
                }
                await new Promise(r => setTimeout(r, 300));
            }
            if (cur) parts.push(cur);
            if (!parts.length) throw new Error('Không bóc được nội dung thread');

            const pad = (n) => String(n).padStart(2, '0');
            const sources = parts.map((text, idx) => ({
                title: parts.length === 1 ? threadTitle : `${threadTitle} (Part ${pad(idx + 1)}/${pad(parts.length)})`,
                text: `# ${threadTitle}\n` +
                    `- **Đường dẫn:** ${urls[0]}\n` +
                    `- **Ngày bắt đầu:** ${threadStartDate || 'Không rõ'}\n` +
                    (parts.length > 1 ? `- **Phần:** ${idx + 1}/${parts.length}\n` : '') +
                    `\n${text}`
            }));

            setStatus(`Đã tải ${totalPages} trang. Đang tạo notebook...`);
            // Từ đây background lo trọn gói (tạo notebook, lưu cache + Sheet) → rời trang không sao
            const shortUrl = getNormalizedUrl();
            const meta = await buildSaveMeta(shortUrl, threadTitle, pass);
            window.removeEventListener('beforeunload', unloadGuard);
            const response = await sendBg({ action: 'thread_add_sources', sources, meta });
            if (!response?.success)
                throw new Error(response?.error || 'Lỗi tạo notebook');

            renderLinks({ notebooklm: response.notebookLink });
            const ok = document.createElement('div');
            ok.innerHTML = `<span style="color:#2e7d32">✅ Đã thêm ${totalPages} trang (${response.added} nguồn) vào NotebookLM.</span>`;
            contentEl.prepend(ok);
            footer.style.display = 'none';
        } catch (e) {
            setError(e.message);
            resetButtons();
        } finally {
            window.removeEventListener('beforeunload', unloadGuard);
        }
    };

    const enterContentPage = () => {
        lpBox.style.display = '';
        const isThread = isForumThread();
        btnFetch.style.display  = isThread ? 'none' : '';
        btnThread.style.display = isThread ? '' : 'none';
        setStatus(isThread
            ? 'Thread diễn đàn — nhấn để scrape toàn bộ & upload NotebookLM.'
            : "Nhấn 'Tóm tắt' để tải.");
        footer.style.display = '';
        resetButtons();
        checkLocalAndRender();
    };

    const leaveContentPage = () => {
        lpBox.style.display = 'none';
    };

    btnFetch.onclick  = () => createNotebook();
    btnThread.onclick = () => createThreadNotebook();

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'thread_progress' && btnThread.disabled)
            contentEl.innerHTML = `<i style="color:#888">Đang thêm nguồn ${msg.current}/${msg.total} vào NotebookLM...</i>`;
    });

    // SPA navigation — patch pushState/replaceState + popstate + yt-navigate-finish
    let lastUrl = isContentPage() ? getNormalizedUrl() : null;
    const onUrlChange = () => {
        const content = isContentPage();
        const currentUrl = content ? getNormalizedUrl() : null;
        if (currentUrl && currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            enterContentPage();
        } else if (!currentUrl && lastUrl) {
            lastUrl = null;
            leaveContentPage();
        }
    };

    const _push    = history.pushState.bind(history);
    const _replace = history.replaceState.bind(history);
    history.pushState    = (...args) => { _push(...args);    onUrlChange(); };
    history.replaceState = (...args) => { _replace(...args); onUrlChange(); };
    window.addEventListener('popstate', onUrlChange);
    // YouTube dùng custom event này sau mỗi SPA navigation
    window.addEventListener('yt-navigate-finish', onUrlChange);

    if (isContentPage()) enterContentPage(); else leaveContentPage();
}
