function addGoogleCalendar() {
  const GOOGLE_CALENDAR_LINK = 'https://calendar.google.com/calendar/u/0/r/eventedit?ofe=true&crm=AVAILABLE';
  const TIME_LOAD_PAGE_ADDCALENDAR = 1000;
  const TIME_LOAD_GOOGLE_MAP = 1000;
  const TEAMS = [
    { id: "/g/121qfk5v", name: "Thanh Hóa", stadium: "Sân vận động Thanh Hóa, 37 Lê Quý Đôn, P. Ba Đình, Thạnh Hóa, Thanh Hoá, Việt Nam" },
    { id: "/m/0ghqgf", name: "Hoàng Anh Gia Lai", stadium: "Sân vận động Pleiku, Quang Trung, P.Tây Sơn, Pleiku, Gia Lai 600000, Việt Nam" },
    { id: "/g/11f08kzdh8", name: "Hồng Lĩnh Hà Tĩnh", stadium: "Sân vận động Hà Tĩnh, Nguyễn Biểu, Nam Hà, Hà Tĩnh, Việt Nam" },
    { id: "/m/01xn5sc", name: "Bình Dương", stadium: "Sân vận động Gò Đậu, Đ. 30 Tháng 4, Phú Thọ, Thủ Dầu Một, Bình Dương, Việt Nam" },
    { id: "/m/0ghqfd", name: "Nam Định", stadium: "Sân vận động Thiên Trường, 5 Đặng Xuân Thiều, Vị Hoàng, Nam Định, Việt Nam" },
    { id: "/m/064l6nx", name: "Hà Nội", stadium: "Sân vận động Hàng Đẫy, 9 P. Trịnh Hoài Đức, Cát Linh, Đống Đa, Hà Nội, Việt Nam" },
    { id: "/m/051x467", name: "Viettel", stadium: "Sân Vận Động Mỹ Đình, Mỹ Đình 1, Nam Từ Liêm, Hà Nội, Việt Nam" },
    { id: "/g/1228xg3s", name: "CAHN", stadium: "Sân vận động Hàng Đẫy, 9 P. Trịnh Hoài Đức, Cát Linh, Đống Đa, Hà Nội, Việt Nam" },
    { id: "/m/09k53c6", name: "Quảng Nam", stadium: "Sân Vận Động Hòa Xuân, Dương Loan, Hoà Xuân, Cẩm Lệ, Đà Nẵng 550000, Việt Nam" },
    { id: "/m/01xn5sr", name: "TP.HCM", stadium: "Sân vận động Thống Nhất, 138 Đ. Đào Duy Từ, Phường 6, Quận 10, Hồ Chí Minh, Việt Nam" },
    { id: "/m/0ghqdc", name: "Bình Định", stadium: "Sân vận động Quy Nhơn, 194 Lê Hồng Phong, Trần Hưng Đạo, Quy Nhơn, Bình Định, Việt Nam" },
    { id: "/m/0404qjd", name: "Hải Phòng", stadium: "Sân vận động Lạch Tray, 15 Lạch Tray, Lê Lợi, Ngô Quyền, Hải Phòng 180000, Việt Nam" },
    { id: "/m/026hmd8", name: "Đà Nẵng", stadium: "Sân vân động Hòa Xuân, Trần Nam Trung, Hoà Xuân, Cẩm Lệ, Đà Nẵng 550000, Việt Nam" },
    { id: "/m/0ghqf1", name: "Sông Lam Nghệ An", stadium: "Sân Vận động Vinh, Đào Tấn, Cửa Nam, Vinh, Nghệ An, Việt Nam" },
    { id: "/m/04ltf", name: "Liverpool", stadium: "Sân vận động Anfield, Anfield Rd, Anfield, Liverpool L4 0TH, Vương Quốc Anh" },
    { id: "/m/01634x", name: "Man City", stadium: "Sân vận động Thành phố Manchester, Etihad Stadium, Etihad Campus, Manchester M11 3FF, Vương Quốc Anh" },
    { id: "/m/0xbm", name: "Arsenal", stadium: "Emirates Stadium, Hornsey Rd, London N7 7AJ, Vương Quốc Anh" },
    { id: "/m/0bl8l", name: "Aston Villa", stadium: "Sân vận động Villa Park, Trinity Rd, Birmingham B6 6HE, Vương Quốc Anh" },
    { id: "/m/0j2pg", name: "Brighton", stadium: "American Express Stadium, Village Way, Brighton and Hove, Brighton BN1 9BL, Vương Quốc Anh" },
    { id: "/m/023fb", name: "Chelsea", stadium: "Sân vận động Stamford Bridge, Fulham Rd., London SW6 1HS, Vương Quốc Anh" },
    { id: "/m/0hvjr", name: "Tottenham", stadium: "Sân vận động Tottenham Hotspur, 782 High Rd, London N17 0BX, Vương Quốc Anh" },
    { id: "/m/014nzp", name: "Nottm Forest", stadium: "The City Ground, West Bridgford, Nottingham NG2 5FJ, Vương Quốc Anh" },
    { id: "/m/0fvly", name: "Newcastle", stadium: "St. James' Park, Barrack Rd, Newcastle upon Tyne NE1 4ST, Vương Quốc Anh" },
    { id: "/m/02_lt", name: "Fulham", stadium: "Sân vận động Craven Cottage, Stevenage Rd, London SW6 6HH, Vương Quốc Anh" },
    { id: "/m/02b0xq", name: "Bournemouth", stadium: "Vitality Stadium, Kings Park, Bournemouth BH7 7AF, Vương Quốc Anh" },
    { id: "/m/050fh", name: "Man Utd", stadium: "Sân vận động Old Trafford, Sir Matt Busby Way, Old Trafford, Stretford, Manchester M16 0RA, Vương Quốc Anh" },
    { id: "/m/02b0y3", name: "Brentford", stadium: "Gtech Community Stadium, Lionel Rd S, Brentford TW8 0RU, Vương Quốc Anh" },
    { id: "/m/01rlzn", name: "Leicester", stadium: "Sân vận động King Power, Filbert Wy, Leicester LE2 7FL, Vương Quốc Anh" },
    { id: "/m/0ckf6", name: "West Ham", stadium: "Sân vận động Olympic, Luân Đôn E20 2ST, Vương Quốc Anh" },
    { id: "/m/0mmd6", name: "Everton", stadium: "Sân vận động Goodison Park, Goodison Rd, Liverpool L4 4EL, Vương Quốc Anh" },
    { id: "/m/01zhs3", name: "Ipswich Town", stadium: "Portman Road Stadium, Town Football Club, Portman Rd, Ipswich IP1 2DA, Vương Quốc Anh" },
    { id: "/m/0223bl", name: "Crystal Palace", stadium: "Selhurst Park Stadium, Holmesdale Rd, London SE25 6PU, Vương Quốc Anh" },
    { id: "/m/0k_l4", name: "Southampton", stadium: "St Mary's Stadium, Britannia Rd, Southampton SO14 5FP, Vương Quốc Anh" },
    { id: "/m/01fwqn", name: "Wolves", stadium: "Molineux Stadium, Waterloo Rd, Wolverhampton WV1 4QR, Vương Quốc Anh" },
    { id: "/m/04b6sy", name: "Việt Nam", stadium: "Sân vận động Quốc gia Mỹ Đình, 1 Đ. Lê Đức Thọ, Mỹ Đình, Nam Từ Liêm, Hà Nội, Việt Nam" },
    { id: "/m/046vvc", name: "Thái Lan", stadium: "Rajamangala National Stadium, 286 Soi Ramkhamhaeng 24 Yaek 18, Khwaeng Hua Mak, Khet Bang Kapi, Krung Thep Maha Nakhon 10240, Thái Lan" },
    { id: "/m/0413b_", name: "Indonesia", stadium: "Sân vận động Bung Karno, Jl. Pintu Satu Senayan, Gelora, Kecamatan Tanah Abang, Kota Jakarta Pusat, Daerah Khusus Ibukota Jakarta 10270, Indonesia" },
    { id: "/m/04h4zx", name: "Malaysia", stadium: "Sân vận động quốc gia Bukit Jalil, Jalan Barat, Bukit Jalil, 57000 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur, Malaysia" },
    { id: "/m/04h54p", name: "Singapore", stadium: "Sân vận động quốc gia Singapore, 1 Stadium Dr, Singapore 397629" },
    { id: "/m/04k3r_", name: "Philippines", stadium: "Sân vận động Rizal Memorial, Rizal Memorial Sports Complex, Adriatico St, Malate, Maynila, 1004 Kalakhang Maynila, Philippines" },
    { id: "/m/04nq_y", name: "Lào", stadium: "Sân vận động Quốc gia Lào Mới, 18°03'43.7\"N 102°42'14., 2E, Muang Xai, Lào" },
    { id: "/m/04nqn6", name: "Campuchia", stadium: "Sân vận động Olympic, Charles de Gaulle Boulevard រាជធានី​ភ្នំពេញ, Phnom Penh 12253, Campuchia" },
    { id: "/m/04q41k", name: "Myanmar", stadium: "Sân vận động Thuwunna, R5CP+GPG, Ragoon, Myanmar (Miến Điện)" },
    { id: "/m/04mx79", name: "Đông Timor", stadium: "9 P. Trịnh Hoài Đức, Cát Linh, Đống Đa, Hà Nội, Việt Nam" },
    { id: "/g/11b6nyv4yk", name: "Bình Phước", stadium: "Sân vận động tỉnh Bình Phước, GVHH+HFM, Tân Bình, Đồng Xoài, Bình Phước, Việt Nam" },
    { id: "/g/11f1zdmlfs", name: "Ninh Bình", stadium: "Sân vận động Đông Thành, Đông Phương Hồng, Đông Thành, Ninh Bình, Việt Nam" },
    { id: "/m/06l22", name: "Real Madrid", stadium: "Sân vận động Santiago Bernabéu, Av. de Concha Espina, 1, Chamartín, 28036 Madrid, Tây Ban Nha" },
    { id: "/m/0hvgt", name: "Barcelona", stadium: "Sân vận động Camp Nou, Les Corts, 08028 Barcelona, Tây Ban Nha" },
    { id: "/m/02w64f", name: "Tây Ban Nha", stadium: "Sân vận động Santiago Bernabéu, Av. de Concha Espina, 1, Chamartín, 28036 Madrid, Tây Ban Nha" },
    { id: "/m/01l3vx", name: "Pháp", stadium: "Stade de France, 93200 Saint-Denis, Pháp" },
    { id: "/m/01l3wr", name: "Đức", stadium: "Sân vận động Allianz, Werner-Heisenberg-Allee 25, 80939 München, Đức" },
    { id: "/m/02rqxc", name: "Bồ Đào Nha", stadium: "Estádio do Sport Lisboa e Benfica, Av. Eusébio da Silva Ferreira, 1500-313 Lisboa, Bồ Đào Nha" },
    { id: "/m/01_1kk", name: "PSG", stadium: "Parc des Princes, 24 Rue du Commandant Guilbaud, 75016 Paris, Pháp" },
    { id: "/m/03x6m", name: "Inter", stadium: "Sân vận động Giuseppe Meazza, Piazzale Angelo Moratti, 20151 Milano MI, Ý" },
    { id: "/m/0_ll3j7", name: "Inter Miami", stadium: "Sân vận động Lockhart, 1350 NW 55th St, Fort Lauderdale, FL 33309, Hoa Kỳ" },
    { id: "/m/042rlf", name: "Al Hilal", stadium: "KINGDOM ARENA, RRHB7787، 7787، 3168 Akkah, حي حطين، Riyadh 13516, Ả Rập Xê-út" },
    { id: "/m/045xx", name: "Juventus", stadium: "Sân vận động Juventus, Corso Gaetano Scirea, 50, 10151 Torino TO, Ý" },
    { id: "/m/0196bp", name: "Sunderland", stadium: "Sân vận động Ánh sáng, Monkwearmouth, Sunderland SR5 1SU, Vương Quốc Anh" },
    { id: "/m/0212mp", name: "Burnley", stadium: "Turf Moor Stadium, 56 Yorkshire St, Burnley BB11 3BN, Vương Quốc Anh" },
    { id: "/m/01xn7x1", name: "Leeds", stadium: "Elland Road, Elland Rd, Beeston, Leeds LS11 0ES, Vương Quốc Anh" },

  ];


  // trang danh sách trận đấu
  if (window.location.href.includes("google.com/search")) {
    themBieuTuongVaoDivTranDau();
    themBieuTuongCanhDivMuaVe();

    // các trang có thể biến đổi mà không cần load lại nên xử lý qua click vùng trống
    document.addEventListener('click', function (event) {
      themBieuTuongVaoDivTranDau();
      themBieuTuongCanhDivMuaVe();
    });
  }

  // trang thêm lịch
  if (window.location.href.includes("ofe=true")) {
    tinhChinhThem();
  }

  function themBieuTuongVaoDivTranDau() {
    const divTranDaus = [...document.querySelectorAll('div[data-df-match-mid]')]
      .filter(div => !div.querySelector('.imspo_mt__t-sc'));
    divTranDaus.forEach(div => {
      const tdsWithTeamMid = Array.from(div.querySelectorAll('td[data-df-team-mid]')); // 2 phần tử    
      if (tdsWithTeamMid.length == 2) {
        const firstTd = tdsWithTeamMid[0];
        const secondTd = tdsWithTeamMid[1];
        const firstTeamMid = firstTd.getAttribute('data-df-team-mid');
        const secondTeamMid = secondTd.getAttribute('data-df-team-mid');
        const team1 = TEAMS.find(t => t.id === firstTeamMid);
        const team2 = TEAMS.find(t => t.id === secondTeamMid);
        if (team1 && team2) {
          let targetTd = div.querySelector('td.GOsQPe:not(:has(div.BbrjBe)):not(:has(img))'); // GOsQPe: vùng thời gian; BbrjBe: vùng link youtube kết quả (đã đấu)
          if (targetTd) {
            const img = document.createElement('img');
            img.alt = 'Thêm vào Google Calendar';
            img.src = chrome.runtime.getURL("add.png");;
            img.style.width = "30px";
            img.style.height = "30px";
            img.addEventListener('click', function (event) {
              event.stopPropagation();
              const text = team1.name + " vs " + team2.name;
              const startTime = div.getAttribute('data-start-time');
              const dates = convertISOToCompactFormat(startTime);
              const location = team1.stadium;
              const details = '';
              openGoogleCalendarAdding(text, dates, location, details);
            });
            targetTd.appendChild(img);
          }
        }
      }
    });
  }

  // chọn map, chọn Lịch thi đấu bóng đá
  function tinhChinhThem() {
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
  }

  function themBieuTuongCanhDivMuaVe() {
    const divMuaVes = document.querySelectorAll('div[jsname="s2gQvd"]:not(:has(img))'); // div mua vé
    if (divMuaVes.length > 0) {
      const divMuaVe = divMuaVes[0];
      const img = document.createElement('img');
      img.alt = 'Thêm vào Google Calendar';
      img.src = chrome.runtime.getURL("add.png");;
      img.style.width = "30px";
      img.style.height = "30px";
      img.style.float = "right";
      img.addEventListener('click', function (event) {
        event.stopPropagation();
        const thoiGian = document.querySelector('span.imso_mh__lr-dt-ds').textContent;
        const divsDoi = document.querySelectorAll('div[jscontroller="QhKwbc"]');
        const doi1id = divsDoi[0].getAttribute('data-df-team-mid') || '';
        const doi2id = divsDoi[1].getAttribute('data-df-team-mid') || '';
        const team1 = TEAMS.find(t => t.id === doi1id);
        const team2 = TEAMS.find(t => t.id === doi2id);
        if (team1 && team2) {
          const title = team1.name + " vs " + team2.name;
          const time = convertToISOWithEndTime(thoiGian);
          const location = team1.stadium;
          openGoogleCalendarAdding(title, time, location, '');
        }
      });
      divMuaVe.appendChild(img);
    }
  }

  function openGoogleCalendarAdding(text, dates, location, details) {
    let url = GOOGLE_CALENDAR_LINK;
    if (text) {
      url += "&text=" + text;
    }
    if (dates) {
      url += "&dates=" + dates;
    }
    if (location) {
      url += "&location=" + location;
    }
    if (details) {
      url += "&details=" + details;
    }
    window.open(url, '_blank');
  };

  function convertISOToCompactFormat(dateString) {
    // Parse the input date string as a Date object in UTC
    const date = new Date(dateString);

    // Convert the date to GMT+7 (UTC+7)
    const offset = 7 * 60 * 60 * 1000; // 7 hours in milliseconds
    const gmt7Date = new Date(date.getTime() + offset);

    // Extract the components of the date
    const year = gmt7Date.getUTCFullYear();
    const month = String(gmt7Date.getUTCMonth() + 1).padStart(2, '0'); // Months are 0-based, so add 1
    const day = String(gmt7Date.getUTCDate()).padStart(2, '0');
    const hours = String(gmt7Date.getUTCHours()).padStart(2, '0');
    const minutes = String(gmt7Date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(gmt7Date.getUTCSeconds()).padStart(2, '0');

    const startDate = new Date(year, parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 2);

    // Định dạng lại thành chuỗi "yyyyMMddThhmmssZ" (chuyển thành giờ UTC)
    const formattedStartDate = startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const formattedEndDate = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    return `${formattedStartDate}/${formattedEndDate}`;

  }

  function convertToISOWithEndTime(thoiGian) {
    const parts = thoiGian.trim().split(', ');
    let datePart, timePart;
    if (parts.length === 3) {
      // Th 3, 1/7, 08:00
      datePart = parts[1];
      timePart = parts[2];
    } else if (parts.length === 2) {
      const firstPart = parts[0];
      if (firstPart == "Hôm nay") {
        // Hôm nay, 23:00
        datePart = getHomNay();
        timePart = parts[1];
      } else if (firstPart == "Ngày mai") {
        // Ngày mai, 23:00
        datePart = getNgayMai();
        timePart = parts[1];
      } else {
        // 23/8, 21:00
        datePart = parts[0];
        timePart = parts[1];
      }
    } else {
      throw new Error("Định dạng không hợp lệ");
    }
    const [day, month] = datePart.split('/');
    const [hours, minutes] = timePart.split(':');
    const currentYear = new Date().getFullYear();
    const startDate = new Date(currentYear, parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 2);
    // Định dạng lại thành chuỗi "yyyyMMddThhmmssZ" (chuyển thành giờ UTC)
    const formattedStartDate = startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const formattedEndDate = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    return `${formattedStartDate}/${formattedEndDate}`;
  }

  function getHomNay() {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1; // tháng bắt đầu từ 0 nên cần cộng thêm 1
    return `${day}/${month}`;
  }

  function getNgayMai() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const day = tomorrow.getDate();
    const month = tomorrow.getMonth() + 1; // months are 0-indexed
    return `${day}/${month}`;
  }

}

