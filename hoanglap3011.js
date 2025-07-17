
import { quoteTrietLy, quoteHaiHuoc } from './quotes.js';


const TEXTS = {
  DIARY: "🖊️ Nhật ký",
  CHECKLIST: "✅ Checklist",
  THOUGHT: "💭 Viết ra",
  TODOLIST: "✔️ To Do List",
  THIS_WEEK: "📒 This Week",
  TODOLIST_NEXTWEEK: "✔️ To Do List Next Week",
  PREVIOUS_WEEK: "📘 Previous Week"
};

let KEYS = {
  DIARY: null,
  CHECKLIST: null,
  THOUGHT: null,
  TODOLIST: null,
  THIS_WEEK: null,
  TODOLIST_NEXTWEEK: null,
  PREVIOUS_WEEK: null
};

let URLS = {
  DIARY: "",
  CHECKLIST: "",
  THOUGHT: "",
  TODOLIST: "",
  THIS_WEEK: "",
  TODOLIST_NEXTWEEK: "",
  PREVIOUS_WEEK: ""
};

const KEY_PASS = "pass";
const URL_GET_DAY_LINK = "https://script.google.com/macros/s/AKfycbzyeYfS-yNLfffRp37Z74nvfPpD_2JlTEOE8DeD-lQXM-bm1h3zlcQD5EWhpsLM3ggaVQ/exec";
const URL_GET_WEEK_LINK = "https://script.google.com/macros/s/AKfycbybPB6FByUkp_LMtp4WVF4iz5RfDY2M6PgOMRtJ6_eExKmYZ3bKrnF4mHNV4-z8_QQtrw/exec";

const QUICK_URLS = {
  CALENDAR: "https://calendar.google.com/",
  PROBLEM: "https://docs.google.com/spreadsheets/d/1Ww9sdbQScZdNysDOvD8_1zCqxsi3r-K6FqIKLLoXSho/edit?gid=0#gid=0",
  SODSCD: "https://docs.google.com/document/d/12oVFyqe-yWjuwTW2YN74WPQl6N9xOcaR8KONvH81Ksg/edit?tab=t.0",
  TONGHOPTUAN: "",
  TONGHOPNGAY: "",
  NHACHOCTAP: "https://music.youtube.com/playlist?list=PLpl9CTbHHB9USqW2dcpaRsXaxbykPaIeg&si=vCiN_9xfrNvY6Pvo",
  POMODORO: "https://pomodorotimer.online/",
  HITTHO: "https://www.youtube.com/watch?v=QhIxGtxIFF4&list=PLpl9CTbHHB9W879FlKDxuke-rmCiRvCSW",
  VIPASSANA: "https://www.youtube.com/watch?v=PmuFF36uIxk&list=PLpl9CTbHHB9VnSnZ5yNLFBuDMp1g-P1Ti&index=8",
  METTA: "https://www.youtube.com/watch?v=8Unx4chbLl0&list=PLpl9CTbHHB9VnSnZ5yNLFBuDMp1g-P1Ti&index=1",
  ENGLISH: "",
  NHACTICHCUCDONGLUC: "https://music.youtube.com/playlist?list=PLpl9CTbHHB9Wy7WRZ8-28U0hcLATWA4OX",
  TINTONGHOP: "https://vnexpress.net/doi-song",
  TINTICHCUC: "https://baomoi.com/nang-luong-tich-cuc-top338.epi",
  MONHIEUAI: "",
  LICHTHIDAU: "https://www.24h.com.vn/bong-da/lich-thi-dau-bong-da-hom-nay-moi-nhat-c48a364371.html",
  GUITAR_EDUMALL: "https://www.edumall.vn/vn/course-player/hoc-guitar-dem-hat-cap-toc-trong-30-ngay",
  GYM_MUSIC: "https://music.youtube.com/playlist?list=PLpl9CTbHHB9WU4r1ptkQzWjKQ8g_ijIFa",
  NOTE_GIADINH: "https://docs.google.com/document/d/1Yn04JziVUUTyqUVNqKfKOeEBCDlulV9R1jJPITNpdEA/edit?tab=t.0#heading=h.eejeurvh6dwa",
  LAUGHT: "https://www.youtube.com/watch?v=e5e8RScN_dg&list=PLpl9CTbHHB9X2uQvoUN3Iwwo_QbKolgvM",
  DEEP: "https://www.youtube.com/watch?v=qX900P6POEU&list=PLpl9CTbHHB9UXfVctUpy4NzvNhsQ7s7dX",
  KINDLE: "kindle://",
  RANH: "https://docs.google.com/document/d/1ak5a0MpUnUpGpb42m_PFRkKtyvcsF1AohZJJ9dtqTUw/edit?usp=drivesdk",
  GOAL: "https://docs.google.com/spreadsheets/d/16IRD2vS0BO0UpRRkJHyVVXlBNqmw1qFd6n5G-0WvnkA/edit?gid=0#gid=0"
};

