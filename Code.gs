// ============================================================
// CẤU HÌNH
// ============================================================
const FB_URL     = "https://quanlygiamdinh-default-rtdb.asia-southeast1.firebasedatabase.app/";
const TG_TOKEN   = "8787308818:AAG0bPHmJ1VIj3WNYnhJ_AkLZQddMnVUFas";
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwQA00iOlnCsRwUkh9CN8w7fWONqw_-_EpCXCOJcwdBKoLe3RNuOatTzWQsmkjpHmUg/exec";
const GEMINI_API_KEY = "AIzaSyDYke-QR1RAqSmZA74az7UkXV7Q8dQ0MZM";

const NOTIFY_CHAT_IDS = [ "6236086183",];

const REMIND_BEFORE_MINUTES = [60, 15];

// ============================================================
// CORE: FIREBASE & ROUTING
// ============================================================
function api(path, method = "get", data = null) {
  const params = {
    method: method.toLowerCase(),
    contentType: "application/json",
    muteHttpExceptions: true
  };
  if (data) params.payload = JSON.stringify(data);

  const url = `${FB_URL}${path}.json`;
  const res = UrlFetchApp.fetch(url, params);
  try {
    return JSON.parse(res.getContentText());
  } catch (e) {
    Logger.log(`Lỗi parse JSON từ ${url}: ${res.getContentText().substring(0, 200)}`);
    return null;
  }
}

function updateStep(id, nextStep) {
  return api(`Workstation/${id}`, "patch", {
    step: parseInt(nextStep),
    stepUpdatedAt: new Date().toISOString(),
    lastUpdate: new Date().toISOString()
  });
}

function doGet(e) {
  // Vì giao diện đã chuyển sang GitHub, hàm doGet chỉ dùng để kiểm tra BE có hoạt động hay không
  return ContentService.createTextOutput("Backend Tasco DLK is running...")
         .setMimeType(ContentService.MimeType.TEXT);
}

// Hàm doOptions để cấp quyền CORS cho GitHub gọi vào Web App
function doOptions(e) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders(headers);
}
// ============================================================
// doPost
// ============================================================
// ============================================================
// doPost
// ============================================================
function doPost(e) {
  try {
    if (!e || !e.postData) {
      return makeJsonResponse({ success: false, error: 'No post data' });
    }

    var contents = JSON.parse(e.postData.contents);

    // Log để debug
    Logger.log('doPost action: ' + contents.action);

    if (contents.action === 'export_word')      return handleWordExport(contents.data);
    if (contents.action === 'export_bienbangd') return exportBienbangGD(contents.data);
    if (contents.action === 'export_uyquyen')   return exportUyQuyen(contents.data);
    if (contents.action === 'export_xacnhanbt') return exportXacNhanBT(contents.data);
    if (contents.action === 'export_hopdong')   return exportHopDong(contents.data);
    
    // ═══════ THÊM MỚI: EXPORT FILE WORD HỒ SƠ BỒI THƯỜNG ═══════
    if (contents.action === 'export_thongbao_bt')  return exportThongBaoBT(contents.data);
    if (contents.action === 'export_toinhan_bt')   return exportToiNhanBT(contents.data);
    if (contents.action === 'export_xacminh_bt')   return exportXacMinhBT(contents.data);
    // ═════════════════════════════════════════════════════════
    
    if (contents.action === 'delete_cloudinary') return deleteCloudinaryImage(contents.publicId);
    
    // --- GOOGLE DRIVE ---
    if (contents.action === 'upload_drive')      return uploadToDrive(contents);
    if (contents.action === 'delete_drive')      return deleteFromDrive(contents);

    // ============================================================
    // ĐOẠN MÃ MỚI THÊM: LẤY DUNG LƯỢNG CLOUDINARY (ĐÃ SỬA LỖI XÁC THỰC)
    // ============================================================
    if (contents.action === 'get_cloudinary_usage') {
      try {
        var CLOUD_NAME = "dm7zocpmr"; 
        var API_KEY = "875311428977927"; // API Key của bạn
        var API_SECRET = "70s6NDFhU1ZPzER0oE_V1fhuQfg"; // API Secret của bạn
        
        // URL chuẩn không chứa key/secret
        var url = "https://api.cloudinary.com/v1_1/" + CLOUD_NAME + "/usage";
        
        // Tạo chuỗi xác thực Basic Auth
        var authStr = Utilities.base64Encode(API_KEY + ':' + API_SECRET);
        
        var options = {
          "method": "get",
          "headers": {
            "Authorization": "Basic " + authStr
          },
          "muteHttpExceptions": true
        };
        
        var response = UrlFetchApp.fetch(url, options);
        var responseCode = response.getResponseCode();
        var data = JSON.parse(response.getContentText());
        
        if (responseCode === 200) {
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            storage: data.storage
          })).setMimeType(ContentService.MimeType.JSON);
        } else {
          // Bắt lỗi chi tiết từ Cloudinary nếu mã lỗi không phải 200 OK
          return ContentService.createTextOutput(JSON.stringify({
            success: false, 
            error: "Cloudinary Error (" + responseCode + "): " + (data.error ? data.error.message : "Unknown")
          })).setMimeType(ContentService.MimeType.JSON);
        }
        
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false, 
          error: "GAS Exception: " + err.toString()
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    // ============================================================

    // Telegram
    if (contents.message) {
      handleTelegramFlow(contents.message);
      return makeJsonResponse({ success: true, message: 'Telegram processed' });
    }

    Logger.log('Unknown action: ' + JSON.stringify(contents).substring(0, 200));
    return makeJsonResponse({ success: false, error: 'Unknown action: ' + contents.action });

  } catch (err) {
    Logger.log('Lỗi doPost: ' + err);
    return makeJsonResponse({ success: false, error: err.toString() });
  }
}

// ════════════════════════════════════════════════════════════════════
// EXPORT THÔNG BÁO BỒI THƯỜNG
// ════════════════════════════════════════════════════════════════════
function exportThongBaoBT(data) {
  try {
    // ID template THÔNG BÁO BỒI THƯỜNG
    var TEMPLATE_ID = '1YA7SFO9Y4TS7LBJN-Y7fuCSYJ-H4GMgJXCrrbJ9kBY8'; // ⚠️ THAY BẰNG ID TEMPLATE THỰC TẾ
    
    var templateFile = DriveApp.getFileById(TEMPLATE_ID);
    var tempFile = templateFile.makeCopy('ThongBaoBT_temp_' + Date.now());
    var tempFileId = tempFile.getId();
    var doc = DocumentApp.openById(tempFileId);
    var body = doc.getBody();

    var replacements = {
      '{{NGAY_TAO}}': data.ngayTao || '—',
      '{{TEN_HIEN_THI}}': data.tenHienThi || '—',
      '{{NGUOI_DUOC_BH}}': data.nguoiDuocBH || '—',
      '{{THOIKIEU}}': data.quanHeVoiNguoiBH || '—',
      '{{DIA_CHI}}': data.diaChiBH || '—',
      '{{LOAI_THAT_THAT}}': data.loaiThatThat || '—',
      '{{NGAY_THAT_THAT}}': data.ngayThatThat || '—',
      '{{DIA_DIEM_THAT_THAT}}': data.diaDiemThatThat || '—',
      '{{TONG_TIEN_BT}}': data.tongTienBT ? formatNumber(data.tongTienBT) : '0',
      '{{TONG_CHI_PHI_CHU}}': numberToVietnamese(data.tongTienBT) || '—',
      '{{TIEN_THUNG_TAT}}': data.tienThuongTat ? formatNumber(data.tienThuongTat) : '0',
      '{{TIEN_NOI_VIEN}}': data.tienNoiVien ? formatNumber(data.tienNoiVien) : '0',
      '{{TEN_NGUOI_NHAN}}': data.tenNguoiNhan || '—',
      '{{STK}}': data.stk || '—',
      '{{NGAN_HANG}}': data.nganHang || '—',
      
      // Bổ sung các mức trách nhiệm và phân loại
      '{{MUC_BT}}': data.mucBT || '—',
      '{{TIEN_TU_VONG}}': data.tienTuVong ? formatNumber(data.tienTuVong) : '0',
      '{{TIEN_PHAU_THUAT}}': data.tienPhauThuat ? formatNumber(data.tienPhauThuat) : '0',
      '{{MUC_A}}': data.lvlA ? formatNumber(data.lvlA) : '0',
      '{{MUC_B}}': data.lvlB ? formatNumber(data.lvlB) : '0',
      '{{MUC_C}}': data.lvlC ? formatNumber(data.lvlC) : '0',
      '{{MUC_D}}': data.lvlD ? formatNumber(data.lvlD) : '0',
      '{{LOAI_A}}': data.lvlA ? formatNumber(data.lvlA) : '0',
      '{{LOAI_B}}': data.lvlB ? formatNumber(data.lvlB) : '0',
      '{{LOAI_C}}': data.lvlC ? formatNumber(data.lvlC) : '0',
      '{{LOAI_D}}': data.lvlD ? formatNumber(data.lvlD) : '0'
    };

    for (var key in replacements) {
      body.replaceText(
        key.replace(/\{/g, '\\{').replace(/\}/g, '\\}'),
        replacements[key]
      );
    }

    doc.saveAndClose();

    var exportUrl = 'https://docs.google.com/feeds/download/documents/export/Export?id='
      + tempFileId + '&exportFormat=docx';
    var response = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });

    var b64 = Utilities.base64Encode(response.getBlob().getBytes());
    DriveApp.getFileById(tempFileId).setTrashed(true);

    return makeJsonResponse({
      success: true,
      content: b64,
      fileName: 'ThongBaoBT_' + data.tenHienThi + '_' + Date.now() + '.docx'
    });

  } catch(e) {
    Logger.log('Lỗi exportThongBaoBT: ' + e);
    return makeJsonResponse({ success: false, error: e.message });
  }
}

