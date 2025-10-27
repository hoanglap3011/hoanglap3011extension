(async function () {
    const TYPE_CALENDAR = "lichthidau";

    const ICON_URL = document.documentElement?.dataset?.extAddIcon || "";
    const TEAMS_URL = document.documentElement?.dataset?.extTeamsData || "";

    // Load dữ liệu đội bóng
    let teamsArray = [];
    try {
        const res = await fetch(TEAMS_URL);
        teamsArray = await res.json();
    } catch (e) {
        console.warn("⚠️ Không thể load football-teams.json:", e);
    }

    // Tạo map để tra nhanh theo id hoặc name
    const teamMap = {};
    for (const t of teamsArray) {
        if (t.id) teamMap[t.id] = t;
        if (t.name) teamMap[t.name.toLowerCase()] = t;
        if (t.name_alias) teamMap[t.name_alias.toLowerCase()] = t;
    }

    const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    const createAddButton = () => {
        const img = document.createElement("img");
        img.src = ICON_URL;
        img.alt = "Add";
        img.title = "Thêm trận";
        Object.assign(img.style, {
            width: "28px",
            height: "28px",
            cursor: "pointer",
            objectFit: "contain",
            display: "inline-block", // Đổi thành inline-block để dễ căn chỉnh
        });
        return img;
    };

    const toCompactUTC = (d) => {
        if (!d || isNaN(d)) return null;
        const pad = (n) => (n < 10 ? "0" + n : n);
        return (
            d.getUTCFullYear().toString() +
            pad(d.getUTCMonth() + 1) +
            pad(d.getUTCDate()) +
            "T" +
            pad(d.getUTCHours()) +
            pad(d.getUTCMinutes()) +
            pad(d.getUTCSeconds()) +
            "Z"
        );
    };

    const parseDateTime = (dateText, timeText, block) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let d = null;

        if (/hôm nay|hom nay/i.test(dateText)) d = new Date(today);
        else if (/hôm qua|hom qua/i.test(dateText)) {
            d = new Date(today);
            d.setDate(d.getDate() - 1);
        } 
        else if (/ngày mai|ngay mai/i.test(dateText)) {
            d = new Date(today);
            d.setDate(d.getDate() + 1);
        } 
        else {
            const m = dateText.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
            if (m) {
                const dd = parseInt(m[1]);
                const mm = parseInt(m[2]);
                d = new Date(now.getFullYear(), mm - 1, dd);
            }
        }

        if (!d) return null;

        const searchArea = [timeText, block?.innerText].join(" ");
        const mt = searchArea.match(/(\d{1,2}):(\d{2})/);
        if (mt) {
            d.setHours(parseInt(mt[1]));
            d.setMinutes(parseInt(mt[2]));
        }

        return d;
    };

    const extractTeams = (block) => {
        const teamNames = [];
        const teamIds = [];

        qa("td[data-df-team-mid]", block).forEach((td) => {
            const id = td.getAttribute("data-df-team-mid");
            if (id && !teamIds.includes(id)) teamIds.push(id);

            const nameNode = td.closest("tr")?.querySelector(".ellipsisize span[aria-hidden='true'], .liveresults-sports-immersive__hide-element");
            const name = (nameNode?.innerText || "").trim();
            if (name && !teamNames.includes(name)) teamNames.push(name);
        });

        return {
            team1: teamNames[0] || null,
            team2: teamNames[1] || null,
            team1_id: teamIds[0] || null,
            team2_id: teamIds[1] || null,
        };
    };

    const parseBlock = (block) => {
        if (block.dataset.extAddInjected) return null;

        const node = block.querySelector("[data-start-time]");
        const isoAttr = node?.getAttribute("data-start-time");

        const dateElem = block.querySelector(".imspo_mt__date");
        const timeElem = block.querySelector(".imspo_mt__ndl-p");

        const dateText = (dateElem?.innerText || "").trim();
        const timeText = (timeElem?.innerText || "").trim();

        const { team1, team2, team1_id, team2_id } = extractTeams(block);

        let d = null;
        if (isoAttr) {
            d = new Date(isoAttr);
        } else {
            d = parseDateTime(dateText, timeText, block);
        }

        if (!team1 || !team2 || !d) return null;

        const start_time = toCompactUTC(d);
        const end_time = toCompactUTC(new Date(d.getTime() + 120 * 60000)); // +120 phút

        const stadium =
            teamMap[team1_id]?.stadium ||
            teamMap[team1?.toLowerCase()]?.stadium ||
            "";

        return {
            team1,
            team2,
            team1_id,
            team2_id,
            stadium,
            start_time,
            end_time,
            datetime_local: d.toLocaleString(),
        };
    };

    const getTeamNameFromNode = (node) => {
        if (!node) return null;
        
        let el = node.querySelector(".liveresults-sports-immersive__hide-element");
        let name = el?.innerText?.trim();
        if (name) return name;

        el = node.querySelector("span[aria-hidden='true']");
        name = el?.innerText?.trim();
        if (name) return name;
        
        el = node.querySelector(".imso_mh__tm-nm");
        name = el?.innerText?.trim();
        if (name) return name; 

        return null;
    };

    const parseMainHeaderBlock = (block) => {
        try {
            const t1_node = block.querySelector(".imso_mh__first-tn-ed");
            const t2_node = block.querySelector(".imso_mh__second-tn-ed");

            if (!t1_node || !t2_node) return null;

            const team1_id = t1_node.getAttribute("data-df-team-mid");
            const team2_id = t2_node.getAttribute("data-df-team-mid");
            
            const team1 = getTeamNameFromNode(t1_node);
            const team2 = getTeamNameFromNode(t2_node);

            const dtString = block.querySelector(".imso_mh__lr-dt-ds")?.innerText?.trim();
            
            if (!dtString) { 
                 console.warn("⚠️ Không thể parse header: không tìm thấy chuỗi ngày giờ .imso_mh__lr-dt-ds");
                 return null;
            }
            
            const d = parseDateTime(dtString, dtString, block);

            if (!team1 || !team2 || !d) {
                console.warn(`⚠️ Không thể parse header. Chi tiết: team1=${team1}, team2=${team2}, dateFound=${d}, rawDateString='${dtString}'`);
                return null;
            }

            const start_time = toCompactUTC(d);
            const end_time = toCompactUTC(new Date(d.getTime() + 120 * 60000)); // +120 phút

            const stadium =
                teamMap[team1_id]?.stadium ||
                teamMap[team1?.toLowerCase()]?.stadium ||
                "";

            return {
                team1,
                team2,
                team1_id,
                team2_id,
                stadium,
                start_time,
                end_time,
                datetime_local: d.toLocaleString(),
            };
        } catch (e) {
            console.error("Lỗi khi parseMainHeaderBlock:", e);
            return null;
        }
    };


    const insertButton = (block, btn) => {
        const timeWrap = block.querySelector(".imspo_mt__ns-pm-s") || block.querySelector(".wrFIWe");
        const row = document.createElement("div");
        Object.assign(row.style, { display: "flex", justifyContent: "center", marginTop: "6px" });
        row.appendChild(btn);
        if (timeWrap) timeWrap.insertAdjacentElement("afterend", row);
        else block.appendChild(row);
    };

    // +++ CẬP NHẬT: Viết lại hàm này để sửa lỗi căn chỉnh +++
    const scanAndAttachMainHeader = () => {
        const mainHeaderBlock = document.querySelector("div.imso_mh__mh-ed"); 
        
        if (!mainHeaderBlock || mainHeaderBlock.dataset.extAddInjected) return;

        const info = parseMainHeaderBlock(mainHeaderBlock);
        if (!info) {
             mainHeaderBlock.dataset.extAddInjected = "failed";
            return;
        }

        // 1. Tạo nút (img)
        const btn = createAddButton();
        // Thay đổi style cho phù hợp với các icon bên cạnh
        Object.assign(btn.style, { 
            width: "24px", 
            height: "24px",
            verticalAlign: "middle" // Căn giữa cái ảnh bên trong "chip"
        });

        btn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            openGoogleCalendarAdding(info.team1 + " vs " + info.team2, info.start_time + "/" + info.end_time, info.stadium, "");
        };

        // 2. Tạo "chip" (div wrapper) để bọc nút
        const newChip = document.createElement("div");
        newChip.className = "imso-li-w"; // Dùng class chung của các nút "Xem trực tiếp", "Mua vé"
        Object.assign(newChip.style, {
            display: "inline-block", // Hiển thị
            verticalAlign: "middle", // Căn giữa "chip" này với các "chip" khác
            marginLeft: "8px",       // Tạo khoảng cách với nút "Mua vé"
        });
        newChip.appendChild(btn); // Đặt nút (img) vào trong "chip"

        // 3. Tìm vị trí và chèn "chip"
        const buyTicketLink = mainHeaderBlock.querySelector("a[href*='q=V%C3%A9']");
        const buyTicketWrapper = buyTicketLink?.closest(".imso-li-w"); 

        if (buyTicketWrapper) {
            // Chèn CÁI CHIP (div) vào sau wrapper "Mua vé"
            buyTicketWrapper.insertAdjacentElement("afterend", newChip);
        } else {
            // Fallback: Nếu không tìm thấy nút "Mua vé", chèn vào cuối container
            const buttonContainer = mainHeaderBlock.querySelector(".sNZGXd g-scrolling-carousel div[jsname='s2gQvd']");
            if (buttonContainer) {
                buttonContainer.appendChild(newChip);
            }
        }

        mainHeaderBlock.dataset.extAddInjected = "1";
    };

    const scanAndAttach = () => {
        const blocks = qa("div.imso-loa.imso-ani");
        for (const b of blocks) {
            if (b.closest(".imso_mh__mh-ed")) continue;

            const info = parseBlock(b);
            if (!info) continue;

            const btn = createAddButton();
            btn.onclick = (e) => {
                e.stopPropagation();
                openGoogleCalendarAdding(info.team1 + " vs " + info.team2, info.start_time + "/" + info.end_time, info.stadium, "");

            };

            insertButton(b, btn);
            b.dataset.extAddInjected = "1";
        }
    };

    const openGoogleCalendarAdding = (text, dates, location, details) => {
        let url = 'https://calendar.google.com/calendar/u/0/r/eventedit?ofe=true&crm=AVAILABLE';
        if (text) url += "&text=" + encodeURIComponent(text);
        if (dates) url += "&dates=" + encodeURIComponent(dates);
        if (location) url += "&location=" + encodeURIComponent(location);
        if (details) url += "&details=" + encodeURIComponent(details);
        url += "&calendar=" + TYPE_CALENDAR;
        window.open(url, '_blank');
    }

    const runAllScans = () => {
        scanAndAttach(); 
        scanAndAttachMainHeader(); 
    };

    new MutationObserver(() => runAllScans()).observe(document, { childList: true, subtree: true });
    setTimeout(runAllScans, 600);
})();