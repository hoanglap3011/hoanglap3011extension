(function() {
    chrome.storage.local.get([SETTINGS_KEY, SUMMARY_SITES_KEY], (data) => {
        const settings = { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };
        if (!settings.sbEnable) return;
        const sites = (data[SUMMARY_SITES_KEY] ?? DEFAULT_SUMMARY_SITES)
            .split('\n')
            .map(s => s.trim().toLowerCase())
            .filter(Boolean);
        const hostname = window.location.hostname.replace(/^www\./, '');
        const allowed = sites.some(s => hostname === s || hostname.endsWith('.' + s));
        if (allowed) initSummaryBox();
    });
})();

function initSummaryBox() {
    if (document.getElementById('lp-summary-box-container')) return;

    // URL chuẩn hoá dùng làm khoá cache; null = không phải trang nội dung
    const getNormalizedUrl = () => {
        const { hostname, pathname, search } = window.location;
        if (hostname.includes('youtube.com')) {
            const v = new URLSearchParams(search).get('v');
            return (pathname === '/watch' && v) ? `https://youtu.be/${v}` : null;
        }
        const segments = pathname.split('/').filter(Boolean);
        if (segments.length < 1) return null;
        const hasArticleJsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).some(s => {
            try {
                const d = JSON.parse(s.textContent);
                const types = [].concat(Array.isArray(d) ? d.map(x => x['@type']) : d['@type']).join(',').toLowerCase();
                return /article|newsarticle|blogposting|videoobject/.test(types);
            } catch { return false; }
        });
        if (hasArticleJsonLd) return window.location.origin + pathname;
        // Fallback: URL kết thúc bằng numeric ID (phổ biến ở báo Việt Nam)
        const lastSegment = segments[segments.length - 1];
        if (/\d{4,}\.html?$/.test(lastSegment)) return window.location.origin + pathname;
        return null;
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
        #lp-box.minimized .resizer { display: none; }
        .resizer {
            width: 12px; height: 12px; position: absolute;
            right: 0; bottom: 0; cursor: nwse-resize;
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
        <div class="footer" style="display:none"><button class="btn-summary" id="btn-fetch">Tóm tắt</button></div>
        <div class="resizer"></div>
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

    lpBox.querySelector('.resizer').onmousedown = (e) => {
        e.preventDefault();
        let startW = lpBox.offsetWidth, startH = lpBox.offsetHeight;
        let startX = e.clientX, startY = e.clientY;
        const onResize = (ev) => {
            lpBox.style.width  = (startW + ev.clientX - startX) + 'px';
            lpBox.style.height = (startH + ev.clientY - startY) + 'px';
        };
        document.onmousemove = onResize;
        document.onmouseup = () => { document.onmousemove = null; saveBoxState(); };
    };

    const contentEl = lpBox.querySelector('#content');
    const btnFetch  = lpBox.querySelector('#btn-fetch');
    const footer    = lpBox.querySelector('.footer');

    const resetBtn = () => { btnFetch.disabled = false; btnFetch.textContent = 'Tóm tắt'; };

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
        return 'url';
    };

    const saveToDb = (notebookId, shortUrl, pageTitle, pass) => {
        const notebookLink = `https://notebooklm.google.com/notebook/${notebookId}`;
        return postApi({
            action: 'addSummaryEntry', pass,
            code: shortUrl, title: pageTitle,
            notebooklm: notebookLink, category: getCategory(shortUrl)
        });
    };

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
        contentEl.innerHTML = '<i style="color:#888">Đang khởi tạo NotebookLM...</i>';

        chrome.runtime.sendMessage({ action: 'create_notebook', url: shortUrl }, async (response) => {
            if (chrome.runtime.lastError || !response?.success) {
                contentEl.innerHTML = `<span style="color:red">Lỗi: ${response?.error || 'Không kết nối được'}</span>`;
                resetBtn();
                return;
            }
            const newData = { notebooklm: `https://notebooklm.google.com/notebook/${response.notebookId}` };
            renderLinks(newData);
            footer.style.display = 'none';
            // Local save + server sync in background
            setLocalEntry(shortUrl, newData).then(() => {
                saveToDb(response.notebookId, shortUrl, pageTitle, pass);
            });
        });
    };

    const checkLocalAndRender = async () => {
        const url = getNormalizedUrl();
        if (!url) return;
        const cached = await getLocalEntry(url);
        if (cached && (cached.notebooklm || cached.summary)) {
            renderLinks(cached);
            footer.style.display = 'none';
        }
    };

    const enterContentPage = () => {
        lpBox.style.display = '';
        contentEl.innerHTML = '<i style="color:#888">Nhấn \'Tóm tắt\' để tải.</i>';
        footer.style.display = '';
        resetBtn();
        checkLocalAndRender();
    };

    const leaveContentPage = () => {
        lpBox.style.display = 'none';
    };

    btnFetch.onclick = () => createNotebook();

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes.notebookRecreated) return;
        const { sourceUrl, newNotebookId } = changes.notebookRecreated.newValue || {};
        if (!sourceUrl || sourceUrl !== getNormalizedUrl()) return;
        const notebookLink = `https://notebooklm.google.com/notebook/${newNotebookId}`;
        const newData = { notebooklm: notebookLink };
        setLocalEntry(sourceUrl, newData);
        renderLinks(newData);
        footer.style.display = 'none';
        // Cập nhật GAS
        getApiPass().then(pass => {
            if (pass) postApi({ action: 'updateSummaryNotebook', pass, code: sourceUrl, notebooklm: notebookLink });
        });
    });

    // SPA navigation — patch pushState/replaceState + popstate + yt-navigate-finish
    let lastUrl = getNormalizedUrl();
    const onUrlChange = () => {
        const currentUrl = getNormalizedUrl();
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

    if (lastUrl) enterContentPage(); else leaveContentPage();
}