// ════════════════════════════════════════════════════════════════════
// EXPORT TỜ TRÌNH BỒI THƯỜNG
// ════════════════════════════════════════════════════════════════════
function exportToiNhanBT(data) {
  try {
    var TEMPLATE_ID = '1zx1BWSGjLP1a_U0q57-voe2iuO_xgdIiUyDJ7_VDM-A'; // ⚠️ THAY BẰNG ID THỰC TẾ

    var templateFile = DriveApp.getFileById(TEMPLATE_ID);
    var tempFile = templateFile.makeCopy('ToTrinhBT_temp_' + Date.now());
    var tempFileId = tempFile.getId();
    var doc = DocumentApp.openById(tempFileId);
    var body = doc.getBody();

    // ── Ánh xạ placeholder → giá trị ──────────────────────────────
    var replacements = {
      // Thông tin người được bảo hiểm
      '{{TEN_HIEN_THI}}':       data.tenHienThi           || '—',
      '{{NGUOI_DUOC_BH}}':      data.nguoiDuocBH          || '—',
      '{{TUOI_BH}}':            data.tuoiBH               || '—',
      '{{DIA_CHI_BH}}':         data.diaChiBH             || '—',
      '{{NGAY_SINH_BH}}':       data.ngaySinhBH           || '—',
      '{{CMND_BH}}':            data.cmndBH               || '—',

      // Thông tin người thụ hưởng
      '{{NGUOI_THU_HUONG}}':    data.tenNguoiNhan         || '—',
      '{{QUAN_HE}}':            data.quanHeVoiNguoiBH     || '—',
      '{{CCCD_THU_HUONG}}':     data.cccdThuHuong         || '—',
      '{{DIA_CHI_THU_HUONG}}':  data.diaChiThuHuong       || '—',
      '{{SDT_THU_HUONG}}':      data.sdtThuHuong          || '—',
      '{{STK_THU_HUONG}}':      data.stkThuHuong          || '—',
      '{{NGAN_HANG}}':          data.nganHang             || '—',

      // Thông tin hợp đồng / GCN
      '{{SO_GCN}}':             data.soGcn                || '—',
      '{{SO_HD}}':              data.soHopDong            || '—',
      '{{THOI_HIEU_TU}}':       data.thoiHieuTu           || '—',
      '{{THOI_HIEU_DEN}}':      data.thoiHieuDen          || '—',
      '{{GOI_BH}}':             data.goiBH                || '—',

      // Thông tin sự cố / tổn thất
      '{{LOAI_THAT_THAT}}':     data.loaiThatThat         || '—',
      '{{NGAY_THAT_THAT}}':     data.ngayThatThat         || '—',
      '{{DIA_DIEM_SU_CO}}':     data.diaDiemSuCo          || '—',
      '{{MO_TA_SU_CO}}':        data.moTaSuCo             || '—',
      '{{MO_TA_THAT_THAT}}':    data.moTaThatThat         || '—',

      // Thông tin y tế / điều trị
      '{{TEN_BENH}}':           data.tenBenh              || '—',
      '{{TEN_BENH_VIEN}}':      data.tenBenhVien          || '—',
      '{{NGAY_VAO_VIEN}}':      data.ngayVaoVien          || '—',
      '{{NGAY_RA_VIEN}}':       data.ngayRaVien           || '—',
      '{{SO_NGAY_NAM_VIEN}}':   String(data.soNgayNamVien || '0'),

      // Thông tin tài chính
      '{{TIEN_THUONG_TAT}}':    data.tienThuongTat  ? formatNumber(data.tienThuongTat)  : '0',
      '{{TIEN_NOI_VIEN}}':      data.tienNoiVien    ? formatNumber(data.tienNoiVien)    : '0',
      '{{TIEN_NGOAI_VIEN}}':    data.tienNgoaiVien  ? formatNumber(data.tienNgoaiVien)  : '0',
      '{{TIEN_PHAU_THUAT}}':    data.tienPhauThuat  ? formatNumber(data.tienPhauThuat)  : '0',
      '{{TONG_TIEN_BT}}':       data.tongTienBT     ? formatNumber(data.tongTienBT)     : '0',
      '{{TIEN_CHU_DONG_CHIU}}': data.tienChuDongChiu? formatNumber(data.tienChuDongChiu): '0',
      '{{TIEN_THUC_CHI}}':      data.tienThucChi    ? formatNumber(data.tienThucChi)    : '0',

      // Mức trách nhiệm
      '{{MUC_A}}':              data.lvlA           ? formatNumber(data.lvlA)           : '0',
      '{{MUC_B}}':              data.lvlB           ? formatNumber(data.lvlB)           : '0',
      '{{MUC_C}}':              data.lvlC           ? formatNumber(data.lvlC)           : '0',
      '{{MUC_D}}':              data.lvlD           ? formatNumber(data.lvlD)           : '0',
      
      // Aliases cho "Loại A, B, C, D" như user mô tả
      '{{LOAI_A}}':             data.lvlA           ? formatNumber(data.lvlA)           : '0',
      '{{LOAI_B}}':             data.lvlB           ? formatNumber(data.lvlB)           : '0',
      '{{LOAI_C}}':             data.lvlC           ? formatNumber(data.lvlC)           : '0',
      '{{LOAI_D}}':             data.lvlD           ? formatNumber(data.lvlD)           : '0',
      '{{MUC_BT}}':             data.mucBT          || '—',
      '{{TIEN_TU_VONG}}':       data.tienTuVong     ? formatNumber(data.tienTuVong)     : '0',

      // Thông tin tờ trình / GĐV
      // Thông tin tờ trình / GĐV
      '{{NGAY_LAP_TO_TRINH}}':  data.ngayLapToTrinh       || _today(),
      '{{TEN_GDV}}':            data.tenGDV               || '—',
      '{{MA_GDV}}':             data.maGDV                || '—',
      '{{MA_HO_SO}}':           data.maHoSo               || '—',
      '{{KET_LUAN_GDV}}':       data.ketLuanGDV           || '—',
      '{{DE_XUAT_BT}}':         data.deXuatBT             || '—',
    };

    // ── Thay thế trong toàn bộ body (bao gồm cả table cells) ──────
    _replaceAllInDoc(body, replacements);

    doc.saveAndClose();

    // ── Export sang .docx ─────────────────────────────────────────
    var exportUrl = 'https://docs.google.com/feeds/download/documents/export/Export?id='
      + tempFileId + '&exportFormat=docx';
    var response = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      throw new Error('Export thất bại, HTTP ' + response.getResponseCode());
    }

    var b64 = Utilities.base64Encode(response.getBlob().getBytes());
    DriveApp.getFileById(tempFileId).setTrashed(true); // Xoá file tạm

    var fileName = 'ToTrinhBT_' 
      + (data.tenHienThi || 'KhachHang').replace(/\s+/g, '_') 
      + '_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd')
      + '.docx';

    return makeJsonResponse({ success: true, content: b64, fileName: fileName });

  } catch (e) {
    Logger.log('Lỗi exportToTrinhBT: ' + e);
    return makeJsonResponse({ success: false, error: e.message });
  }
}

