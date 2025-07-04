// Các tuỳ chọn Pomodoro: mỗi object gồm số phút làm việc, nghỉ ngắn, nghỉ dài
// work: thời gian làm việc (phút)
// shortBreak: thời gian nghỉ ngắn (phút)
// longBreak: thời gian nghỉ dài (phút)
const pomodoroOptions = [
    { work: 0.1, shortBreak: 0.1, longBreak: 0.1 },
    { work: 30, shortBreak: 5, longBreak: 15 },
    { work: 45, shortBreak: 10, longBreak: 20 }
];

// Mảng các câu khích lệ, sẽ hiển thị ngẫu nhiên hoặc chuyển qua lại bằng nút
const motivationTexts = [
    "Hãy tập trung, thành quả đang chờ bạn!",
    "Đừng để ý đến xao nhãng, hãy hoàn thành Pomodoro này!",
    "Bạn làm được mà, cố lên!",
    "Tập trung 1 Pomodoro thôi, rồi nghỉ ngơi!",
    "Mỗi phút tập trung là một bước tiến tới thành công!",
    "Hãy hoàn thành công việc, đừng trì hoãn!",
    "Bạn đang tiến bộ từng chút một!",
    "Tắt thông báo, tập trung vào nhiệm vụ!"
];

// Biến điều khiển trạng thái Pomodoro
let timer = null; // ID của interval đếm ngược
let isBreak = false; // Đang ở trạng thái nghỉ hay làm việc
let currentOption = 0; // Tuỳ chọn Pomodoro hiện tại (index trong pomodoroOptions)
let timeLeft = 0; // Thời gian còn lại (giây)
let breakType = ''; // Loại nghỉ: 'short' hoặc 'long'
let motivationIndex = 0; // Index của câu khích lệ đang hiển thị

// Lấy các phần tử DOM cần thao tác
const taskInput = document.getElementById('taskInput'); // Ô nhập nội dung công việc
const pomodoroSelect = document.getElementById('pomodoroSelect'); // Combobox chọn Pomodoro
const progressBar = document.getElementById('progressBar'); // Thanh progressbar
const progressTime = document.getElementById('progressTime'); // Text hiển thị thời gian còn lại
const startBtn = document.getElementById('startBtn'); // Nút bắt đầu
const motivationBox = document.getElementById('motivationBox'); // Vùng hiển thị text khích lệ
const breakSound = document.getElementById('breakSound'); // Âm thanh báo nghỉ

const prevMotivationBtn = document.getElementById('prevMotivation'); // Nút prev text khích lệ
const nextMotivationBtn = document.getElementById('nextMotivation'); // Nút next text khích lệ

// Định dạng thời gian (giây) thành chuỗi mm:ss
function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// Cập nhật chiều rộng và màu của progressbar
function setProgress(percent, color) {
    progressBar.style.width = percent + '%';
    progressBar.style.background = color;
}

// Cập nhật giao diện progressbar và thời gian còn lại
function updateProgressBar() {
    let total;
    let color;
    if (!isBreak) {
        // Đang làm việc: màu xanh dương
        total = pomodoroOptions[currentOption].work * 60;
        color = '#1976d2'; // xanh dương
    } else if (breakType === 'long') {
        // Nghỉ dài: màu vàng
        total = pomodoroOptions[currentOption].longBreak * 60;
        color = '#ffd600'; // vàng
    } else {
        // Nghỉ ngắn: màu xanh lá cây
        total = pomodoroOptions[currentOption].shortBreak * 60;
        color = '#43a047'; // xanh lá cây
    }
    let percent = (timeLeft / total) * 100;
    setProgress(percent, color);
    progressTime.textContent = formatTime(timeLeft);
}

// Reset lại trạng thái Pomodoro về ban đầu (khi đổi combobox hoặc bấm lại)
function resetPomodoro() {
    clearInterval(timer);
    isBreak = false;
    timeLeft = pomodoroOptions[currentOption].work * 60;
    setProgress(100, '#1976d2'); // xanh dương khi làm việc
    progressTime.textContent = formatTime(timeLeft);
    startBtn.disabled = false;
}

