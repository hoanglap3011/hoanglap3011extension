import { TodolistModule } from './TodolistModule.js';
import { DatePickerModule } from './DatePickerModule.js';
import { DateModule } from './DateModule.js';
import { TuVungModule } from './tuvung.js';

// =====================================================================
// --- DỊCH NHANH (Anh <-> Việt) ---
// Nguồn chính: endpoint gtx của Google (miễn phí, tự phát hiện ngôn ngữ)
// Dự phòng: MyMemory khi gtx lỗi/bị chặn
// =====================================================================
const TranslateService = (() => {
    const CACHE_KEY = 'translateCache';
    const CACHE_LIMIT = 300;          // giữ 300 chuỗi gần nhất, tránh phình storage
    const cache = new Map();

    // Nạp lại kho dịch cũ để mở hub lần sau không phải gọi API nữa
    const ready = (async () => {
        try {
            const data = await chrome.storage.local.get(CACHE_KEY);
            Object.entries(data?.[CACHE_KEY] || {}).forEach(([k, v]) => cache.set(k, v));
        } catch (_) { /* không có storage thì chạy bằng bộ nhớ tạm */ }
    })();

    function persist() {
        const entries = [...cache].slice(-CACHE_LIMIT);
        cache.clear();
        entries.forEach(([k, v]) => cache.set(k, v));
        chrome.storage.local.set({ [CACHE_KEY]: Object.fromEntries(entries) }).catch(() => {});
    }
    // Chữ có dấu tiếng Việt -> chắc chắn là tiếng Việt, khỏi phải đoán
    const VI_DIACRITICS = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;

    async function viaGoogle(text, target) {
        const url = 'https://translate.googleapis.com/translate_a/single'
            + `?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`gtx ${res.status}`);
        const data = await res.json();
        const translated = (data?.[0] || []).map(seg => seg?.[0] || '').join('').trim();
        if (!translated) throw new Error('gtx rỗng');
        return { text: translated, from: data?.[2] || '?', to: target };
    }

    async function viaMyMemory(text, from, to) {
        const url = 'https://api.mymemory.translated.net/get'
            + `?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`mymemory ${res.status}`);
        const data = await res.json();
        const translated = (data?.responseData?.translatedText || '').trim();
        if (!translated) throw new Error('mymemory rỗng');
        return { text: translated, from, to };
    }

    async function translate(text) {
        const key = text.toLowerCase();
        if (cache.has(key)) return cache.get(key);

        const looksVietnamese = VI_DIACRITICS.test(text);
        let result = null;

        try {
            result = await viaGoogle(text, looksVietnamese ? 'en' : 'vi');
            // Gõ tiếng Việt không dấu: gtx nhận ra là 'vi' -> dịch lại sang tiếng Anh
            if (!looksVietnamese && result.from === 'vi') {
                result = await viaGoogle(text, 'en');
            }
        } catch (_) {
            const [from, to] = looksVietnamese ? ['vi', 'en'] : ['en', 'vi'];
            result = await viaMyMemory(text, from, to);
        }

        // Dịch ra y hệt đầu vào thì coi như không có gì để hiện.
        // Vẫn phải nhớ là ĐÃ THỬ, nếu không sẽ bị gọi lại API liên tục.
        const value = result.text.toLowerCase() === key ? null : result;
        cache.set(key, value);
        persist();
        return value;
    }

    // undefined = chưa thử bao giờ; null = đã thử nhưng không có bản dịch khác
    return { ready, translate, peek: (text) => cache.get(text.toLowerCase()) };
})();

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (_) {
        // Popup mất focus thì clipboard API bị từ chối -> dùng cách cũ
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
    }
}

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
            // Giữ hub mở để chọn ngày; đóng lại sau khi todolist đã mở xong
            keepOpen: true,
            action: () => {
                DatePickerModule.pickDate(searchInput, (selectedDate) => {
                    const dateStr = DateModule.formatDate(selectedDate);
                    TodolistModule.openToDoListWeekFromDay(dateStr, () => window.close());
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
                chrome.tabs.create({ url: 'https://notebook.google.com/notebook/6b091958-4067-475b-b85f-403999ea4fe7' })
            }
        },
        {
            id: 'open_baihoctamhuyet',
            name: 'Bài học tâm huyết - web5ngay',
            keywords: 'bai hoc tam huyet bài học tâm huyết web5ngay',
            action: () => {
                chrome.tabs.create({ url: 'https://notebook.google.com/notebook/183c04ff-e3bc-4182-a4e0-d34a24e09d7d' })
            }
        },
        {
            id: 'open_trikycamxuc',
            name: 'Tri kỷ cảm xúc - web5ngay',
            keywords: 'tri kỷ cảm xúc ky cam xuc web5ngay',
            action: () => {
                chrome.tabs.create({ url: 'https://notebook.google.com/notebook/75741b2e-19a2-430c-984d-0eb11aa1aac0' })
            }
        },       
        {
            id: 'open_betterversion',
            name: 'Better Version',
            keywords: 'better version',
            action: () => {
                chrome.tabs.create({ url: '' })
            }
        },    
        {
            id: 'open_innerworldpodcast',
            name: 'Inner World Podcast',
            keywords: 'inner world podcast',
            action: () => {
                chrome.tabs.create({ url: '' })
            }
        },                         
        {
            id: 'open_quanlytuvung',
            name: 'Quản lý từ vựng',
            keywords: 'quan ly tuvung',
            action: async () => {
                await chrome.tabs.create({ url: chrome.runtime.getURL('tuvung.html') });
            }
        },
        {
            id: 'open_tuvungbatky',
            name: 'Từ vựng bất kỳ',
            keywords: 'tuvung bat ky tubatky',
            action: async () => {
                chrome.runtime.sendMessage({ action: 'showTuvungPopup' });
            }
        },
        {
            id: 'open_themtuvung',
            name: 'Thêm từ vựng',
            keywords: 'them tuvung',
            action: async () => {
                await TuVungModule.openAddForm();
            }
        }    
        ,{
            id: 'open_quanlytoeic',
            name: 'Quản lý Toeic',
            keywords: 'quan ly toeic',
            action: async () => {
                await chrome.tabs.create({ url: chrome.runtime.getURL('toeic.html') })
            }
        },
        {
            id: 'open_toeicbatky',
            name: 'Toeic bất kỳ',
            keywords: 'toeic batky ',
            action: async () => {
                chrome.runtime.sendMessage({ action: 'showToeicPopup' });
            }
        },
        {
            id: 'open_neo',
            name: 'Neo — màn hình tập trung',
            keywords: 'neo tap trung focus phien lam viec pip noi',
            action: async () => {
                const url = chrome.runtime.getURL('neo_anchor.html');
                const tabs = await chrome.tabs.query({ url });
                if (tabs.length) {
                    await chrome.tabs.update(tabs[0].id, { active: true });
                    chrome.windows.update(tabs[0].windowId, { focused: true });
                } else {
                    chrome.tabs.create({ url, pinned: true });
                }
            }
        },
        {
            id: 'open_hengio',
            name: 'Hẹn giờ — đếm ngược',
            keywords: 'hengio hẹn giờ hen gio dem nguoc countdown timer bam gio',
            action: async () => {
                const url = chrome.runtime.getURL('hengio.html');
                const tabs = await chrome.tabs.query({ url });
                if (tabs.length) {
                    await chrome.tabs.update(tabs[0].id, { active: true });
                    chrome.windows.update(tabs[0].windowId, { focused: true });
                } else {
                    chrome.tabs.create({ url });
                }
            }
        },
        {
            id: 'open_standup',
            name: 'Standup — nhắc nhở đứng dậy',
            keywords: 'standup dung day di chuyen ngoi lau nhac nho suc khoe',
            action: async () => {
                const url = chrome.runtime.getURL('standup.html');
                const tabs = await chrome.tabs.query({ url });
                if (tabs.length) {
                    await chrome.tabs.update(tabs[0].id, { active: true });
                    chrome.windows.update(tabs[0].windowId, { focused: true });
                } else {
                    chrome.tabs.create({ url, pinned: true });
                }
            }
        },
    ];

    // --- 2. CACHE DOM VÀ TRẠNG THÁI ---
    const searchInput = document.getElementById('searchInput');
    const commandList = document.getElementById('commandList');
    let filteredCommands = [...ALL_COMMANDS];
    let selectedIndex = 0;
    let isExecuting = false;

    // Trạng thái của dòng dịch
    // Chờ hẳn 900ms sau khi ngừng gõ mới dịch, và chỉ với chuỗi từ 3 ký tự trở lên.
    // Gõ "dragon" từng chữ sẽ chỉ tốn 1 request thay vì 6.
    const AUTO_TRANSLATE_DELAY = 900;
    const AUTO_TRANSLATE_MIN_LEN = 3;
    const translateState = { query: '', loading: false, error: false };
    let translateTimer = null;
    let lastRequestId = 0;


    // --- 3. HÀM RENDER DANH SÁCH ---
    function renderList(commands, keepSelection = false) {
        commandList.innerHTML = ''; // Xoá danh sách cũ
        commands.forEach((command, index) => {
            const li = document.createElement('li');
            li.dataset.id = command.id;
            if (command.isTranslate) li.classList.add('translate-row');

            const nameSpan = document.createElement('span');
            nameSpan.textContent = command.name;
            li.appendChild(nameSpan);

            const keywordSpan = document.createElement('small');
            // Dòng dịch tự đặt gợi ý riêng, lệnh thường lấy từ khoá đầu tiên
            keywordSpan.textContent = command.hint ?? command.keywords.split(' ')[0];
            li.appendChild(keywordSpan);

            // Xử lý click chuột
            li.addEventListener('click', (e) => {
                executeCommand(command, e);
            });

            commandList.appendChild(li);
        });

        // Cập nhật lại mục được chọn
        if (!keepSelection || selectedIndex >= commands.length) selectedIndex = 0;
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

    // Chỉ gọi khi người dùng CHỦ ĐỘNG chuyển tới dòng dịch (mũi tên),
    // không đặt trong updateSelection vì hàm đó chạy sau mỗi lần render.
    function translateSelectedRow() {
        const current = filteredCommands[selectedIndex];
        if (current?.isTranslate && !current.ready && !current.tried && !current.failed) {
            requestTranslate(current.rawQuery);
        }
    }

    // --- 5. HÀM THỰC THI LỆNH ---
async function executeCommand(command, event) {
    if (!command || isExecuting) return;   // đã chạy rồi thì bỏ qua
    isExecuting = true;
    try {
        await command.action(event);
        if (!command.keepOpen) window.close();
    } finally {
        isExecuting = false;
    }
}

    // --- 5b. DÒNG DỊCH (luôn nằm CUỐI danh sách nên không tranh Enter với lệnh) ---

    function requestTranslate(text) {
        if (!text) return;
        if (TranslateService.peek(text) !== undefined) return;                        // đã dịch rồi
        if (translateState.error && translateState.query === text) return;            // vừa lỗi, chờ người dùng gõ tiếp
        if (translateState.loading && translateState.query === text) return;          // đúng chuỗi này đang dịch

        clearTimeout(translateTimer); // huỷ lịch debounce cũ để không dịch lặp
        const requestId = ++lastRequestId;
        translateState.loading = true;
        translateState.error = false;
        translateState.query = text;
        renderRows(true);

        TranslateService.translate(text)
            .catch(() => { if (requestId === lastRequestId) translateState.error = true; return null; })
            .finally(() => {
                if (requestId !== lastRequestId) return; // đã có yêu cầu mới hơn, kết quả này bỏ đi
                translateState.loading = false;
                // Người dùng đã gõ tiếp thì kết quả này không còn đúng nữa
                if (searchInput.value.trim() === text) renderRows(true);
            });
    }

    function buildTranslateRows(rawQuery, autoTranslate) {
        if (rawQuery.length < 2) return [];

        const entry = TranslateService.peek(rawQuery);
        const tried = entry !== undefined;          // đã gọi API cho chuỗi này chưa
        const cached = entry || null;               // có bản dịch dùng được không
        const isLoadingThis = translateState.loading && translateState.query === rawQuery;
        const failedThis = translateState.error && translateState.query === rawQuery;

        // Không khớp lệnh nào -> gần như chắc chắn là muốn dịch, dịch sẵn cho nhanh
        if (!tried && !isLoadingThis && !failedThis && autoTranslate && rawQuery.length >= AUTO_TRANSLATE_MIN_LEN) {
            clearTimeout(translateTimer);
            translateTimer = setTimeout(() => {
                if (searchInput.value.trim() === rawQuery) requestTranslate(rawQuery);
            }, AUTO_TRANSLATE_DELAY);
        }

        let name = `Dịch "${rawQuery}"`;
        let hint = 'dịch';
        if (isLoadingThis)   { name = 'Đang dịch…'; hint = 'dịch'; }
        else if (cached)     { name = `🌐 ${cached.text}`; hint = `${cached.from} → ${cached.to} · Enter để chép`; }
        else if (failedThis) { name = '⚠️ Không dịch được, thử lại sau'; hint = 'dịch'; }
        else if (tried)      { name = `🌐 Không có bản dịch khác cho "${rawQuery}"`; hint = 'dịch'; }

        const rows = [{
            id: 'translate_result',
            name,
            hint,
            keywords: '',
            isTranslate: true,
            rawQuery,
            ready: !!cached,
            failed: failedThis,
            tried,
            keepOpen: !cached, // chưa có kết quả thì giữ hub mở để còn thấy trạng thái
            action: async () => {
                const result = cached || await TranslateService.translate(rawQuery).catch(() => null);
                if (!result) { translateState.error = !tried; translateState.query = rawQuery; renderRows(true); return; }
                await copyToClipboard(result.text);
                window.close();
            }
        }];

        // Từ/cụm ngắn thì mời lưu luôn vào kho từ vựng; câu dài thì không
        if (cached && rawQuery.split(/\s+/).length <= 4) {
            const isFromVietnamese = cached.from === 'vi';
            rows.push({
                id: 'translate_add_tuvung',
                name: `➕ Thêm "${isFromVietnamese ? cached.text : rawQuery}" vào từ vựng`,
                hint: 'tu vung',
                keywords: '',
                isTranslate: true,
                rawQuery,
                ready: true,
                action: async () => {
                    await TuVungModule.openAddForm({
                        word: isFromVietnamese ? cached.text : rawQuery,
                        meaning: isFromVietnamese ? rawQuery : cached.text,
                    });
                }
            });
        }

        return rows;
    }

    function renderRows(keepSelection = false) {
        const rawQuery = searchInput.value.trim();
        const query = rawQuery.toLowerCase();

        const matched = ALL_COMMANDS.filter(command =>
            command.name.toLowerCase().includes(query) ||
            command.keywords.toLowerCase().includes(query)
        );

        filteredCommands = [...matched, ...buildTranslateRows(rawQuery, matched.length === 0)];
        renderList(filteredCommands, keepSelection);
    }

    const applyFilter = () => renderRows(false);

    // --- 6. GÁN CÁC EVENT LISTENER ---

    // Tự động focus vào input khi mở
    searchInput.focus();

    // Lọc danh sách khi gõ
    searchInput.addEventListener('input', () => applyFilter());

    // Xử lý phím (Mũi tên, Enter, Escape)
    searchInput.addEventListener('keydown', (e) => {
        // Bỏ qua Enter phát sinh từ việc xác nhận bộ gõ tiếng Việt
        if (e.isComposing || e.keyCode === 229) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedIndex = (selectedIndex + 1) % filteredCommands.length;
                updateSelection();
                translateSelectedRow();
                break;
            case 'ArrowUp':
                e.preventDefault();
                selectedIndex = (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
                updateSelection();
                translateSelectedRow();
                break;
            case 'Enter':
                e.preventDefault();
                executeCommand(filteredCommands[selectedIndex]);
                break;
            case 'Escape':
                window.close();
                break;
        }
    });

    // --- 7. KHỞI CHẠY LẦN ĐẦU ---
    renderList(ALL_COMMANDS);
    // Kho dịch cũ nạp xong thì vẽ lại, từ nào tra rồi sẽ hiện ngay khỏi gọi API
    TranslateService.ready.then(() => { if (searchInput.value.trim()) renderRows(true); });
});