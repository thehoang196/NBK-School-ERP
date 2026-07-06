/**
 * Chiến lược xử lý xung đột khi import dữ liệu trùng lặp.
 */
export enum ConflictStrategy {
  /** Fail nếu trùng employeeCode — không insert, không update */
  STRICT = 'strict',

  /** Nếu trùng employeeCode → ghi đè toàn bộ fields bằng dữ liệu mới */
  UPSERT = 'upsert',

  /** Nếu trùng employeeCode → chỉ update các field có giá trị (non-null) từ file import */
  MERGE = 'merge',
}
