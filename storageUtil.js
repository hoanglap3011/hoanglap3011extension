/**
 * =================================================================
 * --- STORAGE UTILITY (storageUtil.js) ---
 * =================================================================
 * Module tiện ích dùng chung để quản lý việc lưu và lấy dữ liệu
 * từ Chrome Storage (nếu là extension) hoặc LocalStorage (nếu là web).
 *
 * Tự động xử lý việc parse và stringify JSON cho LocalStorage.
 *
 * Cung cấp 2 phương thức chính:
 * - StorageUtil.get(keys, callback)
 * - StorageUtil.set(object, callback)
 */
const StorageUtil = (function () {

    /**
     * Kiểm tra xem môi trường hiện tại có phải là Chrome Extension hay không.
     * @returns {boolean} True nếu là extension, false nếu không.
     */
    function isExtensionEnv() {
        return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
    }

    /**
     * Lấy dữ liệu từ storage.
     * @param {string|string[]} keys - Một key (chuỗi) hoặc một mảng các keys.
     * @param {function} callback - Hàm callback sẽ được gọi với kết quả (VD: callback(result)).
     * Kết quả là một object { key1: value1, key2: value2, ... }
     */
    function get(keys, callback) {
        // Đảm bảo keys luôn là một mảng cho nhất quán
        const keyArray = Array.isArray(keys) ? keys : [keys];

        if (isExtensionEnv()) {
            chrome.storage.local.get(keyArray, callback);
        } else {
            // Logic lấy từ file vietgido.js của bạn (rất tốt)
            const result = {};
            keyArray.forEach(k => {
                const raw = localStorage.getItem(k);
                if (raw === null) {
                    result[k] = null; // Hoặc undefined, null giống logic cũ của bạn
                } else {
                    try {
                        // Cố gắng parse JSON, nếu không phải JSON, trả về chuỗi
                        result[k] = JSON.parse(raw);
                    } catch (e) {
                        result[k] = raw;
                    }
                }
            });
            
            if (typeof callback === 'function') {
                callback(result);
            }
        }
    }

    /**
     * Lưu dữ liệu vào storage.
     * @param {object} obj - Một object chứa các cặp key-value cần lưu. VD: { ten: 'Hoang Lap', tuoi: 30 }
     * @param {function} [callback] - Hàm callback tùy chọn sẽ được gọi khi lưu xong.
     */
    function set(obj, callback) {
        if (isExtensionEnv()) {
            chrome.storage.local.set(obj, callback);
        } else {
            // Logic lưu từ file vietgido.js của bạn (rất tốt)
            Object.entries(obj).forEach(([k, v]) => {
                // Nếu giá trị là chuỗi thì lưu thẳng
                if (typeof v === 'string') {
                    localStorage.setItem(k, v);
                } else {
                    // Nếu là object, array, boolean... stringify trước khi lưu
                    localStorage.setItem(k, JSON.stringify(v));
                }
            });
            
            if (typeof callback === 'function') {
                callback();
            }
        }
    }

    // "Xuất" các hàm này ra ngoài để sử dụng
    return {
        get: get,
        set: set,
        isExtensionEnv: isExtensionEnv
    };

})();