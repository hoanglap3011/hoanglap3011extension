
/**
 * Tính số tuần hiện tại trong năm (theo chuẩn ISO hoặc gần đúng)
 * @returns {number} Số tuần tính từ đầu năm đến hiện tại
 */
export function getCurrentWeekNumber() {
  const today = new Date();
  const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
  // Số ngày đã trôi qua từ đầu năm
  const pastDaysOfYear = (today - firstDayOfYear) / 86400000;
  // Tính số tuần (làm tròn lên)
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}