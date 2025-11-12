// Chạy code khi toàn bộ nội dung HTML đã được tải xong
document.addEventListener('DOMContentLoaded', function() {

    // === CẬP NHẬT NGÀY THÁNG === (Không thay đổi)
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('vi-VN', {
        weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric'
    });

    // ======================================================
    // === KHỐI LOGIC MỚI CHO STEPPER (NHẤN GIỮ) ===
    // ======================================================

    let stepperInterval = null; // Biến để lưu trữ interval
    let intervalSpeed = 100;    // Tốc độ lặp lại (ms) - 10 lần/giây

    // 1. Hàm cập nhật số đếm (tái sử dụng)
    function updateStep(button) {
        const stepAmount = parseInt(button.dataset.step); // -1 hoặc 1
        const parentStepper = button.closest('.stepper');
        const inputId = parentStepper.dataset.targetInput;
        const displayId = parentStepper.dataset.targetDisplay;
        const input = document.getElementById(inputId);
        const display = document.getElementById(displayId);

        let currentValue = parseInt(input.value);
        let newValue = currentValue + stepAmount;

        if (newValue < 0) {
            newValue = 0; // Không cho số âm
        }

        // Cập nhật giá trị
        input.value = newValue;
        display.innerText = newValue;
    }

    // 2. Hàm để BẮT ĐẦU lặp
    function startStepping(event) {
        // 'this' chính là nút đang được nhấn
        event.preventDefault(); // Ngăn hành vi mặc định (như bôi đen văn bản)
        
        updateStep(this); // Chạy 1 lần ngay lập tức

        // Bắt đầu lặp
        stepperInterval = setInterval(() => {
            updateStep(this);
        }, intervalSpeed);
    }

    // 3. Hàm để DỪNG lặp
    function stopStepping() {
        if (stepperInterval) {
            clearInterval(stepperInterval);
            stepperInterval = null;
        }
    }

    // 4. Gắn sự kiện cho các nút
    const stepperButtons = document.querySelectorAll('.stepper-btn');

    stepperButtons.forEach(button => {
        // Bắt đầu khi nhấn chuột xuống (mousedown) hoặc chạm (touchstart)
        button.addEventListener('mousedown', startStepping);
        button.addEventListener('touchstart', startStepping);

        // Dừng khi nhả chuột (mouseup) hoặc rời chuột (mouseleave)
        button.addEventListener('mouseup', stopStepping);
        button.addEventListener('mouseleave', stopStepping);
        
        // Dừng khi nhả ngón tay (touchend)
        button.addEventListener('touchend', stopStepping);
        button.addEventListener('touchcancel', stopStepping);
    });

    // ======================================================
    // === XỬ LÝ GỬI FORM === (Không thay đổi)
    // ======================================================
    const habitForm = document.getElementById('habit-form');
    const saveButton = document.getElementById('save-button');

    habitForm.addEventListener('submit', function(event) {
        event.preventDefault(); // Ngăn form gửi theo cách truyền thống
        
        saveButton.innerText = 'Đang lưu...';
        saveButton.disabled = true;

        const formData = new FormData(habitForm);
        const data = Object.fromEntries(formData.entries());

        if (!data.read_book) {
            data.read_book = "false";
        }

        console.log('Dữ liệu gửi đi:', data);

        // ----- GIẢ LẬP GỌI API -----
        setTimeout(() => {
            console.log('Giả lập lưu thành công');
            saveButton.innerText = 'Đã lưu!';
            
            setTimeout(() => {
                window.close(); // Đóng popup
            }, 1500);

        }, 1000);
        // ---------------------------
    });
});