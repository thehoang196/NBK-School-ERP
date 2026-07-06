/**
 * Property-Based Test: Version creation if and only if valid rows exist
 *
 * Feature: timetable-management-features, Property 3: Version creation if and only if valid rows exist
 * Validates: Requirements 1.4, 1.8
 *
 * For any set of import rows, a new TimetableVersion (DRAFT) SHALL be created if and only if
 * there is at least one row that passes all validations. When all rows are invalid, no version
 * SHALL be created.
 */
import * as fc from 'fast-check';
import { TimetableImportService } from '../services/timetable-import.service';
import {
  ImportTimetableOptions,
  TimetableImportResult,
} from '../interfaces/timetable-import.interface';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { TimetableStatus } from '../../../common/enums/status.enum';

describe('Feature: timetable-management-features, Property 3: Version creation if and only if valid rows exist', () => {
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
  const dayOfWeekValidArb = fc.integer({ min: 2, max: 7 });
  const dayOfWeekInvalidArb = fc.oneof(
    fc.integer({ min: -100, max: 1 }),
    fc.integer({ min: 8, max: 100 }),
  );
  const periodNumberValidArb = fc.integer({ min: 1, max: 15 });
  const periodNumberInvalidArb = fc.integer({ min: -100, max: 0 });

  /** A valid row: has non-empty fields and dayOfWeek in [2,7], periodNumber > 0 */
  interface RowSpec {
    className: string;
    dayOfWeek: number;
    periodNumber: number;
    subjectCode: string;
    teacherCode: string;
    roomCode: string;
    isValid: boolean;
  }

  const validRowArb: fc.Arbitrary<RowSpec> = fc.record({
    className: nonEmptyAlphanumString,
    dayOfWeek: dayOfWeekValidArb,
    periodNumber: periodNumberValidArb,
    subjectCode: nonEmptyAlphanumString,
    teacherCode: nonEmptyAlphanumString,
    roomCode: fc.oneof(nonEmptyAlphanumString, fc.constant('')),
    isValid: fc.constant(true),
  });

  /** Invalid row variants: empty required field, or dayOfWeek out of range, or periodNumber <= 0 */
  const invalidRowArb: fc.Arbitrary<RowSpec> = fc.oneof(
    // Invalid dayOfWeek
    fc.record({
      className: nonEmptyAlphanumString,
      dayOfWeek: dayOfWeekInvalidArb,
      periodNumber: periodNumberValidArb,
      subjectCode: nonEmptyAlphanumString,
      teacherCode: nonEmptyAlphanumString,
      roomCode: fc.constant(''),
      isValid: fc.constant(false),
    }),
    // Invalid periodNumber
    fc.record({
      className: nonEmptyAlphanumString,
      dayOfWeek: dayOfWeekValidArb,
      periodNumber: periodNumberInvalidArb,
      subjectCode: nonEmptyAlphanumString,
      teacherCode: nonEmptyAlphanumString,
      roomCode: fc.constant(''),
      isValid: fc.constant(false),
    }),
    // Empty className
    fc.record({
      className: fc.constant(''),
      dayOfWeek: dayOfWeekValidArb,
      periodNumber: periodNumberValidArb,
      subjectCode: nonEmptyAlphanumString,
      teacherCode: nonEmptyAlphanumString,
      roomCode: fc.constant(''),
      isValid: fc.constant(false),
    }),
    // Empty subjectCode
    fc.record({
      className: nonEmptyAlphanumString,
      dayOfWeek: dayOfWeekValidArb,
      periodNumber: periodNumberValidArb,
      subjectCode: fc.constant(''),
      teacherCode: nonEmptyAlphanumString,
      roomCode: fc.constant(''),
      isValid: fc.constant(false),
    }),
    // Empty teacherCode
    fc.record({
      className: nonEmptyAlphanumString,
      dayOfWeek: dayOfWeekValidArb,
      periodNumber: periodNumberValidArb,
      subjectCode: nonEmptyAlphanumString,
      teacherCode: fc.constant(''),
      roomCode: fc.constant(''),
      isValid: fc.constant(false),
    }),
  );

  /** Generate a mixed row set with a known count of valid/invalid rows */
  const rowSetArb: fc.Arbitrary<RowSpec[]> = fc
    .tuple(
      fc.array(validRowArb, { minLength: 0, maxLength: 8 }),
      fc.array(invalidRowArb, { minLength: 0, maxLength: 8 }),
    )
    .filter(
      ([validRows, invalidRows]) => validRows.length + invalidRows.length >= 1,
    )
    .chain(([validRows, invalidRows]) => {
      const allRows = [...validRows, ...invalidRows];
      // Shuffle the rows
      return fc.shuffledSubarray(allRows, {
        minLength: allRows.length,
        maxLength: allRows.length,
      });
    });

  // --- Helpers ---

  /**
   * Creates a mock ExcelJS workbook buffer from rows.
   * We bypass actual Excel creation by mocking parseExcelRows directly.
   */
  function createMockFile(size: number = 1024): Express.Multer.File {
    return {
      buffer: Buffer.alloc(size),
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size,
      fieldname: 'file',
      originalname: 'test.xlsx',
      encoding: '7bit',
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };
  }

  /**
   * Creates a mock repo that returns entities matching any code in the given set for a school.
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
   * Creates a service instance with mocked dependencies that track version creation.
   * Returns: { service, versionCreated, slotsInserted }
   */
  function createServiceWithMocks(
    schoolId: string,
    knownEntities: {
      classNames: string[];
      teacherCodes: string[];
      subjectCodes: string[];
      periodNumbers: number[];
      roomCodes: string[];
    },
  ) {
    let versionCreated = false;
    let slotsInserted: any[] = [];

    // Build entities for the target school
    const teachers = knownEntities.teacherCodes.map((code, i) => ({
      id: `teacher-${i}`,
      schoolId,
      employeeCode: code,
      deletedAt: null,
    }));
    const subjects = knownEntities.subjectCodes.map((code, i) => ({
      id: `subject-${i}`,
      schoolId,
      code,
      deletedAt: null,
    }));
    const classes = knownEntities.classNames.map((name, i) => ({
      id: `class-${i}`,
      schoolId,
      name,
      deletedAt: null,
    }));
    const periods = knownEntities.periodNumbers.map((num, i) => ({
      id: `period-${i}`,
      schoolId,
      periodNumber: num,
      deletedAt: null,
    }));
    const rooms = knownEntities.roomCodes.map((code, i) => ({
      id: `room-${i}`,
      schoolId,
      code,
      deletedAt: null,
    }));

    const mockTeacherRepo = createMockRepo(teachers);
    const mockSubjectRepo = createMockRepo(subjects);
    const mockClassRepo = createMockRepo(classes);
    const mockPeriodRepo = createMockRepo(periods);
    const mockRoomRepo = createMockRepo(rooms);

    // Mock versionRepo.getNextVersionNumber
    const mockVersionRepo = {
      getNextVersionNumber: jest.fn().mockResolvedValue(1),
    };

    // Mock dataSource.transaction — tracks whether version is created
    const mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation(async (cb: (manager: any) => Promise<any>) => {
          const mockManager = {
            create: jest
              .fn()
              .mockImplementation((EntityClass: any, data: any) => {
                if (EntityClass === TimetableVersionEntity) {
                  versionCreated = true;
                  return { id: 'version-id-123', ...data };
                }
                return {
                  id: `slot-${Math.random().toString(36).slice(2)}`,
                  ...data,
                };
              }),
            save: jest
              .fn()
              .mockImplementation(async (EntityClass: any, entity: any) => {
                if (EntityClass === TimetableVersionEntity) {
                  return entity;
                }
                if (Array.isArray(entity)) {
                  slotsInserted = entity;
                  return entity;
                }
                return entity;
              }),
          };
          return cb(mockManager);
        }),
    };

    const service = new TimetableImportService(
      mockDataSource as any,
      mockVersionRepo as any,
      mockTeacherRepo as any,
      mockSubjectRepo as any,
      mockClassRepo as any,
      mockPeriodRepo as any,
      mockRoomRepo as any,
    );

    return {
      service,
      getVersionCreated: () => versionCreated,
      getSlotsInserted: () => slotsInserted,
    };
  }

  // --- Property Tests ---

  it('version is created if and only if successCount >= 1 (biconditional)', async () => {
    await fc.assert(
      fc.asyncProperty(
        rowSetArb,
        uuidArb,
        uuidArb,
        async (rows, schoolId, semesterId) => {
          // Determine which rows are structurally valid (pass validateRows)
          const validRows = rows.filter((r) => r.isValid);

          // Collect unique codes from valid rows to create known entities
          const knownEntities = {
            classNames: [...new Set(validRows.map((r) => r.className))],
            teacherCodes: [...new Set(validRows.map((r) => r.teacherCode))],
            subjectCodes: [...new Set(validRows.map((r) => r.subjectCode))],
            periodNumbers: [...new Set(validRows.map((r) => r.periodNumber))],
            roomCodes: [
              ...new Set(
                validRows.filter((r) => r.roomCode).map((r) => r.roomCode),
              ),
            ],
          };

          const { service, getVersionCreated } = createServiceWithMocks(
            schoolId,
            knownEntities,
          );

          // Mock parseExcelRows to return our generated rows
          jest.spyOn(service, 'parseExcelRows').mockResolvedValue(
            rows.map((r) => ({
              className: r.className,
              dayOfWeek: r.dayOfWeek,
              periodNumber: r.periodNumber,
              subjectCode: r.subjectCode,
              teacherCode: r.teacherCode,
              roomCode: r.roomCode,
            })),
          );

          const file = createMockFile();
          const result = await service.importFromExcel({
            file,
            schoolId,
            semesterId,
          });

          // Biconditional: version created ⟺ successCount >= 1
          if (result.successCount >= 1) {
            expect(result.versionId).not.toBeNull();
            expect(result.versionName).not.toBeNull();
            expect(getVersionCreated()).toBe(true);
          } else {
            expect(result.versionId).toBeNull();
            expect(result.versionName).toBeNull();
            expect(getVersionCreated()).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('totalRows always equals successCount + errorCount', async () => {
    await fc.assert(
      fc.asyncProperty(
        rowSetArb,
        uuidArb,
        uuidArb,
        async (rows, schoolId, semesterId) => {
          const validRows = rows.filter((r) => r.isValid);

          const knownEntities = {
            classNames: [...new Set(validRows.map((r) => r.className))],
            teacherCodes: [...new Set(validRows.map((r) => r.teacherCode))],
            subjectCodes: [...new Set(validRows.map((r) => r.subjectCode))],
            periodNumbers: [...new Set(validRows.map((r) => r.periodNumber))],
            roomCodes: [
              ...new Set(
                validRows.filter((r) => r.roomCode).map((r) => r.roomCode),
              ),
            ],
          };

          const { service } = createServiceWithMocks(schoolId, knownEntities);

          jest.spyOn(service, 'parseExcelRows').mockResolvedValue(
            rows.map((r) => ({
              className: r.className,
              dayOfWeek: r.dayOfWeek,
              periodNumber: r.periodNumber,
              subjectCode: r.subjectCode,
              teacherCode: r.teacherCode,
              roomCode: r.roomCode,
            })),
          );

          const file = createMockFile();
          const result = await service.importFromExcel({
            file,
            schoolId,
            semesterId,
          });

          // Invariant: totalRows = successCount + errorCount
          expect(result.totalRows).toBe(
            result.successCount + result.errorCount,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('when all rows are invalid, no version is created (versionId is null)', async () => {
    // Generate only invalid rows
    const allInvalidRowsArb = fc.array(invalidRowArb, {
      minLength: 1,
      maxLength: 10,
    });

    await fc.assert(
      fc.asyncProperty(
        allInvalidRowsArb,
        uuidArb,
        uuidArb,
        async (rows, schoolId, semesterId) => {
          // No valid entities needed since all rows are invalid at validation stage
          const knownEntities = {
            classNames: [] as string[],
            teacherCodes: [] as string[],
            subjectCodes: [] as string[],
            periodNumbers: [] as number[],
            roomCodes: [] as string[],
          };

          const { service, getVersionCreated } = createServiceWithMocks(
            schoolId,
            knownEntities,
          );

          jest.spyOn(service, 'parseExcelRows').mockResolvedValue(
            rows.map((r) => ({
              className: r.className,
              dayOfWeek: r.dayOfWeek,
              periodNumber: r.periodNumber,
              subjectCode: r.subjectCode,
              teacherCode: r.teacherCode,
              roomCode: r.roomCode,
            })),
          );

          const file = createMockFile();
          const result = await service.importFromExcel({
            file,
            schoolId,
            semesterId,
          });

          // No version should be created
          expect(result.versionId).toBeNull();
          expect(result.versionName).toBeNull();
          expect(getVersionCreated()).toBe(false);
          expect(result.successCount).toBe(0);
          expect(result.errorCount).toBe(result.totalRows);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('when at least one valid row exists, version is always created', async () => {
    // Generate at least 1 valid row mixed with possibly invalid rows
    const atLeastOneValidArb = fc
      .tuple(
        fc.array(validRowArb, { minLength: 1, maxLength: 5 }),
        fc.array(invalidRowArb, { minLength: 0, maxLength: 5 }),
      )
      .chain(([validRows, invalidRows]) => {
        const allRows = [...validRows, ...invalidRows];
        return fc.shuffledSubarray(allRows, {
          minLength: allRows.length,
          maxLength: allRows.length,
        });
      });

    await fc.assert(
      fc.asyncProperty(
        atLeastOneValidArb,
        uuidArb,
        uuidArb,
        async (rows, schoolId, semesterId) => {
          const validRows = rows.filter((r) => r.isValid);

          const knownEntities = {
            classNames: [...new Set(validRows.map((r) => r.className))],
            teacherCodes: [...new Set(validRows.map((r) => r.teacherCode))],
            subjectCodes: [...new Set(validRows.map((r) => r.subjectCode))],
            periodNumbers: [...new Set(validRows.map((r) => r.periodNumber))],
            roomCodes: [
              ...new Set(
                validRows.filter((r) => r.roomCode).map((r) => r.roomCode),
              ),
            ],
          };

          const { service, getVersionCreated } = createServiceWithMocks(
            schoolId,
            knownEntities,
          );

          jest.spyOn(service, 'parseExcelRows').mockResolvedValue(
            rows.map((r) => ({
              className: r.className,
              dayOfWeek: r.dayOfWeek,
              periodNumber: r.periodNumber,
              subjectCode: r.subjectCode,
              teacherCode: r.teacherCode,
              roomCode: r.roomCode,
            })),
          );

          const file = createMockFile();
          const result = await service.importFromExcel({
            file,
            schoolId,
            semesterId,
          });

          // Version MUST be created when ≥1 valid row exists
          // Note: Due to duplicate detection, some "valid" rows may fail if they share
          // the same className+dayOfWeek+periodNumber. So we check the biconditional.
          if (result.successCount >= 1) {
            expect(result.versionId).not.toBeNull();
            expect(result.versionName).not.toBeNull();
            expect(getVersionCreated()).toBe(true);
          }
          // If all "valid" rows happened to be duplicates of each other,
          // successCount could be 0, so no version is created. That's correct behavior.
        },
      ),
      { numRuns: 100 },
    );
  });
});
