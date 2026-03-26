// api
const API = 
"https://script.google.com/macros/s/AKfycbzDsNSqsJd9BVD-kpcF0CWK1V38NEh8iAayqNy5C9V3fdZAik-10KhCjS11XL71xBCVaA/exec"
;

const API_ACTION_GET_SUMMARY_BY_CODE = "getSummaryByCode";
const API_ACTION_GET_SUMMARY_BY_CATEGORY = "getSummariesByCategory";
const API_ACTION_GET_QUOTES = "getQuotes";
const API_ACTION_ADD_VIETGIDO = "addVietGiDo";
const API_ACTION_GET_DANHMUC_QUOTES = "getDanhMucAndQuote";
const API_ACTION_GET_TODOLIST_WEEK = "getToDoListWeek";
const API_ACTION_GET_METADATA_INTENT_TIME = "getMetaDataIntentTime";
const API_ACTION_ADD_INTENT_TIME_DATA = "addIntentTimeData";

// CACHE KEYS
const CACHE_PASS = "pass";
const CACHE_QUOTES = "quotes";

// hoanglap3011
const CACHE_TODOLIST = "todolist";

// vietgido
const CACHE_DANH_MUC = 'selectedDanhMuc';
const CACHE_AUTO_NEXT = 'autoNextSwitchState';
const CACHE_SHOW_TOOLBAR = 'showToolbarSwitchState';
const CACHE_HIDE_UNREQUIRED = 'hideUnrequiredSwitchState';
const CACHE_SHOW_CONGRATS = 'showCongratSwitchState';

// intent-time
const CACHE_HABIT_LIST = 'habitList';

// recap
const CACHE_DATA_RECAP = 'dataRecap';

// facebook
const MIN_SUMMARY_LENGTH = 1000;

// youtube
const YOUTUBE_PANEL_FIXED_HEIGHT = "230px";

// =======================================================
// --- CÀI ĐẶT TOÀN BỘ EXTENSION (ĐÃ CHUẨN HÓA) ---
// =======================================================

// Từ khóa ẩn khối mặc định cho Facebook
const DEFAULT_FB_KEYWORDS = [
    "Những người bạn có thể biết",
    "People You May Know",
    "Reels",
    "Phòng họp mặt và Reels",
    "Được đề xuất cho bạn",
    "Suggested for you",
    "Bí Mật Showbiz"
];

// Danh sách chặn website mặc định
// Cú pháp mỗi dòng: url | duration(HH:MM) | allowed_frames(HH:MM-HH:MM,...)
// Chỉ url là bắt buộc. Dòng bắt đầu bằng # là comment.
const DEFAULT_WEBSITE_BLOCKLIST = `# Chặn vĩnh viễn
tiktok.com

# Giới hạn thời gian + khung giờ
vnexpress.net | 00:10 | 12:00-14:00

# Chỉ giới hạn thời gian
voz.vn | 00:10`;

// Storage keys
const SETTINGS_KEY = 'LapsExtensionSettings';
const FB_KEYWORDS_KEY = 'fbBlockKeywordsList';
const WEBSITE_BLOCKLIST_KEY = 'websiteBlocklist';

// Cài đặt mặc định CHUNG
const DEFAULT_SETTINGS = {
    // Facebook
    fbEnableSummarize: true,
    fbEnableBlockByKeyword: true,
    fbEnableHideStories: true,
    
    // YouTube
    ytEnableHomepageHider: true,
    ytEnableSummaryBox: true,
    ytEnableHideRelated: true,
    ytEnableAutoSummarize: false,
    ytEnableAutoCloseNotebook: false
};
// =======================================================