// ────────────────────────────────────────────────────────────────────
// Hàm thay thế đệ quy: body paragraph + tất cả table cells
// ────────────────────────────────────────────────────────────────────
function _replaceAllInDoc(body, replacements) {
  // 1. Thay trong paragraphs thông thường
  for (var key in replacements) {
    body.replaceText(_escapeRegex(key), replacements[key]);
  }

  // 2. Thay trong tất cả table cells
  var numTables = body.getNumChildren();
  for (var i = 0; i < numTables; i++) {
    var child = body.getChild(i);
    if (child.getType() === DocumentApp.ElementType.TABLE) {
      var table = child.asTable();
      for (var r = 0; r < table.getNumRows(); r++) {
        var row = table.getRow(r);
        for (var c = 0; c < row.getNumCells(); c++) {
          var cell = row.getCell(c);
          for (var key in replacements) {
            cell.replaceText(_escapeRegex(key), replacements[key]);
          }
        }
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────────
// Escape ký tự đặc biệt của Java regex dùng trong replaceText()
// ────────────────────────────────────────────────────────────────────
function _escapeRegex(str) {
  return str.replace(/[\{\}\[\]\(\)\^\$\.\|\?\*\+\\]/g, '\\$&');
}

// ────────────────────────────────────────────────────────────────────
// Lấy ngày hôm nay định dạng dd/MM/yyyy
// ────────────────────────────────────────────────────────────────────
function _today() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

// ════════════════════════════════════════════════════════════════════
// EXPORT XÁC MINH PHÍ BẢO HIỂM
// ════════════════════════════════════════════════════════════════════
function exportXacMinhBT(data) {
  try {
    // ID template XÁC MINH PHÍ
    var TEMPLATE_ID = '1EsKnY_cf1iZ7u_KbNtgomRYyt3l4hgY7Gg95xh5ueNY'; 
    
    var templateFile = DriveApp.getFileById(TEMPLATE_ID);
    var tempFile = templateFile.makeCopy('XacMinhBT_temp_' + Date.now());
    var tempFileId = tempFile.getId();
    var doc = DocumentApp.openById(tempFileId);
    var body = doc.getBody();

    // Hàm phụ để định dạng ngày tháng nếu cần (DD/MM/YYYY)
    var formatDt = function(str) {
      if (!str) return '—';
      // Xử lý nhiều format ngày khác nhau
      if (str.includes('T')) {
        return str.split('T')[0].split('-').reverse().join('/');
      } else if (str.includes('-')) {
        return str.split('-').reverse().join('/');
      }
      return str;
    };

    // Hàm phụ để định dạng ngày tháng dạng chữ (ngày dd tháng mm năm yyyy)
    var formatNgayThangNam = function(str) {
      if (!str) return '—';
      
      var parts;
      // Xử lý format ISO (YYYY-MM-DD hoặc YYYY-MM-DDTHH:mm:ss)
      if (str.includes('T')) {
        parts = str.split('T')[0].split('-');
      } else if (str.includes('-')) {
        parts = str.split('-');
      } else {
        return str;
      }
      
      // parts = [YYYY, MM, DD]
      if (parts && parts.length === 3) {
        var ngay = parts[2].padStart(2, '0');  // Đảm bảo 2 chữ số
        var thang = parts[1].padStart(2, '0'); // Đảm bảo 2 chữ số
        var nam = parts[0];
        return 'ngày ' + ngay + ' tháng ' + thang + ' năm ' + nam;
      }
      return str;
    };

    // ⚠️ HỖ TRỢ NHIỀU TÊN PROPERTY - NẾU FRONTEND GỬIA KHÁC TÊN
    var loaiHinhBH = data.loaiHinhBH || data.loai_hinh_bh || data.loaiHinh || '—';
    var donViBH = data.companyName || data.donViBH || data.don_vi_bh || data.tenCongTy || '—';

    var replacements = {
      '{{NGUOI_DUOC_BH}}': data.nguoiDuocBH || '—',
      '{{TUOI}}': data.tuoiBH || '—',
      '{{DIA_CHI}}': data.diaChiBH || '—',
      '{{SO_GCN}}': data.soGcn || '—',
      '{{SO_HOP_DONG}}': data.soHopDong || '—',
      '{{TEN_BENH}}': data.tenBenh || '—',
      '{{QUAN_HE}}': data.quanHeVoiNguoiBH || '—',
      '{{TEN_NGUOI_NHAN}}': data.tenNguoiNhan || '—',
      '{{TIEN_BAO_HIEM}}': data.tongTienBT ? formatNumber(data.tongTienBT) : '0',
      '{{CHI_NHANH}}': data.chiNhanh || 'Đắk Lắk',
      
      // --- CÁC TRƯỜNG MỚI BỔ SUNG (SỬA LỖI) ---
      '{{LOAI_HINH_BH}}': loaiHinhBH, // ✅ SỬA: Hỗ trợ nhiều tên property
      '{{THOI_HAN_BH}}': (data.thoiHieuTu && data.thoiHieuDen) 
                          ? (formatDt(data.thoiHieuTu) + ' đến ' + formatDt(data.thoiHieuDen)) 
                          : '—',
      '{{NGAY_CAP}}': formatDt(data.ngayTao) || '—',
      '{{DON_VI_BH}}': donViBH, // ✅ SỬA: Hỗ trợ nhiều tên property
      '{{NGAY_TAI_NAN}}': formatDt(data.ngayThatThat) || '—',
      '{{NGAY_LAP_HS}}': formatNgayThangNam(data.ngayTao), // ✅ SỬA: Format ngày dd tháng mm năm yyyy

      // Bổ sung các mức trách nhiệm
      '{{MUC_A}}': data.lvlA ? formatNumber(data.lvlA) : '0',
      '{{MUC_B}}': data.lvlB ? formatNumber(data.lvlB) : '0',
      '{{MUC_C}}': data.lvlC ? formatNumber(data.lvlC) : '0',
      '{{MUC_D}}': data.lvlD ? formatNumber(data.lvlD) : '0',
      '{{LOAI_A}}': data.lvlA ? formatNumber(data.lvlA) : '0',
      '{{LOAI_B}}': data.lvlB ? formatNumber(data.lvlB) : '0',
      '{{LOAI_C}}': data.lvlC ? formatNumber(data.lvlC) : '0',
      '{{LOAI_D}}': data.lvlD ? formatNumber(data.lvlD) : '0',
      '{{MUC_BT}}': data.mucBT || '—',
      '{{TIEN_TU_VONG}}': data.tienTuVong ? formatNumber(data.tienTuVong) : '0',
      '{{TIEN_PHAU_THUAT}}': data.tienPhauThuat ? formatNumber(data.tienPhauThuat) : '0'
    };

    // Thực hiện thay thế văn bản trong Body
    for (var key in replacements) {
      body.replaceText(
        key.replace(/\{/g, '\\{').replace(/\}/g, '\\}'),
        replacements[key]
      );
    }

    doc.saveAndClose();

    // Xuất file sang định dạng DOCX
    var exportUrl = 'https://docs.google.com/feeds/download/documents/export/Export?id='
      + tempFileId + '&exportFormat=docx';
    
    var response = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });

    var b64 = Utilities.base64Encode(response.getBlob().getBytes());
    
    // Dọn dẹp file tạm
    DriveApp.getFileById(tempFileId).setTrashed(true);

    return makeJsonResponse({
      success: true,
      content: b64,
      fileName: 'XacMinhBT_' + (data.tenHienThi || data.nguoiDuocBH) + '.docx'
    });

  } catch(e) {
    Logger.log('Lỗi exportXacMinhBT: ' + e);
    Logger.log('Data nhận được: ' + JSON.stringify(data)); // ✅ Thêm log để debug
    return makeJsonResponse({ success: false, error: e.message });
  }
}

// ════════════════════════════════════════════════════════════════════
// HỖ TRỢ: Format số tiền
// ════════════════════════════════════════════════════════════════════
function formatNumber(num) {
  if (!num) return '0';
  return Number(num).toLocaleString('vi-VN');
}

// ════════════════════════════════════════════════════════════════════
// HỖ TRỢ: Chuyển số thành chữ Việt (tùy chọn)
// ════════════════════════════════════════════════════════════════════
function numberToVietnamese(num) {
  // Hàm đơn giản - có thể mở rộng nếu cần
  num = Number(num);
  if (num === 0) return 'Không đồng';
  if (num < 1000000) return Math.round(num / 1000) + ' nghìn đồng';
  return Math.round(num / 1000000) + ' triệu đồng';
}

function deleteCloudinaryImage(publicId) {
  var CLOUD_NAME = 'drnarbfoa';
  var API_KEY    = '356748555623213';     // ← Thay bằng API Key thật từ Cloudinary Dashboard
  var API_SECRET = 'JtTxsYlkb6S_ImytSp7mQEhSYNY';  // ← Thay bằng API Secret thật

  if (!publicId) {
    return makeJsonResponse({ success: false, error: 'Missing publicId' });
  }

  try {
    var timestamp = Math.floor(Date.now() / 1000);
    var strToSign = 'invalidate=true&public_id=' + publicId + '&timestamp=' + timestamp + API_SECRET;

    var sigBytes  = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_1,
      strToSign,
      Utilities.Charset.UTF_8
    );
    var signature = sigBytes.map(function(b) {
      return ('0' + (b & 0xff).toString(16)).slice(-2);
    }).join('');

    var url  = 'https://api.cloudinary.com/v1_1/' + CLOUD_NAME + '/image/destroy';
    var resp = UrlFetchApp.fetch(url, {
      method:             'POST',
      muteHttpExceptions: true,
      payload: {
        public_id:  publicId,
        api_key:    API_KEY,
        timestamp:  String(timestamp),
        signature:  signature,
        invalidate: 'true'
      }
    });

    var body = JSON.parse(resp.getContentText());
    Logger.log('Cloudinary delete result: ' + JSON.stringify(body));

    // "not found" vẫn coi là thành công (ảnh đã bị xóa trước đó)
    if (body.result === 'ok' || body.result === 'not found') {
      return makeJsonResponse({ success: true, result: body.result });
    }

    return makeJsonResponse({
      success: false,
      error:   body.error && body.error.message ? body.error.message : 'Cloudinary error'
    });

  } catch (err) {
    Logger.log('deleteCloudinaryImage error: ' + err);
    return makeJsonResponse({ success: false, error: err.toString() });
  }
}

function makeJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// ============================================================
// TELEGRAM: XỬ LÝ TIN NHẮN ĐẾN
// ============================================================
function handleTelegramFlow(message) {
  const chatId    = message.chat.id;
  const messageId = message.message_id;

  const existing = api(`Workstation?orderBy="telegramMessageId"&equalTo=${messageId}`, "get") || {};
  if (Object.keys(existing).length > 0) {
    sendTg("⚠️ Tin nhắn này đã được xử lý trước đó.", chatId);
    return;
  }

  if (message.photo) {
    sendTg("📸 <b>Đã nhận ảnh.</b> Đang gọi AI phân tích biển số...", chatId);
    const fileId = message.photo[message.photo.length - 1].file_id;
    const bsxDetected = ocrWithGemini(fileId);

    if (bsxDetected) {
      sendTg(`🔍 AI phát hiện biển số: <b>${bsxDetected}</b>. Đang kiểm tra hệ thống...`, chatId);
      const all = api("Workstation", "get") || {};
      let foundId = null;
      for (const k in all) {
        const cleanDB = (all[k].bsx || "").replace(/[\.\-\s]/g, "").toUpperCase();
        if (cleanDB === bsxDetected) { foundId = k; break; }
      }
      if (foundId) {
        updateStep(foundId, 3);
        sendTg(`✅ <b>THÀNH CÔNG:</b> Xe <b>${bsxDetected}</b> đã chuyển sang <b>B3: Đã giám định</b>.`, chatId);
      } else {
        sendTg(`⚠️ Không tìm thấy hồ sơ xe <b>${bsxDetected}</b> trong danh sách chờ.`, chatId);
      }
    } else {
      sendTg("❌ Không nhận diện được biển số xe từ ảnh.", chatId);
    }
    return;
  }

  if (message.text) {
    const text = message.text.trim();
    if (!text.includes("BSX:") && !text.includes("Biển số") && !text.includes("Mã số vụ tổn thất")) return;

    const ex = (reg) => (text.match(reg) || [])[1]?.trim() || "N/A";
    const bsxRaw = ex(/BSX:\s*(.*)/i) || ex(/Biển số:\s*(.*)/i);
    if (bsxRaw === "N/A") {
      sendTg("❌ Không tìm thấy thông tin biển số xe trong tin nhắn.", chatId);
      return;
    }

    const bsxClean = bsxRaw.replace(/[\s\.\-]/g, "").toUpperCase();
    if (isRateLimited(chatId, bsxClean)) {
      sendTg("⏳ Vui lòng chờ 60 giây trước khi gửi lại thông tin xe này.", chatId);
      return;
    }

    const allRecords = api("Workstation", "get") || {};
    for (const key in allRecords) {
      const recordBsx = (allRecords[key].bsx || "").replace(/[\s\.\-]/g, "").toUpperCase();
      if (recordBsx === bsxClean) {
        sendTg(`⚠️ Hồ sơ xe <b>${bsxClean}</b> đã tồn tại (ID: ${key}). Không tạo mới.`, chatId);
        return;
      }
    }

    const newId = `VTT_${Date.now()}`;
    const data = {
      claimCode: ex(/Mã số vụ tổn thất:\s*([^\s@]+)/) || `HS-${new Date().toISOString().slice(0, 10)}`,
      bsx: bsxRaw,
      customer: ex(/Người liên hệ:\s*([^-\n\d]+)/).replace(/\s{2,}/g, " ").trim() || "N/A",
      phone: ex(/Người liên hệ:.*?(\d{10,11})/) || "N/A",
      location: ex(/Địa điểm VTT:\s*(.*)/) || "N/A",
      step: 1,
      stepUpdatedAt: new Date().toISOString(),
      createdFrom: "telegram",
      telegramMessageId: messageId,
      telegramChatId: chatId,
      createdAt: new Date().toISOString()
    };

    api(`Workstation/${newId}`, "put", { ...data, id: newId });

    sendTg(
      `✅ <b>ĐÃ TIẾP NHẬN HỒ SƠ MỚI</b>\n` +
      `🚗 Biển số: <b>${bsxRaw}</b>\n` +
      `👤 Khách hàng: ${data.customer}\n` +
      `📞 SĐT: ${data.phone}\n` +
      `🆔 Mã hồ sơ: <code>${newId}</code>`,
      chatId
    );
  }
}

function isRateLimited(chatId, bsxClean) {
  const props = PropertiesService.getScriptProperties();
  const key   = `rate_${chatId}_${bsxClean}`;
  const last  = props.getProperty(key);
  if (last && Date.now() - parseInt(last) < 60000) return true;
  props.setProperty(key, Date.now().toString());
  return false;
}


// ============================================================
// THAY TOÀN BỘ hàm handleWordExport(data) trong Apps Script
// ============================================================

function handleWordExport(data) {
  try {
    var TEMPLATE_ID = '1FYG4HAncww0TiVNciJLg2qE908_e1p0O58Pt6jtdpv4';

    var tempFile = DriveApp.getFileById(TEMPLATE_ID)
      .makeCopy('TBTNN_' + (data.bsx || 'HS') + '_' + Date.now());
    var doc  = DocumentApp.openById(tempFile.getId());
    var body = doc.getBody();

    // Parse giờ và ngày từ accidentDate (DD/MM/YYYY HH:mm)
    var gioTN = '', ngayTN = '';
    if (data.accidentDate) {
      var parts = data.accidentDate.trim().split(' ');
      if (parts.length >= 2 && parts[1].indexOf(':') !== -1) {
        gioTN  = parts[1];
        ngayTN = parts[0];
      } else {
        ngayTN = parts[0];
      }
    }

    // Ngày ký hôm nay
    var today = new Date();
    var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
    var ngayKy = '';
    if (data.notifyDate) {
      ngayKy = data.notifyDate.trim().split(' ')[0];
    }
    if (!ngayKy) {
      ngayKy = pad(today.getDate()) + '/' + pad(today.getMonth() + 1) + '/' + today.getFullYear();
    }

    // Tên xe, tên chủ xe, địa chỉ
    var tenXe       = [data.hangXe, data.loaiXe].filter(Boolean).join(' ') || '';
    var tenChuXe    = data.ownerName    || data.chuXe    || '';
    var tenChuXeHoa = tenChuXe.toUpperCase();
    var diaChi      = data.ownerAddress || data.diaChi   || '';

    var replacements = {
      // Thông tin chủ xe / lái xe
      // Thông tin chủ xe / lái xe
      '{{TENCHUXE}}':         tenChuXe,
      '{{TENCHUXE_HOA}}':     tenChuXeHoa,
      '{{HOTENLAIXE}}':       data.driverName || data.customer || tenChuXe,
      '{{NGUOITHONGBAO}}':    data.customer   || tenChuXe, 
      '{{NGUOIKY}}':          data.customer   || tenChuXe, 
      '{{DIACHI}}':           diaChi,
      '{{SDT}}':            data.phone      || '',

      // Thông tin xe
      '{{BSX}}':            data.bsx        || '',
      '{{SOKHUNG}}':        data.soKhung    || '',
      '{{TENXE}}':          tenXe,

      // Bảo hiểm
      '{{SOGCNTN}}':        data.claimCode  || '',
      '{{HLTU}}':           '',
      '{{HLDEN}}':          '',

      // GPLX
      '{{SOGPLX}}':         data.soGPLX     || '',
      '{{HANGGPLX}}':       data.hangGPLX   || '',
      '{{NGAYCAPGPLX}}':    data.ngayCapGPLX|| '',
      '{{HETHANGPLX}}':     data.hetHanGPLX || '',

      // Đăng kiểm
      '{{SODANGKIEM}}':     data.soDangKiem || '',
      '{{NGAYCAPDK}}':      data.ngayCapDK  || '',
      '{{HETHANDK}}':       data.hetHanDK   || '',

      // Tai nạn
      '{{GIOTN}}':          gioTN ? gioTN + ' giờ' : '......',
      '{{NGAYTN}}':         ngayTN          || '',
      '{{DIADIEM}}':        data.location   || '',
      '{{DIENBIENVANNHAN}}': data.cause     || '',

      '{{THIETHAIVXC}}':    data.description|| '',

      // Ngày ký
      '{{NGAYKY}}':         ngayKy,
    };

    for (var key in replacements) {
      body.replaceText(key, replacements[key]);
    }

    doc.saveAndClose();

    var url = 'https://docs.google.com/feeds/download/documents/export/Export?id='
      + tempFile.getId() + '&exportFormat=docx';
    var response = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });

    var base64 = Utilities.base64Encode(response.getBlob().getBytes());
    tempFile.setTrashed(true);

    return makeJsonResponse({
      success:  true,
      fileName: 'TBTNN_' + (data.bsx || 'HS') + '_' + ngayKy.replace(/\//g, '') + '.docx',
      content:  base64
    });

  } catch (err) {
    Logger.log('Lỗi handleWordExport: ' + err);
    return makeJsonResponse({ success: false, error: err.toString() });
  }
}

