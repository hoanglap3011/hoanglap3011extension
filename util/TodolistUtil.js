const TodolistUtil = {

  fetchLinkToDoListWeek(dayStr, callback) {
    StorageUtil.get([CACHE_PASS], (result) => {
      const pass = result[CACHE_PASS] || "";
      if (!pass || pass.length === 0) {
        PasswordUtil.openPasswordPopup();
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
            throw new Error("Lỗi khi gọi API");
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
          LoadingOverlayUtil.hide();
        });
    });
  },

  openToDoListWeekFromDay(dayStr) {
    const keyToDoList = CACHE_TODOLIST + "." + dayStr;
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
          StorageUtil.set({ [CACHE_TODOLIST]: arr }, () => { });
        });
      });
    });
  }

};