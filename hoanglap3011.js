
// Import các danh ngôn triết lý và hài hước
import { quoteTrietLy , quoteHaiHuoc } from './quotes.js';


// Các text hiển thị cho các nút chức năng chính
const TEXT_DIARY = "🖊️ Nhật ký";
const TEXT_DIARY_CHECKLIST = "✅ Checklist";
const TEXT_THOUGHT = "💭 Viết ra";
const TEXT_TODOLIST = "✔️ To Do List";
const TEXT_THIS_WEEK = "📒 This week";
const TEXT_TODOLIST_NEXTWEEK = "✔️ To Do List Next week";
const TEXT_PREVIOUS_WEEK = "📘 Previous week";

let KEY_DIARY;
let KEY_DIARYCHECKLIST;
let KEY_THOUGHT;
let KEY_TODOLIST;
let KEY_THIS_WEEK;
let KEY_TODOLIST_NEXTWEEK;
let KEY_PREVIOUS_WEEK;

let URL_DIARY = "";
let URL_CHECKLIST = "";
let URL_THOUGHT = "";
let URL_TODOLIST = "";
let URL_THIS_WEEK = "";
let URL_TODOLIST_NEXTWEEK = "";
let URL_PREVIOUS_WEEK = "";

const KEY_PASS = "pass";
const URL_GET_DAY_LINK = "https://script.google.com/macros/s/AKfycbyaOZZDckZlMMMWMlchO0Vb5E04bPTaDGLAC5HEQdc9uJEwmQYq7_O_qW13BJMs-whqFQ/exec";
const URL_GET_WEEK_LINK = "https://script.google.com/macros/s/AKfycbzzDGFPCjS3PZB40vO6NJ3jbSHaIzuhCB64tglm_krc2e5nA10zMigOP8LTtWw9gpEksg/exec";

const URL_CALENDAR = "https://calendar.google.com/";
const URL_PROBLEM = "https://docs.google.com/spreadsheets/d/1Ww9sdbQScZdNysDOvD8_1zCqxsi3r-K6FqIKLLoXSho/edit?gid=0#gid=0";
const URL_SODSCD = "https://docs.google.com/document/d/12oVFyqe-yWjuwTW2YN74WPQl6N9xOcaR8KONvH81Ksg/edit?tab=t.0";
const URL_TONGHOPTUAN = "";
const URL_TONGHOPNGAY = "";
const URL_NHACHOCTAP = "https://music.youtube.com/playlist?list=PLpl9CTbHHB9USqW2dcpaRsXaxbykPaIeg&si=vCiN_9xfrNvY6Pvo";
const URL_POMODORO = "https://pomodorotimer.online/";
const URL_HITTHO = "https://www.youtube.com/watch?v=QhIxGtxIFF4&list=PLpl9CTbHHB9W879FlKDxuke-rmCiRvCSW";
const URL_VIPASSANA = "https://www.youtube.com/watch?v=PmuFF36uIxk&list=PLpl9CTbHHB9VnSnZ5yNLFBuDMp1g-P1Ti&index=8";
const URL_METTA = "https://www.youtube.com/watch?v=8Unx4chbLl0&list=PLpl9CTbHHB9VnSnZ5yNLFBuDMp1g-P1Ti&index=1";
const URL_ENGLISH = "";
const URL_NHACTICHCUCDONGLUC = "https://music.youtube.com/playlist?list=PLpl9CTbHHB9Wy7WRZ8-28U0hcLATWA4OX";
const URL_TINTONGHOP = "https://vnexpress.net/doi-song";
const URL_TINTICHCUC = "https://baomoi.com/nang-luong-tich-cuc-top338.epi";
const URL_MONHIEUAI = "";
const URL_LICHTHIDAU = "https://www.24h.com.vn/bong-da/lich-thi-dau-bong-da-hom-nay-moi-nhat-c48a364371.html";
const URL_GUITAR_EDUMALL = "https://www.edumall.vn/vn/course-player/hoc-guitar-dem-hat-cap-toc-trong-30-ngay";
const URL_GYM_MUSIC = "https://music.youtube.com/playlist?list=PLpl9CTbHHB9WU4r1ptkQzWjKQ8g_ijIFa";
const URL_NOTE_GIADINH = "https://docs.google.com/document/d/1Yn04JziVUUTyqUVNqKfKOeEBCDlulV9R1jJPITNpdEA/edit?tab=t.0#heading=h.eejeurvh6dwa";
const URL_LAUGHT = "https://www.youtube.com/watch?v=e5e8RScN_dg&list=PLpl9CTbHHB9X2uQvoUN3Iwwo_QbKolgvM";
const URL_DEEP = "https://www.youtube.com/watch?v=qX900P6POEU&list=PLpl9CTbHHB9UXfVctUpy4NzvNhsQ7s7dX";
const URL_KINDLE = "kindle://";
const URL_RANH = "https://docs.google.com/document/d/1ak5a0MpUnUpGpb42m_PFRkKtyvcsF1AohZJJ9dtqTUw/edit?usp=drivesdk";
const URL_GOAL = "https://docs.google.com/spreadsheets/d/16IRD2vS0BO0UpRRkJHyVVXlBNqmw1qFd6n5G-0WvnkA/edit?gid=0#gid=0";

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


