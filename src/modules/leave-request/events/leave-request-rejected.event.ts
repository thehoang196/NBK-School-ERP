/**
 * Event phát ra khi admin từ chối đơn xin nghỉ.
 */
export class LeaveRequestRejectedEvent {
  constructor(
    public readonly schoolId: string,
    public readonly teacherId: string,
    public readonly requestId: string,
    public readonly rejectedBy: string,
    public readonly reason: string,
  ) {}
}
