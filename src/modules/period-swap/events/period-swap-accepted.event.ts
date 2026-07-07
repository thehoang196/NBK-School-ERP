/**
 * Event phát ra khi GV target đồng ý đổi tiết → chuyển sang chờ admin.
 */
export class PeriodSwapAcceptedEvent {
  constructor(
    public readonly schoolId: string,
    public readonly swapId: string,
    public readonly requesterId: string,
    public readonly targetId: string,
  ) {}
}