/**
 * Khởi tạo giao diện và đăng ký các sự kiện cho các nút chức năng chính
 * Bao gồm: hiển thị ngày, quote, các nút truy cập nhanh, lưu pass, v.v.
 */
document.addEventListener("DOMContentLoaded", function () {
  hienThiNgayHienTai();
  getKeyCache();
  showPass();
  capNhatURL();
  loadQuoteIndex();

  // Đăng ký sự kiện chuyển quote
  addClick("btnPrevQuote", () => shiftQuote(-1));
  addClick("btnNextQuote", () => shiftQuote(1));

  // Đăng ký sự kiện chọn loại quote
  const categorySelect = document.getElementById("quoteCategory");
  if (categorySelect) {
    categorySelect.addEventListener("change", function () {
      setQuoteCategory(this.value);
    });
  }

  // Đăng ký sự kiện hiển thị/ẩn ô nhập pass
  addClick("btnEnter", function () {
    const divPassword = document.getElementById('divPassword');
    divPassword.style.display = (divPassword.style.display === 'none') ? 'block' : 'none';
    if (divPassword.style.display === 'block') showPass();
  });


  // Lưu mật khẩu vào storage
  addClick("btnSavePass", function () {
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
  });


  // Đăng ký sự kiện cho các nút truy cập nhanh (Diary, Checklist, Thought, ToDo, v.v.)
  addClick("btnDiary", () => window.open(URL_DIARY, '_self'));
  addClick("btnDiaryChecklist", () => window.open(URL_CHECKLIST, '_self'));
  addClick("btnThought", function () {
    if (isMobile()) {
      window.open(URL_THOUGHT, '_self');
    } else {
      const iframe = document.getElementById("iframeThought");
      iframe.src = URL_THOUGHT;
      const iframeContainer = document.getElementById('divIframeThought');
      iframeContainer.style.display = (iframeContainer.style.display === 'none') ? 'block' : 'none';
    }
  });
  addClick("btnToDoList", () => window.open(URL_TODOLIST, '_self'));
  addClick("btnThisWeek", () => window.open(URL_THIS_WEEK, '_self'));
  addClick("btnPreviousWeek", () => window.open(URL_PREVIOUS_WEEK, '_self'));
  addClick("btnToDoListNextWeek", () => window.open(URL_TODOLIST_NEXTWEEK, '_self'));


  // Đăng ký sự kiện cho các nút truy cập nhanh khác (Calendar, Problem, v.v.)
  addClick("btnCalendar", () => window.open(URL_CALENDAR, '_self'));
  addClick("btnProblem", () => window.open(URL_PROBLEM, '_self'));
  addClick("btnSodscd", () => window.open(URL_SODSCD, '_self'));
  addClick("btnTongHopNhatKyNgay", () => window.open(URL_TONGHOPNGAY, '_self'));
  addClick("btnTongHopNhatKyTuan", () => window.open(URL_TONGHOPTUAN, '_self'));


  // Đăng ký sự kiện cho các nút nhạc, pomodoro, youtube, v.v.
  addClick("btnPomodoro", function () {
    if (isMobile()) {
      window.open(URL_POMODORO, '_self');
    } else {
      const iframeContainer = document.getElementById('divIframePomodoro');
      iframeContainer.style.display = (iframeContainer.style.display === 'none') ? 'block' : 'none';
    }
  });
  addClick("btnHitTho", function () {
    const iframeContainer = document.getElementById('divIframeYoutube');
    if (iframeContainer.style.display === 'none') {
      iframeContainer.style.display = 'block';
    }
    const iframe = document.getElementById("iframeYoutube");
    if (iframe) {
      iframe.src = HIT_THO_URLS[hitThoIndex];
      hitThoIndex = (hitThoIndex + 1) % HIT_THO_URLS.length;
    }
  });
  addClick("btnNhacHocTap", function () {
    const iframeContainer = document.getElementById('divIframeYoutube');
    if (iframeContainer.style.display === 'none') {
      iframeContainer.style.display = 'block';
    }
    const iframe = document.getElementById("iframeYoutube");
    if (iframe) {
      iframe.src = NHAC_VUI_URLS[nhacVuiIndex];
      nhacVuiIndex = (nhacVuiIndex + 1) % NHAC_VUI_URLS.length;
    }
  });
  addClick("btnThienVipassana", () => window.open(URL_VIPASSANA, '_self'));
  addClick("btnThienMetta", () => window.open(URL_METTA, '_self'));
  addClick("btnLuyenTiengAnh", () => window.open(URL_ENGLISH, '_self'));
  addClick("btnNhacTichCuc", () => window.open(URL_NHACTICHCUCDONGLUC, '_self'));
  addClick("btnTinTongHop", () => window.open(URL_TINTONGHOP, '_self'));
  addClick("btnTinTichCuc", () => window.open(URL_TINTICHCUC, '_self'));
  addClick("btnMoNhieuAi", () => window.open(URL_MONHIEUAI, '_self'));
  addClick("btnLichThiDauBongDa", () => window.open(URL_LICHTHIDAU, '_self'));
  addClick("btnGuitarEdumall", () => window.open(URL_GUITAR_EDUMALL, '_self'));
  addClick("btnGymMusic", () => window.open(URL_GYM_MUSIC, '_self'));
  addClick("btnNoteVeGiaDinh", () => window.open(URL_NOTE_GIADINH, '_self'));
  addClick("btnTinTucThanhPodcast", () => window.open("", '_self'));
  addClick("btnPlaylistCuoi", () => window.open(URL_LAUGHT, '_self'));
  addClick("btnPlaylistSauSac", () => window.open(URL_DEEP, '_self'));
  addClick("btnDocSachKindle", () => window.open(URL_KINDLE, '_self'));
  addClick("btnRanh", () => window.open(URL_RANH, '_self'));
  addClick("btnMuctieu", () => window.open(URL_GOAL, '_self'));
});

