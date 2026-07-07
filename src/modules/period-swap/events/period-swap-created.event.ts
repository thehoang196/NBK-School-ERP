/**
 * Event phát ra khi GV tạo yêu cầu đổi tiết.
 */
export class PeriodSwapCreatedEvent {
  constructor(
    public readonly schoolId: string,
    public readonly swapId: string,
    public readonly requesterId: string,
    public readonly targetId: string,
    public readonly requesterDate: string,
    public readonly requesterPeriod: number,
    public readonly targetDate: string,
    public readonly targetPeriod: number,
  ) {}
}
