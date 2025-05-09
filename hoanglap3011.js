const API_URL = "https://script.google.com/macros/s/AKfycbwI4Xjkkt1HrrGDL9dQsN8bsK6-s85r7Hu_t8mWG1Wr_ZILQpiiQf6bti7gj1r6TeQ_/exec"; 

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

      chrome.storage.local.set({
        [diaryKey]: diary.trim(),
        [diaryChecklistKey]: diaryChecklist.trim(),
        [thoughtKey]: thought.trim(),
        [toDoListKey]: toDoList.trim()
      }, () => {
        if (typeof callback === 'function') callback();
      });
    })
    .catch(error => {
      console.error("Lỗi khi gọi API và lưu cache:", error);
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const diaryElement = document.getElementById("diary");
  const diaryChecklistElement = document.getElementById("diaryChecklist");
  const thoughtElement = document.getElementById("thought");
  const toDoListElement = document.getElementById("toDoList");

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

  chrome.storage.local.get([diaryKey, diaryChecklistKey, thoughtKey, toDoListKey], (result) => {
    let diary = result[diaryKey];
    let diaryChecklist = result[diaryChecklistKey];
    let thought = result[thoughtKey];
    let toDoList = result[toDoListKey];

    if (diary) {
      diaryElement.textContent = "Nhật ký";
      diaryElement.href = diary;
    }
    if (diaryChecklist) {
      diaryChecklistElement.textContent = "Nhật ký checklist";
      diaryChecklistElement.href = diaryChecklist;
    }
    if (thought) {
      thoughtElement.textContent = "Suy nghĩ";
      thoughtElement.href = thought;
    }
    if (toDoList) {
      toDoListElement.textContent = "To Do List";
      toDoListElement.href = toDoList;
    }

    function updateLinksFromCache() {
      chrome.storage.local.get([diaryKey, diaryChecklistKey, thoughtKey, toDoListKey], (result) => {
        diaryElement.href = result[diaryKey];
        diaryChecklistElement.href = result[diaryChecklistKey] ;
        thoughtElement.href = result[thoughtKey] ;
        toDoListElement.href = result[toDoListKey] ;
        diaryElement.textContent = "Nhật ký";
        diaryChecklistElement.textContent = "Nhật ký Checklist";
        thoughtElement.textContent = "Suy nghĩ";        
        toDoListElement.textContent = "To Do List";        
      });
    }

    if (!diary || !diaryChecklist || !thought || !toDoList) {
      fetchAndStoreLink(updateLinksFromCache);
    } 
  });
});
