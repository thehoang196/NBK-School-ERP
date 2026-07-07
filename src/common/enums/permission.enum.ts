/**
 * Permission enum cho hệ thống NBK_EMS.
 * Format: <resource>:<action>
 */
export enum Permission {
  // School
  SCHOOL_CREATE = 'school:create',
  SCHOOL_READ = 'school:read',
  SCHOOL_UPDATE = 'school:update',
  SCHOOL_DELETE = 'school:delete',

  // Campus
  CAMPUS_CREATE = 'campus:create',
  CAMPUS_READ = 'campus:read',
  CAMPUS_UPDATE = 'campus:update',
  CAMPUS_DELETE = 'campus:delete',

  // Academic Year
  ACADEMIC_YEAR_CREATE = 'academic-year:create',
  ACADEMIC_YEAR_READ = 'academic-year:read',
  ACADEMIC_YEAR_UPDATE = 'academic-year:update',
  ACADEMIC_YEAR_DELETE = 'academic-year:delete',

  // Semester / Week
  SEMESTER_CREATE = 'semester:create',
  SEMESTER_READ = 'semester:read',
  SEMESTER_UPDATE = 'semester:update',
  SEMESTER_DELETE = 'semester:delete',

  // Grade
  GRADE_CREATE = 'grade:create',
  GRADE_READ = 'grade:read',
  GRADE_UPDATE = 'grade:update',
  GRADE_DELETE = 'grade:delete',

  // Class
  CLASS_CREATE = 'class:create',
  CLASS_READ = 'class:read',
  CLASS_UPDATE = 'class:update',
  CLASS_DELETE = 'class:delete',

  // Subject
  SUBJECT_CREATE = 'subject:create',
  SUBJECT_READ = 'subject:read',
  SUBJECT_UPDATE = 'subject:update',
  SUBJECT_DELETE = 'subject:delete',

  // Room
  ROOM_CREATE = 'room:create',
  ROOM_READ = 'room:read',
  ROOM_UPDATE = 'room:update',
  ROOM_DELETE = 'room:delete',

  // Teacher
  TEACHER_CREATE = 'teacher:create',
  TEACHER_READ = 'teacher:read',
  TEACHER_UPDATE = 'teacher:update',
  TEACHER_DELETE = 'teacher:delete',

  // Teaching Assignment
  TEACHING_ASSIGNMENT_CREATE = 'teaching-assignment:create',
  TEACHING_ASSIGNMENT_READ = 'teaching-assignment:read',
  TEACHING_ASSIGNMENT_UPDATE = 'teaching-assignment:update',
  TEACHING_ASSIGNMENT_DELETE = 'teaching-assignment:delete',

  // Timetable
  TIMETABLE_CREATE = 'timetable:create',
  TIMETABLE_READ = 'timetable:read',
  TIMETABLE_UPDATE = 'timetable:update',
  TIMETABLE_DELETE = 'timetable:delete',
  TIMETABLE_PUBLISH = 'timetable:publish',
  TIMETABLE_ROLLBACK = 'timetable:rollback',

  // Event / Holiday
  EVENT_CREATE = 'event:create',
  EVENT_READ = 'event:read',
  EVENT_UPDATE = 'event:update',
  EVENT_DELETE = 'event:delete',

  // Import / Export
  IMPORT_EXECUTE = 'import:execute',
  EXPORT_EXECUTE = 'export:execute',

  // Audit Log
  AUDIT_LOG_READ = 'audit-log:read',

  // User Management
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',

  // Leave Request
  LEAVE_REQUEST_CREATE = 'leave-request:create',
  LEAVE_REQUEST_READ = 'leave-request:read',
  LEAVE_REQUEST_APPROVE = 'leave-request:approve',
  LEAVE_REQUEST_REJECT = 'leave-request:reject',

  // Period Swap
  PERIOD_SWAP_CREATE = 'period-swap:create',
  PERIOD_SWAP_READ = 'period-swap:read',
  PERIOD_SWAP_APPROVE = 'period-swap:approve',
}

