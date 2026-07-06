/**
 * Loại nghỉ phép.
 */
export enum LeaveRequestType {
  /** Nghỉ phép năm */
  ANNUAL = 'annual',
  /** Nghỉ ốm */
  SICK = 'sick',
  /** Nghỉ không lương */
  UNPAID = 'unpaid',
  /** Nghỉ việc riêng */
  PERSONAL = 'personal',
  /** Nghỉ thai sản */
  MATERNITY = 'maternity',
  /** Khác */
  OTHER = 'other',
}