// ============================================================
// OCR BIỂN SỐ BẰNG GEMINI
// ============================================================
function ocrWithGemini(fileId) {
  try {
    const fileInfo = JSON.parse(
      UrlFetchApp.fetch(`https://api.telegram.org/bot${TG_TOKEN}/getFile?file_id=${fileId}`).getContentText()
    );
    if (!fileInfo.ok) throw new Error("Telegram getFile failed");

    const imgBlob    = UrlFetchApp.fetch(`https://api.telegram.org/file/bot${TG_TOKEN}/${fileInfo.result.file_path}`).getBlob();
    const base64Img  = Utilities.base64Encode(imgBlob.getBytes());
    const geminiUrl  = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const payload = {
      contents: [{
        parts: [
          { text: "Đọc biển số xe trong ảnh. Chỉ trả về chuỗi ký tự biển số viết liền, không dấu, không khoảng trắng (VD: 47A12345). Nếu không thấy rõ hoặc không phải biển số xe, trả về KHONGTHAY." },
          { inline_data: { mime_type: "image/jpeg", data: base64Img } }
        ]
      }],
      generationConfig: { temperature: 0.1, topK: 1, topP: 1, maxOutputTokens: 20 }
    };

    const result = JSON.parse(UrlFetchApp.fetch(geminiUrl, {
      method: "post", contentType: "application/json",
      payload: JSON.stringify(payload), muteHttpExceptions: true
    }).getContentText());

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toUpperCase() || "";
    if (text.includes("KHONGTHAY")) return null;
    return text.replace(/[^A-Z0-9]/g, "");
  } catch (e) {
    Logger.log("Lỗi OCR Gemini: " + e);
    return null;
  }
}


