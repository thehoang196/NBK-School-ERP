import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { FetParseException } from '../exceptions/fet-parse.exception';
import {
  FetInputData,
  TeachingAssignmentDto,
  TeacherDto,
  TeacherAvailabilityDto,
  ClassDto,
  SubjectDto,
  RoomDto,
  RoomConstraintDto,
  PeriodDefinitionDto,
} from '../interfaces/fet-dto.interface';

// ─── Internal XML node types (parsed from fast-xml-parser) ──────────────────

interface FetXmlRoot {
  fet?: FetXmlDocument;
}

interface FetXmlDocument {
  Institution_Name?: string;
  Comments?: string;
  Days_List?: FetDaysList;
  Hours_List?: FetHoursList;
  Teachers_List?: FetTeachersList;
  Subjects_List?: FetSubjectsList;
  Students_List?: FetStudentsList;
  Activities_List?: FetActivitiesList;
  Rooms_List?: FetRoomsList;
  Time_Constraints_List?: FetTimeConstraintsList;
  Space_Constraints_List?: FetSpaceConstraintsList;
}

interface FetDaysList {
  Number_of_Days?: number;
  Day?: FetDayNode | FetDayNode[];
}

interface FetDayNode {
  Name?: string;
}

interface FetHoursList {
  Number_of_Hours?: number;
  Hour?: FetHourNode | FetHourNode[];
}

interface FetHourNode {
  Name?: string;
}

interface FetTeachersList {
  Teacher?: FetTeacherNode | FetTeacherNode[];
}

interface FetTeacherNode {
  Name?: string;
}

interface FetSubjectsList {
  Subject?: FetSubjectNode | FetSubjectNode[];
}

interface FetSubjectNode {
  Name?: string;
}

interface FetStudentsList {
  Year?: FetYearNode | FetYearNode[];
}

interface FetYearNode {
  Name?: string;
  Group?: FetGroupNode | FetGroupNode[];
}

interface FetGroupNode {
  Name?: string;
}

interface FetActivitiesList {
  Activity?: FetActivityNode | FetActivityNode[];
}

interface FetActivityNode {
  Id?: number | string;
  Teacher?: string;
  Subject?: string;
  Students?: string;
  Duration?: number | string;
  Total_Duration?: number | string;
  Active?: string | boolean;
  Activity_Group_Id?: number | string;
}

interface FetRoomsList {
  Room?: FetRoomNode | FetRoomNode[];
}

interface FetRoomNode {
  Name?: string;
  Capacity?: number | string;
}

interface FetTimeConstraintsList {
  ConstraintTeacherNotAvailableTimes?:
    FetTeacherNotAvailable | FetTeacherNotAvailable[];
  ConstraintTeacherMaxHoursDaily?: FetTeacherMaxHours | FetTeacherMaxHours[];
}

interface FetTeacherNotAvailable {
  Weight_Percentage?: number | string;
  Teacher?: string;
  Number_of_Not_Available_Times?: number | string;
  Not_Available_Time?: FetNotAvailableTime | FetNotAvailableTime[];
}

interface FetNotAvailableTime {
  Day?: string;
  Hour?: string;
}

interface FetTeacherMaxHours {
  Weight_Percentage?: number | string;
  Teacher_Name?: string;
  Teacher?: string;
  Maximum_Hours_Daily?: number | string;
}

interface FetSpaceConstraintsList {
  ConstraintActivityPreferredRoom?:
    FetActivityPreferredRoom | FetActivityPreferredRoom[];
}

interface FetActivityPreferredRoom {
  Weight_Percentage?: number | string;
  Activity_Id?: number | string;
  Room?: string;
}

/**
 * FetInputDeserializerService — parses FET v6.x input XML back into domain DTOs.
 *
 * This service is the complement to FetInputExporter. It enables round-trip
 * property testing: export → deserialize → compare structural equivalence.
 *
 * Since FET XML uses names (not UUIDs), the deserializer generates synthetic IDs
 * from entity names/positions to reconstruct a structurally equivalent FetInputData.
 */
