// api
const API = "https://script.google.com/macros/s/AKfycby9m4Exj3U4L8OA8Be7Oidu6CwVZRIaZpnOoKdBigVA7m9UQvzfUASFQ9tO6DzkBHTh/exec";
const API_ACTION_GET_SUMMARY_BY_CODE = "getSummaryByCode";
const API_ACTION_GET_QUOTES = "getQuotes";
const API_ACTION_ADD_VIETGIDO = "addVietGiDo";
const API_ACTION_GET_DANHMUC_QUOTES = "getDanhMucAndQuote";

// youtube
const YOUTUBE_PANEL_FIXED_HEIGHT = "230px";

// CACHE KEYS
const CACHE_PASS = "pass";
const CACHE_QUOTES = "quotes";

// vietgido
const CACHE_DANH_MUC = 'selectedDanhMuc';
const CACHE_AUTO_NEXT = 'autoNextSwitchState';
const CACHE_SHOW_TOOLBAR = 'showToolbarSwitchState';
const CACHE_HIDE_UNREQUIRED = 'hideUnrequiredSwitchState';

// facebook
const MIN_SUMMARY_LENGTH = 1000; // Giới hạn tóm tắt là 150 ký tự