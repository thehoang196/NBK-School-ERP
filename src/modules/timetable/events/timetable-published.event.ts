/**
 * Event emitted when a timetable version is published.
 * Notification module can listen for this event to notify affected teachers.
 *
 * Validates: REQ-5.2 - Gửi thông báo cho giáo viên liên quan
 */
export class TimetablePublishedEvent {
  public static readonly eventName = 'timetable.published';

  constructor(
    public readonly versionId: string,
    public readonly semesterId: string,
    public readonly teacherIds: string[],
    public readonly publishedBy: string,
    public readonly publishedAt: Date,
  ) {}
}
