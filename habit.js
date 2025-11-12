// Chạy code khi toàn bộ nội dung HTML đã được tải xong
document.addEventListener('DOMContentLoaded', function() {

    // === CẬP NHẬT NGÀY THÁNG === 
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('vi-VN', {
        weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric'
    });

    // === KHỐI LOGIC MỚI CHO STEPPER (NHẤN GIỮ) ===
    let stepperInterval = null; 
    let intervalSpeed = 100;    

    // 1. Hàm cập nhật số đếm (tái sử dụng)
    function updateStep(button) {
        const stepAmount = parseInt(button.dataset.step); 
        const parentStepper = button.closest('.stepper');
        const inputId = parentStepper.dataset.targetInput;
        const displayId = parentStepper.dataset.targetDisplay;
        const input = document.getElementById(inputId);
        const display = document.getElementById(displayId);

        let currentValue = parseInt(input.value);
        let newValue = currentValue + stepAmount;

        if (newValue < 0) {
            newValue = 0; 
        }

        input.value = newValue;
        display.innerText = newValue;
        
        // ==============================================
        // === THÊM VÀO ĐÂY ĐỂ RUNG (CHỈ DÙNG CHO ANDROID) ===
        if (navigator.vibrate) {
            navigator.vibrate(50); // Rung nhẹ 50 mili-giây
        }
        // ==============================================
    }

    // 2. Hàm để BẮT ĐẦU lặp
    function startStepping(event) {
        event.preventDefault(); 
        updateStep(this); 
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
        button.addEventListener('mousedown', startStepping);
        button.addEventListener('touchstart', startStepping);
        button.addEventListener('mouseup', stopStepping);
        button.addEventListener('mouseleave', stopStepping);
        button.addEventListener('touchend', stopStepping);
        button.addEventListener('touchcancel', stopStepping);
    });

    // === XỬ LÝ GỬI FORM === 
    // (Phần code này không thay đổi, giữ nguyên như cũ)
    const habitForm = document.getElementById('habit-form');
    const saveButton = document.getElementById('save-button');
    
    habitForm.addEventListener('submit', function(event) {
        event.preventDefault(); 
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
                window.close();
            }, 1500);
        }, 1000);
        // ---------------------------
    });
});