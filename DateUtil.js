/**
 * dateUtil.js
 * Các hàm tiện ích xử lý ngày tháng
 */

const DateUtil = {

  /**
   * Trả về chuỗi ngày hiện tại theo định dạng dd.MM.yyyy
   * @returns {string}
   */
  getDDMMYYYYHienTai() {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}.${month}.${year}`;
  },

  /**
   * Định dạng đối tượng Date thành chuỗi dd.MM.yyyy
   * @param {Date} d
   * @returns {string}
   */
  formatDate(d) {
    return [
      String(d.getDate()).padStart(2, '0'),
      String(d.getMonth() + 1).padStart(2, '0'),
      d.getFullYear()
    ].join('.');
  },

  /**
   * Parse chuỗi dd.MM.yyyy thành đối tượng Date
   * @param {string} dateStr - Chuỗi ngày theo định dạng dd.MM.yyyy
   * @returns {Date}
   */
  parseDate(dateStr) {
    const [day, month, year] = dateStr.split('.').map(Number);
    return new Date(year, month - 1, day);
  },

  /**
   * Lấy thông tin tuần từ một ngày cho trước
   * @param {string} dateStr - Chuỗi ngày theo định dạng dd.MM.yyyy
   * @returns {{
   *   week: number,
   *   month: string,
   *   startOfWeek: string,
   *   endOfWeek: string,
   *   weekYear: number,
   *   daysOfWeek: string[]
   * }}
   */
  getInfoWeek(dateStr) {
    const date = DateUtil.parseDate(dateStr);

    // 0 = Monday
    const dayOfWeek = (date.getDay() + 6) % 7;

    // Monday và Sunday
    const monday = new Date(date);
    monday.setDate(date.getDate() - dayOfWeek);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // Tính tuần theo ISO 8601
    const thursday = new Date(monday);
    thursday.setDate(monday.getDate() + 3);
    const weekYear = thursday.getFullYear();

    const firstThursday = new Date(weekYear, 0, 4);
    const firstThursdayDay = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - firstThursdayDay + 3);

    const diffInDays = (monday - firstThursday) / (1000 * 60 * 60 * 24);
    const weekNumber = 1 + Math.round(diffInDays / 7);

    // Tạo mảng các ngày trong tuần theo định dạng dd.MM.yyyy
    const daysOfWeek = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      daysOfWeek.push(DateUtil.formatDate(d));
    }

    return {
      week: weekNumber,
      month: String(sunday.getMonth() + 1).padStart(2, '0'),
      startOfWeek: DateUtil.formatDate(monday),
      endOfWeek: DateUtil.formatDate(sunday),
      weekYear,
      daysOfWeek
    };
  },

  /**
   * Hiển thị ngày hiện tại lên element có id="current-date"
   */
  hienThiNgayHienTai() {
    const today = new Date();
    document.getElementById("current-date").textContent = today.toLocaleDateString('vi-VN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

};