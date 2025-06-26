import { quoteTrietLy , quoteHaiHuoc } from './quotes.js';

const TEXT_DIARY = "🖊️ Nhật ký";
const TEXT_DIARY_CHECKLIST = "✅ Checklist";
const TEXT_THOUGHT = "💭 Viết ra";
const TEXT_TODOLIST = "✔️ To Do List";
const TEXT_THIS_WEEK = "This week";

let KEY_DIARY;
let KEY_DIARYCHECKLIST;
let KEY_THOUGHT;
let KEY_TODOLIST;
let KEY_THIS_WEEK;

let URL_DIARY = "";
let URL_CHECKLIST = "";
let URL_THOUGHT = "";
let URL_TODOLIST = "";
let URL_THIS_WEEK = "";

const KEY_PASS = "pass";
const URL_GAS_GETFILE = "https://script.google.com/macros/s/AKfycbzLkc3oMl2P41brxfEs7i3qe_pChROCPWEZSrusd26HANNCoPwjDa4rdBXrPHNUTS0FNg/exec";
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

document.addEventListener("DOMContentLoaded", function () {
  hienThiNgayHienTai();
  getKeyCache();
  showPass();
  capNhatURL();

  loadQuoteIndex();
  updateQuoteDisplay();

  document.getElementById("btnPrevQuote").addEventListener("click", () => shiftQuote(-1));
  document.getElementById("btnNextQuote").addEventListener("click", () => shiftQuote(1));
  // Handler for Doc Sach Kindle button
  document.getElementById("btnDocSachKindle").addEventListener("click", function () {
    window.open(URL_KINDLE, '_blank');
  });

  // Handler for category combobox
  const categorySelect = document.getElementById("quoteCategory");
  if (categorySelect) {
    categorySelect.addEventListener("change", function () {
      setQuoteCategory(this.value);
    });
  }

  document.getElementById("btnEnter").addEventListener("click", function () {
    const divPassword = document.getElementById('divPassword');
    if (divPassword.style.display === 'none') {
      divPassword.style.display = 'block';
      showPass();
    } else {
      divPassword.style.display = 'none';
    }
  });

  document.getElementById("btnSavePass").addEventListener("click", function () {
    const pass = document.getElementById('txtPass').value;
    if (!pass || pass.length === 0) {
      alert("Nhập pass");
    } else {
      if (isExtensionEnv()) {
        chrome.storage.local.set({
          [KEY_PASS]: pass,
        });
      } else {
        localStorage.setItem(KEY_PASS, pass);
      }
      alert("Saved!");
    }
  });

  // Handler for Diary button
  document.getElementById("btnDiary").addEventListener("click", function () {
    window.open(URL_DIARY, '_blank');
  });

  // Handler for Diary Checklist button
  document.getElementById("btnDiaryChecklist").addEventListener("click", function () {
    window.open(URL_CHECKLIST, '_blank');
  });

  // Handler for Thought button
  document.getElementById("btnThought").addEventListener("click", function () {
    if (isMobile()) {
      window.open(URL_THOUGHT, '_blank');
    } else {
      const iframe = document.getElementById("iframeThought");
      iframe.src = URL_THOUGHT;
      const iframeContainer = document.getElementById('divIframeThought');
      if (iframeContainer.style.display === 'none') {
        iframeContainer.style.display = 'block';
      } else {
        iframeContainer.style.display = 'none';
      }
    }
  });

  // Handler for To Do List button
  document.getElementById("btnToDoList").addEventListener("click", function () {
    window.open(URL_TODOLIST, '_blank');
  });

  document.getElementById("btnThisWeek").addEventListener("click", function () {
    window.open(URL_THIS_WEEK, '_blank');
  });

  // Handler for Calendar button
  document.getElementById("btnCalendar").addEventListener("click", function () {
    window.open(URL_CALENDAR, '_blank');
  });

  // Handler for Problem button
  document.getElementById("btnProblem").addEventListener("click", function () {
    window.open(URL_PROBLEM, '_blank');
  });

  // Handler for Sodscd button
  document.getElementById("btnSodscd").addEventListener("click", function () {
    window.open(URL_SODSCD, '_blank');
  });

  // Handler for Tong Hop Nhat Ky Ngay button
  document.getElementById("btnTongHopNhatKyNgay").addEventListener("click", function () {
    window.open(URL_TONGHOPNGAY, '_blank');
  });

  // Handler for Tong Hop Nhat Ky Tuan button
  document.getElementById("btnTongHopNhatKyTuan").addEventListener("click", function () {
    window.open(URL_TONGHOPTUAN, '_blank');
  });

  // Handler for Pomodoro button
  document.getElementById("btnPomodoro").addEventListener("click", function () {
    if (isMobile()) {
      window.open(URL_POMODORO, '_blank');
    } else {
      const iframeContainer = document.getElementById('divIframePomodoro');
      if (iframeContainer.style.display === 'none') {
        iframeContainer.style.display = 'block';
      } else {
        iframeContainer.style.display = 'none';
      }
    }
  });

  // Handler for Hit Tho button
  document.getElementById("btnHitTho").addEventListener("click", function () {
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

  // Handler for Nhac Hoc Tap button
  document.getElementById("btnNhacHocTap").addEventListener("click", function () {
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

  // Handler for Thien Vipassana button
  document.getElementById("btnThienVipassana").addEventListener("click", function () {
    window.open(URL_VIPASSANA, '_blank');
  });

  // Handler for Thien Metta button
  document.getElementById("btnThienMetta").addEventListener("click", function () {
    window.open(URL_METTA, '_blank');
  });

  // Handler for Luyen Tieng Anh button
  document.getElementById("btnLuyenTiengAnh").addEventListener("click", function () {
    window.open(URL_ENGLISH, '_blank');
  });

  // Handler for Nhac Tich Cuc button
  document.getElementById("btnNhacTichCuc").addEventListener("click", function () {
    window.open(URL_NHACTICHCUCDONGLUC, '_blank');
  });

  // Handler for Tin Tong Hop button
  document.getElementById("btnTinTongHop").addEventListener("click", function () {
    window.open(URL_TINTONGHOP, '_blank');
  });

  // Handler for Tin Tich Cuc button
  document.getElementById("btnTinTichCuc").addEventListener("click", function () {
    window.open(URL_TINTICHCUC, '_blank');
  });

  // Handler for Mo Nhieu AI button
  document.getElementById("btnMoNhieuAi").addEventListener("click", function () {
    window.open(URL_MONHIEUAI, '_blank');
  });

  // Handler for Lich Thi Dau Bong Da button
  document.getElementById("btnLichThiDauBongDa").addEventListener("click", function () {
    window.open(URL_LICHTHIDAU, '_blank');
  });

  // Handler for Guitar Edumall button
  document.getElementById("btnGuitarEdumall").addEventListener("click", function () {
    window.open(URL_GUITAR_EDUMALL, '_blank');
  });

  // Handler for Gym Music button
  document.getElementById("btnGymMusic").addEventListener("click", function () {
    window.open(URL_GYM_MUSIC, '_blank');
  });

  // Handler for Note Ve Gia Dinh button
  document.getElementById("btnNoteVeGiaDinh").addEventListener("click", function () {
    window.open(URL_NOTE_GIADINH, '_blank');
  });

  // Handler for Tin Tuc Thanh Podcast button
  document.getElementById("btnTinTucThanhPodcast").addEventListener("click", function () {
    window.open("", '_blank');
  });

  // Handler for Playlist Cuoi button
  document.getElementById("btnPlaylistCuoi").addEventListener("click", function () {
    window.open(URL_LAUGHT, '_blank');
  });

  // Handler for Playlist Sau Sac button
  document.getElementById("btnPlaylistSauSac").addEventListener("click", function () {
    window.open(URL_DEEP, '_blank');
  });

  // Handler for Doc Sach Kindle button
  document.getElementById("btnDocSachKindle").addEventListener("click", function () {
    window.open(URL_KINDLE, '_blank');
  });

  document.getElementById("btnRanh").addEventListener("click", function () {
    window.open(URL_RANH, '_blank');
  });

  document.getElementById("btnMuctieu").addEventListener("click", function () {
    window.open(URL_GOAL, '_blank');
  });

});

function isExtensionEnv() {
  return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
}

function getISOWeekNumber() {
  var date = new Date();
  var target = new Date(date.valueOf());
  target.setDate(target.getDate() + 3 - (target.getDay() + 6) % 7);
  var firstThursday = new Date(target.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - (firstThursday.getDay() + 6) % 7);
  var weekNumber = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return weekNumber;
}

function fetchAndStoreLink(callback) {
  const pass = document.getElementById("txtPass").value;
  fetch(URL_GAS_GETFILE + "?password=" + pass)
    .then(response => {
      if (!response.ok) throw new Error("Lỗi khi gọi API");
      return response.json();
    })
    .then(json => {
      const { diary, diaryChecklist, thought, toDoList, thisWeek } = json;
      if (isExtensionEnv()) {
        chrome.storage.local.set({
          [KEY_DIARY]: diary.trim(),
          [KEY_DIARYCHECKLIST]: diaryChecklist.trim(),
          [KEY_THOUGHT]: thought.trim(),
          [KEY_TODOLIST]: toDoList.trim(),
          [KEY_THIS_WEEK]: thisWeek.trim(),
        }, () => {
          if (typeof callback === 'function') callback();
        });
      } else {
        localStorage.setItem(KEY_DIARY, diary.trim());
        localStorage.setItem(KEY_DIARYCHECKLIST, diaryChecklist.trim());
        localStorage.setItem(KEY_THOUGHT, thought.trim());
        localStorage.setItem(KEY_TODOLIST, toDoList.trim());
        localStorage.setItem(KEY_THIS_WEEK, thisWeek.trim());
        if (typeof callback === 'function') callback();
      }
    })
    .catch(error => {
      console.error("Lỗi khi gọi API và lưu cache:", error);
    });
}

function hienThiNgayHienTai() {
  const today = new Date();
  const formattedDate = today.toLocaleDateString('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  document.getElementById("current-date").textContent = formattedDate;
}

function capNhatURL() {
  const diaryElement = document.getElementById("btnDiary");
  const diaryChecklistElement = document.getElementById("btnDiaryChecklist");
  const thoughtElement = document.getElementById("btnThought");
  const toDoListElement = document.getElementById("btnToDoList");
  const thisWeekElement = document.getElementById("btnThisWeek");

  diaryElement.innerHTML = '<span class="spinner"></span>';
  diaryChecklistElement.innerHTML = '<span class="spinner"></span>';
  thoughtElement.innerHTML = '<span class="spinner"></span>';
  toDoListElement.innerHTML = '<span class="spinner"></span>';
  thisWeekElement.innerHTML = '<span class="spinner"></span>';

  if (isExtensionEnv()) {
    chrome.storage.local.get([KEY_DIARY, KEY_DIARYCHECKLIST, KEY_THOUGHT, KEY_TODOLIST, KEY_THIS_WEEK], (result) => {
      handleStorageResult(result);
    });
  } else {
    const result = {
      [KEY_DIARY]: localStorage.getItem(KEY_DIARY),
      [KEY_DIARYCHECKLIST]: localStorage.getItem(KEY_DIARYCHECKLIST),
      [KEY_THOUGHT]: localStorage.getItem(KEY_THOUGHT),
      [KEY_TODOLIST]: localStorage.getItem(KEY_TODOLIST),
      [KEY_THIS_WEEK]: localStorage.getItem(KEY_THIS_WEEK),
    };
    handleStorageResult(result);
  }
}

function handleStorageResult(result) {
  let diary = result[KEY_DIARY];
  let diaryChecklist = result[KEY_DIARYCHECKLIST];
  let thought = result[KEY_THOUGHT];
  let toDoList = result[KEY_TODOLIST];
  let thisWeek = result[KEY_THIS_WEEK];

  const diaryElement = document.getElementById("btnDiary");
  const diaryChecklistElement = document.getElementById("btnDiaryChecklist");
  const thoughtElement = document.getElementById("btnThought");
  const toDoListElement = document.getElementById("btnToDoList");
  const thisWeekElement = document.getElementById("btnThisWeek");

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

  if (!diary || !diaryChecklist || !thought || !toDoList || !thisWeek) {
    fetchAndStoreLink(() => {
      if (isExtensionEnv()) {
        chrome.storage.local.get([KEY_DIARY, KEY_DIARYCHECKLIST, KEY_THOUGHT, KEY_TODOLIST, KEY_THIS_WEEK], (newResult) => {
          handleStorageResult(newResult);
        });
      } else {
        const newResult = {
          [KEY_DIARY]: localStorage.getItem(KEY_DIARY),
          [KEY_DIARYCHECKLIST]: localStorage.getItem(KEY_DIARYCHECKLIST),
          [KEY_THOUGHT]: localStorage.getItem(KEY_THOUGHT),
          [KEY_TODOLIST]: localStorage.getItem(KEY_TODOLIST),
          [KEY_THIS_WEEK]: localStorage.getItem(KEY_THIS_WEEK)
        };
        handleStorageResult(newResult);
      }
    });
  }
}

function getKeyCache() {
  const weekNumber = getISOWeekNumber();
  const today = new Date();
  const toDayStr = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${today.getFullYear()}`;
  KEY_DIARY = `${toDayStr}diary`;
  KEY_DIARYCHECKLIST = `${toDayStr}diaryChecklist`;
  KEY_THOUGHT = `${weekNumber}thought`;
  KEY_TODOLIST = `${weekNumber}todo`;
  KEY_THIS_WEEK = `${weekNumber}folder`;
}

function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

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
