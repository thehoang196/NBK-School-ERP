/**
 * Domain events cho Teacher module.
 * Các module khác (Payroll, HR, Notification) có thể subscribe
 * qua @OnEvent decorator.
 */

export class TeacherCreatedEvent {
  public static readonly eventName = 'teacher.created';

  constructor(
    public readonly teacherId: string,
    public readonly schoolId: string,
    public readonly employeeCode: string,
    public readonly fullName: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class TeacherUpdatedEvent {
  public static readonly eventName = 'teacher.updated';

  constructor(
    public readonly teacherId: string,
    public readonly schoolId: string,
    public readonly employeeCode: string,
    public readonly changedFields: string[],
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class TeacherDeletedEvent {
  public static readonly eventName = 'teacher.deleted';

  constructor(
    public readonly teacherId: string,
    public readonly schoolId: string,
    public readonly employeeCode: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class TeachersMergedEvent {
  public static readonly eventName = 'teacher.merged';

  constructor(
    public readonly primaryTeacherId: string,
    public readonly secondaryTeacherId: string,
    public readonly schoolId: string,
    public readonly referencesUpdated: number,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class TeachersImportedEvent {
  public static readonly eventName = 'teacher.imported';

  constructor(
    public readonly schoolId: string,
    public readonly batchId: string | null,
    public readonly successCount: number,
    public readonly errorCount: number,
    public readonly importedBy: string | null,
    public readonly timestamp: Date = new Date(),
  ) {}
}
