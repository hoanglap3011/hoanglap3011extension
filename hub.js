import { TodolistModule } from './TodolistModule.js';
import { DatePickerModule } from './DatePickerModule.js';
import { DateModule } from './DateModule.js';
import { TuVungModule } from './tuvung.js';

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
            id: 'open_recap',
            name: 'Mở trang recap',
            keywords: 'recap tóm tắt',
            action: () => chrome.tabs.create({ url: chrome.runtime.getURL('recap.html') })
        },
        {
            id: 'open_todolist',
            name: 'Mở trang To Do List',
            keywords: 'to do list todolist',
            keepOpen: true,
            action: () => {
                DatePickerModule.pickDate(searchInput, (selectedDate) => {
                    const dateStr = DateModule.formatDate(selectedDate);
                    TodolistModule.openToDoListWeekFromDay(dateStr);
                });
            }
        },
        {
            id: 'open_bieton',
            name: 'Mở trang Biết Ơn',
            keywords: 'biết ơn biet on',
            action: () => {
                const danhMuc = 'Biết Ơn';
                chrome.tabs.create({ url: chrome.runtime.getURL(`vietgido.html?danhMuc=${encodeURIComponent(danhMuc)}`) })
            }
        },
        {
            id: 'open_thanhtuu',
            name: 'Mở trang Thành Tựu',
            keywords: 'biết ơn biet on thành tựu thanh',
            action: () => {
                const danhMuc = 'Thành Tựu';
                chrome.tabs.create({ url: chrome.runtime.getURL(`vietgido.html?danhMuc=${encodeURIComponent(danhMuc)}`) })
            }
        },        
        {
            id: 'open_nhatkytrangthai',
            name: 'Mở trang Nhật Ký',
            keywords: 'giác ngộ nhật ký trạng thái cảm xúc giac ngo nhat ky trang thai cam xuc bai hoc',
            action: () => {
                const danhMuc = 'Giác Ngộ - Nhật Ký Trạng Thái';
                chrome.tabs.create({ url: chrome.runtime.getURL(`vietgido.html?danhMuc=${encodeURIComponent(danhMuc)}`) })
            }
        },
        {
            id: 'open_nguphaptienganh',
            name: 'Ngữ pháp tiếng Anh',
            keywords: 'giác ngộ nhật ký trạng thái cảm xúc',
            action: () => chrome.tabs.create({ url: chrome.runtime.getURL('recap.html') })
        },
        {
            id: 'open_mapproblem',
            name: 'Mindomo map problem',
            keywords: 'giác ngộ nhật ký trạng thái cảm xúc',
            action: () => {
                chrome.tabs.create({ url: 'https://hoanglap3011.github.io/hoanglap3011extension/panel.html' })
            }
        },
        {
            id: 'open_pomodoro',
            name: 'Pomodoro',
            keywords: 'pomodoro đồng hồ bấm giờ nhắc nhở đứng dậy nghỉ ngơi',
            action: () => {
                chrome.tabs.create({ url: 'https://hoanglap3011.github.io/hoanglap3011extension/panel.html' })
            }
        },
        {
            id: 'open_parkingLot',
            name: 'Parking Lot',
            keywords: 'parking lot delay muốn làm sau',
            action: () => {
                const danhMuc = 'Parking Lot';
                chrome.tabs.create({ url: chrome.runtime.getURL(`vietgido.html?danhMuc=${encodeURIComponent(danhMuc)}`) })
            }
        },
        {
            id: 'open_tamsubuonvui',
            name: 'Tâm sự buồn vui - web5ngay',
            keywords: 'tâm sự buồn vui tam su buon vui web5ngay',
            action: () => {
                chrome.tabs.create({ url: 'https://notebooklm.google.com/notebook/97ddf6ac-d209-4bb2-86bb-e7cfc9b48129' })
            }
        },
        {
            id: 'open_quanlytuvung',
            name: 'Quản lý từ vựng',
            keywords: 'quan ly',
            action: async () => {
                chrome.tabs.create({ url: chrome.runtime.getURL('tuvung.html') })
            }
        },
        {
            id: 'open_tuvungbatky',
            name: 'Từ vựng bất kỳ',
            keywords: 'từ vựng bất kỳ tu vung bat ky tubatky',
            action: async () => {
                await TuVungModule.show();
            }
        },
        {
            id: 'open_themtuvung',
            name: 'Thêm từ vựng',
            keywords: 'them tu vung',
            action: async () => {
                await TuVungModule.openAddForm();
            }
        }        
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
            li.addEventListener('click', (e) => {
                executeCommand(command, e);
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
    async function executeCommand(command, event) {
        if (command) {
            await command.action(event);   // ← chờ action xong
            if (!command.keepOpen) {
                window.close();            // ← sau đó mới đóng
            }
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