export const StorageModule = (function () {

    function isExtensionEnv() {
        return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
    }

    function get(keys, callback) {
        const keyArray = Array.isArray(keys) ? keys : [keys];
        if (isExtensionEnv()) {
            chrome.storage.local.get(keyArray, callback);
        } else {
            const result = {};
            keyArray.forEach(k => {
                const raw = localStorage.getItem(k);
                if (raw === null) {
                    result[k] = null;
                } else {
                    try { result[k] = JSON.parse(raw); }
                    catch (e) { result[k] = raw; }
                }
            });
            if (typeof callback === 'function') callback(result);
        }
    }

    function set(obj, callback) {
        if (isExtensionEnv()) {
            chrome.storage.local.set(obj, callback);
        } else {
            Object.entries(obj).forEach(([k, v]) => {
                localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
            });
            if (typeof callback === 'function') callback();
        }
    }

    return { get, set, isExtensionEnv };

})();