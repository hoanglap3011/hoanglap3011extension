
import { quoteTrietLy, quoteHaiHuoc } from './quotes.js';

const DATA = {
  diary: { keyCache: null, url: "" },
  checklist: { keyCache: null, url: "" },
  note: { keyCache: null, url: "" },
  toDoList: { keyCache: null, url: "" },
  thisWeek: { keyCache: null, url: "" },
  toDoListNextWeek: { keyCache: null, url: "" },
  previousWeek: { keyCache: null, url: "" }
};

let urlToOpen = "";

const KEY_PASS = "key";
const URL_GET_LINK = "https://script.google.com/macros/s/AKfycbw12YIV-Xr53lFPMbb2at7CP50jOHiCkPWA8ZMqbvbSti93BQZVOrJNzKNNisdPoIwWvw/exec";
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
  document.getElementById('versionJS').innerHTML = '9';
  hienThiNgayHienTai();
  setKeyCache();
  showPass();
  // updateQuickLinks();
  updateQuickLinksFromCache();
  loadQuoteIndex();
  const clickHandlers = [
    ["btnPrevQuote", () => shiftQuote(-1)],
    ["btnNextQuote", () => shiftQuote(1)],
    ["btnEnter", togglePasswordInput],
    ["btnSavePass", savePass],
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
    ["btnDiaryDay", chonNgayDiary],
    ["btnChecklistDay", chonNgayChecklist],
  ];
  // Tạo handler động cho các nút tương ứng với DATA
  Object.keys(DATA).forEach(type => {
    const id = "btn" + type.charAt(0).toUpperCase() + type.slice(1);
    clickHandlers.push([id, () => openUrl(type)]);
  });
  clickHandlers.forEach(([id, handler]) => addClick(id, handler));

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

function chonNgayDiary() {
  flatpickr("#datepicker", {
    defaultDate: new Date(),
    dateFormat: "d.m.Y",
    locale: "vn",
    position: "below",
    onChange: function (selectedDates, dateStr, instance) {
      const keyCache = "diary." + dateStr;
      const el = document.getElementById("btnDiaryDay");
      let text = el.innerHTML;
      el.innerHTML = '<span class="spinner"></span>';
      el.disabled = true;
      getStorage([keyCache], (obj) => {
        if (obj[keyCache]) {
          urlToOpen = obj[keyCache];
          showChecklistOpenButton();
          el.innerHTML = text;
          el.disabled = false;
        } else {
          fetchLinkAndStore(dateStr, "diary", () => getStorage([keyCache], (obj2) => {
            urlToOpen = obj2[keyCache];
            showChecklistOpenButton();
            el.innerHTML = text;
            el.disabled = false;
          }));
        }
      });
    }
  }).open();
}

function chonNgayChecklist() {
  flatpickr("#datepicker", {
    defaultDate: new Date(),
    dateFormat: "d.m.Y",
    locale: "vn",
    position: "below",
    onChange: function (selectedDates, dateStr, instance) {
      const keyCache = "checklist." + dateStr;
      const el = document.getElementById("btnChecklistDay");
      let text = el.innerHTML;
      el.innerHTML = '<span class="spinner"></span>';
      el.disabled = true;
      getStorage([keyCache], (obj) => {
        if (obj[keyCache]) {
          urlToOpen = obj[keyCache];
          showChecklistOpenButton();
          el.innerHTML = text;
          el.disabled = false;
        } else {
          fetchLinkAndStore(dateStr, "checklist", () => getStorage([keyCache], (obj2) => {
            urlToOpen = obj2[keyCache];
            showChecklistOpenButton();
            el.innerHTML = text;
            el.disabled = false;
          }));
        }
      });
    }
  }).open();
}