// quick link hoanglap3011
const TODOLIST_ALL = "https://docs.google.com/spreadsheets/d/1ODqzKCpG_uZ_3YckZMiXNvhE6xGGulUEy7nICsdAQHo/edit";
const PARKING_LOT = "https://docs.google.com/spreadsheets/d/1wJioap23Z4zkycu-xdbaAyunw8mEvKrVON8isa3KQBs/edit?gid=1922680355#gid=1922680355";
const CALENDAR = "https://calendar.google.com/";
const PROBLEM = "https://docs.google.com/spreadsheets/d/1Ww9sdbQScZdNysDOvD8_1zCqxsi3r-K6FqIKLLoXSho/edit?gid=0#gid=0";
const SODSCD = "https://docs.google.com/document/d/12oVFyqe-yWjuwTW2YN74WPQl6N9xOcaR8KONvH81Ksg/edit?tab=t.0";
const TONGHOPTUAN = "";
const TONGHOPNGAY = "";
const NHACHOCTAP = "https://music.youtube.com/playlist?list=PLpl9CTbHHB9USqW2dcpaRsXaxbykPaIeg&si=vCiN_9xfrNvY6Pvo";
const POMODORO = "https://pomodorotimer.online/";
const HITTHO = "https://www.youtube.com/watch?v=QhIxGtxIFF4&list=PLpl9CTbHHB9W879FlKDxuke-rmCiRvCSW";
const VIPASSANA = "https://www.youtube.com/watch?v=PmuFF36uIxk&list=PLpl9CTbHHB9VnSnZ5yNLFBuDMp1g-P1Ti&index=8";
const METTA = "https://www.youtube.com/watch?v=8Unx4chbLl0&list=PLpl9CTbHHB9VnSnZ5yNLFBuDMp1g-P1Ti&index=1";
const ENGLISH = "";
const NHACTICHCUCDONGLUC = "https://music.youtube.com/playlist?list=PLpl9CTbHHB9Wy7WRZ8-28U0hcLATWA4OX";
const TINTONGHOP = "https://vnexpress.net/doi-song";
const TINTICHCUC = "https://baomoi.com/nang-luong-tich-cuc-top338.epi";
const MONHIEUAI = "";
const LICHTHIDAU = "https://www.24h.com.vn/bong-da/lich-thi-dau-bong-da-hom-nay-moi-nhat-c48a364371.html";
const GUITAR_EDUMALL = "https://www.edumall.vn/vn/course-player/hoc-guitar-dem-hat-cap-toc-trong-30-ngay";
const GYM_MUSIC = "https://music.youtube.com/playlist?list=PLpl9CTbHHB9WU4r1ptkQzWjKQ8g_ijIFa";
const NOTE_GIADINH = "https://docs.google.com/document/d/1Yn04JziVUUTyqUVNqKfKOeEBCDlulV9R1jJPITNpdEA/edit?tab=t.0#heading=h.eejeurvh6dwa";
const LAUGHT = "https://www.youtube.com/watch?v=e5e8RScN_dg&list=PLpl9CTbHHB9X2uQvoUN3Iwwo_QbKolgvM";
const DEEP = "https://www.youtube.com/watch?v=qX900P6POEU&list=PLpl9CTbHHB9UXfVctUpy4NzvNhsQ7s7dX";
const KINDLE = "kindle://";
const RANH = "https://docs.google.com/document/d/1ak5a0MpUnUpGpb42m_PFRkKtyvcsF1AohZJJ9dtqTUw/edit?usp=drivesdk";
const GOAL = "https://docs.google.com/spreadsheets/d/16IRD2vS0BO0UpRRkJHyVVXlBNqmw1qFd6n5G-0WvnkA/edit?gid=0#gid=0"
const HIT_THO_URLS = [
  "https://www.youtube.com/embed/QhIxGtxIFF4?si=umecJ5wXItfUmMoA",
  "https://www.youtube.com/embed/yauSdpw3mCs?si=pBiN49B_fn_Lyz32",
  "https://www.youtube.com/embed/dvqzksrjhpM?si=HDpOcbGCUshCKH9N",
  "https://www.youtube.com/embed/LwUyeKUred8?si=NqkPazXe2ilSp9JX"
];
const NHAC_VUI_URLS = [
  "https://www.youtube.com/embed/ubnDMTUui1Y?si=5GA7GJ_-o94fcSt5",
  "https://www.youtube.com/embed/bKhkqpWoWTU?si=k-CcDAioXVBYc7J9",
];