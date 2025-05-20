let URL_DIARY = "";
let URL_CHECKLIST = "";
let URL_THOUGHT = "";
let URL_TODOLIST = "";
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
const URL_TINTONGHOP = "";
const URL_TINTICHCUC = "";
const URL_MONHIEUAI = "";
const URL_LICHTHIDAU = "https://www.24h.com.vn/bong-da/lich-thi-dau-bong-da-hom-nay-moi-nhat-c48a364371.html";
const URL_GUITAR_EDUMALL = "https://www.edumall.vn/vn/course-player/hoc-guitar-dem-hat-cap-toc-trong-30-ngay";
const URL_GYM_MUSIC = "https://music.youtube.com/playlist?list=PLpl9CTbHHB9WU4r1ptkQzWjKQ8g_ijIFa";
const URL_NOTE_GIADINH = "https://docs.google.com/document/d/1Yn04JziVUUTyqUVNqKfKOeEBCDlulV9R1jJPITNpdEA/edit?tab=t.0#heading=h.eejeurvh6dwa";
const URL_LAUGHT = "https://www.youtube.com/watch?v=e5e8RScN_dg&list=PLpl9CTbHHB9X2uQvoUN3Iwwo_QbKolgvM";
const URL_DEEP = "https://www.youtube.com/watch?v=qX900P6POEU&list=PLpl9CTbHHB9UXfVctUpy4NzvNhsQ7s7dX";
const URL_KINDLE = "kindle://";

