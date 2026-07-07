/**
 * Event phát ra khi admin duyệt đơn xin nghỉ.
 */
export class LeaveRequestApprovedEvent {
  constructor(
    public readonly schoolId: string,
    public readonly teacherId: string,
    public readonly requestId: string,
    public readonly approvedBy: string,
    public readonly startDate: string,
    public readonly endDate: string,
  ) {}
}
