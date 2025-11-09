document.addEventListener('DOMContentLoaded', () => {

    // --- 1. DANH SÁCH LỆNH CỐ ĐỊNH ---
    // Đây là nơi bạn định nghĩa tất cả các chức năng
    const ALL_COMMANDS = [
        {
            id: 'open_hoanglap3011',
            name: 'Mở file HoangLap3011.html',
            keywords: 'hoang lap 3011',
            action: () => chrome.tabs.create({ url: chrome.runtime.getURL('hoanglap3011.html') })
        },
        {
            id: 'open_vietgido',
            name: 'Mở file VietGido.html',
            keywords: 'viết gì đó note ghi chú', // Từ khoá để tìm kiếm
            action: () => chrome.tabs.create({ url: chrome.runtime.getURL('vietgido.html') })
        },
        {
            id: 'open_media_hub',
            name: 'Mở Media Hub',
            keywords: 'media nhạc music',
            action: () => chrome.tabs.create({ url: chrome.runtime.getURL('media_hub.html') })
        },
        {
            id: 'open_extensions',
            name: 'Mở trang Extensions',
            keywords: 'tiện ích chrome manage',
            action: () => chrome.tabs.create({ url: 'chrome://extensions/' })
        }
        // Thêm bao nhiêu lệnh tuỳ thích vào đây
    ];

    // --- 2. CACHE DOM VÀ TRẠNG THÁI ---
    const searchInput = document.getElementById('searchInput');
    const commandList = document.getElementById('commandList');
    let filteredCommands = [...ALL_COMMANDS];
    let selectedIndex = 0;

    // --- 3. HÀM RENDER DANH SÁCH ---
    function renderList(commands) {
        commandList.innerHTML = ''; // Xoá danh sách cũ
        commands.forEach((command, index) => {
            const li = document.createElement('li');
            li.dataset.id = command.id;
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = command.name;
            li.appendChild(nameSpan);

            const keywordSpan = document.createElement('small');
            keywordSpan.textContent = command.keywords.split(' ')[0]; // Lấy từ khoá đầu tiên làm gợi ý
            li.appendChild(keywordSpan);

            // Xử lý click chuột
            li.addEventListener('click', () => {
                executeCommand(command);
            });
            
            commandList.appendChild(li);
        });

        // Cập nhật lại mục được chọn
        selectedIndex = 0;
        updateSelection();
    }

    // --- 4. HÀM CẬP NHẬT MỤC ĐƯỢC CHỌN (TÔ SÁNG) ---
    function updateSelection() {
        // Xoá class 'selected' khỏi tất cả
        commandList.querySelectorAll('li').forEach(li => {
            li.classList.remove('selected');
        });

        // Thêm class 'selected' vào mục hiện tại
        const selectedLi = commandList.children[selectedIndex];
        if (selectedLi) {
            selectedLi.classList.add('selected');
            // Cuộn để mục được chọn luôn trong tầm nhìn
            selectedLi.scrollIntoView({ block: 'nearest' });
        }
    }

    // --- 5. HÀM THỰC THI LỆNH ---
    function executeCommand(command) {
        if (command) {
            command.action();
            // Tự động đóng cửa sổ popup sau khi chạy lệnh
            window.close();
        }
    }

    // --- 6. GÁN CÁC EVENT LISTENER ---

    // Tự động focus vào input khi mở
    searchInput.focus();

    // Lọc danh sách khi gõ
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        
        filteredCommands = ALL_COMMANDS.filter(command => 
            command.name.toLowerCase().includes(query) || 
            command.keywords.toLowerCase().includes(query)
        );
        
        renderList(filteredCommands);
    });

    // Xử lý phím (Mũi tên, Enter, Escape)
    searchInput.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault(); // Ngăn con trỏ di chuyển trong input
                selectedIndex = (selectedIndex + 1) % filteredCommands.length;
                updateSelection();
                break;
            
            case 'ArrowUp':
                e.preventDefault(); // Ngăn con trỏ di chuyển trong input
                selectedIndex = (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
                updateSelection();
                break;
            
            case 'Enter':
                e.preventDefault();
                executeCommand(filteredCommands[selectedIndex]);
                break;
            
            case 'Escape':
                window.close(); // Đóng popup nếu nhấn Escape
                break;
        }
    });

    // --- 7. KHỞI CHẠY LẦN ĐẦU ---
    renderList(ALL_COMMANDS);
});