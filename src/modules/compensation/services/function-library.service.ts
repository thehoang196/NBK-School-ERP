import { Injectable, Logger } from '@nestjs/common';
import {
  FUNCTION_LIBRARY,
  FunctionDefinition,
} from '../formula-engine/function-library';
import { TeachingMetricsService, SubjectActivityMapping } from './teaching-metrics.service';
import { AttendanceSummaryService } from '../../attendance/services/attendance-summary.service';
import { TeachingActivityType } from '../enums';

export interface FunctionDocItem {
  name: string;
  description: string;
  params: { name: string; type: string; required: boolean }[];
  returnType: string;
  example: string;
  category: string;
}

@Injectable()
export class FunctionLibraryService {
  private readonly logger = new Logger(FunctionLibraryService.name);

  private readonly categoryMap: Record<string, string> = {
    SUM: 'math',
    ROUND: 'math',
    MIN: 'math',
    MAX: 'math',
    ABS: 'math',
    FLOOR: 'math',
    CEIL: 'math',
    IF: 'logic',
    TeachingHours: 'business',
    TeachingHoursBySubject: 'business',
    TeachingHoursByType: 'business',
    AttendanceDays: 'business',
  };

  constructor(
    private readonly teachingMetricsService: TeachingMetricsService,
    private readonly attendanceSummaryService: AttendanceSummaryService,
  ) {}

  /**
   * Get all available functions with their documentation.
   */
  getAllFunctions(): FunctionDocItem[] {
    return Object.entries(FUNCTION_LIBRARY).map(([name, def]) => ({
      name: def.name,
      description: def.description,
      params: def.params,
      returnType: def.returnType,
      example: def.example,
      category: this.categoryMap[name] || 'other',
    }));
  }

  /**
   * Get functions by category.
   */
  getFunctionsByCategory(category: string): FunctionDocItem[] {
    return this.getAllFunctions().filter((fn) => fn.category === category);
  }

  /**
   * Get a specific function's documentation.
   */
  getFunction(name: string): FunctionDocItem | null {
    const def = FUNCTION_LIBRARY[name];
    if (!def) return null;

    return {
      name: def.name,
      description: def.description,
      params: def.params,
      returnType: def.returnType,
      example: def.example,
      category: this.categoryMap[name] || 'other',
    };
  }

  /**
   * TeachingHours: Queries actual_timetable_slots.
   * Returns total slots for a teacher within a pay period date range.
   */
  async getTeachingHours(
    teacherId: string,
    schoolId: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    return this.teachingMetricsService.getTotalTeachingHours(
      teacherId,
      schoolId,
      startDate,
      endDate,
    );
  }

  /**
   * TeachingHoursBySubject: Filtered by subject_id.
   */
  async getTeachingHoursBySubject(
    teacherId: string,
    schoolId: string,
    startDate: string,
    endDate: string,
    subjectId: string,
  ): Promise<number> {
    return this.teachingMetricsService.getTeachingHoursBySubject(
      teacherId,
      schoolId,
      startDate,
      endDate,
      subjectId,
    );
  }

  /**
   * TeachingHoursByType: Filtered by activity type.
   * Requires subject→activity mapping (resolved from rule engine or config).
   */
  async getTeachingHoursByType(
    teacherId: string,
    schoolId: string,
    startDate: string,
    endDate: string,
    activityType: TeachingActivityType,
    subjectActivityMappings: SubjectActivityMapping[],
  ): Promise<number> {
    return this.teachingMetricsService.getTeachingHoursByType(
      teacherId,
      schoolId,
      startDate,
      endDate,
      activityType,
      subjectActivityMappings,
    );
  }

  /**
   * AttendanceDays: Gets actual work days from attendance summary.
   * Returns NGAY_CONG (actual_work_days) from the attendance summary for the month.
   */
  async getAttendanceDays(
    teacherId: string,
    schoolId: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    // Extract month/year from startDate
    const date = new Date(startDate);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    const summary = await this.attendanceSummaryService.findByTeacher(
      teacherId,
      schoolId,
      month,
      year,
    );

    if (!summary) {
      this.logger.warn(
        `Không có dữ liệu chấm công cho GV ${teacherId}, tháng ${month}/${year}`,
      );
      return 0;
    }

    return Number(summary.actualWorkDays);
  }
}
