import { Injectable, Logger } from '@nestjs/common';
import { XMLBuilder } from 'fast-xml-parser';
import {
  FetInputData,
  FetExportResult,
  ActivityMetadata,
  TeacherAvailabilityDto,
  RoomConstraintDto,
} from '../interfaces/fet-dto.interface';
import {
  IFetInputExporter,
  ValidationError,
  ValidationResult,
} from '../interfaces/generation-pipeline.interface';
import { GenerationValidationException } from '../exceptions';

/**
 * Pure function layer for FET input XML generation.
 * No database dependencies — accepts only DTOs.
 * Produces deterministic FET v6.x XML output.
 */
@Injectable()
export class FetInputExporterService implements IFetInputExporter {
  private readonly logger = new Logger(FetInputExporterService.name);

  private readonly xmlBuilder = new XMLBuilder({
    format: true,
    suppressEmptyNode: true,
    ignoreAttributes: false,
    processEntities: false,
  });

  /**
   * Validates completeness and referential integrity of FetInputData.
   * Returns a ValidationResult with errors for each invalid field.
   */
  validate(input: FetInputData): ValidationResult {
    const errors: ValidationError[] = [];

    // 1. Non-empty collection checks
    if (!input.teachers || input.teachers.length === 0) {
      errors.push({
        field: 'teachers',
        message: 'Danh sách giáo viên không được rỗng',
      });
    }

    if (!input.classes || input.classes.length === 0) {
      errors.push({
        field: 'classes',
        message: 'Danh sách lớp học không được rỗng',
      });
    }

    if (!input.subjects || input.subjects.length === 0) {
      errors.push({
        field: 'subjects',
        message: 'Danh sách môn học không được rỗng',
      });
    }

    if (!input.teachingAssignments || input.teachingAssignments.length === 0) {
      errors.push({
        field: 'teachingAssignments',
        message: 'Danh sách phân công giảng dạy không được rỗng',
      });
    }

    if (!input.periodDefinitions || input.periodDefinitions.length === 0) {
      errors.push({
        field: 'periodDefinitions',
        message: 'Danh sách tiết học không được rỗng',
      });
    }

    if (!input.days || input.days.length === 0) {
      errors.push({
        field: 'days',
        message: 'Danh sách ngày trong tuần không được rỗng',
      });
    }

    // Build lookup sets for referential integrity checks
    const teacherIds = new Set((input.teachers || []).map((t) => t.id));
    const classIds = new Set((input.classes || []).map((c) => c.id));
    const subjectIds = new Set((input.subjects || []).map((s) => s.id));
    const roomIds = new Set((input.rooms || []).map((r) => r.id));

    // 7-10. Validate teaching assignments references and periodsPerWeek
    if (input.teachingAssignments) {
      for (const assignment of input.teachingAssignments) {
        if (!teacherIds.has(assignment.teacherId)) {
          errors.push({
            field: `teachingAssignments[${assignment.id}].teacherId`,
            message: `Phân công '${assignment.id}' tham chiếu giáo viên không tồn tại: '${assignment.teacherId}'`,
          });
        }

        if (!classIds.has(assignment.classId)) {
          errors.push({
            field: `teachingAssignments[${assignment.id}].classId`,
            message: `Phân công '${assignment.id}' tham chiếu lớp không tồn tại: '${assignment.classId}'`,
          });
        }

        if (!subjectIds.has(assignment.subjectId)) {
          errors.push({
            field: `teachingAssignments[${assignment.id}].subjectId`,
            message: `Phân công '${assignment.id}' tham chiếu môn học không tồn tại: '${assignment.subjectId}'`,
          });
        }

        if (assignment.periodsPerWeek <= 0) {
          errors.push({
            field: `teachingAssignments[${assignment.id}].periodsPerWeek`,
            message: `Phân công '${assignment.id}' có số tiết/tuần phải > 0, nhận được: ${assignment.periodsPerWeek}`,
          });
        }
      }
    }

    // 11. Validate teacher availability references
    if (input.teacherAvailability) {
      for (const availability of input.teacherAvailability) {
        if (!teacherIds.has(availability.teacherId)) {
          errors.push({
            field: `teacherAvailability[${availability.teacherId}].teacherId`,
            message: `Lịch rảnh tham chiếu giáo viên không tồn tại: '${availability.teacherId}'`,
          });
        }
      }
    }

    // 12-13. Validate room constraints references
    if (input.roomConstraints) {
      for (const constraint of input.roomConstraints) {
        if (!roomIds.has(constraint.roomId)) {
          errors.push({
            field: `roomConstraints[${constraint.subjectId}].roomId`,
            message: `Ràng buộc phòng tham chiếu phòng không tồn tại: '${constraint.roomId}'`,
          });
        }

        if (!subjectIds.has(constraint.subjectId)) {
          errors.push({
            field: `roomConstraints[${constraint.subjectId}].subjectId`,
            message: `Ràng buộc phòng tham chiếu môn học không tồn tại: '${constraint.subjectId}'`,
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Exports FetInputData to FET v6.x XML.
   * Throws GenerationValidationException if input is invalid.
   * Returns XML string and activityMap for downstream use.
   */
  export(input: FetInputData): FetExportResult {
    const validation = this.validate(input);
    if (!validation.valid) {
      const fields = validation.errors.map((e) => e.field);
      this.logger.error(
        `FET input validation failed: ${validation.errors.map((e) => e.message).join('; ')}`,
      );
      throw new GenerationValidationException(fields);
    }

    const activityMap = new Map<string, ActivityMetadata>();

    // Generate activities and build activityMap
    const activities = this.buildActivities(input, activityMap);

    // Build FET XML structure
    const fetDocument = this.buildFetDocument(input, activities, activityMap);

    // Serialize to XML
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      this.xmlBuilder.build(fetDocument);

    this.logger.debug(
      `FET XML exported: ${input.teachingAssignments.length} assignments → ${activityMap.size} activities`,
    );

    return { xml, activityMap };
  }

  /**
   * Builds the FET activity list and populates the activityMap.
   * Uses ONE activity per teaching assignment with Duration=1 and Total_Duration=periodsPerWeek.
   * FET will split into sub-activities automatically.
   */
  private buildActivities(
    input: FetInputData,
    activityMap: Map<string, ActivityMetadata>,
  ): Array<{
    Id: number;
    Teacher: string;
    Subject: string;
    Students: string;
    Duration: number;
    Total_Duration: number;
    Active: string;
  }> {
    const teacherMap = new Map(input.teachers.map((t) => [t.id, t.name]));
    const subjectMap = new Map(input.subjects.map((s) => [s.id, s.name]));
    const classMap = new Map(input.classes.map((c) => [c.id, c.name]));

    const activities: Array<{
      Id: number;
      Teacher: string;
      Subject: string;
      Students: string;
      Duration: number;
      Total_Duration: number;
      Active: string;
    }> = [];

    let activityId = 1;

    for (const assignment of input.teachingAssignments) {
      const teacherName = teacherMap.get(assignment.teacherId)!;
      const subjectName = subjectMap.get(assignment.subjectId)!;
      const className = classMap.get(assignment.classId)!;

      activities.push({
        Id: activityId,
        Teacher: teacherName,
        Subject: subjectName,
        Students: className,
        Duration: 1,
        Total_Duration: assignment.periodsPerWeek,
        Active: 'true',
      });

      activityMap.set(String(activityId), {
        teachingAssignmentId: assignment.id,
        teacherId: assignment.teacherId,
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        duration: 1,
      });

      activityId++;
    }

    return activities;
  }

  /**
   * Builds the complete FET document structure as a JS object
   * suitable for XMLBuilder serialization.
   */
  private buildFetDocument(
    input: FetInputData,
    activities: Array<{
      Id: number;
      Teacher: string;
      Subject: string;
      Students: string;
      Duration: number;
      Total_Duration: number;
      Active: string;
    }>,
    activityMap: Map<string, ActivityMetadata>,
  ): Record<string, unknown> {
    return {
      fet: {
        '@_version': '6.2.7',
        Institution_Name: input.institution,
        Comments: 'Generated by NBK_EMS',
        Days_List: this.buildDaysList(input),
        Hours_List: this.buildHoursList(input),
        Teachers_List: this.buildTeachersList(input),
        Subjects_List: this.buildSubjectsList(input),
        Students_List: this.buildStudentsList(input),
        Activities_List: this.buildActivitiesList(activities),
        Rooms_List: this.buildRoomsList(input),
        Time_Constraints_List: this.buildTimeConstraints(input, activityMap),
        Space_Constraints_List: this.buildSpaceConstraints(input, activityMap),
      },
    };
  }

  private buildDaysList(input: FetInputData): Record<string, unknown> {
    return {
      Number_of_Days: input.days.length,
      Day: input.days.map((day) => ({ Name: day })),
    };
  }

  private buildHoursList(input: FetInputData): Record<string, unknown> {
    return {
      Number_of_Hours: input.periodDefinitions.length,
      Hour: input.periodDefinitions.map((pd) => ({ Name: pd.name })),
    };
  }

  private buildTeachersList(input: FetInputData): Record<string, unknown> {
    return {
      Teacher: input.teachers.map((t) => ({ Name: t.name })),
    };
  }

  private buildSubjectsList(input: FetInputData): Record<string, unknown> {
    return {
      Subject: input.subjects.map((s) => ({ Name: s.name })),
    };
  }

  private buildStudentsList(input: FetInputData): Record<string, unknown> {
    // Group classes by gradeId
    const gradeGroups = new Map<string, string[]>();
    for (const cls of input.classes) {
      const existing = gradeGroups.get(cls.gradeId) || [];
      existing.push(cls.name);
      gradeGroups.set(cls.gradeId, existing);
    }

    const years: Array<Record<string, unknown>> = [];
    for (const [gradeId, classNames] of gradeGroups) {
      years.push({
        Name: gradeId,
        Number_of_Students: 0,
        Group: classNames.map((name) => ({
          Name: name,
          Number_of_Students: 0,
        })),
      });
    }

    return {
      Year: years,
    };
  }

  private buildActivitiesList(
    activities: Array<{
      Id: number;
      Teacher: string;
      Subject: string;
      Students: string;
      Duration: number;
      Total_Duration: number;
      Active: string;
    }>,
  ): Record<string, unknown> {
    return {
      Activity: activities.map((a) => ({
        Id: a.Id,
        Teacher: a.Teacher,
        Subject: a.Subject,
        Students: a.Students,
        Duration: a.Duration,
        Total_Duration: a.Total_Duration,
        Active: a.Active,
      })),
    };
  }

  private buildRoomsList(input: FetInputData): Record<string, unknown> {
    if (!input.rooms || input.rooms.length === 0) {
      return {};
    }

    return {
      Room: input.rooms.map((r) => ({
        Name: r.name,
        Capacity: r.capacity,
      })),
    };
  }

  private buildTimeConstraints(
    input: FetInputData,
    _activityMap: Map<string, ActivityMetadata>,
  ): Record<string, unknown> {
    const constraints: Array<Record<string, unknown>> = [];

    // Teacher not available constraints
    if (input.teacherAvailability && input.teacherAvailability.length > 0) {
      const teacherNameMap = new Map(input.teachers.map((t) => [t.id, t.name]));
      const periodNameMap = new Map(
        input.periodDefinitions.map((pd) => [pd.id, pd.name]),
      );

      for (const availability of input.teacherAvailability) {
        const teacherName = teacherNameMap.get(availability.teacherId);
        if (!teacherName || availability.unavailableSlots.length === 0) {
          continue;
        }

        const notAvailableTimes = this.buildNotAvailableTimes(
          availability,
          input.days,
          periodNameMap,
        );

        if (notAvailableTimes.length > 0) {
          constraints.push({
            ConstraintTeacherNotAvailableTimes: {
              Weight_Percentage: 100,
              Teacher: teacherName,
              Number_of_Not_Available_Times: notAvailableTimes.length,
              Not_Available_Time: notAvailableTimes,
            },
          });
        }
      }
    }

    // Teacher max periods per day constraints
    for (const teacher of input.teachers) {
      if (teacher.maxPeriodsPerDay > 0) {
        constraints.push({
          ConstraintTeacherMaxHoursDaily: {
            Weight_Percentage: 100,
            Teacher: teacher.name,
            Maximum_Hours_Daily: teacher.maxPeriodsPerDay,
          },
        });
      }
    }

    if (constraints.length === 0) {
      return {};
    }

    // Flatten constraints into a single object with arrays
    return this.flattenConstraints(constraints);
  }

  private buildNotAvailableTimes(
    availability: TeacherAvailabilityDto,
    days: string[],
    periodNameMap: Map<string, string>,
  ): Array<{ Day: string; Hour: string }> {
    const times: Array<{ Day: string; Hour: string }> = [];

    for (const slot of availability.unavailableSlots) {
      const dayName = days[slot.dayOfWeek];
      const hourName = periodNameMap.get(slot.periodId);

      if (dayName && hourName) {
        times.push({ Day: dayName, Hour: hourName });
      }
    }

    return times;
  }

  private buildSpaceConstraints(
    input: FetInputData,
    activityMap: Map<string, ActivityMetadata>,
  ): Record<string, unknown> {
    if (!input.roomConstraints || input.roomConstraints.length === 0) {
      return {};
    }

    const roomNameMap = new Map(input.rooms.map((r) => [r.id, r.name]));
    const constraints: Array<Record<string, unknown>> = [];

    // Build subject → activity IDs mapping
    const subjectActivityMap = this.buildSubjectActivityMap(activityMap);

    for (const roomConstraint of input.roomConstraints) {
      const roomName = roomNameMap.get(roomConstraint.roomId);
      if (!roomName) continue;

      const activityIds =
        subjectActivityMap.get(roomConstraint.subjectId) || [];
      for (const activityId of activityIds) {
        constraints.push({
          ConstraintActivityPreferredRoom: {
            Weight_Percentage: roomConstraint.weight,
            Activity_Id: activityId,
            Room: roomName,
          },
        });
      }
    }

    if (constraints.length === 0) {
      return {};
    }

    return this.flattenConstraints(constraints);
  }

  /**
   * Builds a mapping from subjectId → list of FET activity IDs
   * that teach that subject.
   */
  private buildSubjectActivityMap(
    activityMap: Map<string, ActivityMetadata>,
  ): Map<string, string[]> {
    const result = new Map<string, string[]>();

    for (const [activityId, metadata] of activityMap) {
      const existing = result.get(metadata.subjectId) || [];
      existing.push(activityId);
      result.set(metadata.subjectId, existing);
    }

    return result;
  }

  /**
   * Flattens an array of constraint objects into a single record
   * where each constraint type is a key mapping to a single object or array.
   * This ensures deterministic XML output.
   */
  private flattenConstraints(
    constraints: Array<Record<string, unknown>>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const constraint of constraints) {
      for (const [key, value] of Object.entries(constraint)) {
        const existing = result[key];
        if (existing === undefined) {
          result[key] = value;
        } else if (Array.isArray(existing)) {
          (existing as unknown[]).push(value);
        } else {
          result[key] = [existing, value];
        }
      }
    }

    return result;
  }
}