/**
 * Hàm tiện ích: Đăng ký sự kiện click cho phần tử theo id
 * @param {string} id - id của phần tử
 * @param {Function} handler - hàm xử lý khi click
 */
function addClick(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', handler);
}


/**
 * Kiểm tra môi trường đang chạy là extension hay web thông thường
 * @returns {boolean}
 */
function isExtensionEnv() {
  return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
}


/**
 * Tính số tuần hiện tại trong năm theo chuẩn ISO
 * @returns {number} Số tuần ISO
 */
function getISOWeekNumber() {
  var date = new Date();
  var target = new Date(date.valueOf());
  target.setDate(target.getDate() + 3 - (target.getDay() + 6) % 7);
  var firstThursday = new Date(target.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - (firstThursday.getDay() + 6) % 7);
  var weekNumber = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return weekNumber;
}



function fetchDayLinkAndStore(callback) {
  const pass = document.getElementById("txtPass").value;
  fetch(URL_GET_DAY_LINK + "?password=" + pass)
    .then(response => {
      if (!response.ok) throw new Error("Lỗi khi gọi API");
      return response.json();
    })
    .then(json => {
      const { diary, diaryChecklist } = json;
      if (isExtensionEnv()) {
        chrome.storage.local.set({
          [KEY_DIARY]: diary.trim(),
          [KEY_DIARYCHECKLIST]: diaryChecklist.trim(),
        }, () => {
          if (typeof callback === 'function') callback();
        });
      } else {
        localStorage.setItem(KEY_DIARY, diary.trim());
        localStorage.setItem(KEY_DIARYCHECKLIST, diaryChecklist.trim());
        if (typeof callback === 'function') callback();
      }
    })
    .catch(error => {
      console.error("Lỗi khi gọi API và lưu cache:", error);
    });
}