document.addEventListener("DOMContentLoaded", function() {
  hienThiNgayHienTai();
  capNhatURL();

  // Handler for Diary button
  document.getElementById("btnDiary").addEventListener("click", function() {
    window.open(URL_DIARY, '_blank');
  });

  // Handler for Diary Checklist button
  document.getElementById("btnDiaryChecklist").addEventListener("click", function() {
    window.open(URL_CHECKLIST, '_blank');
  });

  // Handler for Thought button
  document.getElementById("btnThought").addEventListener("click", function() {
    window.open(URL_THOUGHT, '_blank');
  });

  // Handler for To Do List button
  document.getElementById("btnToDoList").addEventListener("click", function() {
    window.open(URL_TODOLIST, '_blank');
  });

  // Handler for Calendar button
  document.getElementById("btnCalendar").addEventListener("click", function() {
    window.open(URL_CALENDAR, '_blank');
  });

  // Handler for Problem button
  document.getElementById("btnProblem").addEventListener("click", function() {
    window.open(URL_PROBLEM, '_blank');
  });

  // Handler for Sodscd button
  document.getElementById("btnSodscd").addEventListener("click", function() {
    window.open(URL_SODSCD, '_blank');
  });

  // Handler for Tong Hop Nhat Ky Ngay button
  document.getElementById("btnTongHopNhatKyNgay").addEventListener("click", function() {
    window.open(URL_TONGHOPNGAY, '_blank');
  });

  // Handler for Tong Hop Nhat Ky Tuan button
  document.getElementById("btnTongHopNhatKyTuan").addEventListener("click", function() {
    window.open(URL_TONGHOPTUAN, '_blank');
  });

  // Handler for Nhac Hoc Tap button
  document.getElementById("btnNhacHocTap").addEventListener("click", function() {
    window.open(URL_NHACHOCTAP, '_blank');
  });

  // Handler for Pomodoro button
  document.getElementById("btnPomodoro").addEventListener("click", function() {
    window.open(URL_POMODORO, '_blank');
  });

  // Handler for Hit Tho button
  document.getElementById("btnHitTho").addEventListener("click", function() {
    window.open(URL_HITTHO, '_blank');
  });

  // Handler for Thien Vipassana button
  document.getElementById("btnThienVipassana").addEventListener("click", function() {
    window.open(URL_VIPASSANA, '_blank');
  });

  // Handler for Thien Metta button
  document.getElementById("btnThienMetta").addEventListener("click", function() {
    window.open(URL_METTA, '_blank');
  });

  // Handler for Luyen Tieng Anh button
  document.getElementById("btnLuyenTiengAnh").addEventListener("click", function() {
    window.open(URL_ENGLISH, '_blank');
  });

  // Handler for Nhac Tich Cuc button
  document.getElementById("btnNhacTichCuc").addEventListener("click", function() {
    window.open(URL_NHACTICHCUCDONGLUC, '_blank');
  });

  // Handler for Tin Tong Hop button
  document.getElementById("btnTinTongHop").addEventListener("click", function() {
    window.open(URL_TINTONGHOP, '_blank');
  });

  // Handler for Tin Tich Cuc button
  document.getElementById("btnTinTichCuc").addEventListener("click", function() {
    window.open(URL_TINTICHCUC, '_blank');
  });

  // Handler for Mo Nhieu AI button
  document.getElementById("btnMoNhieuAi").addEventListener("click", function() {
    window.open(URL_MONHIEUAI, '_blank');
  });

  // Handler for Lich Thi Dau Bong Da button
  document.getElementById("btnLichThiDauBongDa").addEventListener("click", function() {
    window.open(URL_LICHTHIDAU, '_blank');
  });

  // Handler for Guitar Edumall button
  document.getElementById("btnGuitarEdumall").addEventListener("click", function() {
    window.open(URL_GUITAR_EDUMALL, '_blank');
  });

  // Handler for Gym Music button
  document.getElementById("btnGymMusic").addEventListener("click", function() {
    window.open(URL_GYM_MUSIC, '_blank');
  });

  // Handler for Note Ve Gia Dinh button
  document.getElementById("btnNoteVeGiaDinh").addEventListener("click", function() {
    window.open(URL_NOTE_GIADINH, '_blank');
  });

  // Handler for Tin Tuc Thanh Podcast button
  document.getElementById("btnTinTucThanhPodcast").addEventListener("click", function() {
    window.open("", '_blank');
  });

  // Handler for Playlist Cuoi button
  document.getElementById("btnPlaylistCuoi").addEventListener("click", function() {
    window.open(URL_LAUGHT, '_blank');
  });

  // Handler for Playlist Sau Sac button
  document.getElementById("btnPlaylistSauSac").addEventListener("click", function() {
    window.open(URL_DEEP, '_blank');
  });

  // Handler for Doc Sach Kindle button
  document.getElementById("btnDocSachKindle").addEventListener("click", function() {
    window.open(URL_KINDLE, '_blank');
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
  const API_URL = "https://script.google.com/macros/s/AKfycbwI4Xjkkt1HrrGDL9dQsN8bsK6-s85r7Hu_t8mWG1Wr_ZILQpiiQf6bti7gj1r6TeQ_/exec"; 
  fetch(API_URL)
    .then(response => {
      if (!response.ok) throw new Error("Lỗi khi gọi API");
      return response.json();
    })
    .then(json => {
      const { diary, diaryChecklist, thought, toDoList } = json;
      const weekNumber = getISOWeekNumber();
      const today = new Date();
      const toDayStr = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${today.getFullYear()}`;
      const diaryKey = `${toDayStr}diary`;
      const diaryChecklistKey = `${toDayStr}diaryChecklist`;
      const thoughtKey = `${weekNumber}thought`;
      const toDoListKey = `${weekNumber}todo`;

      if (isExtensionEnv()) {
        chrome.storage.local.set({
          [diaryKey]: diary.trim(),
          [diaryChecklistKey]: diaryChecklist.trim(),
          [thoughtKey]: thought.trim(),
          [toDoListKey]: toDoList.trim()
        }, () => {
          if (typeof callback === 'function') callback();
        });
      } else {
        localStorage.setItem(diaryKey, diary.trim());
        localStorage.setItem(diaryChecklistKey, diaryChecklist.trim());
        localStorage.setItem(thoughtKey, thought.trim());
        localStorage.setItem(toDoListKey, toDoList.trim());
        if (typeof callback === 'function') callback();
      }
    })
    .catch(error => {
      console.error("Lỗi khi gọi API và lưu cache:", error);
    });
}

function hienThiNgayHienTai(){
  const today = new Date();
  const formattedDate = today.toLocaleDateString('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  document.getElementById("current-date").textContent = formattedDate;
}

function capNhatURL(){
  const diaryElement = document.getElementById("btnDiary");
  const diaryChecklistElement = document.getElementById("btnDiaryChecklist");
  const thoughtElement = document.getElementById("btnThought");
  const toDoListElement = document.getElementById("btnToDoList");

  diaryElement.innerHTML = '<span class="spinner"></span>';
  diaryChecklistElement.innerHTML = '<span class="spinner"></span>';
  thoughtElement.innerHTML = '<span class="spinner"></span>';
  toDoListElement.innerHTML = '<span class="spinner"></span>';

  const weekNumber = getISOWeekNumber();
  const today = new Date();
  const toDayStr = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${today.getFullYear()}`;
  const diaryKey = `${toDayStr}diary`;
  const diaryChecklistKey = `${toDayStr}diaryChecklist`;
  const thoughtKey = `${weekNumber}thought`;
  const toDoListKey = `${weekNumber}todo`;

  if (isExtensionEnv()) {
    chrome.storage.local.get([diaryKey, diaryChecklistKey, thoughtKey, toDoListKey], (result) => {
      handleStorageResult(result);
    });
  } else {
    const result = {
      [diaryKey]: localStorage.getItem(diaryKey),
      [diaryChecklistKey]: localStorage.getItem(diaryChecklistKey),
      [thoughtKey]: localStorage.getItem(thoughtKey),
      [toDoListKey]: localStorage.getItem(toDoListKey)
    };
    handleStorageResult(result);
  }
}

function handleStorageResult(result) {
  const weekNumber = getISOWeekNumber();
  const today = new Date();
  const toDayStr = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${today.getFullYear()}`;
  const diaryKey = `${toDayStr}diary`;
  const diaryChecklistKey = `${toDayStr}diaryChecklist`;
  const thoughtKey = `${weekNumber}thought`;
  const toDoListKey = `${weekNumber}todo`;

  let diary = result[diaryKey];
  let diaryChecklist = result[diaryChecklistKey];
  let thought = result[thoughtKey];
  let toDoList = result[toDoListKey];

  const diaryElement = document.getElementById("btnDiary");
  const diaryChecklistElement = document.getElementById("btnDiaryChecklist");
  const thoughtElement = document.getElementById("btnThought");
  const toDoListElement = document.getElementById("btnToDoList");

  if (diary) {
    diaryElement.innerHTML = "🖊️ Nhật ký";
    URL_DIARY = diary;
  }
  if (diaryChecklist) {
    diaryChecklistElement.innerHTML = "✅ Nhật ký checklist";
    URL_CHECKLIST = diaryChecklist;
  }
  if (thought) {
    thoughtElement.innerHTML = "💭 Suy nghĩ";
    URL_THOUGHT = thought;
  }
  if (toDoList) {
    toDoListElement.innerHTML = "✅ To Do List";
    URL_TODOLIST = toDoList;
  }

  if (!diary || !diaryChecklist || !thought || !toDoList) {
    fetchAndStoreLink(() => {
      if (isExtensionEnv()) {
        chrome.storage.local.get([diaryKey, diaryChecklistKey, thoughtKey, toDoListKey], (newResult) => {
          handleStorageResult(newResult);
        });
      } else {
        const newResult = {
          [diaryKey]: localStorage.getItem(diaryKey),
          [diaryChecklistKey]: localStorage.getItem(diaryChecklistKey),
          [thoughtKey]: localStorage.getItem(thoughtKey),
          [toDoListKey]: localStorage.getItem(toDoListKey)
        };
        handleStorageResult(newResult);
      }
    });
  }
}