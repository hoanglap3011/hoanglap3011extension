function doGet(e) {
  try {
    // Lấy tham số từ request
    var params = e.parameter || {};
    var pass = params.pass || "";
    var dayParam = params.day || "";
    
    // Kiểm tra password
    var props = PropertiesService.getScriptProperties();
    var correctPass = props.getProperty('PASS');
    if (!correctPass) {
      return createErrorResponse("Chưa thiết lập PASS trong Properties");
    }
    // if (pass !== correctPass) {
    //   return createErrorResponse("Mật khẩu không đúng");
    // }
    
    // Xử lý tham số day
    var day;
    if (dayParam) {
      // Kiểm tra định dạng dd.MM.yyyy
      var dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
      if (!dateRegex.test(dayParam)) {
        return createErrorResponse("Định dạng ngày không đúng. Yêu cầu: dd.MM.yyyy");
      }
      
      // Kiểm tra ngày có hợp lệ không
      var parts = dayParam.split('.');
      var testDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      if (testDate.getDate() != parseInt(parts[0]) || 
          testDate.getMonth() != parseInt(parts[1]) - 1 || 
          testDate.getFullYear() != parseInt(parts[2])) {
        return createErrorResponse("Ngày không hợp lệ");
      }
      
      day = dayParam;
    } else {
      // Sử dụng ngày hiện tại
      var today = new Date();
      var dd = String(today.getDate()).padStart(2, '0');
      var mm = String(today.getMonth() + 1).padStart(2, '0');
      var yyyy = today.getFullYear();
      day = dd + '.' + mm + '.' + yyyy;
    }
    
    // Lấy ID folder từ Properties
    var folderId = props.getProperty('ID_FOLDER');
    if (!folderId) {
      return createErrorResponse("Chưa thiết lập ID_FOLDER trong Properties");
    }
    
    // Truy cập thư mục Drive
    var folder;
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (error) {
      return createErrorResponse("Không thể truy cập thư mục Drive với ID: " + folderId);
    }
    
    // Tìm file Google Sheet có tên "To Do List " + day
    var fileName = "To Do List " + day;
    var files = folder.getFilesByName(fileName);
    
    if (!files.hasNext()) {
      return createErrorResponse("Không tìm thấy file: " + fileName);
    }
    
    var file = files.next();
    
    // Kiểm tra xem có phải Google Sheet không
    if (file.getMimeType() !== MimeType.GOOGLE_SHEETS) {
      return createErrorResponse("File tìm thấy không phải là Google Sheet");
    }
    
    // Lấy thông tin liên lạc
    var contactText = props.getProperty('CONTACT') || "";
    
    // Tạo ảnh base64
    var base64Image = generateImage(day, contactText);
    console.log(base64Image);
    
    // Trả về kết quả thành công
    return createSuccessResponse(base64Image);
    
  } catch (error) {
    console.log(error);
    return createErrorResponse("Lỗi không xác định: " + error.toString());
  }
}