function openUrl(type) {
  if (DATA[type].url) {
    window.open(DATA[type].url, '_self');
  } else {
    const id = "btn" + type.charAt(0).toUpperCase() + type.slice(1);
    const el = document.getElementById(id);
    let text = el.innerHTML;
    el.innerHTML = '<span class="spinner"></span>';
    el.disabled = true;
    const dStr = getCurrentDateFormatted();
    fetchLinkAndStore(dStr, type, () => getStorage([DATA[type].keyCache], (obj) => {
      DATA[type].url = obj[DATA[type].keyCache];
      window.open(DATA[type].url, '_self');
      el.innerHTML = text;
      el.disabled = false;
    }));
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

function fetchLinkAndStore(dStr, type, callback) {
  const pass = document.getElementById("txtPass").value;
  fetch(`${URL_GET_LINK}?key=${pass}&day=${dStr}&type=${type}`)
    .then(r => r.ok ? r.json() : Promise.reject("Lỗi khi gọi API"))
    .then(data => {
      const url = data[type];
      let keyCache;
      if (type === 'diary' || type === 'checklist') {
        keyCache = `${type}.${dStr}`;
      } else {
        const infoWeek = getInfoWeek(dStr);
        const week = infoWeek.week;
        keyCache = `${type}.week.${week}`;
      }
      setStorage({ [keyCache]: url }, callback);
    })
    .catch(console.error);
}


function hienThiNgayHienTai() {
  const today = new Date();
  document.getElementById("current-date").textContent = today.toLocaleDateString('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}


function updateQuickLinksFromCache() {
  const keys = Object.values(DATA).map(item => item.keyCache);
  getStorage(keys, (result) => {
    Object.entries(result).forEach(([key, url]) => {
      const type = key.split('.')[0]; // lấy phần trước dấu chấm
      if (DATA[type]) {
        DATA[type].url = url;
      }
    });
  });
}


function setKeyCache() {
  const dStr = getCurrentDateFormatted();
  const infoWeek = getInfoWeek(dStr);
  const week = infoWeek.week;
  Object.keys(DATA).forEach(key => {
    if (key === 'diary' || key === 'checklist') {
      DATA[key].keyCache = `${key}.${dStr}`;
    } else {
      DATA[key].keyCache = `${key}.week.${week}`;
    }
  });
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


function getInfoWeek(dateStr) {
    const [day, month, year] = dateStr.split('.').map(Number);
    const inputDate = new Date(year, month - 1, day);
    const dayOfWeek = (inputDate.getDay() + 6) % 7; // 0 = Monday
    const monday = new Date(inputDate);
    monday.setDate(inputDate.getDate() - dayOfWeek);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const tempDate = new Date(monday);
    tempDate.setDate(tempDate.getDate() + 3); // Thursday
    const weekYear = tempDate.getFullYear();
    const firstThursday = new Date(weekYear, 0, 4);
    const firstThursdayDay = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - firstThursdayDay + 3);
    const diffInDays = (monday - firstThursday) / (1000 * 60 * 60 * 24);
    const weekNumber = 1 + Math.round(diffInDays / 7);
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

function showChecklistOpenButton() {
  // Nếu popup đã tồn tại thì không tạo nữa
  if (document.getElementById("popupChecklistLink")) return;

  const popup = document.createElement("div");
  popup.id = "popupChecklistLink";
  popup.style.position = "fixed";
  popup.style.top = "50%";
  popup.style.left = "50%";
  popup.style.transform = "translate(-50%, -50%)";
  popup.style.backgroundColor = "white";
  popup.style.padding = "20px";
  popup.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";
  popup.style.zIndex = "10000";
  popup.style.textAlign = "center";
  popup.style.borderRadius = "8px";

  popup.innerHTML = `
    <p style="margin-bottom: 1em;">✅ Tài liệu đã sẵn sàng</p>
    <a href="${urlToOpen}" target="_blank" style="display:inline-block; padding:10px 20px; background:#007bff; color:white; text-decoration:none; border-radius:5px;">👉 Mở tài liệu Checklist</a><br><br>
    <button id="btnClosePopupChecklist" style="margin-top:10px;">Đóng</button>
  `;

  document.body.appendChild(popup);

  document.getElementById("btnClosePopupChecklist").addEventListener("click", () => {
    popup.remove();
  });
}