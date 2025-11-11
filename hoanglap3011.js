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
  hienThiNgayHienTai();
  showPass();
  const clickHandlers = [
    ["btnEnter", togglePasswordInput],
    ["btnVietGiDo", vietGiDo],
    ["btnRecap", recap],
    ["btnToDoListThisWeek", openToDoListThisWeek],
    ["btnToDoListWeekCustom", openToDoListWeekCustom],
    ["btnParkingLot", () => window.open(PARKING_LOT, '_blank')],
    ["btnSavePass", savePass],
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
  // Tạo handler động cho các nút tương ứng với DATA
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
    categorySelect.value = "haiHuoc";
    setQuoteCategory("haiHuoc");
  }

});

function openToDoListWeekCustom(){
  flatpickr("#datepicker", {
    defaultDate: new Date(),
    dateFormat: "d.m.Y",
    locale: "vn",
    position: "below",
    onChange: function (selectedDates, dateStr, instance) {
      openToDoListWeekFromDay(dateStr);
    }
  }).open();

}

function openToDoListThisWeek(){  
  const todayStr = getDDMMYYYYHienTai(); 
  openToDoListWeekFromDay(todayStr);
}

function openToDoListWeekFromDay(dayStr){  
  const { week, weekYear: year } = getInfoWeek(dayStr);
  const keyToDoList = CACHE_TODOLIST_WEEK_PREFIX + week + "." + year;  
  StorageUtil.get([CACHE_TODOLIST], (obj) => {
    const raw = obj[CACHE_TODOLIST];
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
        alert('Lỗi khi parse todolist từ cache', e);
      }
    }    
    fetchLinkToDoListWeek(dayStr, (url) => {
      window.open(url, '_blank');
      StorageUtil.get([CACHE_TODOLIST], (obj) => {
        const raw = obj[CACHE_TODOLIST];
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
        const idx = arr.findIndex(item => item && Object.prototype.hasOwnProperty.call(item, keyToDoList));
        if (idx >= 0) {
          arr[idx] = { [keyToDoList]: url };
        } else {
          arr.push({ [keyToDoList]: url });
        }
        StorageUtil.set({ [CACHE_TODOLIST]: arr }, () => {
        });
      });            
    });
  });
}

function fetchLinkToDoListWeek(dayStr, callback) {
  const pass = document.getElementById("txtPass").value;
  if (!pass || pass.length === 0) {
    togglePasswordInput();
    return;
  }

  LoadingOverlayUtil.show();

  fetch(API, {
    method: 'POST',
    body: JSON.stringify({
      pass: pass,
      action: API_ACTION_GET_TODOLIST_WEEK,
      dayStr: dayStr
    })
  })
    .then(response => {
      if (!response.ok) {
        alert('Lỗi khi gọi API');
        throw new Error("Lỗi khi gọi API");
      }
      return response.json();
    })
    .then(result => {
      const code = result.code;
      if (code !== 1) {
        const errMsg = result.error || 'Có lỗi xảy ra';
        alert('Lỗi: ' + errMsg);
        return;
      }
      const url = result.data;
      if (typeof callback === 'function') {
        callback(url);
      }      
    })
    .catch(err => {
      alert('Lỗi khi gọi API: ' + err);
    }).finally(() => {  
      LoadingOverlayUtil.hide(); // <-- SỬA DÒNG NÀY
    });
}


function addClick(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', handler);
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
    StorageUtil.set({ [CACHE_PASS]: pass }, () => { alert("Saved!"); togglePasswordInput(); });
  }
}





function hienThiNgayHienTai() {
  const today = new Date();
  document.getElementById("current-date").textContent = today.toLocaleDateString('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}




function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function showPass() {
  StorageUtil.get([CACHE_PASS], result => {
    document.getElementById("txtPass").value = result[CACHE_PASS] || "";
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



function vietGiDo(){
  window.open("vietgido.html", '_blank');
}

function recap(){
  window.open("recap.html", '_blank');
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

