import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { Conflict, SlotCheckPayload } from './conflict.interface';

/**
 * Key format: "teacherId-dayOfWeek-periodId"
 * Value: slot occupying that teacher's time
 */
export type TeacherTimeslotIndex = Map<string, TimetableSlotEntity>;

/**
 * Key format: "roomId-dayOfWeek-periodId"
 * Value: slot occupying that room
 */
export type RoomTimeslotIndex = Map<string, TimetableSlotEntity>;

/**
 * Key format: "classId-dayOfWeek-periodId"
 * Value: slot occupying that class's time
 */
export type ClassTimeslotIndex = Map<string, TimetableSlotEntity>;

/**
 * Key format: "teacherId-dayOfWeek"
 * Value: array of period orders for that teacher on that day
 */
export type TeacherDayPeriodsIndex = Map<string, number[]>;

/**
 * Key format: "classId-subjectId"
 * Value: array of dayOfWeek values where this subject appears for this class
 */
export type SubjectDaysIndex = Map<string, number[]>;

export interface ConflictIndexes {
  teacherTimeslot: TeacherTimeslotIndex;
  roomTimeslot: RoomTimeslotIndex;
  classTimeslot: ClassTimeslotIndex;
  teacherDayPeriods: TeacherDayPeriodsIndex;
  subjectDays: SubjectDaysIndex;
  teacherDaySlots: Map<string, TimetableSlotEntity[]>;
  periodOrderMap: Map<string, number>;
  roomCampusMap: Map<string, string>;
}

export interface ConflictChecker {
  check(target: SlotCheckPayload, indexes: ConflictIndexes): Conflict[];
}
