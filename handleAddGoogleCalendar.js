(function handleAddGoogleCalendar() {
  const TIME_LOAD_PAGE_ADDCALENDAR = 1000;
  const TIME_LOAD_GOOGLE_MAP = 1000;

  setTimeout(() => {
    const inputElement = document.querySelector('input[aria-label="Thêm vị trí"]');
    if (inputElement) {
      inputElement.focus();
      const arrowDownEvent = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        code: 'ArrowDown',
        keyCode: 40,
        which: 40,
        bubbles: true
      });

      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      });

      inputElement.dispatchEvent(arrowDownEvent);

      setTimeout(() => {
        inputElement.dispatchEvent(arrowDownEvent);
        inputElement.dispatchEvent(enterEvent);
        const ulElement = document.querySelector('ul[aria-label="Danh sách lịch"]');
        if (ulElement) {
          const parentElement = ulElement.parentElement;
          if (parentElement) {
            const previousSibling = parentElement.previousElementSibling;
            if (previousSibling) {
              previousSibling.click();
              const liElements = document.querySelectorAll('li');
              let targetLi = null;
              liElements.forEach((li) => {
                if (li.textContent.includes("Lịch thi đấu bóng đá")) {
                  targetLi = li;
                  return;
                }
              });
              if (targetLi) {
                targetLi.click();
              }
            }
          }
        }
      }, TIME_LOAD_GOOGLE_MAP);
    }
  }, TIME_LOAD_PAGE_ADDCALENDAR);
})();
