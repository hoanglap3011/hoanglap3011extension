document.addEventListener('DOMContentLoaded', function () {
    LoadingOverlayUtil.init({
        getStorageFunc: StorageUtil.get,
        cacheQuotesKey: CACHE_QUOTES 
    });

    // Lấy dữ liệu từ Cache khi mở Extension
    StorageUtil.get([CACHE_HABIT_LIST], (obj) => {
        let saved = obj[CACHE_HABIT_LIST];
        if (saved) {
            // Xử lý trường hợp cache lưu là chuỗi hoặc đối tượng
            habitCache = parseDataArray(saved);
            if (habitCache.length > 0) {
                renderHabits(habitCache);
            } else {
                refreshCache();
            }
        } else {
            refreshCache();
        }
    });

    // Gán sự kiện cho các nút chức năng
    addClick('btn-refresh', refreshCache);
    addClick('btn-close', closeModal);
    addClick('btn-submit', submitHabitData);
    
    // Tìm kiếm real-time
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.oninput = (e) => {
            const key = e.target.value.toLowerCase();
            const filtered = habitCache.filter(h => 
                h.dieu_tot_dep && h.dieu_tot_dep.toLowerCase().includes(key)
            );
            renderHabits(filtered);
        };
    }
});

/**
 * Hàm hỗ trợ parse dữ liệu an toàn
 * Chuyển đổi từ String JSON sang Array
 */
function parseDataArray(input) {
    if (!input) return [];
    try {
        // Nếu là string, parse nó ra
        let data = typeof input === 'string' ? JSON.parse(input) : input;
        
        // Nếu sau khi parse vẫn là string (trường hợp bị stringify 2 lần từ server)
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }
        
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.error("Lỗi khi parse danh sách thói quen:", e);
        return [];
    }
}

/**
 * Tải lại danh mục từ Server
 */
function refreshCache() {
    StorageUtil.get([CACHE_PASS], (result) => {
        const pass = result[CACHE_PASS] || "";
        if (!pass) {
            openPasswordPopup();
            return;
        }

        LoadingOverlayUtil.show();

        fetch(API, {
            method: 'POST',
            body: JSON.stringify({
                pass: pass,
                action: API_ACTION_GET_METADATA_INTENT_TIME
            })
        })
        .then(response => response.json())
        .then(result => {
            // Kiểm tra mã phản hồi code: 1 theo chuẩn hoanglap3011.js
            if (result.code === 1) {
                // SỬA LỖI TẠI ĐÂY: Parse result.data nếu nó là string
                habitCache = parseDataArray(result.data);
                
                StorageUtil.set({ [CACHE_HABIT_LIST]: habitCache }, () => {
                    renderHabits(habitCache);
                    NotificationUtil.show("Lấy dữ liệu thành công!", "success"); 
                });
            } else {
                NotificationUtil.show("Lỗi: " + result.error, "error");
            }
        })
        .catch(err => NotificationUtil.show("Lỗi: " + err, "error"))
        .finally(() => LoadingOverlayUtil.hide());
    });
}

/**
 * Hiển thị các thẻ thói quen lên giao diện
 */
function renderHabits(list) {
    const container = document.getElementById('habit-list');
    if (!container) return;
    
    container.innerHTML = '';

    // Đảm bảo list là mảng trước khi dùng forEach
    const targetList = Array.isArray(list) ? list : [];

    targetList.forEach(h => {
        if (!h || !h.dieu_tot_dep) return;
        
        const div = document.createElement('div');
        div.className = 'habit-card';
        div.innerText = h.dieu_tot_dep;
        div.onclick = () => openModal(h);
        container.appendChild(div);
    });
}


function openModal(habit) {
    selectedHabit = habit;
    
    // Kiểm tra an toàn trước khi set innerText
    const titleEl = document.getElementById('modal-title');
    const unitEl = document.getElementById('modal-unit-label');
    const modal = document.getElementById('input-modal');

    if (titleEl && unitEl && modal) {
        titleEl.innerText = habit.dieu_tot_dep;
        unitEl.innerText = habit.don_vi;
        modal.classList.remove('hidden');
        
        // Tự động focus vào ô nhập số
        const inputVal = document.getElementById('habit-value');
        if (inputVal) inputVal.focus();
    } else {
        console.error("Không tìm thấy các thành phần của Modal trong HTML");
    }
}

function closeModal() {
    const modal = document.getElementById('input-modal');
    if (modal) modal.classList.add('hidden');
    
    // Xóa trắng dữ liệu cũ trong popup
    document.getElementById('habit-value').value = '';
    document.getElementById('habit-note').value = '';
}

// Khi nhấn nút Lưu
function submitHabitData() {
    const val = document.getElementById('habit-value').value;
    const note = document.getElementById('habit-note').value;
    
    if (!val) {
        NotificationUtil.show("Vui lòng nhập giá trị!", "error");
        return;
    }

    // Lấy pass từ storage của Chrome
    StorageUtil.get([CACHE_PASS], (result) => {
        const pass = result[CACHE_PASS] || "";
        if (!pass) {
            openPasswordPopup(); //
            return;
        }

        LoadingOverlayUtil.show(); //

        const payload = {
            pass: pass,
            action: API_ACTION_ADD_INTENT_TIME_DATA,
            content: {
                dieu_tot_dep: selectedHabit.dieu_tot_dep,
                don_vi: selectedHabit.don_vi,
                gia_tri: val,
                ghi_chu: note
            }
        };

        fetch(API, {
            method: 'POST',
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(result => {
            if (result.code === 1) {
                closeModal();
                // showSuccessResult();
                NotificationUtil.show("Đã lưu thành công!", "success");
            } else {
                NotificationUtil.show("Lỗi: " + result.error, "error");
            }
        })
        .catch(err => NotificationUtil.show("Lỗi: " + err, "error"))
        .finally(() => LoadingOverlayUtil.hide());
    });
}


function addClick(id, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
}

function openPasswordPopup() {
    const popupWidth = 400;
    const popupHeight = 250;
    const left = (window.screen.width / 2) - (popupWidth / 2);
    const top = (window.screen.height / 2) - (popupHeight / 2);
    window.open('password.html', 'passwordPopup', `width=${popupWidth},height=${popupHeight},top=${top},left=${left},resizable=yes`);
}
