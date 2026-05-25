(async function() {
    const BLOCKER_CONTAINER_ID = 'my-ext-blocker-container';

    // --- 1. PARSE BLOCKLIST ---
    // Mỗi dòng một domain. Dòng bắt đầu bằng # hoặc trống bị bỏ qua.
    function parseBlocklistText(text) {
        return (text || '').split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    }

    // --- 2. LOAD BLOCKLIST TỪ STORAGE ---
    async function loadBlocklist() {
        return new Promise(resolve => {
            const KEY = 'websiteBlocklist';
            const DEFAULT = `# Chặn vĩnh viễn\ntiktok.com\nvoz.vn\nvnexpress.net`;

            chrome.storage.local.get(KEY, (data) => {
                const raw = data[KEY];
                if (raw === undefined) {
                    chrome.storage.local.set({ [KEY]: DEFAULT });
                    resolve(parseBlocklistText(DEFAULT));
                } else {
                    resolve(parseBlocklistText(raw));
                }
            });
        });
    }

    // --- 3. CHẶN ---
    function triggerBlock() {
        if (document.getElementById(BLOCKER_CONTAINER_ID)) return;
        window.stop();

        const html = `
        <html lang="vi"><head>
            <title>Truy cập bị chặn</title><meta charset="UTF-8">
            <style>
                html,body{background:#121212;color:#E0E0E0;font-family:-apple-system,sans-serif;
                    display:flex;justify-content:center;align-items:center;height:100vh;margin:0;}
                .container{border:1px dashed #FF5555;padding:40px;border-radius:12px;background:#1E1E1E;text-align:center;max-width:420px;}
                h1{color:#FF8A80;margin-top:0;}
                p{line-height:1.6;color:#ccc;}
                .hint{margin-top:16px;font-size:0.9em;color:#888;}
            </style>
        </head><body>
            <div class="container" id="${BLOCKER_CONTAINER_ID}">
                <h1>🚫 Truy cập bị chặn</h1>
                <p>Trang web này nằm trong danh sách chặn của extension.</p>
                <p class="hint">Hãy mở <strong>Safari</strong> nếu bạn cần vào trang này.</p>
            </div>
        </body></html>`;

        document.documentElement.innerHTML = html;

        // Ngăn trang khôi phục lại nội dung
        const observer = new MutationObserver(() => {
            if (!document.getElementById(BLOCKER_CONTAINER_ID)) {
                window.stop();
                document.documentElement.innerHTML = html;
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    // --- 4. KHỞI CHẠY ---
    async function initCheck() {
        const domains = await loadBlocklist();
        if (!domains.length) return;

        const currentHostname = window.location.hostname;
        const isBlocked = domains.some(domain =>
            currentHostname === domain || currentHostname.endsWith('.' + domain)
        );

        if (isBlocked) triggerBlock();
    }

    initCheck();

    window.addEventListener('pageshow', (event) => {
        if (event.persisted) initCheck();
    });

})();