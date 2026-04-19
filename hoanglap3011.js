// Import các hàm xử lý ngày tháng từ dateUtil.js
// <script src="dateUtil.js"></script>
// Hoặc nếu dùng ES module: import { getDDMMYYYYHienTai, formatDate, parseDate, getInfoWeek, hienThiNgayHienTai } from './dateUtil.js';

let urlToOpen = "";

let hitThoIndex = 0;
let nhacVuiIndex = 0;

let quoteArray = [];
let quoteIndex = 0;


document.addEventListener("DOMContentLoaded", function () {
  LoadingOverlayUtil.init({
      getStorageFunc: StorageUtil.get,
      cacheQuotesKey: CACHE_QUOTES 
  });
  document.getElementById('versionJS').innerHTML = '10';
  DateUtil.hienThiNgayHienTai();
  const clickHandlers = [
    ["btnHabit", openHabit],
    ["btnEnter", PasswordUtil.openPasswordPopup],
    ["btnVietGiDo", vietGiDo],
    ["btnIntentTime", openIntentTime],
    ["btnRecap", recap],
    ["btnToDoListThisWeek", openToDoListThisWeek],
    ["btnToDoListWeekCustom", openToDoListWeekCustom],
    ["btnParkingLot", () => window.open(PARKING_LOT, '_blank')],
    ["btnToDoListTong", () => window.open(TODOLIST_ALL, '_self')],
    ["btnCalendar", () => window.open(CALENDAR, '_self')],
    ["btnProblem", () => window.open(PROBLEM, '_self')],
    ["btnSodscd", () => window.open(SODSCD, '_self')],
    ["btnTongHopNhatKyNgay", () => window.open(TONGHOPNGAY, '_self')],
    ["btnTongHopNhatKyTuan", () => window.open(TONGHOPTUAN, '_self')],
    ["btnPanel", () => window.open('panel.html', '_bank')],
    ["btnHitTho", playHitTho],
    ["btnNhacHocTap", playNhacVui],
    ["btnThienVipassana", () => window.open(VIPASSANA, '_self')],
    ["btnThienMetta", () => window.open(METTA, '_self')],
    ["btnLuyenTiengAnh", () => window.open(ENGLISH, '_self')],
    ["btnNhacTichCuc", () => window.open(NHACTICHCUCDONGLUC, '_self')],
    ["btnTinTongHop", () => window.open(TINTONGHOP, '_self')],
    ["btnTinTichCuc", () => window.open(TINTICHCUC, '_self')],
    ["btnMoNhieuAi", () => window.open(MONHIEUAI, '_self')],
    ["btnLichThiDauBongDa", () => window.open(LICHTHIDAU, '_self')],
    ["btnGuitarEdumall", () => window.open(GUITAR_EDUMALL, '_self')],
    ["btnGymMusic", () => window.open(GYM_MUSIC, '_self')],
    ["btnNoteVeGiaDinh", () => window.open(NOTE_GIADINH, '_self')],
    ["btnTinTucThanhPodcast", () => window.open("", '_self')],
    ["btnPlaylistCuoi", () => window.open(LAUGHT, '_self')],
    ["btnPlaylistSauSac", () => window.open(DEEP, '_self')],
    ["btnDocSachKindle", () => window.open(KINDLE, '_self')],
    ["btnRanh", () => window.open(RANH, '_self')],
    ["btnMuctieu", () => window.open(GOAL, '_self')],
    ["btnPrevQuote", showPrevQuote],
    ["btnNextQuote", showNextQuote],
  ];
  clickHandlers.forEach(([id, handler]) => addClick(id, handler));

  // Dynamically populate quote category options
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
    categorySelect.value = "haiHuoc";
    setQuoteCategory("haiHuoc");
  }

});

function openToDoListWeekCustom(event) {
  const currentTarget = event.currentTarget;
  DatePickerUtil.pickDate(currentTarget, (selectedDate) => {
    const dateStr = DateUtil.formatDate(selectedDate);
    TodolistUtil.openToDoListWeekFromDay(dateStr);
  });
}

function openToDoListThisWeek() {
  const todayStr = DateUtil.getDDMMYYYYHienTai();
  TodolistUtil.openToDoListWeekFromDay(todayStr);
}


function addClick(id, handler) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('click', (e) => handler(e));
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

function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function updateQuoteDisplay() {
  const quoteDiv = document.getElementById("daily-quote");
  const btnPrev = document.getElementById("btnPrevQuote");
  const btnNext = document.getElementById("btnNextQuote");

  if (quoteDiv && quoteArray.length > 0) {
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

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function vietGiDo() {
  window.open("vietgido.html", '_blank');
}

function openIntentTime() {
  window.open("intent-time.html", '_blank');
}

function openHabit() {
  window.open("habit.html", '_blank');
}

function recap() {
  window.open("recap.html", '_blank');
}