// ============================================================
// GỬI TELEGRAM
// ============================================================
function sendTg(txt, cid) {
  try {
    UrlFetchApp.fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "post",
      payload: { chat_id: String(cid), text: txt, parse_mode: "HTML" },
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log("Lỗi gửi Telegram: " + e);
  }
}

function _broadcastTg(msg) {
  NOTIFY_CHAT_IDS.forEach(chatId => {
    if (chatId && !chatId.startsWith("CHAT_ID")) sendTg(msg, chatId);
  });
}


// ============================================================
// NHẮC LỊCH HẸN
// ============================================================
function checkAndSendReminders() {
  const now     = new Date();
  const records = api("Workstation", "get") || {};
  const props   = PropertiesService.getScriptProperties();

  for (const id in records) {
    const item = records[id];
    if (!item.appointmentTime || parseInt(item.step || 0) >= 3) continue;

    const apptTime = new Date(item.appointmentTime);
    const diffMins = Math.round((apptTime - now) / 60000);

    for (const threshold of REMIND_BEFORE_MINUTES) {
      if (diffMins < threshold - 5 || diffMins > threshold + 5) continue;

      const dedupKey = `reminded_${id}_${threshold}`;
      if (props.getProperty(dedupKey)) continue;

      _broadcastTg(_buildReminderMsg(item, diffMins));
      props.setProperty(dedupKey, now.toISOString());
    }
  }

  _cleanOldRemindKeys(props);
}

function _buildReminderMsg(item, diffMins) {
  const stepLabels = {
    1: "Tiếp nhận", 2: "Lên lịch hẹn", 3: "Đã giám định",
    4: "Đã có báo giá", 5: "Chờ duyệt giá", 6: "Chờ hoá đơn"
  };
  const icon      = diffMins <= 15 ? "🚨" : "⏰";
  const urgentTag = item.urgent ? "🔴 <b>[XỬ LÝ GẤP]</b>\n" : "";

  return (
    `${icon} <b>NHẮC LỊCH HẸN GIÁM ĐỊNH</b>\n` +
    `${urgentTag}` +
    `──────────────────\n` +
    `🚗 Biển số:    <b>${item.bsx || "?"}</b>\n` +
    `👤 Khách hàng: ${item.customer || "—"}\n` +
    `📞 SĐT:        ${item.phone || "—"}\n` +
    `📍 Địa điểm:  ${item.location || "—"}\n` +
    `🔧 Gara:       ${item.garaName || "—"}\n` +
    `📋 Trạng thái: ${stepLabels[item.step] || "?"}\n` +
    `──────────────────\n` +
    `🕐 Giờ hẹn: <b>${_formatVN(new Date(item.appointmentTime))}</b>\n` +
    `⏳ Còn:     <b>${diffMins} phút</b>\n` +
    `🆔 Mã HS:   <code>${item.claimCode || item.id || "?"}</code>`
  );
}

function _cleanOldRemindKeys(props) {
  try {
    const all = props.getProperties();
    const TWO_HOURS = 2 * 3600 * 1000;
    for (const key in all) {
      if (!key.startsWith("reminded_")) continue;
      const ts = new Date(all[key]).getTime();
      if (!isNaN(ts) && Date.now() - ts > TWO_HOURS) props.deleteProperty(key);
    }
  } catch (e) {
    Logger.log("Lỗi _cleanOldRemindKeys: " + e);
  }
}


// ============================================================
// BÁO CÁO SÁNG
// ============================================================
function morningDigest() {
  const records  = api("Workstation", "get") || {};
  const todayStr = _todayVN();

  const todayAppts   = [];
  const overdueItems = [];

  for (const id in records) {
    const item = records[id];
    if (!item.appointmentTime || parseInt(item.step || 0) >= 3) continue;

    const apptTime   = new Date(item.appointmentTime);
    const apptDateVN = _formatVN(apptTime).split(" - ")[1];
    const hoursLate  = (Date.now() - apptTime.getTime()) / 3600000;

    if (apptDateVN === todayStr) todayAppts.push(item);
    else if (hoursLate > 0) overdueItems.push({ item, hoursLate: Math.round(hoursLate) });
  }

  if (!todayAppts.length && !overdueItems.length) return;

  let msg = `☀️ <b>BÁO CÁO SÁNG — ${todayStr}</b>\n══════════════════\n`;

  if (todayAppts.length) {
    msg += `\n📅 <b>LỊCH HẸN HÔM NAY (${todayAppts.length} vụ)</b>\n`;
    todayAppts
      .sort((a, b) => new Date(a.appointmentTime) - new Date(b.appointmentTime))
      .forEach((item, i) => {
        const time   = _formatVN(new Date(item.appointmentTime)).split(" - ")[0];
        const urgent = item.urgent ? " 🔴" : "";
        msg += `${i + 1}. <b>${item.bsx}</b>${urgent} — ${time} — ${item.customer || "?"} — ${item.location || "?"}\n`;
      });
  }

  if (overdueItems.length) {
    msg += `\n⚠️ <b>TRỄ HẸN CHƯA XỬ LÝ (${overdueItems.length} vụ)</b>\n`;
    overdueItems
      .sort((a, b) => b.hoursLate - a.hoursLate)
      .slice(0, 5)
      .forEach(({ item, hoursLate }) => {
        msg += `• <b>${item.bsx}</b> — trễ ${hoursLate}h — ${item.customer || "?"}\n`;
      });
    if (overdueItems.length > 5) msg += `... và ${overdueItems.length - 5} hồ sơ khác\n`;
  }

  _broadcastTg(msg);
}


// ============================================================
// TIỆN ÍCH: NGÀY GIỜ VIỆT NAM
// ============================================================
function _formatVN(date) {
  const vn  = new Date(date.getTime() + 7 * 3600 * 1000);
  const pad = n => String(n).padStart(2, "0");
  return `${pad(vn.getUTCHours())}:${pad(vn.getUTCMinutes())} - ${pad(vn.getUTCDate())}/${pad(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()}`;
}

function _todayVN() {
  const vn  = new Date(Date.now() + 7 * 3600 * 1000);
  const pad = n => String(n).padStart(2, "0");
  return `${pad(vn.getUTCDate())}/${pad(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()}`;
}


// ============================================================
// SETUP: LẤY CHAT_ID & QUẢN LÝ WEBHOOK
// ============================================================
function deleteWebhook() {
  const res = UrlFetchApp.fetch(
    `https://api.telegram.org/bot${TG_TOKEN}/deleteWebhook`,
    { method: "post", muteHttpExceptions: true }
  );
  Logger.log(res.getContentText());
}

function getChatIds() {
  const res  = UrlFetchApp.fetch(
    `https://api.telegram.org/bot${TG_TOKEN}/getUpdates`,
    { muteHttpExceptions: true }
  );
  const data = JSON.parse(res.getContentText());

  if (!data.ok || !data.result?.length) {
    Logger.log("Chưa có tin nhắn. Hãy nhắn bot 1 tin rồi chạy lại hàm này.");
    return;
  }

  const seen = new Set();
  data.result.forEach(update => {
    const chat = update.message?.chat;
    if (!chat || seen.has(chat.id)) return;
    seen.add(chat.id);
    Logger.log(`👤 ${chat.first_name || ""} ${chat.last_name || ""} (@${chat.username || "?"}) → chat_id: ${chat.id}`);
  });
}

function reRegisterWebhook() {
  const res = UrlFetchApp.fetch(
    `https://api.telegram.org/bot${TG_TOKEN}/setWebhook?url=${encodeURIComponent(WEB_APP_URL)}`,
    { muteHttpExceptions: true }
  );
  Logger.log(res.getContentText());
}

