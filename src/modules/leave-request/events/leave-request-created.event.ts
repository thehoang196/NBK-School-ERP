/**
 * Event phát ra khi giáo viên tạo đơn xin nghỉ mới.
 */
export class LeaveRequestCreatedEvent {
  constructor(
    public readonly schoolId: string,
    public readonly teacherId: string,
    public readonly requestId: string,
    public readonly startDate: string,
    public readonly endDate: string,
    public readonly leaveType: string,
  ) {}
}