// Gửi thông báo đến tất cả các tab (nếu extension hỗ trợ) và notification trình duyệt
function notifyAllTabs(message) {
    // Gửi message qua chrome.runtime (nếu là extension)
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'pomodoro-break', message });
    }
    // Hiện notification trình duyệt
    if (window.Notification && Notification.permission === 'granted') {
        new Notification(message);
    } else if (window.Notification && Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') new Notification(message);
        });
    }
}

// Bắt đầu Pomodoro: đếm ngược thời gian làm việc, khi hết thì chuyển sang nghỉ
function startPomodoro() {
    startBtn.disabled = true;
    isBreak = false;
    timeLeft = pomodoroOptions[currentOption].work * 60;
    setProgress(100, '#1976d2'); // xanh dương khi làm việc
    progressTime.textContent = formatTime(timeLeft);
    timer = setInterval(() => {
        timeLeft--;
        updateProgressBar();
        if (timeLeft <= 0) {
            clearInterval(timer);
            // Phát âm thanh báo nghỉ
            breakSound.play();
            // Gửi thông báo đến các tab và notification
            notifyAllTabs('đã đến giờ nghỉ, hãy nghỉ ngơi nhé');
            // Bắt đầu nghỉ (ở đây mặc định là nghỉ ngắn)
            isBreak = true;
            breakType = 'short';
            timeLeft = pomodoroOptions[currentOption].shortBreak * 60;
            setProgress(100, '#43a047'); // xanh lá cây khi nghỉ ngắn
            progressTime.textContent = formatTime(timeLeft);
            timer = setInterval(() => {
                timeLeft--;
                updateProgressBar();
                if (timeLeft <= 0) {
                    clearInterval(timer);
                    startBtn.disabled = false;
                }
            }, 1000);
        }
    }, 1000);
}


// Khi đổi tuỳ chọn combobox, reset lại Pomodoro
pomodoroSelect.addEventListener('change', function() {
    currentOption = parseInt(this.value);
    resetPomodoro();
});


// Khi bấm nút bắt đầu, reset và bắt đầu Pomodoro
startBtn.addEventListener('click', function() {
    resetPomodoro();
    startPomodoro();
});


// Hiển thị ngẫu nhiên 1 câu khích lệ
function showRandomMotivation() {
    motivationIndex = Math.floor(Math.random() * motivationTexts.length);
    motivationBox.textContent = motivationTexts[motivationIndex];
}


// Hiển thị câu khích lệ theo index (có vòng lặp)
function showMotivationAt(idx) {
    if (idx < 0) idx = motivationTexts.length - 1;
    if (idx >= motivationTexts.length) idx = 0;
    motivationIndex = idx;
    motivationBox.textContent = motivationTexts[motivationIndex];
}

// Hiển thị ngẫu nhiên 1 câu khích lệ khi load trang
showRandomMotivation();
// Nếu muốn tự động đổi text mỗi 30s thì bỏ comment dòng dưới
// setInterval(showRandomMotivation, 30000);

// Gán sự kiện cho nút prev/next để chuyển text khích lệ
if (prevMotivationBtn && nextMotivationBtn) {
    prevMotivationBtn.addEventListener('click', function() {
        showMotivationAt(motivationIndex - 1);
    });
    nextMotivationBtn.addEventListener('click', function() {
        showMotivationAt(motivationIndex + 1);
    });
}

// Khởi tạo trạng thái ban đầu cho Pomodoro
resetPomodoro();

// Lắng nghe message từ background để nhận thông báo từ tab khác (nếu là extension)
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.type === 'pomodoro-break') {
            if (window.Notification && Notification.permission === 'granted') {
                new Notification(msg.message);
            }
        }
    });
}
