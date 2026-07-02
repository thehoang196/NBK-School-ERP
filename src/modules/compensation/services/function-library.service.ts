import { Injectable } from '@nestjs/common';
import { FUNCTION_LIBRARY, FunctionDefinition } from '../formula-engine/function-library';

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
    AttendanceDays: 'business',
  };

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
   * TeachingHours: In production, queries actual_timetable_slots.
   * Returns total slots for a teacher within a pay period date range.
   * Placeholder: returns value from context or 0.
   */
  async getTeachingHours(teacherId: string, startDate: string, endDate: string): Promise<number> {
    // TODO: Integrate with timetable module
    // Query: SELECT COUNT(*) FROM actual_timetable_slots
    //   WHERE teacher_id = :teacherId
    //   AND slot_date BETWEEN :startDate AND :endDate
    //   AND status = 'published'
    return 0;
  }

  /**
   * TeachingHoursBySubject: Similar but filtered by subject_id.
   */
  async getTeachingHoursBySubject(
    teacherId: string,
    startDate: string,
    endDate: string,
    subjectId: string,
  ): Promise<number> {
    // TODO: Integrate with timetable module
    // Query: SELECT COUNT(*) FROM actual_timetable_slots
    //   WHERE teacher_id = :teacherId
    //   AND subject_id = :subjectId
    //   AND slot_date BETWEEN :startDate AND :endDate
    //   AND status = 'published'
    return 0;
  }

  /**
   * AttendanceDays: Placeholder for attendance module integration.
   */
  async getAttendanceDays(teacherId: string, startDate: string, endDate: string): Promise<number> {
    // TODO: Integrate with attendance module when available
    return 0;
  }
}