function checkWebhook() {
  const res = UrlFetchApp.fetch(
    `https://api.telegram.org/bot${TG_TOKEN}/getWebhookInfo`,
    { muteHttpExceptions: true }
  );
  Logger.log(res.getContentText());
}


// ============================================================
// exportBienbangGD — PHIÊN BẢN HOÀN CHỈNH
// Thay thế toàn bộ hàm exportBienbangGD() cũ trong GAS
// ============================================================
function exportBienbangGD(data) {
  try {
    var TEMPLATE_FILE_ID = '1B5X3OHLMUgPzhap87nvnwlb06DVoY6lIetJafMHGBQg';

    var item       = data.item       || {};
    var hangMuc    = data.hangMuc    || [];
    var nguyenNhan = data.nguyenNhan || '';
    var kienNghi   = data.kienNghi   || '';
    var ngay       = data.ngay       || '';
    var thang      = data.thang      || '';
    var nam        = data.nam        || '';
    var noiGD      = data.noiGiamDinh || item.garaName || '';

    var templateFile = DriveApp.getFileById(TEMPLATE_FILE_ID);
    var tempFile     = templateFile.makeCopy('BienbangGD_temp_' + Date.now());
    var tempFileId   = tempFile.getId();
    var doc          = DocumentApp.openById(tempFileId);
    var body         = doc.getBody();

    // REPLACE PLACEHOLDERS
    var today = 'ngày ' + ngay + ' tháng ' + thang + ' năm ' + nam;
    body.replaceText('\\{\\{NGAY\\}\\}',          today);
    body.replaceText('\\{\\{NOI_GD\\}\\}',         noiGD || item.location || '');
    body.replaceText('\\{\\{MAHS\\}\\}',           item.claimCode    || '');
    body.replaceText('\\{\\{NGAYVTT\\}\\}',        item.accidentDate || '');
    body.replaceText('\\{\\{NGAYTB\\}\\}',         item.notifyDate   || '');
    body.replaceText('\\{\\{DIADIEMVTT\\}\\}',     item.location     || '');
    body.replaceText('\\{\\{DIADIEMGD\\}\\}',      noiGD             || '');
    body.replaceText('\\{\\{MOTA\\}\\}',            _capitalizeFirst(item.description));
    body.replaceText('\\{\\{TENGDV\\}\\}',         'Giám định viên Tasco');
    body.replaceText('\\{\\{SDTGDV\\}\\}',         '');
    // Đã sửa: Trả lại đúng tên Lái xe cho thẻ TENLAIXE
    body.replaceText('\\{\\{TENLAIXE\\}\\}',       item.driverName || item.customer || '');
    // Bổ sung: Map đúng tên Người liên hệ cho thẻ NGUOITHONGBAO
    body.replaceText('\\{\\{NGUOITHONGBAO\\}\\}',  item.customer || '');
    body.replaceText('\\{\\{SDTKH\\}\\}',          item.phone || '');
    body.replaceText('\\{\\{BSX\\}\\}',            item.bsx      || '');
    body.replaceText('\\{\\{SOKHUNG\\}\\}',        item.soKhung  || '');
    body.replaceText('\\{\\{SOMAY\\}\\}',          item.soMay    || '');
    body.replaceText('\\{\\{HANGXE\\}\\}',         item.hangXe   || '');
    body.replaceText('\\{\\{HIEUXE\\}\\}',         item.loaiXe   || '');
    // Đã sửa: Map đúng trường soChoNgoi và namSanXuat từ dữ liệu gửi lên
    body.replaceText('\\{\\{SOCHONGOI\\}\\}',      item.soChoNgoi || '');
    body.replaceText('\\{\\{NAMSX\\}\\}',          item.namSanXuat || '');
    body.replaceText('\\{\\{CHUXE\\}\\}',          item.chuXe    || '');
    body.replaceText('\\{\\{CHUXE\\}\\}',          item.chuXe    || '');
    body.replaceText('\\{\\{DIACHI\\}\\}',         item.diaChi   || '');
    body.replaceText('\\{\\{SODK\\}\\}',           item.soDangKiem || '');
    body.replaceText('\\{\\{NGAYDK\\}\\}',         item.ngayCapDK  || '');
    body.replaceText('\\{\\{NGAYHETHANDK\\}\\}',   item.hetHanDK   || '');
    body.replaceText('\\{\\{SOGPLX\\}\\}',         item.soGPLX      || '');
    body.replaceText('\\{\\{HANGGPLX\\}\\}',       item.hangGPLX    || '');
    body.replaceText('\\{\\{NGAYCAPGPLX\\}\\}',    item.ngayCapGPLX || '');
    body.replaceText('\\{\\{HETHANGPLX\\}\\}',     item.hetHanGPLX  || '');
    body.replaceText('\\{\\{TENCHUTK\\}\\}',       item.garaName    || '');
    body.replaceText('\\{\\{DIACHIGARA\\}\\}',      item.garaAddress || '');
    body.replaceText('\\{\\{SDTGARA\\}\\}',         item.garaPhone   || '');
    body.replaceText('\\{\\{MSTGARA\\}\\}',         item.garaTax     || '');
    body.replaceText('\\{\\{NGUYENNHAN\\}\\}',     nguyenNhan || item.cause || '');
    body.replaceText('\\{\\{KIENNGHI\\}\\}',        kienNghi   || '');

    // ── TÌM ĐÚNG BẢNG HẠNG MỤC: bảng có header "STT" ──
    var tables = body.getTables();
    var hangMucTable = null;
    for (var t = 0; t < tables.length; t++) {
      var tbl = tables[t];
      if (tbl.getNumRows() >= 1) {
        var firstRowText = tbl.getRow(0).getText();
        if (firstRowText.indexOf('STT') !== -1 || firstRowText.indexOf('Chi tiết') !== -1) {
          hangMucTable = tbl;
          break;
        }
      }
    }

    if (hangMucTable && hangMuc.length > 0) {
      var numCols = hangMucTable.getRow(0).getNumCells();

      // Xóa hàng dữ liệu cũ, giữ lại các header row (có chữ STT hoặc Sửa chữa)
      var totalRows = hangMucTable.getNumRows();
      var headerRowCount = 0;
      for (var r = 0; r < totalRows; r++) {
        var rowText = hangMucTable.getRow(r).getText();
        if (rowText.indexOf('STT') !== -1 || rowText.indexOf('Sửa chữa') !== -1 || rowText.indexOf('Thay thế') !== -1) {
          headerRowCount = r + 1;
        } else {
          break;
        }
      }
      // Xóa từ dưới lên, giữ headerRowCount rows đầu
      for (var r = totalRows - 1; r >= headerRowCount; r--) {
        hangMucTable.removeRow(r);
      }

      // Append data rows
      hangMuc.forEach(function(hm, idx) {
        var newRow = hangMucTable.appendTableRow();
        // ★ Thu hẹp chiều cao dòng
        newRow.setMinimumHeight(12);

        while (newRow.getNumCells() < numCols) {
          newRow.appendTableCell('');
        }

        // Viết hoa chữ cái đầu
        var capFirst = function(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; };

        var cellValues = [
          String(idx + 1),
          capFirst(hm.chiTiet || ''),
          capFirst(hm.moTa    || ''),
          hm.suaChua ? 'X' : '',
          hm.thayThe ? 'X' : '',
          // Thu hồi: chỉ khi thayThe=true VÀ thuHoi=true (không áp dụng cho sửa chữa)
          (hm.thuHoi && !hm.suaChua) ? 'X' : '',
          // Không thu hồi: khi sửa chữa, HOẶC thayThe không thu hồi, HOẶC không có gì
          (hm.suaChua || (!hm.suaChua && !hm.thayThe && !hm.thuHoi) || (hm.thayThe && !hm.thuHoi)) ? 'X' : '',
          ''
        ];

        for (var c = 0; c < numCols; c++) {
          var cell = newRow.getCell(c);
          cell.setText((c < cellValues.length) ? cellValues[c] : '');
          try {
            var para = cell.getChild(0).asParagraph();
            para.setFontSize(9); // ★ Font nhỏ hơn chút để khít dòng
            if (c === 0 || c >= 3) {
              para.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
            }
          } catch(e) {}
        }
      });
    }

    doc.saveAndClose();

    var exportUrl = 'https://docs.google.com/feeds/download/documents/export/Export?id='
      + tempFileId + '&exportFormat=docx';
    var response = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });

    var patchedBytes = _patchDocxBorders(response.getBlob().getBytes());
    DriveApp.getFileById(tempFileId).setTrashed(true);

    return makeJsonResponse({
      success:  true,
      content:  Utilities.base64Encode(patchedBytes),
      fileName: 'BienbangGD_' + (item.bsx || 'HoSo') + '_' + ngay + thang + nam + '.docx'
    });

  } catch (e) {
    Logger.log('Lỗi exportBienbangGD: ' + e);
    return makeJsonResponse({ success: false, error: e.message });
  }
}

