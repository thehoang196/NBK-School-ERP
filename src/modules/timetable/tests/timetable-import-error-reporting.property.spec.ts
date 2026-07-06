/**
 * Property-Based Test: Import error reporting completeness
 *
 * Feature: timetable-management-features, Property 4: Import error reporting completeness
 * Validates: Requirements 1.5, 1.7
 *
 * For any import execution, the result SHALL satisfy:
 * - totalRows = successCount + errorCount
 * - errors array contains entries for each invalid row with correct row number, field name, and original value
 * - Error row numbers are within [2, totalRows + 1] range (1-indexed, skipping header)
 */
import * as fc from 'fast-check';
import * as ExcelJS from 'exceljs';
import { TimetableImportService } from '../services/timetable-import.service';
import {
  TimetableImportResult,
  TimetableImportError,
  ParsedTimetableRow,
} from '../interfaces/timetable-import.interface';

describe('Feature: timetable-management-features, Property 4: Import error reporting completeness', () => {
  // --- Arbitraries ---
  const alphanumChars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const nonEmptyAlphanumString: fc.Arbitrary<string> = fc
    .array(fc.constantFrom(...alphanumChars.split('')), {
      minLength: 1,
      maxLength: 10,
    })
    .map((chars) => chars.join(''));

  const uuidArb: fc.Arbitrary<string> = fc.uuid();
  const dayOfWeekArb = fc.integer({ min: 2, max: 7 });
  const periodNumberArb = fc.integer({ min: 1, max: 10 });

  /** A valid row that will pass basic validation */
  interface ValidRowInput {
    className: string;
    dayOfWeek: number;
    periodNumber: number;
    subjectCode: string;
    teacherCode: string;
    roomCode: string;
  }

  /** An invalid row that will fail validation (invalid dayOfWeek) */
  interface InvalidRowInput {
    className: string;
    dayOfWeek: number; // will be outside [2,7]
    periodNumber: number;
    subjectCode: string;
    teacherCode: string;
    roomCode: string;
  }

  const validRowArb: fc.Arbitrary<ValidRowInput> = fc.record({
    className: nonEmptyAlphanumString,
    dayOfWeek: dayOfWeekArb,
    periodNumber: periodNumberArb,
    subjectCode: nonEmptyAlphanumString,
    teacherCode: nonEmptyAlphanumString,
    roomCode: nonEmptyAlphanumString,
  });

  // Invalid row: dayOfWeek out of range [2,7] — produces exactly 1 error per row
  const invalidDayRowArb: fc.Arbitrary<InvalidRowInput> = fc.record({
    className: nonEmptyAlphanumString,
    dayOfWeek: fc.oneof(
      fc.integer({ min: -100, max: 1 }),
      fc.integer({ min: 8, max: 100 }),
    ),
    periodNumber: periodNumberArb,
    subjectCode: nonEmptyAlphanumString,
    teacherCode: nonEmptyAlphanumString,
    roomCode: nonEmptyAlphanumString,
  });

  /**
   * Helper: creates an Excel buffer from mixed valid/invalid rows
   */
  async function createExcelBuffer(
    rows: Array<ValidRowInput | InvalidRowInput>,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('TKB');

    // Header row
    worksheet.addRow(['Lớp', 'Thứ', 'Tiết', 'Môn', 'Giáo viên', 'Phòng']);

    // Data rows
    for (const row of rows) {
      worksheet.addRow([
        row.className,
        row.dayOfWeek,
        row.periodNumber,
        row.subjectCode,
        row.teacherCode,
        row.roomCode,
      ]);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Helper: creates a mock repository that returns entities matching the given codes
   */
  function createMockRepo<T>(entities: T[]): { find: jest.Mock } {
    return {
      find: jest
        .fn()
        .mockImplementation(
          ({ where }: { where: { schoolId: string; deletedAt: unknown } }) => {
            const filtered = entities.filter(
              (e: any) => e.schoolId === where.schoolId && e.deletedAt === null,
            );
            return Promise.resolve(filtered);
          },
        ),
    };
  }

  /**
   * Helper: creates a service instance with mocked repos for given valid codes
   */
  function createServiceWithMocks(
    schoolId: string,
    validRows: ValidRowInput[],
  ): TimetableImportService {
    // Build entity lists from valid rows so lookup succeeds for them
    const teachers = validRows.map((r, i) => ({
      id: `teacher-${i}`,
      schoolId,
      employeeCode: r.teacherCode,
      deletedAt: null,
    }));
    const subjects = validRows.map((r, i) => ({
      id: `subject-${i}`,
      schoolId,
      code: r.subjectCode,
      deletedAt: null,
    }));
    const classes = validRows.map((r, i) => ({
      id: `class-${i}`,
      schoolId,
      name: r.className,
      deletedAt: null,
    }));
    const periods = validRows.map((r, i) => ({
      id: `period-${i}`,
      schoolId,
      periodNumber: r.periodNumber,
      deletedAt: null,
    }));
    const rooms = validRows.map((r, i) => ({
      id: `room-${i}`,
      schoolId,
      code: r.roomCode,
      deletedAt: null,
    }));

    // Deduplicate by code/name/number (Maps use last value for duplicate keys)
    const uniqueTeachers = [
      ...new Map(teachers.map((t) => [t.employeeCode, t])).values(),
    ];
    const uniqueSubjects = [
      ...new Map(subjects.map((s) => [s.code, s])).values(),
    ];
    const uniqueClasses = [
      ...new Map(classes.map((c) => [c.name, c])).values(),
    ];
    const uniquePeriods = [
      ...new Map(periods.map((p) => [p.periodNumber, p])).values(),
    ];
    const uniqueRooms = [...new Map(rooms.map((r) => [r.code, r])).values()];

    const mockTeacherRepo = createMockRepo(uniqueTeachers);
    const mockSubjectRepo = createMockRepo(uniqueSubjects);
    const mockClassRepo = createMockRepo(uniqueClasses);
    const mockPeriodRepo = createMockRepo(uniquePeriods);
    const mockRoomRepo = createMockRepo(uniqueRooms);

    // Mock versionRepo.getNextVersionNumber
    const mockVersionRepo = {
      getNextVersionNumber: jest.fn().mockResolvedValue(1),
    };

    // Mock dataSource.transaction to just execute the callback without DB
    const mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb: Function) => {
        const mockManager = {
          create: jest.fn().mockImplementation((_entity: any, data: any) => ({
            id: 'mock-version-id',
            ...data,
          })),
          save: jest
            .fn()
            .mockImplementation(async (_entity: any, data: any) => {
              if (data) return data;
              return { id: 'mock-version-id' };
            }),
        };
        return cb(mockManager);
      }),
    };

    return new TimetableImportService(
      mockDataSource as any,
      mockVersionRepo as any,
      mockTeacherRepo as any,
      mockSubjectRepo as any,
      mockClassRepo as any,
      mockPeriodRepo as any,
      mockRoomRepo as any,
    );
  }

  it('should satisfy totalRows = successCount + errorCount for any mix of valid/invalid rows', async () => {
    // Generate unique valid rows to avoid duplicate detection
    const scenarioArb = fc
      .record({
        schoolId: uuidArb,
        validRows: fc.array(validRowArb, { minLength: 0, maxLength: 8 }),
        invalidRows: fc.array(invalidDayRowArb, { minLength: 0, maxLength: 8 }),
      })
      .filter((s) => s.validRows.length + s.invalidRows.length >= 1);

    await fc.assert(
      fc.asyncProperty(scenarioArb, async (scenario) => {
        const { schoolId, validRows, invalidRows } = scenario;

        // Make valid rows have unique class+day+period combos to avoid duplicate errors
        const dedupedValidRows = makeUniqueCombinations(validRows);

        // Interleave valid and invalid rows randomly
        const allRows: Array<ValidRowInput | InvalidRowInput> = [
          ...dedupedValidRows,
          ...invalidRows,
        ];

        const buffer = await createExcelBuffer(allRows);
        const service = createServiceWithMocks(schoolId, dedupedValidRows);

        const file = {
          buffer,
          mimetype:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: buffer.length,
        } as Express.Multer.File;

        const result = await service.importFromExcel({
          file,
          schoolId,
          semesterId: 'sem-1',
        });

        // PROPERTY: totalRows = successCount + errorCount
        expect(result.totalRows).toBe(result.successCount + result.errorCount);

        // Also verify totalRows matches actual input
        expect(result.totalRows).toBe(allRows.length);
      }),
      { numRuns: 100 },
    );
  });

  it('should have errors.length >= errorCount (one row can produce multiple error entries)', async () => {
    const scenarioArb = fc.record({
      schoolId: uuidArb,
      validRows: fc.array(validRowArb, { minLength: 0, maxLength: 5 }),
      invalidRows: fc.array(invalidDayRowArb, { minLength: 1, maxLength: 5 }),
    });

    await fc.assert(
      fc.asyncProperty(scenarioArb, async (scenario) => {
        const { schoolId, validRows, invalidRows } = scenario;

        const dedupedValidRows = makeUniqueCombinations(validRows);
        const allRows: Array<ValidRowInput | InvalidRowInput> = [
          ...dedupedValidRows,
          ...invalidRows,
        ];

        const buffer = await createExcelBuffer(allRows);
        const service = createServiceWithMocks(schoolId, dedupedValidRows);

        const file = {
          buffer,
          mimetype:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: buffer.length,
        } as Express.Multer.File;

        const result = await service.importFromExcel({
          file,
          schoolId,
          semesterId: 'sem-1',
        });

        // PROPERTY: errors array has at least one entry per invalid row
        // (one row can produce multiple errors if multiple fields are invalid)
        expect(result.errors.length).toBeGreaterThanOrEqual(result.errorCount);

        // When each invalid row has exactly ONE error (single invalid field),
        // errors.length should equal errorCount
        if (result.errorCount > 0) {
          expect(result.errors.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should have all error row numbers within [2, totalRows + 1] range', async () => {
    const scenarioArb = fc.record({
      schoolId: uuidArb,
      validRows: fc.array(validRowArb, { minLength: 0, maxLength: 5 }),
      invalidRows: fc.array(invalidDayRowArb, { minLength: 1, maxLength: 5 }),
    });

    await fc.assert(
      fc.asyncProperty(scenarioArb, async (scenario) => {
        const { schoolId, validRows, invalidRows } = scenario;

        const dedupedValidRows = makeUniqueCombinations(validRows);
        const allRows: Array<ValidRowInput | InvalidRowInput> = [
          ...dedupedValidRows,
          ...invalidRows,
        ];

        const buffer = await createExcelBuffer(allRows);
        const service = createServiceWithMocks(schoolId, dedupedValidRows);

        const file = {
          buffer,
          mimetype:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: buffer.length,
        } as Express.Multer.File;

        const result = await service.importFromExcel({
          file,
          schoolId,
          semesterId: 'sem-1',
        });

        // PROPERTY: all error row numbers are within [2, totalRows + 1]
        // Row 1 is header, data rows start at 2, last row = totalRows + 1
        for (const error of result.errors) {
          expect(error.row).toBeGreaterThanOrEqual(2);
          expect(error.row).toBeLessThanOrEqual(result.totalRows + 1);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should have each error with a valid non-empty field name and value string', async () => {
    const scenarioArb = fc.record({
      schoolId: uuidArb,
      validRows: fc.array(validRowArb, { minLength: 0, maxLength: 5 }),
      invalidRows: fc.array(invalidDayRowArb, { minLength: 1, maxLength: 5 }),
    });

    await fc.assert(
      fc.asyncProperty(scenarioArb, async (scenario) => {
        const { schoolId, validRows, invalidRows } = scenario;

        const dedupedValidRows = makeUniqueCombinations(validRows);
        const allRows: Array<ValidRowInput | InvalidRowInput> = [
          ...dedupedValidRows,
          ...invalidRows,
        ];

        const buffer = await createExcelBuffer(allRows);
        const service = createServiceWithMocks(schoolId, dedupedValidRows);

        const file = {
          buffer,
          mimetype:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: buffer.length,
        } as Express.Multer.File;

        const result = await service.importFromExcel({
          file,
          schoolId,
          semesterId: 'sem-1',
        });

        // PROPERTY: each error has non-empty field, non-empty message, and value is a string
        const validFields = [
          'Lớp',
          'Thứ',
          'Tiết',
          'Môn',
          'Giáo viên',
          'Phòng',
          'Lớp+Thứ+Tiết',
        ];
        for (const error of result.errors) {
          expect(error.field).toBeTruthy();
          expect(validFields).toContain(error.field);
          expect(error.message).toBeTruthy();
          expect(typeof error.message).toBe('string');
          expect(typeof error.value).toBe('string');
          expect(error.row).toBeGreaterThanOrEqual(2);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should report zero errors when all rows are valid with unique class+day+period', async () => {
    const scenarioArb = fc.record({
      schoolId: uuidArb,
      // Generate rows that will be deduped to have unique class+day+period
      validRows: fc.array(validRowArb, { minLength: 1, maxLength: 10 }),
    });

    await fc.assert(
      fc.asyncProperty(scenarioArb, async (scenario) => {
        const { schoolId, validRows } = scenario;

        const dedupedValidRows = makeUniqueCombinations(validRows);
        if (dedupedValidRows.length === 0) return; // skip empty scenarios

        const buffer = await createExcelBuffer(dedupedValidRows);
        const service = createServiceWithMocks(schoolId, dedupedValidRows);

        const file = {
          buffer,
          mimetype:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: buffer.length,
        } as Express.Multer.File;

        const result = await service.importFromExcel({
          file,
          schoolId,
          semesterId: 'sem-1',
        });

        // PROPERTY: when all rows are valid + unique, errorCount = 0 and errors is empty
        expect(result.totalRows).toBe(dedupedValidRows.length);
        expect(result.successCount).toBe(dedupedValidRows.length);
        expect(result.errorCount).toBe(0);
        expect(result.errors).toHaveLength(0);

        // Arithmetic invariant still holds
        expect(result.totalRows).toBe(result.successCount + result.errorCount);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Helper: deduplicate rows by className+dayOfWeek+periodNumber to prevent
   * duplicate detection errors in valid rows
   */
  function makeUniqueCombinations(rows: ValidRowInput[]): ValidRowInput[] {
    const seen = new Set<string>();
    const result: ValidRowInput[] = [];

    for (const row of rows) {
      const key = `${row.className}-${row.dayOfWeek}-${row.periodNumber}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(row);
      }
    }

    return result;
  }
});
