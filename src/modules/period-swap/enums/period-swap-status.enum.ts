/**
 * Trạng thái yêu cầu đổi tiết.
 */
export enum PeriodSwapStatus {
  /** Chờ GV kia đồng ý */
  PENDING_TEACHER = 'pending_teacher',
  /** Chờ admin duyệt */
  PENDING_ADMIN = 'pending_admin',
  /** Đã duyệt */
  APPROVED = 'approved',
  /** GV kia từ chối */
  REJECTED_BY_TEACHER = 'rejected_by_teacher',
  /** Admin từ chối */
  REJECTED_BY_ADMIN = 'rejected_by_admin',
  /** Đã hủy */
  CANCELLED = 'cancelled',
}
