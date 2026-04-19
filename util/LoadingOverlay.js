// loadingOverlay.js

const LoadingOverlayUtil = (function() {
    
    // Biến nội bộ để lưu trữ các hàm/giá trị được tiêm vào
    let config = {
        getStorage: null,
        cacheKey: null
    };

    /**
     * Tự động thêm HTML của overlay vào <body>
     * Sẽ không thêm nếu đã tồn tại.
     */
    function injectHTML() {
        if (document.getElementById('loadingOverlay')) return; 

        const overlayHTML = `
        <div id="loadingOverlay">
            <div class="loading-content">
                <div class="loader"></div>
                <p id="loadingQuote"></p>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', overlayHTML);
    }

    /**
     * Hiển thị overlay
     */
    function show() {
        const overlay = document.getElementById('loadingOverlay');
        if (!overlay) {
            console.warn('LoadingOverlayUtil.init() chưa được gọi.');
            return;
        }

        const quoteEl = document.getElementById('loadingQuote');
        if (quoteEl) {
            quoteEl.textContent = '...'; // Fallback

            // Kiểm tra xem hàm getStorage đã được tiêm vào chưa
            if (config.getStorage && config.cacheKey) {
                try {
                    config.getStorage([config.cacheKey], (data) => {
                        const rawQuotes = data[config.cacheKey];
                        if (!rawQuotes) return;

                        let quotes = [];
                        try {
                            quotes = typeof rawQuotes === 'string' ? JSON.parse(rawQuotes) : rawQuotes;
                        } catch (e) {
                            console.warn("Lỗi parse quote cache", e);
                            return; 
                        }

                        if (Array.isArray(quotes) && quotes.length > 0) {
                            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
                            quoteEl.textContent = randomQuote;
                        }
                    });
                } catch (e) {
                    console.warn("Không thể tải quotes từ cache:", e);
                }
            } else {
                // Nếu chưa init, chỉ hiển thị text chung
                quoteEl.textContent = 'Đang tải...';
            }
        }
        overlay.classList.add('visible');
    }

    /**
     * Ẩn overlay
     */
    function hide() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('visible');
        }
    }

    /**
     * Hàm khởi tạo (Dependency Injection)
     * Đây là hàm BẮT BUỘC phải gọi từ file JS chính (như vietgido.js, hoanglap3011.js)
     * @param {object} appConfig - Gồm { getStorageFunc, cacheQuotesKey }
     */
    function init(appConfig) {
        if (!appConfig || typeof appConfig.getStorageFunc !== 'function' || !appConfig.cacheQuotesKey) {
            console.error('LoadingOverlayUtil.init() thiếu getStorageFunc hoặc cacheQuotesKey.');
            return;
        }
        
        config.getStorage = appConfig.getStorageFunc;
        config.cacheKey = appConfig.cacheQuotesKey;
        
        // Tự động thêm HTML vào trang khi init
        // Đảm bảo DOM đã sẵn sàng
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', injectHTML);
        } else {
            injectHTML();
        }
    }

    // Trả về các hàm public
    return {
        init: init,
        show: show,
        hide: hide
    };

})();