const HIT_THO_URLS = [
  "https://www.youtube.com/embed/QhIxGtxIFF4?si=umecJ5wXItfUmMoA",
  "https://www.youtube.com/embed/yauSdpw3mCs?si=pBiN49B_fn_Lyz32",
  "https://www.youtube.com/embed/dvqzksrjhpM?si=HDpOcbGCUshCKH9N",
  "https://www.youtube.com/embed/LwUyeKUred8?si=NqkPazXe2ilSp9JX"
];
let hitThoIndex = 0;
const NHAC_VUI_URLS = [
  "https://www.youtube.com/embed/ubnDMTUui1Y?si=5GA7GJ_-o94fcSt5",
  "https://www.youtube.com/embed/bKhkqpWoWTU?si=k-CcDAioXVBYc7J9",
];
let nhacVuiIndex = 0;


let currentQuoteList = quoteHaiHuoc;
let currentIndex = 0;

document.addEventListener("DOMContentLoaded", function () {
  hienThiNgayHienTai();
  setKeyCache();
  showPass();
  updateQuickLinks();
  loadQuoteIndex();
  addDayOption();
  [
    ["btnPrevQuote", () => shiftQuote(-1)],
    ["btnNextQuote", () => shiftQuote(1)],
    ["btnEnter", togglePasswordInput],
    ["btnSavePass", savePass],
    ["btnDiary", () => openUrl("DIARY")],
    ["btnDiaryChecklist", () => openUrl("CHECKLIST")],
    ["btnThought", openThought],
    ["btnToDoList", () => openUrl("TODOLIST")],
    ["btnThisWeek", () => openUrl("THIS_WEEK")],
    ["btnPreviousWeek", () => openUrl("PREVIOUS_WEEK")],
    ["btnToDoListNextWeek", () => openUrl("TODOLIST_NEXTWEEK")],
    ["btnCalendar", () => window.open(QUICK_URLS.CALENDAR, '_self')],
    ["btnProblem", () => window.open(QUICK_URLS.PROBLEM, '_self')],
    ["btnSodscd", () => window.open(QUICK_URLS.SODSCD, '_self')],
    ["btnTongHopNhatKyNgay", () => window.open(QUICK_URLS.TONGHOPNGAY, '_self')],
    ["btnTongHopNhatKyTuan", () => window.open(QUICK_URLS.TONGHOPTUAN, '_self')],
    ["btnPanel", openPanel],
    ["btnHitTho", playHitTho],
    ["btnNhacHocTap", playNhacVui],
    ["btnThienVipassana", () => window.open(QUICK_URLS.VIPASSANA, '_self')],
    ["btnThienMetta", () => window.open(QUICK_URLS.METTA, '_self')],
    ["btnLuyenTiengAnh", () => window.open(QUICK_URLS.ENGLISH, '_self')],
    ["btnNhacTichCuc", () => window.open(QUICK_URLS.NHACTICHCUCDONGLUC, '_self')],
    ["btnTinTongHop", () => window.open(QUICK_URLS.TINTONGHOP, '_self')],
    ["btnTinTichCuc", () => window.open(QUICK_URLS.TINTICHCUC, '_self')],
    ["btnMoNhieuAi", () => window.open(QUICK_URLS.MONHIEUAI, '_self')],
    ["btnLichThiDauBongDa", () => window.open(QUICK_URLS.LICHTHIDAU, '_self')],
    ["btnGuitarEdumall", () => window.open(QUICK_URLS.GUITAR_EDUMALL, '_self')],
    ["btnGymMusic", () => window.open(QUICK_URLS.GYM_MUSIC, '_self')],
    ["btnNoteVeGiaDinh", () => window.open(QUICK_URLS.NOTE_GIADINH, '_self')],
    ["btnTinTucThanhPodcast", () => window.open("", '_self')],
    ["btnPlaylistCuoi", () => window.open(QUICK_URLS.LAUGHT, '_self')],
    ["btnPlaylistSauSac", () => window.open(QUICK_URLS.DEEP, '_self')],
    ["btnDocSachKindle", () => window.open(QUICK_URLS.KINDLE, '_self')],
    ["btnRanh", () => window.open(QUICK_URLS.RANH, '_self')],
    ["btnMuctieu", () => window.open(QUICK_URLS.GOAL, '_self')],
  ].forEach(([id, handler]) => addClick(id, handler));

  const categorySelect = document.getElementById("quoteCategory");
  if (categorySelect) {
    categorySelect.addEventListener("change", function () {
      setQuoteCategory(this.value);
    });
  }

  const diarySelect = document.getElementById("dayDiary");
  if (diarySelect) {
    diarySelect.addEventListener("change", function () {
      if (this.value === "none") return;
      chooseDayDiary(this.value);
    });
  }

  const checklistSelect = document.getElementById("dayChecklist");
  if (checklistSelect) {
    checklistSelect.addEventListener("change", function () {
      if (this.value === "none") return;
      chooseDayChecklist(this.value);
    });
  }
});

