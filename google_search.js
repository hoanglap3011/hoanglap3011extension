// handleGoogle.js (content script)
(async function () {
  function removeDiacritics(str) {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name) || "";
  }

  if (!location.pathname.startsWith("/search")) return;

  const rawQ = decodeURIComponent(getQueryParam("q") || "");
  if (!rawQ) return;
  const q = removeDiacritics(rawQ).toLowerCase().replace(/\s+/g, " ").trim();

  try {
    const url = chrome.runtime.getURL("football-teams.json");
    const response = await fetch(url);
    const teams = await response.json();

    const aliasList = [];
    teams.forEach((team) => {
      // Xử lý name_alias như cũ (đã bỏ dấu + lowercase)
      const aliasesRaw = team.name_alias || team["name-alias"] || "";
      const parts = String(aliasesRaw)
        .split(";")
        .map((s) => removeDiacritics(s).toLowerCase().replace(/\s+/g, " ").trim())
        .filter(Boolean);
      aliasList.push(...parts);

      // Thêm name: cả có dấu lẫn không dấu, đều lowercase
      if (team.name) {
        const nameWithAccent = team.name.toLowerCase().replace(/\s+/g, " ").trim();
        const nameWithout = removeDiacritics(team.name).toLowerCase().replace(/\s+/g, " ").trim();
        aliasList.push(nameWithAccent);
        if (nameWithout !== nameWithAccent) {
          aliasList.push(nameWithout); // tránh push trùng nếu tên không có dấu
        }
      }
    });

    const extraKeywords = ["lich thi dau", "bang xep hang", "vleague", "v league", "cup fa"];
    extraKeywords.forEach((kw) => aliasList.push(removeDiacritics(kw).toLowerCase()));

    const matched = aliasList.some((alias) => q.includes(alias));
    if (matched) {
      // set URLs for assets
      const iconUrl = chrome.runtime.getURL("image/add.png");
      const dataUrl = chrome.runtime.getURL("football-teams.json");

      document.documentElement.dataset.extAddIcon = iconUrl;
      document.documentElement.dataset.extTeamsData = dataUrl;

      const s = document.createElement("script");
      s.src = chrome.runtime.getURL("handleFootballMatch.js");
      s.onload = function () { this.remove(); };
      (document.documentElement || document.head || document.body).appendChild(s);
    }
  } catch (err) {
    console.error("Lỗi khi kiểm tra alias hoặc từ khóa:", err);
  }
})();