function fetchWeekLinkAndStore(callback) {
  const pass = document.getElementById("txtPass").value;
  fetch(URL_GET_WEEK_LINK + "?password=" + pass)
    .then(response => {
      if (!response.ok) throw new Error("Lỗi khi gọi API");
      return response.json();
    })
    .then(json => {
      const { thought, toDoList, thisWeek, toDoListNextWeek, previousWeek } = json;
      if (isExtensionEnv()) {
        chrome.storage.local.set({
          [KEY_THOUGHT]: thought.trim(),
          [KEY_TODOLIST]: toDoList.trim(),
          [KEY_THIS_WEEK]: thisWeek.trim(),
          [KEY_TODOLIST_NEXTWEEK]: toDoListNextWeek.trim(),
          [KEY_PREVIOUS_WEEK]: previousWeek.trim(),
        }, () => {
          if (typeof callback === 'function') callback();
        });
      } else {
        localStorage.setItem(KEY_THOUGHT, thought.trim());
        localStorage.setItem(KEY_TODOLIST, toDoList.trim());
        localStorage.setItem(KEY_THIS_WEEK, thisWeek.trim());
        localStorage.setItem(KEY_TODOLIST_NEXTWEEK, toDoListNextWeek.trim());
        localStorage.setItem(KEY_PREVIOUS_WEEK, previousWeek.trim());
        if (typeof callback === 'function') callback();
      }
    })
    .catch(error => {
      console.error("Lỗi khi gọi API và lưu cache:", error);
    });
}

/**
 * Hiển thị ngày hiện tại lên giao diện
 */
