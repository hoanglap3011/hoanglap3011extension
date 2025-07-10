
import { quoteTrietLy, quoteHaiHuoc } from './quotes.js';


const TEXTS = {
  DIARY: "🖊️ Nhật ký",
  CHECKLIST: "✅ Checklist",
  THOUGHT: "💭 Viết ra",
  TODOLIST: "✔️ To Do List",
  THIS_WEEK: "📒 This week",
  TODOLIST_NEXTWEEK: "✔️ To Do List Next week",
  PREVIOUS_WEEK: "📘 Previous week"
};

let KEYS = {};
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
const URL_GET_DAY_LINK = "https://script.google.com/macros/s/AKfycbyaOZZDckZlMMMWMlchO0Vb5E04bPTaDGLAC5HEQdc9uJEwmQYq7_O_qW13BJMs-whqFQ/exec";
const URL_GET_WEEK_LINK = "https://script.google.com/macros/s/AKfycbzzDGFPCjS3PZB40vO6NJ3jbSHaIzuhCB64tglm_krc2e5nA10zMigOP8LTtWw9gpEksg/exec";

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
const today = new Date().toISOString().slice(0, 10);

document.addEventListener("DOMContentLoaded", function () {
  hienThiNgayHienTai();
  setKeyCache();
  showPass();
  updateQuickLinks();
  loadQuoteIndex();
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
    ["btnPomodoro", openPomodoro],
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

function openPomodoro() {
  if (isMobile()) {
    window.open(QUICK_URLS.POMODORO, '_self');
  } else {
    const iframeContainer = document.getElementById('divIframePomodoro');
    iframeContainer.style.display = (iframeContainer.style.display === 'none') ? 'block' : 'none';
  }
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


function getISOWeekNumber() {
  const date = new Date();
  const target = new Date(date.valueOf());
  target.setDate(target.getDate() + 3 - (target.getDay() + 6) % 7);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - (firstThursday.getDay() + 6) % 7);
  return 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
}



function fetchDayLinkAndStore(callback) {
  const pass = document.getElementById("txtPass").value;
  fetch(`${URL_GET_DAY_LINK}?password=${pass}`)
    .then(r => r.ok ? r.json() : Promise.reject("Lỗi khi gọi API"))
    .then(({ diary, diaryChecklist }) => {
      setStorage({
        [KEYS.DIARY]: diary.trim(),
        [KEYS.DIARYCHECKLIST]: diaryChecklist.trim(),
      }, callback);
    })
    .catch(console.error);
}

function fetchWeekLinkAndStore(callback) {
  const pass = document.getElementById("txtPass").value;
  fetch(`${URL_GET_WEEK_LINK}?password=${pass}`)
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
  setBtnAndUrl("CHECKLIST", result[KEYS.DIARYCHECKLIST]);
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
  setBtnAndUrl("CHECKLIST", result[KEYS.DIARYCHECKLIST]);
  setBtnAndUrl("THOUGHT", result[KEYS.THOUGHT]);
  setBtnAndUrl("TODOLIST", result[KEYS.TODOLIST]);
  setBtnAndUrl("THIS_WEEK", result[KEYS.THIS_WEEK]);
  setBtnAndUrl("TODOLIST_NEXTWEEK", result[KEYS.TODOLIST_NEXTWEEK]);
  setBtnAndUrl("PREVIOUS_WEEK", result[KEYS.PREVIOUS_WEEK]);
  if (!result[KEYS.DIARY] || !result[KEYS.DIARYCHECKLIST]) {
    fetchDayLinkAndStore(() => getStorage([KEYS.DIARY, KEYS.DIARYCHECKLIST], handleStorageDayLinkResult));
  }
  if (!result[KEYS.THOUGHT] || !result[KEYS.TODOLIST] || !result[KEYS.THIS_WEEK] || !result[KEYS.TODOLIST_NEXTWEEK] || !result[KEYS.PREVIOUS_WEEK]) {
    fetchWeekLinkAndStore(() => getStorage([
      KEYS.THOUGHT, KEYS.TODOLIST, KEYS.THIS_WEEK, KEYS.TODOLIST_NEXTWEEK, KEYS.PREVIOUS_WEEK
    ], handleStorageWeekLinkResult));
  }
}

function setKeyCache() {
  const week = getISOWeekNumber();
  const today = new Date();
  const dStr = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${today.getFullYear()}`;
  KEYS = {
    DIARY: `${dStr}diary`,
    DIARYCHECKLIST: `${dStr}diaryChecklist`,
    THOUGHT: `${week}thought`,
    TODOLIST: `${week}todo`,
    THIS_WEEK: `${week}folder`,
    TODOLIST_NEXTWEEK: `${week + 1}todo`,
    PREVIOUS_WEEK: `${week - 1}folder`
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
