export enum EntityStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum SchoolStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum CampusStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum AcademicStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  COMPLETED = 'completed',
}

export enum TeacherStatus {
  ACTIVE = 'active',
  ON_LEAVE = 'on_leave',
  RESIGNED = 'resigned',
}

export enum TeacherType {
  FULL_TIME = 'full_time',
  ASSISTANT = 'assistant',
  VISITING = 'visiting',
  INTER_SCHOOL = 'inter_school',
}

export enum SubjectType {
  REQUIRED = 'required',
  ELECTIVE = 'elective',
  EXTRACURRICULAR = 'extracurricular',
}

export enum RoomType {
  STANDARD = 'standard',
  LAB = 'lab',
  GYM = 'gym',
  MUSIC = 'music',
  ART = 'art',
  OTHER = 'other',
}

export enum RoomStatus {
  AVAILABLE = 'available',
  MAINTENANCE = 'maintenance',
  UNAVAILABLE = 'unavailable',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export enum TimetableStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum SlotStatus {
  SCHEDULED = 'scheduled',
  CANCELLED = 'cancelled',
  SUBSTITUTED = 'substituted',
}
