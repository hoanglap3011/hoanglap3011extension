// handleLichThiDau.js
// Chỉ xử lý nghiệp vụ thêm icon Google Calendar vào lịch thi đấu trên các trang phù hợp
// Chỉ cần đảm bảo rằng teams.js đã được inject trước khi chạy đoạn này
// TEAMS is now provided by teams.js and attached to window.TEAMS
// Nghiệp vụ: Thêm icon Google Calendar vào lịch thi đấu trên Google Search
(function handleLichThiDau() {
    themBieuTuongVaoDivTranDau();
    themBieuTuongCanhDivMuaVe();
    document.addEventListener('click', function () {
        themBieuTuongVaoDivTranDau();
        themBieuTuongCanhDivMuaVe();
    });


    function themBieuTuongVaoDivTranDau() {
        const TEAMS = window.TEAMS || [];
        const divTranDaus = [...document.querySelectorAll('div[data-df-match-mid]')]
            .filter(div => !div.querySelector('.imspo_mt__t-sc'));
        divTranDaus.forEach(div => {
            const tdsWithTeamMid = Array.from(div.querySelectorAll('td[data-df-team-mid]'));
            if (tdsWithTeamMid.length == 2) {
                const firstTd = tdsWithTeamMid[0];
                const secondTd = tdsWithTeamMid[1];
                const firstTeamMid = firstTd.getAttribute('data-df-team-mid');
                const secondTeamMid = secondTd.getAttribute('data-df-team-mid');
                const team1 = TEAMS.find(t => t.id === firstTeamMid);
                const team2 = TEAMS.find(t => t.id === secondTeamMid);
                if (team1 && team2) {
                    let targetTd = div.querySelector('td.GOsQPe:not(:has(div.BbrjBe)):not(:has(img))');
                    if (targetTd) {
                        const img = document.createElement('img');
                        img.alt = 'Thêm vào Google Calendar';
                        img.src = chrome.runtime.getURL("add.png");
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

    function themBieuTuongCanhDivMuaVe() {
        const TEAMS = window.TEAMS || [];
        const divMuaVes = document.querySelectorAll('div[jsname="s2gQvd"]:not(:has(img))');
        if (divMuaVes.length > 0) {
            const divMuaVe = divMuaVes[0];
            const img = document.createElement('img');
            img.alt = 'Thêm vào Google Calendar';
            img.src = chrome.runtime.getURL("add.png");
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
        let url = 'https://calendar.google.com/calendar/u/0/r/eventedit?ofe=true&crm=AVAILABLE';
        if (text) url += "&text=" + text;
        if (dates) url += "&dates=" + dates;
        if (location) url += "&location=" + location;
        if (details) url += "&details=" + details;
        window.open(url, '_blank');
    }

    function convertISOToCompactFormat(dateString) {
        const date = new Date(dateString);
        const offset = 7 * 60 * 60 * 1000;
        const gmt7Date = new Date(date.getTime() + offset);
        const year = gmt7Date.getUTCFullYear();
        const month = String(gmt7Date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(gmt7Date.getUTCDate()).padStart(2, '0');
        const hours = String(gmt7Date.getUTCHours()).padStart(2, '0');
        const minutes = String(gmt7Date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(gmt7Date.getUTCSeconds()).padStart(2, '0');
        const startDate = new Date(year, parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
        const endDate = new Date(startDate);
        endDate.setHours(endDate.getHours() + 2);
        const formattedStartDate = startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const formattedEndDate = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        return `${formattedStartDate}/${formattedEndDate}`;
    }

    function convertToISOWithEndTime(thoiGian) {
        const parts = thoiGian.trim().split(', ');
        let datePart, timePart;
        if (parts.length === 3) {
            datePart = parts[1];
            timePart = parts[2];
        } else if (parts.length === 2) {
            const firstPart = parts[0];
            if (firstPart == "Hôm nay") {
                datePart = getHomNay();
                timePart = parts[1];
            } else if (firstPart == "Ngày mai") {
                datePart = getNgayMai();
                timePart = parts[1];
            } else {
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
        const formattedStartDate = startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const formattedEndDate = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        return `${formattedStartDate}/${formattedEndDate}`;
    }

    function getHomNay() {
        const today = new Date();
        const day = today.getDate();
        const month = today.getMonth() + 1;
        return `${day}/${month}`;
    }

    function getNgayMai() {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const day = tomorrow.getDate();
        const month = tomorrow.getMonth() + 1;
        return `${day}/${month}`;
    }
})();
