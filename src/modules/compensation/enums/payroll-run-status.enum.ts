/**
 * Trạng thái của Payroll Run.
 * Workflow: DRAFT → REVIEWED → APPROVED → PAID
 */
export enum PayrollRunStatus {
  DRAFT = 'draft',
  REVIEWED = 'reviewed',
  APPROVED = 'approved',
  PAID = 'paid',
  REJECTED = 'rejected',
}