function _capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function _patchDocxBorders(docxBytes) {
  try {
    var FULL_BORDER = '<w:tcBorders>'
      + '<w:top    w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
      + '<w:left   w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
      + '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
      + '<w:right  w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
      + '</w:tcBorders>';

    var blob    = Utilities.newBlob(docxBytes, 'application/zip', 'doc.docx');
    var zipFile = Utilities.unzip(blob);
    var docXmlBlob = null;

    for (var i = 0; i < zipFile.length; i++) {
      if (zipFile[i].getName() === 'word/document.xml') {
        docXmlBlob = zipFile[i]; break;
      }
    }
    if (!docXmlBlob) return docxBytes;

    var xml = docXmlBlob.getDataAsString('UTF-8');

    // ══════════════════════════════════════════════════
    // BƯỚC 0: XÓA TRANG "THẺ 1"
    // Tìm <w:p> chứa <w:sectPr> trong <w:pPr> (section break tạo trang riêng)
    // và có text "Thẻ 1" — xóa toàn bộ <w:p> đó
    // ══════════════════════════════════════════════════
    var sectPrIdx = xml.indexOf('<w:sectPr>');
    if (sectPrIdx !== -1) {
      // Tìm <w:pPr> bao ngoài sectPr
      var pPrStart = xml.lastIndexOf('<w:pPr>', sectPrIdx);
      if (pPrStart !== -1) {
        // Tìm <w:p> bao ngoài pPr
        var pStart = xml.lastIndexOf('<w:p ', pPrStart);
        if (pStart === -1) pStart = xml.lastIndexOf('<w:p>', pPrStart);
        var pEnd   = xml.indexOf('</w:p>', pPrStart) + '</w:p>'.length;
        if (pStart !== -1 && pEnd > pStart) {
          xml = xml.substring(0, pStart) + xml.substring(pEnd);
        }
      }
    }

    // ══════════════════════════════════════════════════
    // BƯỚC 1: <w:tcPr/> → full border
    // ══════════════════════════════════════════════════
    xml = xml.split('<w:tcPr/>').join('<w:tcPr>' + FULL_BORDER + '</w:tcPr>');

    // ══════════════════════════════════════════════════
    // BƯỚC 2: <w:tcPr>...</w:tcPr> — xóa border cũ, chèn full border mới
    // ══════════════════════════════════════════════════
    var result  = '';
    var pos     = 0;
    var openPr  = '<w:tcPr>';
    var closePr = '</w:tcPr>';
    var openB   = '<w:tcBorders>';
    var closeB  = '</w:tcBorders>';

    while (pos < xml.length) {
      var startPr = xml.indexOf(openPr, pos);
      if (startPr === -1) { result += xml.substring(pos); break; }

      result += xml.substring(pos, startPr);

      var endPr = xml.indexOf(closePr, startPr);
      if (endPr === -1) { result += xml.substring(startPr); break; }

      var inner = xml.substring(startPr + openPr.length, endPr);

      // Xóa <w:tcBorders>...</w:tcBorders> cũ nếu có
      var bStart = inner.indexOf(openB);
      var bEnd   = inner.indexOf(closeB);
      if (bStart !== -1 && bEnd !== -1) {
        inner = inner.substring(0, bStart) + inner.substring(bEnd + closeB.length);
      }

      result += openPr + inner + FULL_BORDER + closePr;
      pos = endPr + closePr.length;
    }

    // ══════════════════════════════════════════════════
    // BƯỚC 3: Rebuild zip
    // ══════════════════════════════════════════════════
    var newFiles = [];
    for (var j = 0; j < zipFile.length; j++) {
      if (zipFile[j].getName() === 'word/document.xml') {
        newFiles.push(Utilities.newBlob(result, 'application/xml', 'word/document.xml'));
      } else {
        newFiles.push(zipFile[j]);
      }
    }

    return Utilities.zip(newFiles, 'patched.docx').getBytes();

  } catch(e) {
    Logger.log('Lỗi _patchDocxBorders: ' + e);
    return docxBytes;
  }
}

function debugHeaderRow() {
  var TEMPLATE_FILE_ID = '1B5X3OHLMUgPzhap87nvnwlb06DVoY6lIetJafMHGBQg';
  var tempFile = DriveApp.getFileById(TEMPLATE_FILE_ID).makeCopy('DEBUG_temp');
  var tempFileId = tempFile.getId();
  var doc = DocumentApp.openById(tempFileId);
  doc.saveAndClose();

  var exportUrl = 'https://docs.google.com/feeds/download/documents/export/Export?id='
    + tempFileId + '&exportFormat=docx';
  var response = UrlFetchApp.fetch(exportUrl, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });

  var blob = Utilities.newBlob(response.getBlob().getBytes(), 'application/zip', 'doc.docx');
  var zipFile = Utilities.unzip(blob);

  for (var i = 0; i < zipFile.length; i++) {
    if (zipFile[i].getName() === 'word/document.xml') {
      var xml = zipFile[i].getDataAsString('UTF-8');
      
      // Cắt đoạn chứa bảng đầu tiên
      var tcStart = xml.indexOf('<w:tc>');
      if (tcStart === -1) tcStart = xml.indexOf('<w:tc ');
      
      // In ra 2000 ký tự từ cell đầu tiên
      Logger.log('=== XML từ <w:tc> đầu tiên ===');
      Logger.log(xml.substring(tcStart, tcStart + 2000));
      break;
    }
  }

  DriveApp.getFileById(tempFileId).setTrashed(true);
}


function exportUyQuyen(data) {
  try {
    // ★ Upload file UyQuyen_TEMPLATE.docx lên Drive rồi paste ID vào đây
    var TEMPLATE_ID = '1eMUeROJKdeBu5MZhBWhuMOJOhUHsCR57dKetjOYAtjE';
 
    var templateFile = DriveApp.getFileById(TEMPLATE_ID);
    var tempFile     = templateFile.makeCopy('UyQuyen_temp_' + Date.now());
    var tempFileId   = tempFile.getId();
    var doc          = DocumentApp.openById(tempFileId);
    var body         = doc.getBody();
 
    var replacements = {
      '{{TINH}}':           'Gia Lai',
      '{{NGAY_HT}}':        data.ngayHienTai   || '',
      '{{THANG_HT}}':       data.thangHienTai  || '',
      '{{NAM_HT}}':         data.namHienTai    || '',
      '{{BSX}}':            data.bsx           || '',
      '{{NGAY_VTT}}':       data.ngay          || '',
      '{{THANG_VTT}}':      data.thang         || '',
      '{{NAM_VTT}}':        data.nam           || '',
      '{{GIO_VTT}}':        data.gio           || '......',
      '{{NGUOI_DAI_DIEN}}': data.nguoiDaiDien  || '……………………………………………',
      '{{CHUC_VU}}':        data.chucVu        || 'Giám định viên',
      '{{TEN_CHU_XE}}':     data.tenChuXe      || '',
      '{{TEN_HT}}':         data.tenHienThi    || '',
      '{{CCCD}}':           data.cccd          || '…………………………',
      '{{DIA_CHI}}':        data.diaChi        || '………………………………………………………'
    };
 
    for (var key in replacements) {
      body.replaceText(key.replace(/\{/g,'\\{').replace(/\}/g,'\\}'), replacements[key]);
    }
 
    doc.saveAndClose();
 
    var exportUrl = 'https://docs.google.com/feeds/download/documents/export/Export?id='
      + tempFileId + '&exportFormat=docx';
    var response = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
 
    var b64 = Utilities.base64Encode(response.getBlob().getBytes());
    DriveApp.getFileById(tempFileId).setTrashed(true);
 
    return makeJsonResponse({ success: true, content: b64 });
 
  } catch (e) {
    Logger.log('Lỗi exportUyQuyen: ' + e);
    return makeJsonResponse({ success: false, error: e.message });
  }
}


