import { TodolistModule } from './TodolistModule.js';
import { DateModule } from './DateModule.js';
import { DatePickerModule } from './DatePickerModule.js';

const VERSION = '12';

// ===== Danh sách nút: thêm/bớt/sửa nút chỉ cần sửa mảng này =====
// { label, url, target } để mở link (target mặc định '_self'),
// hoặc { label, onClick } để chạy hàm.
const LINKS = [
    { label: '🖊️ Viết Gì Đó',      url: 'vietgido.html',    target: '_blank' },
    { label: '✅ To Do List',       onClick: openToDoListThisWeek },
    { label: '📅 To Do List tuần',  onClick: openToDoListWeekCustom },
    { label: '🅿️ Parking Lot',     url: PARKING_LOT,        target: '_blank' },
    { label: '🏋️ Intent-time',     url: 'intent-time.html', target: '_blank' },
    { label: '📒 Recap',            url: 'recap.html',       target: '_blank' },
    { label: '👏 Habit',            url: 'habit.html',       target: '_blank' },
    { label: '✅ All To Do List',   url: TODOLIST_ALL },
    { label: '📆 Lịch',             url: CALENDAR },
    { label: '🎯 Goal',             url: GOAL },
    { label: '🛋️ Rảnh',            url: RANH },
    { label: '📒 This week',        onClick: () => TodolistModule.openThisWeekTimelineFolder() },
    { label: '📅 Tổng hợp ngày',    url: TONGHOPNGAY },
    { label: '🗓️ Tổng hợp tuần',   url: TONGHOPTUAN },
    { label: '🎵 Nhạc học tập',     onClick: () => playYoutubePlaylist(NHAC_VUI_URLS) },
    { label: '🌬️ Hít thở',         onClick: () => playYoutubePlaylist(HIT_THO_URLS) },
    { label: '🧘 Vipassana',        url: VIPASSANA },
    { label: '🧘‍♀️ Metta',           url: METTA },
    { label: '📚 English',          url: ENGLISH },
    { label: '🎶 Pumpup Music',     url: NHACTICHCUCDONGLUC },
    { label: '📰 Tin tổng hợp',     url: TINTONGHOP },
    { label: '✨ Tin tích cực',     url: TINTICHCUC },
    { label: '🤖 Mở nhiều AI',      url: MONHIEUAI },
    { label: '⚽ Lịch thi đấu',     url: LICHTHIDAU },
    { label: '🎸 Guitar edumall',   url: GUITAR_EDUMALL },
    { label: '💪🎧 Gym Music',      url: GYM_MUSIC },
    { label: '👪 Note gia đình',    url: NOTE_GIADINH },
    { label: '😂 Playlist cười',    url: LAUGHT },
    { label: '🧠 Deep Music',       url: DEEP },
    { label: '📖 Kindle',           url: KINDLE },
    { label: 'panel',               url: 'panel.html',       target: '_blank' },
    { label: 'Enter',               onClick: () => PasswordModule.openPasswordPopup() },
];

const QUOTE_CATEGORIES = [
    { id: 'cauToan',    label: 'Cầu Toàn',     file: './quoteCauToan.js',    key: 'quoteCauToan' },
    { id: 'baySuyNghi', label: 'Bẫy Suy Nghĩ', file: './quoteBaySuyNghi.js', key: 'quoteBaySuyNghi' },
    { id: 'loiKyLuat',  label: 'Lời Kỷ Luật',  file: './quoteLoiKyLuat.js',  key: 'quoteLoiKyLuat' },
    { id: 'trietLy',    label: 'Triết lý',     file: './quoteTrietLy.js',    key: 'quoteTrietLy' },
    { id: 'haiHuoc',    label: 'Hài hước',     file: './quoteHaiHuoc.js',    key: 'quoteHaiHuoc' },
];
const DEFAULT_QUOTE_CATEGORY = 'haiHuoc';

let quoteArray = [];
let quoteIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
    DateModule.hienThiNgayHienTai();
    renderLinks();
    initQuoteSection();
});

// ===== Nút link =====

function renderLinks() {
    const row = document.getElementById('link-row');
    LINKS.forEach(link => {
        const btn = document.createElement('button');
        btn.className = 'a-like';
        btn.textContent = link.label;
        btn.addEventListener('click', link.onClick ?? (() => window.open(link.url, link.target || '_self')));

        const col = document.createElement('div');
        col.className = 'col-6 col-md-3 mb-3';
        col.appendChild(btn);
        row.appendChild(col);
    });

    const ver = document.createElement('div');
    ver.className = 'col-6 col-md-3 mb-3';
    ver.textContent = `ver: ${VERSION}`;
    row.appendChild(ver);
}

function openToDoListThisWeek() {
    TodolistModule.openToDoListWeekFromDay(DateModule.getDDMMYYYYHienTai());
}

function openToDoListWeekCustom(event) {
    DatePickerModule.pickDate(event.currentTarget, (selectedDate) => {
        TodolistModule.openToDoListWeekFromDay(DateModule.formatDate(selectedDate));
    });
}

// Mỗi lần bấm phát video kế tiếp trong danh sách (xoay vòng)
const playlistIndex = new Map();
function playYoutubePlaylist(urls) {
    const i = playlistIndex.get(urls) || 0;
    document.getElementById('divIframeYoutube').style.display = 'block';
    document.getElementById('iframeYoutube').src = urls[i];
    playlistIndex.set(urls, (i + 1) % urls.length);
}

// ===== Quote =====

function initQuoteSection() {
    const select = document.getElementById('quoteCategory');
    QUOTE_CATEGORIES.forEach(cat => select.add(new Option(cat.label, cat.id)));
    select.addEventListener('change', () => setQuoteCategory(select.value));
    select.value = DEFAULT_QUOTE_CATEGORY;
    setQuoteCategory(DEFAULT_QUOTE_CATEGORY);

    document.getElementById('btnPrevQuote').addEventListener('click', () => moveQuote(-1));
    document.getElementById('btnNextQuote').addEventListener('click', () => moveQuote(1));
}

function setQuoteCategory(categoryId) {
    const cat = QUOTE_CATEGORIES.find(c => c.id === categoryId);
    if (!cat) return;
    import(cat.file).then(module => {
        quoteArray = shuffleArray([...module[cat.key]]);
        quoteIndex = 0;
        updateQuoteDisplay();
    });
}

function moveQuote(step) {
    const next = quoteIndex + step;
    if (next < 0 || next >= quoteArray.length) return;
    quoteIndex = next;
    updateQuoteDisplay();
}

function updateQuoteDisplay() {
    if (quoteArray.length === 0) return;
    const quoteDiv = document.getElementById('daily-quote');
    quoteDiv.style.opacity = 0;
    setTimeout(() => {
        quoteDiv.textContent = quoteArray[quoteIndex];
        quoteDiv.style.opacity = 1;
    }, 200);
    document.getElementById('btnPrevQuote').disabled = quoteIndex === 0;
    document.getElementById('btnNextQuote').disabled = quoteIndex === quoteArray.length - 1;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
