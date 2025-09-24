
function doPost(e) {
  try {
    const { key, duLieu } = JSON.parse(e.postData.contents);
    const props = PropertiesService.getScriptProperties();
    if (key !== props.getProperty('PASS')) return ReturnUtils.jsonError('Sai mật khẩu');
    const sheetId = props.getProperty('SHEET_ID');
    if (!sheetId) return ReturnUtils.jsonError('Chưa có sheet được cấu hình');
    if (!Array.isArray(duLieu) || !duLieu.length) return ReturnUtils.jsonError('Dữ liệu không hợp lệ hoặc thiếu mục duLieu');
    const sheet = SpreadsheetApp.openById(sheetId).getActiveSheet();
    // Nếu sheet trống, tạo header và thiết lập data validation cho cột thể loại
    if (sheet.getLastRow() === 0) {
      // Tạo dòng tiêu đề
      sheet.getRange(1, 1, 1, 4).setValues([['thoiGian', 'theLoai', 'noiDungText', 'noiDungHtml']]);
      // Thiết lập data validation cho cột B (theLoai)
      sheet.getRange('B:B').setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(['Điều đang có', 'Sự giúp đỡ', 'Bài học', 'Tạo hoá', 'Điều vô hình', 'NVC', 'Khác'])
          .setAllowInvalid(false).build()
      );
    }
    // Chuẩn bị dữ liệu để insert vào sheet: mỗi phần tử là 1 dòng gồm thời gian, thể loại, nội dung text, nội dung html
    const dataToInsert = duLieu.map(item => [
      item.thoiGian ? formatTime(item.thoiGian) : '',
      item.theLoai || '',
      item.noiDungText || '',
      item.noiDungHtml || ''
    ]);
    // Ghi dữ liệu vào sheet nếu có dữ liệu
    if (dataToInsert.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, dataToInsert.length, 4).setValues(dataToInsert);
    }
    return ReturnUtils.jsonSuccess(`Đã lưu thành công ${dataToInsert.length} bản ghi`);
  } catch (error) {
    return ReturnUtils.jsonError('Có lỗi xảy ra: ' + error);
  }
}

function formatTime(iso) {
  const d = new Date(iso);
  return [d.getDate(), d.getMonth() + 1, d.getFullYear()].map(n => String(n).padStart(2, '0')).join('.') +
    ' ' + [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
}

// Thiết lập Sheet ID
function setupSheetId() {
  const sheetId = 'YOUR_SHEET_ID_HERE';
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', sheetId);
  console.log('Đã thiết lập Sheet ID:', sheetId);
}

// Test hàm doPost
function testDoPost() {
  const testData = {
    postData: {
      contents: JSON.stringify({
        tongSoMuc: 1,
        thoiGianTao: '2025-09-18T11:34:06.534Z',
        duLieu: [{
          soThuTu: 1,
          thoiGian: '2025-09-18T11:34',
          theLoai: 'Sự giúp đỡ',
          noiDungText: 'fdsfdsfsdf',
          noiDungHtml: '<p>fdsfdsfsdf</p>'
        }]
      })
    }
  };
  const result = doPost(testData);
  console.log(result.getContent());
}