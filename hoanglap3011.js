
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
const URL_GET_LINK = "https://script.google.com/macros/s/AKfycbzZoNlP98YZVhHNh7HkO2MT0ToHzIB6wHD92sXD_opDD_RZti3UAJWe2CxZ_Jggje6czg/exec";
const QUICK_URLS = {
  TODOLIST_ALL: "https://docs.google.com/spreadsheets/d/1ODqzKCpG_uZ_3YckZMiXNvhE6xGGulUEy7nICsdAQHo/edit",
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


let quoteArray = [];
let quoteIndex = 0;

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById('versionJS').innerHTML = '10';
  hienThiNgayHienTai();
  setKeyCache();
  showPass();
  // updateQuickLinks();
  updateQuickLinksFromCache();
  const clickHandlers = [
    ["btnEnter", togglePasswordInput],
    ["btnVietGiDo", vietGiDo],
    ["btnSavePass", savePass],
    ["btnToDoListTong", () => window.open(QUICK_URLS.TODOLIST_ALL, '_self')],
    ["btnCalendar", () => window.open(QUICK_URLS.CALENDAR, '_self')],
    ["btnProblem", () => window.open(QUICK_URLS.PROBLEM, '_self')],
    ["btnSodscd", () => window.open(QUICK_URLS.SODSCD, '_self')],
    ["btnTongHopNhatKyNgay", () => window.open(QUICK_URLS.TONGHOPNGAY, '_self')],
    ["btnTongHopNhatKyTuan", () => window.open(QUICK_URLS.TONGHOPTUAN, '_self')],
    ["btnPanel", () => window.open('panel.html', '_bank')],
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
    ["btnPrevQuote", showPrevQuote],
    ["btnNextQuote", showNextQuote],
  ];
  // Tạo handler động cho các nút tương ứng với DATA
  Object.keys(DATA).forEach(type => {
    const id = "btn" + type.charAt(0).toUpperCase() + type.slice(1);
    clickHandlers.push([id, () => openUrl(type)]);
  });
  clickHandlers.forEach(([id, handler]) => addClick(id, handler));


  // Dynamically populate quote category options (no need to import quotes.js here)
  const categories = [
    { id: "cauToan", label: "Cầu Toàn" },
    { id: "baySuyNghi", label: "Bẫy Suy Nghĩ" },
    { id: "loiKyLuat", label: "Lời Kỷ Luật" },
    { id: "trietLy", label: "Triết lý" },
    { id: "haiHuoc", label: "Hài hước" }
  ];
  const categorySelect = document.getElementById("quoteCategory");
  if (categorySelect) {
    categorySelect.innerHTML = "";
    categories.forEach(cat => {
      const option = document.createElement("option");
      option.value = cat.id;
      option.textContent = cat.label;
      categorySelect.appendChild(option);
    });
    categorySelect.addEventListener("change", function () {
      setQuoteCategory(this.value);
    });
    categorySelect.value = "cauToan";
    setQuoteCategory("cauToan");
  }

  // Thêm handler cho select box "To Do List New"
  const selectToDoListNew = document.getElementById("btnToDoListNewSelect");
  if (selectToDoListNew) {
    selectToDoListNew.addEventListener("change", function () {
      // Lấy text của option đã chọn
      const selectedValue = this.options[this.selectedIndex].value;
      let key = "";
      const todayStr = getDDMMYYYYHienTai(); 
      const { week, month, weekYear: year } = getInfoWeek(todayStr);
      this.selectedIndex = 0; // Reset lại về lựa chọn ban đầu (text "✅ To Do List New")
      switch (selectedValue) {
        case "homNay":
          key = "toDoListDay." + todayStr;
          break;
        case "ngayMai":
          key = "toDoListDay." + getDDMMYYYYNgayMai();
          break;
        case "tuanNay":
          key = "toDoListWeek." + week + "." + year;
          break;
        case "tuanSau":
          const dayStrAfter7Day = getDDMMYYYY7NgaySau();
          const { week: nextWeek, weekYear: nextYear } = getInfoWeek(dayStrAfter7Day);
          key = "toDoListWeek." + nextWeek + "." + nextYear;
          break;  
        case "thangNay":
          key = "toDoListMonth." + month + "." + year;
          break;     
        case "thangSau":
          const nextMonthStr = getNextMonthFormatted();
          key = "toDoListMonth." + nextMonthStr;
          break;   
        case "namNay":
          key = "toDoListYear." + year;
          break;   
        case "namSau":
          key = "toDoListYear." + (year + 1);
          break;
        case "ngay":
          return chonNgayToDoList();
        case "tuan":
          return chonNgayToDoList();                                                                                                    
        case "thang":
          return chonNgayToDoList();
        case "nam":
          return chonNgayToDoList();
        case "2weeks":
          return getToDoList2Weeks();            
      }
      openToDoList(key);      
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
      getStorage([keyCache], (obj) => {
        if (obj[keyCache]) {
          urlToOpen = obj[keyCache];
          showChecklistOpenButton();
        } else {
          fetchLinkAndStore(dateStr, "chonNgayDiary", () => getStorage([keyCache], (obj2) => {
            urlToOpen = obj2[keyCache];
            showChecklistOpenButton();
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
      getStorage([keyCache], (obj) => {
        if (obj[keyCache]) {
          urlToOpen = obj[keyCache];
          showChecklistOpenButton();
        } else {
          fetchLinkAndStore(dateStr, "chonNgayChecklist", () => getStorage([keyCache], (obj2) => {
            urlToOpen = obj2[keyCache];
            showChecklistOpenButton();
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
    const dStr = getCurrentDateFormatted();
    fetchLinkAndStore(dStr, type, () => getStorage([DATA[type].keyCache], (obj) => {
      DATA[type].url = obj[DATA[type].keyCache];
      window.open(DATA[type].url, '_self');
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
    togglePasswordInput();
  }
}


function isExtensionEnv() {
  return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
}

function fetchLinkAndStore(dStr, typeInput, callback) {
  const pass = document.getElementById("txtPass").value;
  if (!pass || pass.length === 0) {
    togglePasswordInput();
    return;
  }
  let id;
  let type = typeInput;
  if (type == 'chonNgayDiary') {
    type = 'diary';
    id = "btnDiaryDay";
  } else if (type === 'chonNgayChecklist') {
    type = 'checklist';
    id = "btnChecklistDay";
  } else {
    type = typeInput;
    id = "btn" + type.charAt(0).toUpperCase() + type.slice(1);
  }
  const el = document.getElementById(id);
  let text = el.innerHTML;
  el.innerHTML = '<span class="spinner"></span>';
  el.disabled = true;

  fetch(`${URL_GET_LINK}?key=${pass}&day=${dStr}&type=${type}`)
    .then(r => {
      if (!r.ok) {
        alert("Lỗi khi gọi API");
        throw new Error("Lỗi khi gọi API");
      }
      return r.json();
    })
    .then(data => {
      if (data.error) {
        alert("Lỗi: " + data.error);
        return;
      }
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
    .catch(console.error)
    .finally(() => {
      el.innerHTML = text;
      el.disabled = false;      
    });
    ;
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


function updateQuoteDisplay() {
  const quoteDiv = document.getElementById("daily-quote");
  const btnPrev = document.getElementById("btnPrevQuote");
  const btnNext = document.getElementById("btnNextQuote");

  if (quoteDiv && quoteArray.length > 0) {
    // Thêm hiệu ứng chuyển đổi mượt khi thay đổi nội dung
    quoteDiv.style.transition = "opacity 0.3s";
    quoteDiv.style.opacity = 0;

    setTimeout(() => {
      quoteDiv.textContent = quoteArray[quoteIndex];
      quoteDiv.style.opacity = 1;
    }, 200);

    if (btnPrev) btnPrev.disabled = quoteIndex === 0;
    if (btnNext) btnNext.disabled = quoteIndex === quoteArray.length - 1;
  }
}


function setQuoteCategory(category) {
  switch (category) {
    case "trietLy":
      import('./quoteTrietLy.js').then(module => {
        quoteArray = module.quoteTrietLy;
        quoteIndex = 0;
        shuffleArray(quoteArray);
        updateQuoteDisplay();
      });
      break;
    case "haiHuoc":
      import('./quoteHaiHuoc.js').then(module => {
        quoteArray = module.quoteHaiHuoc;
        quoteIndex = 0;
        shuffleArray(quoteArray);
        updateQuoteDisplay();
      });
      break;
    case "cauToan":
      import('./quoteCauToan.js').then(module => {
        quoteArray = module.quoteCauToan;
        quoteIndex = 0;
        shuffleArray(quoteArray);
        updateQuoteDisplay();
      });
      break;
    case "baySuyNghi":
      import('./quoteBaySuyNghi.js').then(module => {
        quoteArray = module.quoteBaySuyNghi;
        quoteIndex = 0;
        shuffleArray(quoteArray);
        updateQuoteDisplay();
      });
      break;
    case "loiKyLuat":
      import('./quoteLoiKyLuat.js').then(module => {
        quoteArray = module.quoteLoiKyLuat;
        quoteIndex = 0;
        shuffleArray(quoteArray);
        updateQuoteDisplay();
      });
      break;
    default:
      quoteArray = [];
      quoteIndex = 0;
  }
}
function showPrevQuote() {
  const btnPrevQuote = document.getElementById("btnPrevQuote");
  const btnNextQuote = document.getElementById("btnNextQuote");
  if (quoteIndex > 0) {
    quoteIndex--;
    updateQuoteDisplay();
  }
  if (btnPrevQuote) btnPrevQuote.disabled = quoteIndex === 0;
  if (btnNextQuote) btnNextQuote.disabled = quoteIndex === quoteArray.length - 1;
}

function showNextQuote() {
  const btnPrevQuote = document.getElementById("btnPrevQuote");
  const btnNextQuote = document.getElementById("btnNextQuote");
  if (quoteIndex < quoteArray.length - 1) {
    quoteIndex++;
    updateQuoteDisplay();
  }
  if (btnPrevQuote) btnPrevQuote.disabled = quoteIndex === 0;
  if (btnNextQuote) btnNextQuote.disabled = quoteIndex === quoteArray.length - 1;
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



function getCurrentDateFormatted() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0'); // tháng bắt đầu từ 0
  const year = today.getFullYear();
  return `${day}.${month}.${year}`;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
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
    <a href="${urlToOpen}" target="_blank" style="display:inline-block; padding:10px 20px; background:#007bff; color:white; text-decoration:none; border-radius:5px;">👉 Mở tài liệu</a><br><br>
    <button id="btnClosePopupChecklist" style="margin-top:10px;">Đóng</button>
  `;

  document.body.appendChild(popup);

  document.getElementById("btnClosePopupChecklist").addEventListener("click", () => {
    popup.remove();
  });
}

function vietGiDo(){
  window.open("vietgido.html", '_blank');
}

function getInfoWeek(dateStr) {
    const date = parseDate(dateStr);

    // 0 = Monday
    const dayOfWeek = (date.getDay() + 6) % 7;

    // Monday và Sunday
    const monday = new Date(date);
    monday.setDate(date.getDate() - dayOfWeek);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // Tính tuần theo ISO 8601
    const thursday = new Date(monday);
    thursday.setDate(monday.getDate() + 3);
    const weekYear = thursday.getFullYear();

    const firstThursday = new Date(weekYear, 0, 4);
    const firstThursdayDay = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - firstThursdayDay + 3);

    const diffInDays = (monday - firstThursday) / (1000 * 60 * 60 * 24);
    const weekNumber = 1 + Math.round(diffInDays / 7);

    // Tạo mảng các ngày trong tuần theo định dạng dd.MM.yyyy
    const daysOfWeek = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        daysOfWeek.push(formatDate(d));
    }

    return {
        week: weekNumber,
        month: String(sunday.getMonth() + 1).padStart(2, '0'),
        startOfWeek: formatDate(monday),
        endOfWeek: formatDate(sunday),
        weekYear,
        daysOfWeek
    };
}

function formatDate(d) {
    return [
        String(d.getDate()).padStart(2, '0'),
        String(d.getMonth() + 1).padStart(2, '0'),
        d.getFullYear()
    ].join('.');
}

function parseDate(dateStr) {
    const [day, month, year] = dateStr.split('.').map(Number);
    return new Date(year, month - 1, day);
}

function getDDMMYYYYHienTai() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0'); 
  const year = today.getFullYear();
  return `${day}.${month}.${year}`;
}

function getDDMMYYYY7NgaySau() {
  const today = new Date();
  const futureDate = new Date(today);
  
  // Cộng thêm 7 ngày
  futureDate.setDate(futureDate.getDate() + 7);
  
  // Lấy ngày, tháng, năm
  const day = String(futureDate.getDate()).padStart(2, '0');
  const month = String(futureDate.getMonth() + 1).padStart(2, '0'); // Tháng bắt đầu từ 0
  const year = futureDate.getFullYear();
  
  return `${day}.${month}.${year}`;
}

function getDDMMYYYYNgayMai() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1); // Cộng thêm 1 ngày
  const day = String(tomorrow.getDate()).padStart(2, '0');
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0'); 
  const year = tomorrow.getFullYear();
  return `${day}.${month}.${year}`;
}

function getNextMonthFormatted() {
  const today = new Date();
  const nextMonth = new Date(today);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const month = String(nextMonth.getMonth() + 1).padStart(2, '0');
  const year = nextMonth.getFullYear();
  return `${month}.${year}`;
}

function chonNgayToDoList() {
  flatpickr("#datepicker", {
    defaultDate: new Date(),
    dateFormat: "d.m.Y",
    locale: "vn",
    position: "below",
    onChange: function (selectedDates, dateStr, instance) {
      const key = "toDoListDay." + dateStr
      openToDoList(key);
    }
  }).open();
}

function openToDoList(keyToDoList){
  // First try to read the cached aggregated "todolist"
  getStorage(['todolist'], (obj) => {
    const raw = obj['todolist'];
    if (raw) {
      try {
        const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(arr)) {
          const foundObj = arr.find(item => item && Object.prototype.hasOwnProperty.call(item, keyToDoList));
          if (foundObj) {
            urlToOpen = foundObj[keyToDoList];
            if (urlToOpen) {
              window.open(urlToOpen, '_blank');
              return;
            }
          }
        }
      } catch (e) {
        console.error('Lỗi khi parse todolist từ cache', e);
        // fallthrough to fetching from server
      }
    }

    // If we reach here, either there is no "todolist" in cache or we didn't find the key
    // Call fetchLinkToDoListAndStore which will merge the retrieved url into 'todolist'
    fetchLinkToDoListAndStore(keyToDoList, () => {
      // After fetch/merge, read 'todolist' and try to find the key again
      getStorage(['todolist'], (obj2) => {
        const raw2 = obj2['todolist'];
        if (raw2) {
          try {
            const arr2 = typeof raw2 === 'string' ? JSON.parse(raw2) : raw2;
            if (Array.isArray(arr2)) {
              const foundObj2 = arr2.find(item => item && Object.prototype.hasOwnProperty.call(item, keyToDoList));
              if (foundObj2) {
                urlToOpen = foundObj2[keyToDoList];
                if (urlToOpen) window.open(urlToOpen, '_blank');
                return;
              }
            }
          } catch (e) {
            console.error('Lỗi khi parse todolist sau khi fetch', e);
          }
        }
        // If still not found, optionally alert
        alert('Không tìm thấy đường link trong todolist sau khi gọi API');
      });
    });
  });
}

function fetchLinkToDoListAndStore(toDoListName, callback) {
  const pass = document.getElementById("txtPass").value;
  if (!pass || pass.length === 0) {
    togglePasswordInput();
    return;
  }

  const el = document.getElementById('btnToDoListNewSelect');
  let text = el.options[0].innerHTML;
  el.options[0].innerHTML = 'Đang tải... ⏳';
  el.disabled = true;  

  // POST request with JSON body
  fetch(URL_GET_LINK, {
    method: 'POST',
    body: JSON.stringify({
      pass: pass,
      action: 'getCustomToDoList',
      toDoListName: toDoListName
    })
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Lỗi khi gọi API');
      }
      return response.json();
    })
    .then(result => {
      const code = result.code;
      if (code === -1) {
        // Error from server
        const errMsg = result.error || 'Có lỗi xảy ra';
        alert('Lỗi: ' + errMsg);
        return;
      }

      // Success path
      // The URL is returned directly in result.data (per request)
      const url = result.data;

      if (url) {
        // Merge into aggregated 'todolist' cache (no longer saving individual key)
        try {
          getStorage(['todolist'], (obj) => {
            const raw = obj['todolist'];
            let arr = [];
            if (raw) {
              try {
                arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (!Array.isArray(arr)) arr = [];
              } catch (e) {
                console.error('Không parse được todolist hiện có, sẽ ghi đè mới', e);
                arr = [];
              }
            }

            const idx = arr.findIndex(item => item && Object.prototype.hasOwnProperty.call(item, toDoListName));
            if (idx >= 0) {
              // replace existing entry
              arr[idx] = { [toDoListName]: url };
            } else {
              // append new entry
              arr.push({ [toDoListName]: url });
            }

            // Save the merged todolist as JSON string
            setStorage({ ['todolist']: JSON.stringify(arr) }, () => {
              if (typeof callback === 'function') callback();
            });
          });
        } catch (e) {
          console.error('Lỗi khi merge todolist', e);
          // still call callback so caller can proceed
          if (typeof callback === 'function') callback();
        }
      } else {
        alert('Không tìm thấy trường url trong dữ liệu trả về');
      }
    })
    .catch(err => {
      console.error(err);
      alert('Lỗi khi gọi API');
    }).finally(() => {
      el.options[0].innerHTML = text;
      el.disabled = false;      
    });
}

function getToDoList2Weeks() {
  const pass = document.getElementById("txtPass").value;
  if (!pass || pass.length === 0) {
    togglePasswordInput();
    return;
  }

  const el = document.getElementById('btnToDoListNewSelect');
  let text = el.options[0].innerHTML;
  el.options[0].innerHTML = 'Đang tải... ⏳';
  el.disabled = true;    

  fetch(URL_GET_LINK, {
    method: 'POST',
    body: JSON.stringify({
      pass: pass,
      action: 'getListToDoList',
    })
  })
    .then(response => {
      if (!response.ok) throw new Error('Lỗi khi gọi API');
      return response.json();
    })
    .then(result => {
      // If server returned an error code, show it
      if (result && result.code === -1) {
        const errMsg = result.error || 'Có lỗi xảy ra';
        alert('Lỗi: ' + errMsg);
        return;
      }

      // Prefer result.data when available; otherwise, fallback to result itself
      const dataArray = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);

      // Transform from [{code: 'key', url: '...'}, ...]
      // into [{ 'key': '...'}, ...]
      const transformed = dataArray.map(item => {
        const code = item && (item.code || item.key);
        const url = item && (item.url || item.value || item.data);
        return code ? { [code]: url || '' } : null;
      }).filter(Boolean);

      // Store as JSON string so it can be parsed when reading from cache
      setStorage({ ['todolist']: JSON.stringify(transformed) });
    })
    .catch(err => {
      console.error(err);
      alert('Lỗi khi gọi API ' + err);
    })
    .finally(() => {
      el.options[0].innerHTML = text;
      el.disabled = false;      
    })
    ;
}