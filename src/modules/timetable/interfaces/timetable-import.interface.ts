/**
 * Interfaces cho TimetableImportService
 * Định nghĩa các data shapes sử dụng trong quy trình import TKB từ Excel
 */

/**
 * Options đầu vào cho hàm importFromExcel
 */
export interface ImportTimetableOptions {
  /** File Excel được upload qua Multer */
  file: Express.Multer.File;
  /** ID trường (multi-tenant scoping) */
  schoolId: string;
  /** ID học kỳ đích để gắn phiên bản TKB */
  semesterId: string;
}

/**
 * Dữ liệu thô sau khi parse 1 dòng Excel
 * Tương ứng với 6 cột template: Lớp, Thứ, Tiết, Môn, Giáo viên, Phòng
 */
export interface ParsedTimetableRow {
  /** Tên lớp (cột A) */
  className: string;
  /** Thứ trong tuần: 2-7 (cột B) */
  dayOfWeek: number;
  /** Số thứ tự tiết học (cột C) */
  periodNumber: number;
  /** Mã môn học (cột D) */
  subjectCode: string;
  /** Mã nhân viên giáo viên (cột E) */
  teacherCode: string;
  /** Mã phòng học (cột F) - có thể rỗng */
  roomCode: string;
}

/**
 * Dữ liệu đã validate và tra cứu xong, sẵn sàng để lưu vào DB
 * Các mã code đã được chuyển thành UUID tương ứng
 */
export interface ValidatedSlotData {
  /** UUID của lớp */
  classId: string;
  /** Thứ trong tuần: 2-7 */
  dayOfWeek: number;
  /** UUID của tiết học (period_definition) */
  periodId: string;
  /** UUID của môn học */
  subjectId: string;
  /** UUID của giáo viên */
  teacherId: string;
  /** UUID của phòng học (optional vì cột Phòng không bắt buộc) */
  roomId?: string;
}

/**
 * Kết quả trả về sau khi import hoàn tất
 */
export interface TimetableImportResult {
  /** Tổng số dòng dữ liệu (không tính header) */
  totalRows: number;
  /** Số dòng import thành công */
  successCount: number;
  /** Số dòng bị lỗi */
  errorCount: number;
  /** Danh sách lỗi chi tiết */
  errors: TimetableImportError[];
  /** ID phiên bản TKB mới tạo (null nếu tất cả dòng đều lỗi) */
  versionId: string | null;
  /** Tên phiên bản TKB mới tạo (null nếu tất cả dòng đều lỗi) */
  versionName: string | null;
}

/**
 * Thông tin lỗi cho 1 dòng import không hợp lệ
 */
export interface TimetableImportError {
  /** Số dòng trong file Excel (bắt đầu từ 2 vì dòng 1 là header) */
  row: number;
  /** Tên trường bị lỗi */
  field: string;
  /** Mô tả lỗi */
  message: string;
  /** Giá trị gốc từ file Excel */
  value: string;
}
