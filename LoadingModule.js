import { StorageModule } from './StorageModule.js';
export const LoadingModule = (function () {

    function injectCSS() {
        if (document.getElementById('loadingOverlayStyle')) return;
        const style = document.createElement('style');
        style.id = 'loadingOverlayStyle';
        style.textContent = `
            #loadingOverlay {
                position: fixed; inset: 0;
                background-color: rgba(0, 0, 0, 0.7);
                z-index: 9999;
                opacity: 0;
                transition: opacity 0.3s ease-in-out;
                display: none;
                justify-content: center;
                align-items: center;
            }
            #loadingOverlay.visible {
                display: flex;
                opacity: 1;
            }
            .loading-content {
                text-align: center;
                color: #fff;
            }
            .loader {
                border: 5px solid #f3f3f3;
                border-top: 5px solid #3b82f6;
                border-radius: 50%;
                width: 50px; height: 50px;
                animation: loadingSpin 1s linear infinite;
                margin: 0 auto 20px auto;
            }
            #loadingQuote {
                font-size: 1.1em;
                font-style: italic;
                max-width: 400px;
                line-height: 1.5;
            }
            @keyframes loadingSpin {
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    function injectHTML() {
        if (document.getElementById('loadingOverlay')) return;
        const html = `
        <div id="loadingOverlay">
            <div class="loading-content">
                <div class="loader"></div>
                <p id="loadingQuote"></p>
            </div>
        </div>`;
        if (document.body) {
            document.body.insertAdjacentHTML('beforeend', html);
        } else {
            document.addEventListener('DOMContentLoaded', () =>
                document.body.insertAdjacentHTML('beforeend', html));
        }
    }

    function loadQuoteIntoEl(quoteEl) {
        quoteEl.textContent = 'Đang tải...';
        StorageModule.get([CACHE_QUOTES], (data) => {
            const rawQuotes = data[CACHE_QUOTES];
            if (!rawQuotes) return;
            try {
                const quotes = typeof rawQuotes === 'string'
                    ? JSON.parse(rawQuotes) : rawQuotes;
                if (Array.isArray(quotes) && quotes.length > 0) {
                    quoteEl.textContent = quotes[Math.floor(Math.random() * quotes.length)];
                }
            } catch (e) {}
        });
    }

    function show() {
        injectHTML();
        const overlay = document.getElementById('loadingOverlay');
        if (!overlay) return;
        const quoteEl = document.getElementById('loadingQuote');
        if (quoteEl) loadQuoteIntoEl(quoteEl);
        overlay.classList.add('visible');
    }

    function hide() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.remove('visible');
    }

    if (typeof document !== 'undefined') {
        injectCSS();
        injectHTML();
    }

    return { show, hide };

})();