@Injectable()
export class FetInputDeserializerService {
  private readonly parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      isArray: (_tagName, jPath) => {
        // Only treat as arrays in list contexts, not inside Activity elements
        const arrayPaths = [
          'fet.Days_List.Day',
          'fet.Hours_List.Hour',
          'fet.Teachers_List.Teacher',
          'fet.Subjects_List.Subject',
          'fet.Students_List.Year',
          'fet.Students_List.Year.Group',
          'fet.Activities_List.Activity',
          'fet.Rooms_List.Room',
          'fet.Time_Constraints_List.ConstraintTeacherNotAvailableTimes',
          'fet.Time_Constraints_List.ConstraintTeacherMaxHoursDaily',
          'fet.Space_Constraints_List.ConstraintActivityPreferredRoom',
          'fet.Time_Constraints_List.ConstraintTeacherNotAvailableTimes.Not_Available_Time',
        ];
        return arrayPaths.includes(String(jPath));
      },
      parseTagValue: true,
      trimValues: true,
    });
  }

  /**
   * Parse FET input XML and reconstruct FetInputData.
   * Throws FetParseException on malformed XML.
   */
  deserialize(xml: string): FetInputData {
    if (!xml || xml.trim().length === 0) {
      throw new FetParseException('XML đầu vào rỗng');
    }

    let parsed: FetXmlRoot;
    try {
      parsed = this.parser.parse(xml) as FetXmlRoot;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Lỗi không xác định';
      throw new FetParseException(`Không thể phân tích XML: ${message}`);
    }

    const doc = parsed?.fet;
    if (!doc) {
      throw new FetParseException('Thiếu phần tử gốc <fet>');
    }

    const institution = doc.Institution_Name ?? '';
    const days = this.parseDays(doc.Days_List);
    const periodDefinitions = this.parsePeriodDefinitions(doc.Hours_List);
    const teachers = this.parseTeachers(
      doc.Teachers_List,
      doc.Time_Constraints_List,
    );
    const subjects = this.parseSubjects(doc.Subjects_List);
    const classes = this.parseClasses(doc.Students_List);
    const rooms = this.parseRooms(doc.Rooms_List);
    const teachingAssignments = this.parseActivities(
      doc.Activities_List,
      teachers,
      classes,
      subjects,
    );
    const teacherAvailability = this.parseTeacherAvailability(
      doc.Time_Constraints_List,
      teachers,
      days,
      periodDefinitions,
    );
    const roomConstraints = this.parseRoomConstraints(
      doc.Space_Constraints_List,
      teachingAssignments,
      subjects,
      rooms,
    );

    // Extract schoolId and semesterId from Comments if embedded
    const { schoolId, semesterId } = this.parseComments(doc.Comments);

    return {
      institution,
      schoolId,
      semesterId,
      teachingAssignments,
      teachers,
      classes,
      subjects,
      rooms,
      periodDefinitions,
      days,
      teacherAvailability,
      roomConstraints,
    };
  }

  // ─── Private parsing methods ────────────────────────────────────────────────

  private parseDays(daysList: FetDaysList | undefined): string[] {
    if (!daysList?.Day) {
      return [];
    }
    const dayNodes = this.ensureArray(daysList.Day);
    return dayNodes.map((d) => d.Name ?? '').filter((name) => name.length > 0);
  }

  private parsePeriodDefinitions(
    hoursList: FetHoursList | undefined,
  ): PeriodDefinitionDto[] {
    if (!hoursList?.Hour) {
      return [];
    }
    const hourNodes = this.ensureArray(hoursList.Hour);
    return hourNodes
      .map((h, index) => {
        const name = h.Name ?? '';
        if (name.length === 0) return null;
        return {
          id: `period-${index}`,
          periodNumber: index + 1,
          name,
          sessionId: `session-${Math.floor(index / 5)}`, // Default session grouping
        };
      })
      .filter((p): p is PeriodDefinitionDto => p !== null);
  }

  private parseTeachers(
    teachersList: FetTeachersList | undefined,
    timeConstraints: FetTimeConstraintsList | undefined,
  ): TeacherDto[] {
    if (!teachersList?.Teacher) {
      return [];
    }
    const teacherNodes = this.ensureArray(teachersList.Teacher);

    // Build maxPeriodsPerDay lookup from constraints
    const maxHoursMap = new Map<string, number>();
    if (timeConstraints?.ConstraintTeacherMaxHoursDaily) {
      const constraints = this.ensureArray(
        timeConstraints.ConstraintTeacherMaxHoursDaily,
      );
      for (const constraint of constraints) {
        // Support both Teacher_Name (FET standard) and Teacher (exporter convention)
        const teacherName = constraint.Teacher_Name ?? constraint.Teacher ?? '';
        const maxHours = this.toNumber(constraint.Maximum_Hours_Daily, 0);
        if (teacherName && maxHours > 0) {
          maxHoursMap.set(teacherName, maxHours);
        }
      }
    }

    return teacherNodes
      .map((t, index) => {
        const name = t.Name ?? '';
        if (name.length === 0) return null;
        return {
          id: `teacher-${index}`,
          name,
          maxPeriodsPerDay: maxHoursMap.get(name) ?? 0,
        };
      })
      .filter((t): t is TeacherDto => t !== null);
  }

  private parseSubjects(
    subjectsList: FetSubjectsList | undefined,
  ): SubjectDto[] {
    if (!subjectsList?.Subject) {
      return [];
    }
    const subjectNodes = this.ensureArray(subjectsList.Subject);
    return subjectNodes
      .map((s, index) => {
        const name = s.Name ?? '';
        if (name.length === 0) return null;
        return {
          id: `subject-${index}`,
          name,
        };
      })
      .filter((s): s is SubjectDto => s !== null);
  }

  private parseClasses(studentsList: FetStudentsList | undefined): ClassDto[] {
    if (!studentsList?.Year) {
      return [];
    }
    const yearNodes = this.ensureArray(studentsList.Year);
    const classes: ClassDto[] = [];
    let classIndex = 0;

    for (const year of yearNodes) {
      const gradeId = year.Name ?? '';
      if (!year.Group) continue;

      const groups = this.ensureArray(year.Group);
      for (const group of groups) {
        const name = group.Name ?? '';
        if (name.length === 0) continue;
        classes.push({
          id: `class-${classIndex}`,
          name,
          gradeId,
        });
        classIndex++;
      }
    }

    return classes;
  }

  private parseRooms(roomsList: FetRoomsList | undefined): RoomDto[] {
    if (!roomsList?.Room) {
      return [];
    }
    const roomNodes = this.ensureArray(roomsList.Room);
    return roomNodes
      .map((r, index) => {
        const name = r.Name ?? '';
        if (name.length === 0) return null;
        return {
          id: `room-${index}`,
          name,
          capacity: this.toNumber(r.Capacity, 30),
        };
      })
      .filter((r): r is RoomDto => r !== null);
  }

  private parseActivities(
    activitiesList: FetActivitiesList | undefined,
    teachers: TeacherDto[],
    classes: ClassDto[],
    subjects: SubjectDto[],
  ): TeachingAssignmentDto[] {
    if (!activitiesList?.Activity) {
      return [];
    }
    const activityNodes = this.ensureArray(activitiesList.Activity);

    // Build name → id lookups
    const teacherMap = new Map(teachers.map((t) => [t.name, t.id]));
    const classMap = new Map(classes.map((c) => [c.name, c.id]));
    const subjectMap = new Map(subjects.map((s) => [s.name, s.id]));

    // Group activities by (teacher, class, subject) to reconstruct teaching assignments.
    // The exporter creates ONE activity per assignment (Duration=1, Total_Duration=periodsPerWeek).
    // But we also handle the case where multiple activities share the same teacher+class+subject
    // (in case activities are split per period).
    const assignmentMap = new Map<string, TeachingAssignmentDto>();

    for (const activity of activityNodes) {
      const teacherName = activity.Teacher ?? '';
      const className = activity.Students ?? '';
      const subjectName = activity.Subject ?? '';
      const duration = this.toNumber(activity.Duration, 1);
      const totalDuration = this.toNumber(activity.Total_Duration, 0);

      const teacherId = teacherMap.get(teacherName) ?? '';
      const classId = classMap.get(className) ?? '';
      const subjectId = subjectMap.get(subjectName) ?? '';

      if (!teacherId || !classId || !subjectId) continue;

      const key = `${teacherId}|${classId}|${subjectId}`;

      if (assignmentMap.has(key)) {
        const existing = assignmentMap.get(key)!;
        // If activities are split, accumulate durations
        existing.periodsPerWeek += duration;
      } else {
        // Use Total_Duration if available (exporter convention: single activity per assignment)
        // Otherwise fall back to Duration
        const periodsPerWeek = totalDuration > 0 ? totalDuration : duration;
        assignmentMap.set(key, {
          id: `assignment-${assignmentMap.size}`,
          teacherId,
          classId,
          subjectId,
          periodsPerWeek,
        });
      }
    }

    return Array.from(assignmentMap.values());
  }

  private parseTeacherAvailability(
    timeConstraints: FetTimeConstraintsList | undefined,
    teachers: TeacherDto[],
    days: string[],
    periodDefinitions: PeriodDefinitionDto[],
  ): TeacherAvailabilityDto[] {
    if (!timeConstraints?.ConstraintTeacherNotAvailableTimes) {
      return [];
    }
    const constraints = this.ensureArray(
      timeConstraints.ConstraintTeacherNotAvailableTimes,
    );

    const teacherIdMap = new Map(teachers.map((t) => [t.name, t.id]));
    const dayIndexMap = new Map(days.map((d, i) => [d, i]));
    const periodIdMap = new Map(periodDefinitions.map((p) => [p.name, p.id]));

    const availabilities: TeacherAvailabilityDto[] = [];

    for (const constraint of constraints) {
      const teacherName = constraint.Teacher ?? '';
      const teacherId = teacherIdMap.get(teacherName);
      if (!teacherId) continue;

      const unavailableSlots: Array<{ dayOfWeek: number; periodId: string }> =
        [];

      if (constraint.Not_Available_Time) {
        const times = this.ensureArray(constraint.Not_Available_Time);
        for (const time of times) {
          const dayName = time.Day ?? '';
          const hourName = time.Hour ?? '';
          const dayIndex = dayIndexMap.get(dayName);
          const periodId = periodIdMap.get(hourName);

          if (dayIndex !== undefined && periodId) {
            unavailableSlots.push({ dayOfWeek: dayIndex, periodId });
          }
        }
      }

      if (unavailableSlots.length > 0) {
        availabilities.push({ teacherId, unavailableSlots });
      }
    }

    return availabilities;
  }

  private parseRoomConstraints(
    spaceConstraints: FetSpaceConstraintsList | undefined,
    teachingAssignments: TeachingAssignmentDto[],
    subjects: SubjectDto[],
    rooms: RoomDto[],
  ): RoomConstraintDto[] {
    if (!spaceConstraints?.ConstraintActivityPreferredRoom) {
      return [];
    }
    const constraints = this.ensureArray(
      spaceConstraints.ConstraintActivityPreferredRoom,
    );

    const roomIdMap = new Map(rooms.map((r) => [r.name, r.id]));

    // Build activity ID → subject ID mapping from teaching assignments
    // Activity IDs are sequential: assignment 0 gets IDs 1..periodsPerWeek, etc.
    const activityToSubjectMap = new Map<string, string>();
    let activityId = 1;
    for (const assignment of teachingAssignments) {
      for (let i = 0; i < assignment.periodsPerWeek; i++) {
        activityToSubjectMap.set(String(activityId), assignment.subjectId);
        activityId++;
      }
    }

    // Deduplicate by (subjectId, roomId) — combine weight
    const roomConstraintMap = new Map<string, RoomConstraintDto>();

    for (const constraint of constraints) {
      const actId = String(constraint.Activity_Id ?? '');
      const roomName = constraint.Room ?? '';
      const weight = this.toNumber(constraint.Weight_Percentage, 100);

      const subjectId = activityToSubjectMap.get(actId);
      const roomId = roomIdMap.get(roomName);

      if (!subjectId || !roomId) continue;

      const key = `${subjectId}|${roomId}`;
      if (!roomConstraintMap.has(key)) {
        roomConstraintMap.set(key, { subjectId, roomId, weight });
      }
    }

    return Array.from(roomConstraintMap.values());
  }

  private parseComments(comments: string | undefined): {
    schoolId: string;
    semesterId: string;
  } {
    let schoolId = '';
    let semesterId = '';

    if (comments) {
      // Try to extract schoolId and semesterId from comments
      // Expected format: "schoolId:xxx;semesterId:yyy" or similar
      const schoolMatch = comments.match(/schoolId:\s*([^\s;]+)/i);
      const semesterMatch = comments.match(/semesterId:\s*([^\s;]+)/i);

      if (schoolMatch) schoolId = schoolMatch[1];
      if (semesterMatch) semesterId = semesterMatch[1];
    }

    return { schoolId, semesterId };
  }

  // ─── Utility helpers ────────────────────────────────────────────────────────

  private ensureArray<T>(value: T | T[]): T[] {
    if (Array.isArray(value)) return value;
    return [value];
  }

  private toNumber(
    value: number | string | undefined,
    defaultValue: number,
  ): number {
    if (value === undefined || value === null) return defaultValue;
    const num = typeof value === 'number' ? value : parseInt(String(value), 10);
    return isNaN(num) ? defaultValue : num;
  }
}
