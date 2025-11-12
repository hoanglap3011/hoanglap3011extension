document.addEventListener("DOMContentLoaded", function () {
    const txtPass = document.getElementById("txtPass");
    const btnSavePass = document.getElementById("btnSavePass");
    const saveMessage = document.getElementById("saveMessage");

    // 1. Tải key hiện có từ cache và điền vào input
    function loadPassword() {
        if (typeof StorageUtil !== 'undefined' && CACHE_PASS) {
            StorageUtil.get([CACHE_PASS], (result) => {
                if (result[CACHE_PASS]) {
                    txtPass.value = result[CACHE_PASS];
                }
            });
        } else {
            console.error("StorageUtil hoặc CACHE_PASS chưa được định nghĩa.");
        }
    }

    // 2. Lưu key mới vào cache
    function savePassword() {
        const passValue = txtPass.value;
        if (!passValue) return; // Không lưu nếu rỗng

        btnSavePass.disabled = true;
        btnSavePass.textContent = "Đang lưu...";

        StorageUtil.set({ [CACHE_PASS]: passValue }, () => {
            // Hiển thị thông báo và tự động đóng popup
            saveMessage.style.display = 'block';
            btnSavePass.textContent = "Đã lưu!";
            
            setTimeout(() => {
                window.close();
            }, 1500); // Đóng sau 1.5 giây
        });
    }

    // 3. Gán sự kiện
    btnSavePass.addEventListener("click", savePassword);
    
    // Tự động focus vào input khi gõ
    txtPass.addEventListener("keyup", function(event) {
        if (event.key === "Enter") {
            savePassword();
        }
    });

    // Tải password khi mở popup
    loadPassword();
    txtPass.focus();
});