function addClick(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', handler);
}

function openUrl(key) {
  if (URLS[key]) window.open(URLS[key], '_self');
}

function openThought() {
  if (isMobile()) {
    openUrl("THOUGHT");
  } else {
    const iframe = document.getElementById("iframeThought");
    iframe.src = URLS.THOUGHT;
    const iframeContainer = document.getElementById('divIframeThought');
    iframeContainer.style.display = (iframeContainer.style.display === 'none') ? 'block' : 'none';
  }
}

function openPanel() {
  const mainWidth = window.screen.availWidth;
  const mainHeight = window.screen.availHeight;
  const width = Math.floor(mainWidth * 0.3);
  const height = Math.floor(mainHeight * 0.9);
  const left = 0;
  const top = Math.floor((mainHeight - height) / 2);
  window.open(
    "panel.html",
    'panelWindow',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
}

function playHitTho() {
  const iframeContainer = document.getElementById('divIframeYoutube');
  if (iframeContainer.style.display === 'none') {
    iframeContainer.style.display = 'block';
  }
  const iframe = document.getElementById("iframeYoutube");
  if (iframe) {
    iframe.src = HIT_THO_URLS[hitThoIndex];
    hitThoIndex = (hitThoIndex + 1) % HIT_THO_URLS.length;
  }
}

function playNhacVui() {
  const iframeContainer = document.getElementById('divIframeYoutube');
  if (iframeContainer.style.display === 'none') {
    iframeContainer.style.display = 'block';
  }
  const iframe = document.getElementById("iframeYoutube");
  if (iframe) {
    iframe.src = NHAC_VUI_URLS[nhacVuiIndex];
    nhacVuiIndex = (nhacVuiIndex + 1) % NHAC_VUI_URLS.length;
  }
}

function togglePasswordInput() {
  const divPassword = document.getElementById('divPassword');
  divPassword.style.display = (divPassword.style.display === 'none') ? 'block' : 'none';
  if (divPassword.style.display === 'block') showPass();
}

function savePass() {
  const pass = document.getElementById('txtPass').value;
  if (!pass || pass.length === 0) {
    alert("Nhập pass");
  } else {
    if (isExtensionEnv()) {
      chrome.storage.local.set({ [KEY_PASS]: pass });
    } else {
      localStorage.setItem(KEY_PASS, pass);
    }
    alert("Saved!");
  }
}


function isExtensionEnv() {
  return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
}



function fetchDayLinkAndStore(dStr, callback) {
  const pass = document.getElementById("txtPass").value;
  fetch(`${URL_GET_DAY_LINK}?password=${pass}&day=${dStr}`)
    .then(r => r.ok ? r.json() : Promise.reject("Lỗi khi gọi API"))
    .then(({ diary, diaryChecklist }) => {
      setStorage({
        [`diary.${dStr}`]: diary.trim(),
        [`checklist.${dStr}`]: diaryChecklist.trim(),
      }, callback);
    })
    .catch(console.error);
}

function fetchWeekLinkAndStore(dStr, callback) {
  const pass = document.getElementById("txtPass").value;
  fetch(`${URL_GET_WEEK_LINK}?password=${pass}&day=${dStr}`)
    .then(r => r.ok ? r.json() : Promise.reject("Lỗi khi gọi API"))
    .then(({ thought, toDoList, thisWeek, toDoListNextWeek, previousWeek }) => {
      setStorage({
        [KEYS.THOUGHT]: thought.trim(),
        [KEYS.TODOLIST]: toDoList.trim(),
        [KEYS.THIS_WEEK]: thisWeek.trim(),
        [KEYS.TODOLIST_NEXTWEEK]: toDoListNextWeek.trim(),
        [KEYS.PREVIOUS_WEEK]: previousWeek.trim(),
      }, callback);
    })
    .catch(console.error);
}

function hienThiNgayHienTai() {
  const today = new Date();
  document.getElementById("current-date").textContent = today.toLocaleDateString('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}


function updateQuickLinks() {
  const ids = ["btnDiary", "btnDiaryChecklist", "btnThought", "btnToDoList", "btnThisWeek", "btnToDoListNextWeek", "btnPreviousWeek"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<span class="spinner"></span>';
  });
  const keys = Object.values(KEYS);
  getStorage(keys, handleStorageResult);
}

function handleStorageDayLinkResult(result) {
  setBtnAndUrl("DIARY", result[KEYS.DIARY]);
  setBtnAndUrl("CHECKLIST", result[KEYS.CHECKLIST]);
}

function handleStorageWeekLinkResult(result) {
  setBtnAndUrl("THOUGHT", result[KEYS.THOUGHT]);
  setBtnAndUrl("TODOLIST", result[KEYS.TODOLIST]);
  setBtnAndUrl("THIS_WEEK", result[KEYS.THIS_WEEK]);
  setBtnAndUrl("TODOLIST_NEXTWEEK", result[KEYS.TODOLIST_NEXTWEEK]);
  setBtnAndUrl("PREVIOUS_WEEK", result[KEYS.PREVIOUS_WEEK]);
}

function handleStorageResult(result) {
  setBtnAndUrl("DIARY", result[KEYS.DIARY]);
  setBtnAndUrl("CHECKLIST", result[KEYS.CHECKLIST]);
  setBtnAndUrl("THOUGHT", result[KEYS.THOUGHT]);
  setBtnAndUrl("TODOLIST", result[KEYS.TODOLIST]);
  setBtnAndUrl("THIS_WEEK", result[KEYS.THIS_WEEK]);
  setBtnAndUrl("TODOLIST_NEXTWEEK", result[KEYS.TODOLIST_NEXTWEEK]);
  setBtnAndUrl("PREVIOUS_WEEK", result[KEYS.PREVIOUS_WEEK]);
  if (!result[KEYS.DIARY] || !result[KEYS.CHECKLIST]) {
    const dStr = getCurrentDateFormatted();
    fetchDayLinkAndStore(dStr, () => getStorage([KEYS.DIARY, KEYS.CHECKLIST], handleStorageDayLinkResult));
  }
  if (!result[KEYS.THOUGHT] || !result[KEYS.TODOLIST] || !result[KEYS.THIS_WEEK] || !result[KEYS.TODOLIST_NEXTWEEK] || !result[KEYS.PREVIOUS_WEEK]) {
    const dStr = getCurrentDateFormatted();
    fetchWeekLinkAndStore(dStr, () => getStorage([
      KEYS.THOUGHT, KEYS.TODOLIST, KEYS.THIS_WEEK, KEYS.TODOLIST_NEXTWEEK, KEYS.PREVIOUS_WEEK
    ], handleStorageWeekLinkResult));
  }
}

function setKeyCache() {
  const dStr = getCurrentDateFormatted();
  const weekAndMonth = getInfoWeek(dStr);
  const week = weekAndMonth.week;
  KEYS = {
    DIARY: `diary.${dStr}`,
    CHECKLIST: `checklist.${dStr}`,
    THOUGHT: `thought.week.${week}`,
    TODOLIST: `todo.week.${week}`,
    THIS_WEEK: `folder.week.${week}`,
    TODOLIST_NEXTWEEK: `todo.week.${week + 1}`,
    PREVIOUS_WEEK: `folder.week.${week - 1}`
  };
}

function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function showPass() {
  getStorage([KEY_PASS], result => {
    document.getElementById("txtPass").value = result[KEY_PASS] || "";
  });
}

function loadQuoteIndex() {
  currentIndex = Math.floor(Math.random() * currentQuoteList.length);
  updateQuoteDisplay();
}

function updateQuoteDisplay() {
  const quoteDiv = document.getElementById("daily-quote");
  if (quoteDiv && currentQuoteList.length > 0) {
    quoteDiv.textContent = currentQuoteList[currentIndex];
  }
}

function shiftQuote(offset) {
  currentIndex = (currentIndex + offset + currentQuoteList.length) % currentQuoteList.length;
  updateQuoteDisplay();
}

function setQuoteCategory(category) {
  currentQuoteList = category === "serious" ? quoteTrietLy : quoteHaiHuoc;
  currentIndex = 0;
  updateQuoteDisplay();
}

// Storage helpers
function setStorage(obj, cb) {
  if (isExtensionEnv()) {
    chrome.storage.local.set(obj, cb);
  } else {
    Object.entries(obj).forEach(([k, v]) => localStorage.setItem(k, v));
    if (typeof cb === 'function') cb();
  }
}
function getStorage(keys, cb) {
  if (isExtensionEnv()) {
    chrome.storage.local.get(keys, cb);
  } else {
    const result = {};
    keys.forEach(k => result[k] = localStorage.getItem(k));
    cb(result);
  }
}
function setBtnAndUrl(key, url) {
  const btnMap = {
    DIARY: "btnDiary",
    CHECKLIST: "btnDiaryChecklist",
    THOUGHT: "btnThought",
    TODOLIST: "btnToDoList",
    THIS_WEEK: "btnThisWeek",
    TODOLIST_NEXTWEEK: "btnToDoListNextWeek",
    PREVIOUS_WEEK: "btnPreviousWeek"
  };
  if (url) {
    URLS[key] = url;
    const el = document.getElementById(btnMap[key]);
    if (el) el.innerHTML = TEXTS[key];
  }
}
// Thêm 7 option cho selectbox dayDiary, là 7 ngày trước đó tính từ ngày hiện tại
function addDayOption() {
  const selectDiary = document.getElementById('dayDiary');
  const selectChecklist = document.getElementById('dayChecklist');
  if (!selectDiary) return;
  if (!selectChecklist) return;
  const today = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const weekday = d.getDay();
    const weekdayMap = ['chủ nhật', 'thứ 2', 'thứ 3', 'thứ 4', 'thứ 5', 'thứ 6', 'thứ 7'];
    const option = document.createElement('option');
    option.value = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
    option.textContent = `${option.value} - ${weekdayMap[weekday]}`;
    const optionChecklist = option.cloneNode(true);
    selectDiary.appendChild(option);
    selectChecklist.appendChild(optionChecklist);
  }
}

function chooseDayDiary(dStr) {
  const keyDiary = `diary.${dStr}`;
  const keyChecklist = `checklist.${dStr}`;
  const keys = [keyDiary, keyChecklist];
  getStorage(keys, (result) => {
    if (result[keyDiary]) {
      const urlDiary = result[keyDiary];
      const urlChecklist = result[keyChecklist];
      if (urlDiary) {
        window.open(urlDiary, '_self');
      }
    } else {
      fetchDayLinkAndStore(dStr, () => getStorage(keys, (result2) => {
        window.open(result2[keyDiary], '_self')
      }))
    }
  });
}

function chooseDayChecklist(dStr) {
  const keyDiary = `diary.${dStr}`;
  const keyChecklist = `checklist.${dStr}`;
  const keys = [keyDiary, keyChecklist];
  getStorage(keys, (result) => {
    if (result[keyDiary]) {
      const urlDiary = result[keyDiary];
      const urlChecklist = result[keyChecklist];
      if (urlChecklist) {
        window.open(urlChecklist, '_self');
      }
    } else {
      fetchDayLinkAndStore(dStr, () => getStorage(keys, (result2) => {
        window.open(result2[keyChecklist], '_self')
      }))
    }
  });
}

function getInfoWeek(dateStr) {
    const [day, month, year] = dateStr.split('.').map(Number);
    const inputDate = new Date(year, month - 1, day);

    // Calculate Monday
    const dayOfWeek = (inputDate.getDay() + 6) % 7; // 0 = Monday
    const monday = new Date(inputDate);
    monday.setDate(inputDate.getDate() - dayOfWeek);

    // Calculate Sunday
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // Determine ISO week year by checking Thursday of that week
    const tempDate = new Date(monday);
    tempDate.setDate(tempDate.getDate() + 3); // Thursday
    const weekYear = tempDate.getFullYear();

    // Find the Thursday of the first ISO week of the year
    const firstThursday = new Date(weekYear, 0, 4);
    const firstThursdayDay = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - firstThursdayDay + 3);

    // Calculate week number
    const diffInDays = (monday - firstThursday) / (1000 * 60 * 60 * 24);
    const weekNumber = 1 + Math.round(diffInDays / 7);

    // Now month comes from Sunday (end of week)
    const monthStr = String(sunday.getMonth() + 1).padStart(2, '0');

    const formatDate = (d) =>
        String(d.getDate()).padStart(2, '0') + '.' +
        String(d.getMonth() + 1).padStart(2, '0') + '.' +
        d.getFullYear();

    return {
        week: weekNumber,
        month: monthStr,
        startOfWeek: formatDate(monday),
        endOfWeek: formatDate(sunday),
        weekYear: weekYear
    };
}

function getCurrentDateFormatted() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0'); // tháng bắt đầu từ 0
  const year = today.getFullYear();
  return `${day}.${month}.${year}`;
}