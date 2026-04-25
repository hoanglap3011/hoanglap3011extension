import { LoadingModule } from './LoadingModule.js';
import { StorageModule } from './StorageModule.js';
import { PasswordModule } from './PasswordModule.js';
export const TodolistModule = {

    fetchLinkToDoListWeek(dayStr, callback) {
        StorageModule.get([CACHE_PASS], (result) => {
            const pass = result[CACHE_PASS] || "";
            if (!pass || pass.length === 0) {
                PasswordModule.openPasswordPopup();
                return;
            }
            LoadingModule.show();
            fetch(API, {
                method: 'POST',
                body: JSON.stringify({ pass, action: API_ACTION_GET_TODOLIST_WEEK, dayStr })
            })
                .then(response => {
                    if (!response.ok) throw new Error("Lỗi khi gọi API");
                    return response.json();
                })
                .then(result => {
                    if (result.code !== 1) {
                        alert('Lỗi: ' + (result.error || 'Có lỗi xảy ra'));
                        return;
                    }
                    if (typeof callback === 'function') callback(result.data);
                })
                .catch(err => alert('Lỗi khi gọi API: ' + err))
                .finally(() => LoadingModule.hide());
        });
    },

    openToDoListWeekFromDay(dayStr) {
        const keyToDoList = CACHE_TODOLIST + "." + dayStr;
        StorageModule.get([CACHE_TODOLIST], (obj) => {
            const raw = obj[CACHE_TODOLIST];
            if (raw) {
                try {
                    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    if (Array.isArray(arr)) {
                        const foundObj = arr.find(item => item && Object.prototype.hasOwnProperty.call(item, keyToDoList));
                        if (foundObj) {
                            const url = foundObj[keyToDoList];
                            if (url) { window.open(url, '_blank'); return; }
                        }
                    }
                } catch (e) {
                    alert('Lỗi khi parse todolist từ cache: ' + e);
                }
            }

            this.fetchLinkToDoListWeek(dayStr, (url) => {
                window.open(url, '_blank');
                StorageModule.get([CACHE_TODOLIST], (obj) => {
                    const raw = obj[CACHE_TODOLIST];
                    let arr = [];
                    if (raw) {
                        try {
                            arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
                            if (!Array.isArray(arr)) arr = [];
                        } catch (e) { arr = []; }
                    }
                    const idx = arr.findIndex(item => item && Object.prototype.hasOwnProperty.call(item, keyToDoList));
                    if (idx >= 0) arr[idx] = { [keyToDoList]: url };
                    else arr.push({ [keyToDoList]: url });
                    StorageModule.set({ [CACHE_TODOLIST]: arr }, () => {});
                });
            });
        });
    },

    openThisWeekTimelineFolder() {
        StorageModule.get([CACHE_PASS], (result) => {
            const pass = result[CACHE_PASS] || "";
            if (!pass || pass.length === 0) {
                PasswordModule.openPasswordPopup();
                return;
            }
            LoadingModule.show();
            fetch(API, {
                method: 'POST',
                body: JSON.stringify({ pass, action: API_ACTION_GET_THIS_WEEK_TIMELINE_FOLDER })
            })
                .then(response => {
                    if (!response.ok) throw new Error("Lỗi khi gọi API");
                    return response.json();
                })
                .then(result => {
                    if (result.code !== 1) {
                        alert('Lỗi: ' + (result.error || 'Có lỗi xảy ra'));
                        return;
                    }
                    window.open(result.data, '_blank');
                })
                .catch(err => alert('Lỗi khi gọi API: ' + err))
                .finally(() => LoadingModule.hide());
        });
    }
};