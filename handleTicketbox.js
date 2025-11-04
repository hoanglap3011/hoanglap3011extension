(async function () {
    const TYPE_CALENDAR = "ticketbox";

    // 1. Lấy URL của icon từ extension (giống file handleGoogleSearch.js)
    const ICON_URL = chrome.runtime.getURL("image/add.png");
    if (!ICON_URL) {
        console.warn("⚠️ [Ext] Không thể lấy URL của add.png");
        return;
    }

    // 2. Mượn các hàm helper từ file handleFootballMatch.js

    /**
     * Chuyển đối tượng Date sang chuỗi UTC rút gọn cho Google Calendar.
     * @param {Date} d - Đối tượng Date
     * @returns {string | null}
     */
    const toCompactUTC = (d) => {
        if (!d || isNaN(d)) return null;
        const pad = (n) => (n < 10 ? "0" + n : n);
        return (
            d.getUTCFullYear().toString() +
            pad(d.getUTCMonth() + 1) +
            pad(d.getUTCDate()) +
            "T" +
            pad(d.getUTCHours()) +
            pad(d.getUTCMinutes()) +
            pad(d.getUTCSeconds()) +
            "Z"
        );
    };

    /**
     * Mở tab Google Calendar để thêm sự kiện.
     */
    const openGoogleCalendarAdding = (text, dates, location, details) => {
        let url = 'https://calendar.google.com/calendar/u/0/r/eventedit?ofe=true&crm=AVAILABLE';
        if (text) url += "&text=" + encodeURIComponent(text);
        if (dates) url += "&dates=" + encodeURIComponent(dates);
        if (location) url += "&location=" + encodeURIComponent(location);
        if (details) url += "&details=" + encodeURIComponent(details);
        url += "&calendar=" + TYPE_CALENDAR;
        window.open(url, '_blank');
    };

    /**
     * Tạo phần tử <img> cho nút bấm.
     */
    const createAddButton = () => {
        const img = document.createElement("img");
        img.src = ICON_URL;
        img.alt = "Add to Calendar";
        img.title = "Thêm vào Google Calendar";
        Object.assign(img.style, {
            width: "32px",  // Kích thước to hơn một chút cho dễ bấm
            height: "32px",
            cursor: "pointer",
            objectFit: "contain",
        });
        return img;
    };

    // 3. Các hàm parser (phân tích) dành riêng cho Ticketbox






    /**
     * Chèn nút bấm vào vị trí mong muốn
     * @param {HTMLElement} block - Phần tử <div class="info">
     * @param {HTMLElement} btn - Nút <img> đã tạo
     */
    const insertButtonTicketbox = (block, btn) => {
        const addressEl = block.querySelector('#address');
        if (!addressEl) {
            console.warn("⚠️ [Ext] Không tìm thấy #address để chèn nút. Chèn tạm vào cuối.");
            block.appendChild(btn); // Fallback
            return;
        }
        
        // Tạo 1 div bọc ngoài để cho nút xuống dòng và có khoảng cách
        const wrapper = document.createElement('div');
        Object.assign(wrapper.style, { 
            marginTop: '16px', 
            textAlign: 'left' // Giữ căn lề trái như các text ở trên
        });
        wrapper.appendChild(btn);
        
        // Chèn vào *sau* phần tử địa chỉ
        addressEl.insertAdjacentElement('afterend', wrapper);
    };

    // 4. Hàm chạy chính
    
/**
     * Lấy toàn bộ thông tin sự kiện từ khối .info
     * @param {HTMLElement} block - Phần tử <div class="info">
     * @returns {object | null}
     */
    const parseTicketboxData = (block) => {
        const titleEl = block.querySelector('div:first-child');
        const venueEl = block.querySelector('.venue-text');
        const addressEl = block.querySelector('#address');

        let dateText = "";
        
        // 1. Thử tìm <span>#date-text cụ thể trước
        const dateSpan = block.querySelector('#date-text');
        if (dateSpan && dateSpan.textContent.trim()) {
            dateText = dateSpan.textContent.trim();
        } else {
            // 2. Nếu không có, lùi lại lấy toàn bộ text của <p id="date">
            const datePEl = block.querySelector('p#date');
            if (datePEl) {
                dateText = datePEl.textContent.trim();
            }
        }
        
        // +++ SỬA LỖI TẠI ĐÂY +++
        // Nếu bất kỳ trường nào bị thiếu (đặc biệt là dateText),
        // chỉ return null và không làm gì cả.
        // Lần quét sau (do MutationObserver) sẽ thử lại.
        if (!titleEl || !dateText || !venueEl || !addressEl) {
            // Log này chỉ để bạn biết nó đang chờ (có thể xóa đi)
            if (titleEl && venueEl && addressEl && !dateText) {
                 console.log("ℹ️ [Ext] Đang chờ nội dung ngày giờ (dateText)...");
            }
            return null; 
        }
        // +++ KẾT THÚC SỬA LỖI +++

        const title = titleEl.innerText.trim();
        const venue = venueEl.innerText.trim();
        const address = addressEl.innerText.trim();
        
        const location = `${venue}, ${address}`;
        const details = `Sự kiện tại: ${location}\nĐặt vé tại: ${window.location.href}`;

        const times = parseTicketboxDateTime(dateText);
        if (!times) {
            console.warn("⚠️ [Ext] Không thể parse chuỗi ngày giờ (sau khi đã tìm thấy):", `"${dateText}"`);
            return null;
        }

        const { startDate, endDate } = times;
        const start_time_utc = toCompactUTC(startDate);
        const end_time_utc = toCompactUTC(endDate);

        if (!start_time_utc || !end_time_utc) return null;

        return {
            title,
            dates: `${start_time_utc}/${end_time_utc}`,
            location,
            details
        };
    };

    /**
     * Phân tích chuỗi ngày giờ của Ticketbox (Hàm này giữ nguyên như lần trước)
     * @param {string} dateText
     * @returns {{startDate: Date, endDate: Date} | null}
     */
    const parseTicketboxDateTime = (dateText) => {
        try {
            const cleanText = dateText.replace(/\s+/g, ' ').trim();

            const match = cleanText.match(
                /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2}),\s*(\d{1,2})\s*tháng\s*(\d{1,2}),\s*(\d{4})/i
            );
            if (!match) {
                 console.warn(`⚠️ [Ext] Regex không khớp với chuỗi đã dọn dẹp: "${cleanText}"`);
                return null;
            }

            const [, startHour, startMin, endHour, endMin, day, month, year] = match.map(Number);
            
            const jsMonth = month - 1; 
            const startDate = new Date(year, jsMonth, day, startHour, startMin);
            const endDate = new Date(year, jsMonth, day, endHour, endMin);

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;
            
            if (endDate < startDate) {
                endDate.setDate(endDate.getDate() + 1);
            }

            return { startDate, endDate };
        } catch (e) {
            console.error("⚠️ [Ext] Lỗi parse ngày giờ Ticketbox:", e);
            return null;
        }
    };

    /**
     * Hàm chạy chính (Đã cập nhật logic)
     */
    const scanAndAttachTicketbox = () => {
        const infoBlock = document.querySelector('div.info');
        
        // 1. Block không tồn tại, HOẶC đã chèn THÀNH CÔNG -> Dừng
        if (!infoBlock || infoBlock.dataset.extAddInjected === "1") {
            return;
        }

        // 2. Thử parse dữ liệu
        const eventData = parseTicketboxData(infoBlock);
        
        // 3. Nếu parse thất bại (trả về null - vì đang chờ text) -> Dừng.
        // KHÔNG đánh dấu 'failed'. Chờ MutationObserver gọi lại.
        if (!eventData) {
            return;
        }

        // 4. Parse thành công! -> Tạo nút
        const btn = createAddButton();
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            openGoogleCalendarAdding(
                eventData.title,
                eventData.dates,
                eventData.location,
                eventData.details
            );
        };

        // 5. Chèn nút và đánh dấu THÀNH CÔNG
        insertButtonTicketbox(infoBlock, btn);
        infoBlock.dataset.extAddInjected = "1"; // Chỉ đánh dấu khi thành công
    };

    // 5. Chạy và theo dõi thay đổi (giống file football)
    new MutationObserver(() => scanAndAttachTicketbox()).observe(document, { 
        childList: true, 
        subtree: true 
    });
    
    // Chạy lần đầu sau 1 khoảng trễ ngắn để chờ trang tải
    setTimeout(scanAndAttachTicketbox, 600);
})();