/**
 * Default permissions per role theo RBAC Matrix.
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  super_admin: Object.values(Permission),
  school_admin: [
    Permission.SCHOOL_READ,
    Permission.CAMPUS_CREATE,
    Permission.CAMPUS_READ,
    Permission.CAMPUS_UPDATE,
    Permission.CAMPUS_DELETE,
    Permission.ACADEMIC_YEAR_CREATE,
    Permission.ACADEMIC_YEAR_READ,
    Permission.ACADEMIC_YEAR_UPDATE,
    Permission.ACADEMIC_YEAR_DELETE,
    Permission.SEMESTER_CREATE,
    Permission.SEMESTER_READ,
    Permission.SEMESTER_UPDATE,
    Permission.SEMESTER_DELETE,
    Permission.GRADE_CREATE,
    Permission.GRADE_READ,
    Permission.GRADE_UPDATE,
    Permission.GRADE_DELETE,
    Permission.CLASS_CREATE,
    Permission.CLASS_READ,
    Permission.CLASS_UPDATE,
    Permission.CLASS_DELETE,
    Permission.SUBJECT_CREATE,
    Permission.SUBJECT_READ,
    Permission.SUBJECT_UPDATE,
    Permission.SUBJECT_DELETE,
    Permission.ROOM_CREATE,
    Permission.ROOM_READ,
    Permission.ROOM_UPDATE,
    Permission.ROOM_DELETE,
    Permission.TEACHER_CREATE,
    Permission.TEACHER_READ,
    Permission.TEACHER_UPDATE,
    Permission.TEACHER_DELETE,
    Permission.TEACHING_ASSIGNMENT_CREATE,
    Permission.TEACHING_ASSIGNMENT_READ,
    Permission.TEACHING_ASSIGNMENT_UPDATE,
    Permission.TEACHING_ASSIGNMENT_DELETE,
    Permission.TIMETABLE_CREATE,
    Permission.TIMETABLE_READ,
    Permission.TIMETABLE_UPDATE,
    Permission.TIMETABLE_DELETE,
    Permission.TIMETABLE_PUBLISH,
    Permission.TIMETABLE_ROLLBACK,
    Permission.EVENT_CREATE,
    Permission.EVENT_READ,
    Permission.EVENT_UPDATE,
    Permission.EVENT_DELETE,
    Permission.IMPORT_EXECUTE,
    Permission.EXPORT_EXECUTE,
    Permission.AUDIT_LOG_READ,
    Permission.USER_CREATE,
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.LEAVE_REQUEST_READ,
    Permission.LEAVE_REQUEST_APPROVE,
    Permission.LEAVE_REQUEST_REJECT,
    Permission.PERIOD_SWAP_READ,
    Permission.PERIOD_SWAP_APPROVE,
  ],
  scheduler: [
    Permission.ACADEMIC_YEAR_READ,
    Permission.SEMESTER_READ,
    Permission.GRADE_READ,
    Permission.CLASS_READ,
    Permission.SUBJECT_CREATE,
    Permission.SUBJECT_READ,
    Permission.SUBJECT_UPDATE,
    Permission.SUBJECT_DELETE,
    Permission.ROOM_CREATE,
    Permission.ROOM_READ,
    Permission.ROOM_UPDATE,
    Permission.ROOM_DELETE,
    Permission.TEACHER_READ,
    Permission.TEACHING_ASSIGNMENT_CREATE,
    Permission.TEACHING_ASSIGNMENT_READ,
    Permission.TEACHING_ASSIGNMENT_UPDATE,
    Permission.TEACHING_ASSIGNMENT_DELETE,
    Permission.TIMETABLE_CREATE,
    Permission.TIMETABLE_READ,
    Permission.TIMETABLE_UPDATE,
    Permission.TIMETABLE_DELETE,
    Permission.TIMETABLE_PUBLISH,
    Permission.EVENT_CREATE,
    Permission.EVENT_READ,
    Permission.EVENT_UPDATE,
    Permission.EVENT_DELETE,
    Permission.IMPORT_EXECUTE,
    Permission.EXPORT_EXECUTE,
  ],
  teacher: [
    Permission.ACADEMIC_YEAR_READ,
    Permission.SEMESTER_READ,
    Permission.GRADE_READ,
    Permission.CLASS_READ,
    Permission.SUBJECT_READ,
    Permission.ROOM_READ,
    Permission.TEACHER_READ,
    Permission.TEACHING_ASSIGNMENT_READ,
    Permission.TIMETABLE_READ,
    Permission.EVENT_READ,
    Permission.EXPORT_EXECUTE,
    Permission.LEAVE_REQUEST_CREATE,
    Permission.LEAVE_REQUEST_READ,
    Permission.PERIOD_SWAP_CREATE,
    Permission.PERIOD_SWAP_READ,
  ],
  viewer: [
    Permission.ACADEMIC_YEAR_READ,
    Permission.SEMESTER_READ,
    Permission.GRADE_READ,
    Permission.CLASS_READ,
    Permission.SUBJECT_READ,
    Permission.TIMETABLE_READ,
    Permission.EVENT_READ,
  ],
  hr: [
    Permission.TEACHER_CREATE,
    Permission.TEACHER_READ,
    Permission.TEACHER_UPDATE,
    Permission.TEACHER_DELETE,
    Permission.USER_CREATE,
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.IMPORT_EXECUTE,
    Permission.EXPORT_EXECUTE,
    Permission.AUDIT_LOG_READ,
  ],
};
