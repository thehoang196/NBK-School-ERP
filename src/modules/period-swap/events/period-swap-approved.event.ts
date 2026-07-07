/**
 * Event phát ra khi admin duyệt đổi tiết.
 * Consumers nên cập nhật actual_timetable_slots.
 */
export class PeriodSwapApprovedEvent {
  constructor(
    public readonly schoolId: string,
    public readonly swapId: string,
    public readonly requesterId: string,
    public readonly targetId: string,
    public readonly requesterDate: string,
    public readonly requesterPeriod: number,
    public readonly targetDate: string,
    public readonly targetPeriod: number,
    public readonly approvedBy: string,
  ) {}
}