addGoogleCalendar();

// Kiểm tra nếu popup chưa được tạo
if (!document.getElementById("my-floating-popup")) {
  const iframe = document.createElement("iframe");
  iframe.id = "my-floating-popup";
  iframe.src = chrome.runtime.getURL("popup.html");

  chrome.storage.local.get(["popupLeft", "popupTop"], (result) => {
    const left = result["popupLeft"] || "20px";
    const top = result["popupTop"] || "20px";
    iframe.style.position = "fixed";
    iframe.style.left = left;
    iframe.style.top = top;
    iframe.style.width = "300px";
    iframe.style.height = "150px";
    iframe.style.zIndex = "999999";
    iframe.style.border = "none";
    iframe.style.borderRadius = "10px";
    iframe.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";
    iframe.style.background = "white";
    iframe.style.resize = "both";
    iframe.style.overflow = "hidden";

    document.body.appendChild(iframe);
  });



  // Nhận thông điệp từ iframe
  window.addEventListener("message", (event) => {
    if (event.source !== iframe.contentWindow) return;
    if (!event.data || typeof event.data !== "object") return;

    if (event.data.action === "close_popup") {
      iframe.remove();
    }

    if (event.data.action === "move_popup") {
      const dx = event.data.dx;
      const dy = event.data.dy;

      const currentLeft = parseInt(iframe.style.left, 10) || 0;
      const currentTop = parseInt(iframe.style.top, 10) || 0;

      const newLeft = currentLeft + dx;
      const newTop = currentTop + dy;

      iframe.style.left = `${newLeft}px`;
      iframe.style.top = `${newTop}px`;

      // Lưu lại
      chrome.storage.local.set({
        ["popupLeft"]: iframe.style.left,
        ["popupTop"]: iframe.style.top
      });
    }
  });
}