function hienThiNgayHienTai() {
  const today = new Date();
  const formattedDate = today.toLocaleDateString('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  document.getElementById("current-date").textContent = formattedDate;
}


/**
 * Cập nhật URL cho các nút truy cập nhanh, hiển thị loading khi đang lấy dữ liệu
 */
function capNhatURL() {
  const diaryElement = document.getElementById("btnDiary");
  const diaryChecklistElement = document.getElementById("btnDiaryChecklist");
  const thoughtElement = document.getElementById("btnThought");
  const toDoListElement = document.getElementById("btnToDoList");
  const thisWeekElement = document.getElementById("btnThisWeek");
  const toDoListNextWeekElement = document.getElementById("btnToDoListNextWeek");
  const previousWeekElement = document.getElementById("btnPreviousWeek");

  diaryElement.innerHTML = '<span class="spinner"></span>';
  diaryChecklistElement.innerHTML = '<span class="spinner"></span>';
  thoughtElement.innerHTML = '<span class="spinner"></span>';
  toDoListElement.innerHTML = '<span class="spinner"></span>';
  thisWeekElement.innerHTML = '<span class="spinner"></span>';
  toDoListNextWeekElement.innerHTML = '<span class="spinner"></span>';
  previousWeekElement.innerHTML = '<span class="spinner"></span>';

  if (isExtensionEnv()) {
    chrome.storage.local.get([KEY_DIARY, KEY_DIARYCHECKLIST, KEY_THOUGHT, KEY_TODOLIST, KEY_THIS_WEEK, KEY_TODOLIST_NEXTWEEK, KEY_PREVIOUS_WEEK], (result) => {
      handleStorageResult(result);
    });
  } else {
    const result = {
      [KEY_DIARY]: localStorage.getItem(KEY_DIARY),
      [KEY_DIARYCHECKLIST]: localStorage.getItem(KEY_DIARYCHECKLIST),
      [KEY_THOUGHT]: localStorage.getItem(KEY_THOUGHT),
      [KEY_TODOLIST]: localStorage.getItem(KEY_TODOLIST),
      [KEY_THIS_WEEK]: localStorage.getItem(KEY_THIS_WEEK),
      [KEY_TODOLIST_NEXTWEEK]: localStorage.getItem(KEY_TODOLIST_NEXTWEEK),
      [KEY_PREVIOUS_WEEK]: localStorage.getItem(KEY_PREVIOUS_WEEK),
    };
    handleStorageResult(result);
  }
}

function handleStorageDayLinkResult(result) {
  let diary = result[KEY_DIARY];
  let diaryChecklist = result[KEY_DIARYCHECKLIST];
  const diaryElement = document.getElementById("btnDiary");
  const diaryChecklistElement = document.getElementById("btnDiaryChecklist");
  if (diary) {
    diaryElement.innerHTML = TEXT_DIARY;
    URL_DIARY = diary;
  }
  if (diaryChecklist) {
    diaryChecklistElement.innerHTML = TEXT_DIARY_CHECKLIST;
    URL_CHECKLIST = diaryChecklist;
  }
}

function handleStorageWeekLinkResult(result) {
  let thought = result[KEY_THOUGHT];
  let toDoList = result[KEY_TODOLIST];
  let thisWeek = result[KEY_THIS_WEEK];
  let toDoListNextWeek = result[KEY_TODOLIST_NEXTWEEK];
  let previousWeek = result[KEY_PREVIOUS_WEEK];
  const thoughtElement = document.getElementById("btnThought");
  const toDoListElement = document.getElementById("btnToDoList");
  const thisWeekElement = document.getElementById("btnThisWeek");
  const toDoListNextWeekElement = document.getElementById("btnToDoListNextWeek");
  const previousWeekElement = document.getElementById("btnPreviousWeek");
  if (thought) {
    thoughtElement.innerHTML = TEXT_THOUGHT;
    URL_THOUGHT = thought;
  }
  if (toDoList) {
    toDoListElement.innerHTML = TEXT_TODOLIST;
    URL_TODOLIST = toDoList;
  }
  if (thisWeek) {
    thisWeekElement.innerHTML = TEXT_THIS_WEEK;
    URL_THIS_WEEK = thisWeek;
  }
  if (toDoListNextWeek) {
    toDoListNextWeekElement.innerHTML = TEXT_TODOLIST_NEXTWEEK;
    URL_TODOLIST_NEXTWEEK = toDoListNextWeek;
  }
  if (previousWeek) {
    previousWeekElement.innerHTML = TEXT_PREVIOUS_WEEK;
    URL_PREVIOUS_WEEK = previousWeek;
  }
}

function handleStorageResult(result) {
  let diary = result[KEY_DIARY];
  let diaryChecklist = result[KEY_DIARYCHECKLIST];
  let thought = result[KEY_THOUGHT];
  let toDoList = result[KEY_TODOLIST];
  let thisWeek = result[KEY_THIS_WEEK];
  let toDoListNextWeek = result[KEY_TODOLIST_NEXTWEEK];
  let previousWeek = result[KEY_PREVIOUS_WEEK];

  const diaryElement = document.getElementById("btnDiary");
  const diaryChecklistElement = document.getElementById("btnDiaryChecklist");
  const thoughtElement = document.getElementById("btnThought");
  const toDoListElement = document.getElementById("btnToDoList");
  const thisWeekElement = document.getElementById("btnThisWeek");
  const toDoListNextWeekElement = document.getElementById("btnToDoListNextWeek");
  const previousWeekElement = document.getElementById("btnPreviousWeek");

  if (diary) {
    diaryElement.innerHTML = TEXT_DIARY;
    URL_DIARY = diary;
  }
  if (diaryChecklist) {
    diaryChecklistElement.innerHTML = TEXT_DIARY_CHECKLIST;
    URL_CHECKLIST = diaryChecklist;
  }
  if (thought) {
    thoughtElement.innerHTML = TEXT_THOUGHT;
    URL_THOUGHT = thought;
  }
  if (toDoList) {
    toDoListElement.innerHTML = TEXT_TODOLIST;
    URL_TODOLIST = toDoList;
  }
  if (thisWeek) {
    thisWeekElement.innerHTML = TEXT_THIS_WEEK;
    URL_THIS_WEEK = thisWeek;
  }
  if (toDoListNextWeek) {
    toDoListNextWeekElement.innerHTML = TEXT_TODOLIST_NEXTWEEK;
    URL_TODOLIST_NEXTWEEK = toDoListNextWeek;
  }
  if (previousWeek) {
    previousWeekElement.innerHTML = TEXT_PREVIOUS_WEEK;
    URL_PREVIOUS_WEEK = previousWeek;
  }

  if (!diary || !diaryChecklist) {
    fetchDayLinkAndStore(() => {
      if (isExtensionEnv()) {
        chrome.storage.local.get([KEY_DIARY, KEY_DIARYCHECKLIST], (newResult) => {
          handleStorageDayLinkResult(newResult);
        });
      } else {
        const newResult = {
          [KEY_DIARY]: localStorage.getItem(KEY_DIARY),
          [KEY_DIARYCHECKLIST]: localStorage.getItem(KEY_DIARYCHECKLIST)
        };
        handleStorageDayLinkResult(newResult);
      }
    });
  }

  if (!thought || !toDoList || !thisWeek || !toDoListNextWeek || !previousWeek) {
    fetchWeekLinkAndStore(() => {
      if (isExtensionEnv()) {
        chrome.storage.local.get([KEY_THOUGHT, KEY_TODOLIST, KEY_THIS_WEEK, KEY_TODOLIST_NEXTWEEK, KEY_PREVIOUS_WEEK], (newResult) => {
          handleStorageWeekLinkResult(newResult);
        });
      } else {
        const newResult = {
          [KEY_THOUGHT]: localStorage.getItem(KEY_THOUGHT),
          [KEY_TODOLIST]: localStorage.getItem(KEY_TODOLIST),
          [KEY_THIS_WEEK]: localStorage.getItem(KEY_THIS_WEEK),
          [KEY_TODOLIST_NEXTWEEK]: localStorage.getItem(KEY_TODOLIST_NEXTWEEK),
          [KEY_PREVIOUS_WEEK]: localStorage.getItem(KEY_PREVIOUS_WEEK),
        };
        handleStorageWeekLinkResult(newResult);
      }
    });
  }
}

/**
 * Sinh các key cache cho từng loại tài nguyên theo ngày/tuần
 */
function getKeyCache() {
  const weekNumber = getISOWeekNumber();
  const today = new Date();
  const toDayStr = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${today.getFullYear()}`;
  KEY_DIARY = `${toDayStr}diary`;
  KEY_DIARYCHECKLIST = `${toDayStr}diaryChecklist`;
  KEY_THOUGHT = `${weekNumber}thought`;
  KEY_TODOLIST = `${weekNumber}todo`;
  KEY_THIS_WEEK = `${weekNumber}folder`;
  KEY_TODOLIST_NEXTWEEK = `${weekNumber + 1}todo`;
  KEY_PREVIOUS_WEEK = `${weekNumber - 1}folder`;
}

/**
 * Kiểm tra thiết bị có phải là mobile không
 * @returns {boolean}
 */
function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Hiển thị mật khẩu đã lưu lên ô nhập
 */
function showPass() {
  let pass;
  if (isExtensionEnv()) {
    chrome.storage.local.get([KEY_PASS], function (result) {
      pass = result[KEY_PASS];
      document.getElementById("txtPass").value = pass;
    });
  } else {
    pass = localStorage.getItem(KEY_PASS);
    document.getElementById("txtPass").value = pass;
  }
}

/**
 * Chọn quote ngẫu nhiên ban đầu
 */
function loadQuoteIndex() {
  currentIndex = Math.floor(Math.random() * currentQuoteList.length);
  updateQuoteDisplay();
}

/**
 * Hiển thị quote hiện tại lên giao diện
 */
function updateQuoteDisplay() {
  const quoteDiv = document.getElementById("daily-quote");
  if (quoteDiv && currentQuoteList.length > 0) {
    quoteDiv.textContent = currentQuoteList[currentIndex];
  }
}

/**
 * Chuyển quote sang trái/phải
 * @param {number} offset - Số lượng dịch chuyển (âm: lùi, dương: tiến)
 */
function shiftQuote(offset) {
  currentIndex = (currentIndex + offset + currentQuoteList.length) % currentQuoteList.length;
  updateQuoteDisplay();
}

/**
 * Đổi loại quote (triết lý/hài hước)
 * @param {string} category - "serious" hoặc "funny"
 */
function setQuoteCategory(category) {
  currentQuoteList = category === "serious" ? quoteTrietLy : quoteHaiHuoc;
  currentIndex = 0;
  updateQuoteDisplay();
}