function createErrorResponse(errorMessage) {
  var response = {
    code: -1,
    error: errorMessage,
    base64Image: ""
  };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function createSuccessResponse(base64Image) {
  var response = {
    code: 0,
    error: "",
    base64Image: base64Image
  };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function generateImage(day, contactText) {
  // iPhone 15 Pro Max dimensions
  var width = 1290;
  var height = 2796;
  
  // Tính toán các vùng theo tỷ lệ yêu cầu
  var region1Height = Math.round(height * 0.20); // 1/5
  var region2Height = Math.round(height * (0.80 * 12.5 / 15)); // 4/5 * 12.5/15
  var region3Height = height - region1Height - region2Height; // 4/5 * 2.5/15
  
  var region1Y = 0;
  var region2Y = region1Height;
  var region3Y = region2Y + region2Height;
  
  // Padding cho vùng 3
  var paddingTB = 5;
  var paddingLR = 10;
  
  // Tính toán layout cho text trong vùng 3
  var contactLayout = layoutContactText(contactText, width - 2 * paddingLR, region3Height - 2 * paddingTB);
  
  // Tạo SVG với các brick cố định để test
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
    '<!-- Vùng 1: Trống, nền trắng -->' +
    '<rect x="0" y="' + region1Y + '" width="' + width + '" height="' + region1Height + '" fill="white"/>' +
    
    '<!-- Vùng 2: Border ngoài -->' +
    '<rect x="0" y="' + region2Y + '" width="' + width + '" height="' + region2Height + '" fill="none" stroke="black" stroke-width="1"/>' +
    
    '<!-- Vùng 2: Brick hàng 1 -->' +
    '<rect x="0" y="' + region2Y + '" width="300" height="60" fill="#FFFACD" stroke="black" stroke-width="1"/>' +
    '<text x="150" y="' + (region2Y + 35) + '" font-size="20" font-family="Helvetica" text-anchor="middle" dominant-baseline="middle" fill="black">Họp team buổi sáng</text>' +
    
    '<rect x="300" y="' + region2Y + '" width="250" height="60" fill="white" stroke="black" stroke-width="1"/>' +
    '<text x="425" y="' + (region2Y + 35) + '" font-size="20" font-family="Helvetica" text-anchor="middle" dominant-baseline="middle" fill="black">Viết báo cáo</text>' +
    
    '<rect x="550" y="' + region2Y + '" width="400" height="60" fill="#FFFACD" stroke="black" stroke-width="1"/>' +
    '<text x="750" y="' + (region2Y + 35) + '" font-size="20" font-family="Helvetica" text-anchor="middle" dominant-baseline="middle" fill="black">Chuẩn bị thuyết trình</text>' +
    
    '<rect x="950" y="' + region2Y + '" width="340" height="60" fill="white" stroke="black" stroke-width="1"/>' +
    '<text x="1120" y="' + (region2Y + 35) + '" font-size="20" font-family="Helvetica" text-anchor="middle" dominant-baseline="middle" fill="black">Kiểm tra email</text>' +
    
    '<!-- Vùng 2: Brick hàng 2 -->' +
    '<rect x="0" y="' + (region2Y + 60) + '" width="200" height="60" fill="white" stroke="black" stroke-width="1"/>' +
    '<text x="100" y="' + (region2Y + 95) + '" font-size="20" font-family="Helvetica" text-anchor="middle" dominant-baseline="middle" fill="black">Ăn trưa</text>' +
    
    '<rect x="200" y="' + (region2Y + 60) + '" width="350" height="60" fill="#FFFACD" stroke="black" stroke-width="1"/>' +
    '<text x="375" y="' + (region2Y + 95) + '" font-size="20" font-family="Helvetica" text-anchor="middle" dominant-baseline="middle" fill="black">Hoàn thành dự án</text>' +
    
    '<rect x="550" y="' + (region2Y + 60) + '" width="300" height="60" fill="white" stroke="black" stroke-width="1"/>' +
    '<text x="700" y="' + (region2Y + 95) + '" font-size="20" font-family="Helvetica" text-anchor="middle" dominant-baseline="middle" fill="black">Tham gia cuộc họp</text>' +
    
    '<rect x="850" y="' + (region2Y + 60) + '" width="440" height="60" fill="#FFFACD" stroke="black" stroke-width="1"/>' +
    '<text x="1070" y="' + (region2Y + 95) + '" font-size="20" font-family="Helvetica" text-anchor="middle" dominant-baseline="middle" fill="black">Làm bài thuyết trình</text>' +
    
    '<!-- Vùng 2: Brick hàng 3 -->' +
    '<rect x="0" y="' + (region2Y + 120) + '" width="400" height="60" fill="white" stroke="black" stroke-width="1"/>' +
    '<text x="200" y="' + (region2Y + 155) + '" font-size="20" font-family="Helvetica" text-anchor="middle" dominant-baseline="middle" fill="black">Kiểm tra tiến độ công việc</text>' +
    
    '<rect x="400" y="' + (region2Y + 120) + '" width="300" height="60" fill="#FFFACD" stroke="black" stroke-width="1"/>' +
    '<text x="550" y="' + (region2Y + 155) + '" font-size="20" font-family="Helvetica" text-anchor="middle" dominant-baseline="middle" fill="black">Gửi báo cáo cho sếp</text>' +
    
    '<rect x="700" y="' + (region2Y + 120) + '" width="590" height="60" fill="white" stroke="black" stroke-width="1"/>' +
    '<text x="995" y="' + (region2Y + 155) + '" font-size="20" font-family="Helvetica" text-anchor="middle" dominant-baseline="middle" fill="black">Cập nhật lịch làm việc</text>' +
    
    '<!-- Vùng 3: Thông tin liên lạc, nền trắng -->' +
    '<rect x="0" y="' + region3Y + '" width="' + width + '" height="' + region3Height + '" fill="white"/>' +
    
    '<!-- Text liên lạc căn giữa -->' +
    renderContactText(contactLayout, width, region3Y, region3Height, paddingTB) +
    '</svg>';
  
  // Encode to Base64
  var base64 = Utilities.base64Encode(svg, Utilities.Charset.UTF_8);
  return "data:image/svg+xml;base64," + base64;
}

function layoutContactText(text, maxWidth, maxHeight) {
  if (!text) return { lines: [], fontSize: 12, lineHeight: 14, totalHeight: 0 };
  
  var minFontSize = 12;
  var maxFontSize = Math.min(48, Math.floor(maxHeight * 0.5));
  var lineHeightMultiplier = 1.2;
  
  // Bắt đầu với font size lớn và giảm dần nếu không fit
  for (var fontSize = maxFontSize; fontSize >= minFontSize; fontSize--) {
    var lineHeight = Math.ceil(fontSize * lineHeightMultiplier);
    var lines = wrapText(text, fontSize, maxWidth);
    var totalHeight = lines.length * lineHeight;
    
    if (totalHeight <= maxHeight || fontSize === minFontSize) {
      return {
        lines: lines,
        fontSize: fontSize,
        lineHeight: lineHeight,
        totalHeight: totalHeight
      };
    }
  }
  
  return { lines: [], fontSize: minFontSize, lineHeight: minFontSize * lineHeightMultiplier, totalHeight: 0 };
}

function wrapText(text, fontSize, maxWidth) {
  if (!text) return [];
  
  var avgCharWidth = fontSize * 0.6;
  var words = text.replace(/\s+/g, ' ').trim().split(' ');
  var lines = [];
  var currentLine = "";
  
  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    var testLine = currentLine ? currentLine + " " + word : word;
    
    if (estimateTextWidth(testLine, fontSize) <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        var chars = word.split('');
        var partialWord = "";
        for (var j = 0; j < chars.length; j++) {
          var testPartial = partialWord + chars[j];
          if (estimateTextWidth(testPartial, fontSize) <= maxWidth) {
            partialWord = testPartial;
          } else {
            if (partialWord) {
              lines.push(partialWord);
              partialWord = chars[j];
            } else {
              lines.push(chars[j]);
            }
          }
        }
        currentLine = partialWord;
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

function estimateTextWidth(text, fontSize) {
  return text.length * fontSize * 0.6;
}

function renderContactText(layout, containerWidth, containerY, containerHeight, paddingTB) {
  if (layout.lines.length === 0) return "";
  
  var centerX = containerWidth / 2;
  var startY = containerY + paddingTB + (containerHeight - 2 * paddingTB - layout.totalHeight) / 2 + layout.fontSize;
  
  var textElements = [];
  for (var i = 0; i < layout.lines.length; i++) {
    var y = startY + i * layout.lineHeight;
    textElements.push(
      '<text x="' + centerX + '" y="' + y + '" font-size="' + layout.fontSize + '" font-family="sans-serif" text-anchor="middle" dominant-baseline="alphabetic" fill="black">' + escapeXml(layout.lines[i]) + '</text>'
    );
  }
  
  return textElements.join('');
}

function escapeXml(text) {
  return text.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;')
             .replace(/'/g, '&apos;');
}