// ============================================================
// exportXacNhanBT — Giấy xác nhận bồi thường
// ============================================================
function exportXacNhanBT(data) {
  try {
    var TEMPLATE_ID = '1_rDG6E4CyZkPZ81mtFRr6Vq6QhxZSAnVULDuvm4fm2Q';

    var templateFile = DriveApp.getFileById(TEMPLATE_ID);
    var tempFile     = templateFile.makeCopy('XacNhanBT_temp_' + Date.now());
    var tempFileId   = tempFile.getId();
    var doc          = DocumentApp.openById(tempFileId);
    var body         = doc.getBody();

    var pad   = function(n){ return n < 10 ? '0'+n : ''+n; };
    var today = new Date();
    var ngay  = pad(today.getDate());
    var thang = pad(today.getMonth()+1);
    var nam   = today.getFullYear();

    var ngayTT = data.accidentDate
      ? data.accidentDate.trim().split(' ')[0]
      : '.../.../...';

    var ownerType   = data.ownerType || 'personal';
    var nguoiDuocBH = ownerType === 'business'
      ? (data.ownerCompany || data.ownerRep || data.chuXe || '')
      : (data.ownerName    || data.chuXe    || '');
    var diaChiBH = ownerType === 'business'
      ? (data.ownerCompanyAddress || data.diaChi || '')
      : (data.ownerAddress        || data.diaChi || '');

    // ── NGƯỜI THỤ HƯỞNG DUY NHẤT ──
    var recv = data.xnbtRecv || 'gara';
    var thuHuong1, stk1, nganHang1;

    if (recv === 'gara') {
      thuHuong1 = data.garaBankOwner || data.garaName    || '...................................';
      stk1      = data.garaBankNo                        || '...................................';
      nganHang1 = data.garaBankName                      || '...................................';
    } else {
      thuHuong1 = data.ownerBankOwner || nguoiDuocBH     || '...................................';
      stk1      = data.ownerBankNo                       || '...................................';
      nganHang1 = data.ownerBankName                     || '...................................';
    }

    var replacements = {
      '{{TINH}}':                'Đắk Lắk',
      '{{NGAY}}':                ngay,
      '{{THANG}}':               thang,
      '{{NAM}}':                 String(nam),
      '{{NGUOI_DUOC_BH}}':       nguoiDuocBH,
      '{{DIA_CHI_BH}}':          diaChiBH,
      '{{BSX}}':                 data.bsx        || '',
      '{{NGAY_TT}}':             ngayTT,
      '{{BOI_THUONG_VAT_CHAT}}': data.description || data.cause || '....................................',
      '{{BOI_THUONG_KHAC}}':     '....................................',
      '{{THU_HUONG_1}}':         thuHuong1,
      '{{TIEN_MAT_1}}':          '☐',
      '{{CHUYEN_KHOAN_1}}':      '☑',
      '{{STK_1}}':               stk1,
      '{{NGAN_HANG_1}}':         nganHang1,
      // Xóa sạch các placeholder người thụ hưởng 2
      '{{THU_HUONG_2}}':         '',
      '{{TIEN_MAT_2}}':          '',
      '{{CHUYEN_KHOAN_2}}':      '',
      '{{STK_2}}':               '',
      '{{NGAN_HANG_2}}':         '',
    };

    for (var key in replacements) {
      body.replaceText(
        key.replace(/\{/g,'\\{').replace(/\}/g,'\\}'),
        replacements[key]
      );
    }

    doc.saveAndClose();

    var exportUrl = 'https://docs.google.com/feeds/download/documents/export/Export?id='
      + tempFileId + '&exportFormat=docx';
    var response = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });

    var b64 = Utilities.base64Encode(response.getBlob().getBytes());
    DriveApp.getFileById(tempFileId).setTrashed(true);

    return makeJsonResponse({
      success:  true,
      content:  b64,
      fileName: 'XacNhanBT_' + (data.bsx||'xe') + '_' + ngay+thang+nam + '.docx'
    });

  } catch(e) {
    Logger.log('Lỗi exportXacNhanBT: ' + e);
    return makeJsonResponse({ success:false, error:e.message });
  }
}

// ============================================================
// XUẤT HỢP ĐỒNG SỬA CHỮA (GARA)
// ============================================================
function exportHopDong(data) {
  try {
    // ⚠️ Thay ID này bằng ID file Google Docs template hợp đồng sửa chữa của bạn
    var TEMPLATE_ID = '1LPdrWDCwBGCwfIFzKLDDsYU-qjurdbYqxFG6nwr8mg8';

    var templateFile = DriveApp.getFileById(TEMPLATE_ID);
    var tempFile     = templateFile.makeCopy('HopDong_temp_' + Date.now());
    var tempFileId   = tempFile.getId();
    var doc          = DocumentApp.openById(tempFileId);
    var body         = doc.getBody();

    var pad   = function(n){ return n < 10 ? '0'+n : ''+n; };
    var today = new Date();
    var ngay  = pad(today.getDate());
    var thang = pad(today.getMonth() + 1);
    var nam   = today.getFullYear();

    // Xử lý tên chủ xe theo loại chủ sở hữu
    var ownerType  = data.ownerType || 'personal';
    var tenBenA    = ownerType === 'business'
      ? (data.ownerCompany || data.ownerRep || data.chuXe || '')
      : (data.ownerName    || data.chuXe    || '');
    var diaChiBenA = ownerType === 'business'
      ? (data.ownerCompanyAddress || data.diaChi || '')
      : (data.ownerAddress        || data.diaChi || '');

    // Tổng giá trị hợp đồng từ danh sách hạng mục
    var hangMuc    = data.damageItems || [];
    var tongGiaTri = hangMuc.reduce(function(acc, d) {
      return acc + (parseFloat(d.giaOem || d.giaAm || 0));
    }, 0);

    // Format số tiền bằng số
    var fmtNum = function(n) {
      return n.toLocaleString('vi-VN') + ' đồng';
    };

    var replacements = {
      '{{NGAY}}':          ngay,
      '{{THANG}}':         thang,
      '{{NAM}}':           String(nam),
      '{{TEN_BEN_A}}':     tenBenA,
      '{{DIA_CHI_BEN_A}}': diaChiBenA,
      '{{SDT_BEN_A}}':     data.phone || '',
      '{{TEN_BEN_B}}':     data.garaName    || '',
      '{{DIA_CHI_BEN_B}}': data.garaAddress || '',
      '{{SDT_BEN_B}}':     data.garaPhone   || '',
      '{{TK_BEN_B}}':      data.garaBankNo  || '',
      '{{BSX}}':           data.bsx         || '',
      '{{HANG_XE}}':       (data.hangXe || '') + ' ' + (data.loaiXe || ''),
      '{{DIA_DIEM_SC}}':   data.garaAddress || data.garaName || '',
      '{{TONG_GIA_TRI}}':  fmtNum(tongGiaTri),
      '{{TONG_GIA_TRI_CHU}}': data.tongGiaTriChu || '',
      '{{TIEN_BH}}':       data.blBaoHiemBaoLanh  ? fmtNum(parseFloat(data.blBaoHiemBaoLanh))  + ' vnđ (Chưa bao gồm thuế VAT)' : '...................................',
      '{{TIEN_KH}}':       data.blKhachHangTuTra  ? fmtNum(parseFloat(data.blKhachHangTuTra))  + ' vnđ (Chưa bao gồm thuế VAT)' : '...................................',
      '{{TIEN_GIAM}}':     data.blGiamGia          ? fmtNum(parseFloat(data.blGiamGia))          + ' vnđ (Chưa bao gồm thuế VAT)' : '...................................',
      '{{DAI_DIEN_BEN_B}}': data.garaRep      || data.garaName || '',
      '{{CHUC_VU_BEN_B}}':  'Giám đốc',
      '{{CHUC_VU_BEN_A}}':  '',
      '{{SO_HD}}':          '',
    };

    for (var key in replacements) {
      body.replaceText(
        key.replace(/\{/g, '\\{').replace(/\}/g, '\\}'),
        replacements[key]
      );
    }

    doc.saveAndClose();

    var exportUrl = 'https://docs.google.com/feeds/download/documents/export/Export?id='
      + tempFileId + '&exportFormat=docx';
    var response = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });

    var b64 = Utilities.base64Encode(response.getBlob().getBytes());
    DriveApp.getFileById(tempFileId).setTrashed(true);

    return makeJsonResponse({
      success:  true,
      content:  b64,
      fileName: 'HopDongSC_' + (data.bsx || 'xe') + '_' + ngay + thang + nam + '.docx'
    });

  } catch(e) {
    Logger.log('Lỗi exportHopDong: ' + e);
    return makeJsonResponse({ success: false, error: e.message });
  }
}

// ============================================================
// LƯU ẢNH LÊN GOOGLE DRIVE
// ============================================================
function uploadToDrive(data) {
  try {
    // 1. NHỚ THAY ID THƯ MỤC CỦA ANH VÀO ĐÂY
    var FOLDER_ID = "1bpOB60B7o1NDwahpZsVxct9PbfdwvKmK"; 
    var folder = DriveApp.getFolderById(FOLDER_ID);
    
    // 2. Giải mã và tạo file
    var blob = Utilities.newBlob(Utilities.base64Decode(data.base64), data.mimeType || 'image/jpeg', data.fileName);
    var file = folder.createFile(blob);
    
    // 3. QUAN TRỌNG: Cấp quyền công khai cho ảnh
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var fileId = file.getId();
    
    // 4. TRẢ VỀ LINK GOOGLEUSERCONTENT (Hiển thị ảnh siêu nhanh, không bị chặn)
    var directUrl = "https://lh3.googleusercontent.com/d/" + fileId;
    
    return makeJsonResponse({ 
      success: true, 
      url: directUrl, 
      fileId: fileId 
    });
  } catch(e) {
    return makeJsonResponse({ success: false, error: e.toString() });
  }
}

// ============================================================
// XÓA ẢNH KHỎI GOOGLE DRIVE
// ============================================================
function deleteFromDrive(data) {
  try {
    if (!data.fileId) return makeJsonResponse({ success: false, error: 'Thiếu fileId' });
    
    var file = DriveApp.getFileById(data.fileId);
    file.setTrashed(true); // Ném vào thùng rác (an toàn hơn là xóa vĩnh viễn)
    
    return makeJsonResponse({ success: true });
  } catch(e) {
    Logger.log('Lỗi delete_drive: ' + e);
    return makeJsonResponse({ success: false, error: e.toString() });
  }
}