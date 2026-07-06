/**
 * Feature: academic-structure, Property 2: Date/Time Ordering Validation
 * Feature: academic-structure, Property 3: Date Range Containment
 * Feature: academic-structure, Property 4: Date Range Non-Overlap
 *
 * **Validates: Requirements 2.2, 2.3, 2.4**
 *
 * Property 2: For any date pair (start, end) provided to the week creation service,
 * the service SHALL accept the input if and only if start <= end.
 *
 * Property 3: For any week with (start_date, end_date) within a semester with
 * (sem_start, sem_end), the service SHALL accept the week if and only if
 * sem_start <= week_start AND week_end <= sem_end.
 *
 * Property 4: For any set of active weeks within the same semester, no two weeks
 * SHALL have overlapping date ranges (i.e., for weeks A and B:
 * A.end < B.start OR B.end < A.start).
 */
import * as fc from 'fast-check';
import { WeekService } from '../../services/week.service';
import { WeekRepository } from '../../repositories/week.repository';
import { SemesterRepository } from '../../repositories/semester.repository';
import { SemesterEntity } from '../../entities/semester.entity';
import { WeekEntity } from '../../entities/week.entity';
import {
  InvalidDateRangeException,
  WeekOutOfRangeException,
  WeekOverlapException,
} from '../../exceptions';
import { WeekType } from '../../enums';
import { DataSource } from 'typeorm';

describe('Feature: academic-structure, Property 2: Date/Time Ordering Validation', () => {
  let service: WeekService;
  let mockWeekRepository: Record<string, jest.Mock>;
  let mockSemesterRepository: Record<string, jest.Mock>;
  let mockDataSource: Record<string, jest.Mock>;

  // Arbitrary: generate a date string in ISO format (YYYY-MM-DD)
  // Using integer-based generation to avoid invalid Date objects from fc.date()
  const dateArb = fc
    .integer({
      min: new Date('2020-01-01').getTime(),
      max: new Date('2030-12-31').getTime(),
    })
    .map((ts) => {
      const d = new Date(ts);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    });

  const uuidArb = fc.uuid();

  beforeEach(() => {
    mockWeekRepository = {
      findOverlappingWeeks: jest.fn().mockResolvedValue([]),
      getNextWeekNumber: jest.fn().mockResolvedValue(1),
      create: jest
        .fn()
        .mockImplementation((data) =>
          Promise.resolve({ id: 'new-id', ...data }),
        ),
      countBySemester: jest.fn().mockResolvedValue(0),
    };

    mockSemesterRepository = {
      findById: jest.fn(),
    };

    mockDataSource = {
      transaction: jest.fn(),
    };

    service = new WeekService(
      mockWeekRepository as unknown as WeekRepository,
      mockSemesterRepository as unknown as SemesterRepository,
      mockDataSource as unknown as DataSource,
    );
  });

  it('should throw InvalidDateRangeException when startDate > endDate', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        dateArb,
        dateArb,
        async (semesterId: string, dateA: string, dateB: string) => {
          // Only test cases where dateA > dateB (invalid ordering)
          const startDate = dateA > dateB ? dateA : dateB;
          const endDate = dateA > dateB ? dateB : dateA;

          // Skip equal dates — they are valid
          if (startDate === endDate) return;

          // Mock semester to exist with wide range so containment passes
          const mockSemester = {
            id: semesterId,
            startDate: '2020-01-01',
            endDate: '2030-12-31',
          } as SemesterEntity;
          mockSemesterRepository.findById.mockResolvedValue(mockSemester);

          const dto = {
            semesterId,
            startDate: startDate, // This is AFTER endDate → invalid
            endDate: endDate,
            weekType: WeekType.REGULAR,
          };

          await expect(service.create(dto, 'school-1')).rejects.toThrow(
            InvalidDateRangeException,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should NOT throw InvalidDateRangeException when startDate <= endDate', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        dateArb,
        dateArb,
        async (semesterId: string, dateA: string, dateB: string) => {
          // Ensure startDate <= endDate (valid ordering)
          const startDate = dateA <= dateB ? dateA : dateB;
          const endDate = dateA <= dateB ? dateB : dateA;

          // Mock semester with a wide range encompassing all generated dates
          const mockSemester = {
            id: semesterId,
            startDate: '2020-01-01',
            endDate: '2030-12-31',
          } as SemesterEntity;
          mockSemesterRepository.findById.mockResolvedValue(mockSemester);
          mockWeekRepository.findOverlappingWeeks.mockResolvedValue([]);
          mockWeekRepository.getNextWeekNumber.mockResolvedValue(1);
          mockWeekRepository.create.mockImplementation((data) =>
            Promise.resolve({ id: 'new-id', ...data }),
          );

          const dto = {
            semesterId,
            startDate,
            endDate,
            weekType: WeekType.REGULAR,
          };

          // Should NOT throw InvalidDateRangeException
          // (may succeed or throw other exceptions, but NOT this one)
          try {
            await service.create(dto, 'school-1');
          } catch (error) {
            expect(error).not.toBeInstanceOf(InvalidDateRangeException);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: academic-structure, Property 3: Date Range Containment', () => {
  let service: WeekService;
  let mockWeekRepository: Record<string, jest.Mock>;
  let mockSemesterRepository: Record<string, jest.Mock>;
  let mockDataSource: Record<string, jest.Mock>;

  const uuidArb = fc.uuid();

  // Generate a date offset (in days) from a base date
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const dayOffsetArb = fc.integer({ min: 0, max: 365 });

  beforeEach(() => {
    mockWeekRepository = {
      findOverlappingWeeks: jest.fn().mockResolvedValue([]),
      getNextWeekNumber: jest.fn().mockResolvedValue(1),
      create: jest
        .fn()
        .mockImplementation((data) =>
          Promise.resolve({ id: 'new-id', ...data }),
        ),
      countBySemester: jest.fn().mockResolvedValue(0),
    };

    mockSemesterRepository = {
      findById: jest.fn(),
    };

    mockDataSource = {
      transaction: jest.fn(),
    };

    service = new WeekService(
      mockWeekRepository as unknown as WeekRepository,
      mockSemesterRepository as unknown as SemesterRepository,
      mockDataSource as unknown as DataSource,
    );
  });

  /**
   * Helper: add days to a date string and return ISO date string
   */
  function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  it('should accept week when date range is fully within semester', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        // semester length in days (at least 7 to fit a week)
        fc.integer({ min: 7, max: 180 }),
        // week start offset from semester start (must leave room for week end)
        fc.integer({ min: 0, max: 170 }),
        // week length in days (1-7)
        fc.integer({ min: 0, max: 6 }),
        async (
          semesterId: string,
          semLength: number,
          weekStartOffset: number,
          weekLength: number,
        ) => {
          const semStart = '2024-01-01';
          const semEnd = addDays(semStart, semLength);

          // Ensure week fits within semester
          const maxOffset = semLength - weekLength;
          if (maxOffset < 0) return; // skip if semester too short for week
          const adjustedOffset = weekStartOffset % (maxOffset + 1);

          const weekStart = addDays(semStart, adjustedOffset);
          const weekEnd = addDays(weekStart, weekLength);

          // Verify our generator produces valid containment
          if (weekStart < semStart || weekEnd > semEnd) return;

          const mockSemester = {
            id: semesterId,
            startDate: semStart,
            endDate: semEnd,
          } as SemesterEntity;
          mockSemesterRepository.findById.mockResolvedValue(mockSemester);
          mockWeekRepository.findOverlappingWeeks.mockResolvedValue([]);
          mockWeekRepository.getNextWeekNumber.mockResolvedValue(1);
          mockWeekRepository.create.mockImplementation((data) =>
            Promise.resolve({ id: 'new-id', ...data }),
          );

          const dto = {
            semesterId,
            startDate: weekStart,
            endDate: weekEnd,
            weekType: WeekType.REGULAR,
          };

          // Should NOT throw WeekOutOfRangeException
          try {
            await service.create(dto, 'school-1');
          } catch (error) {
            expect(error).not.toBeInstanceOf(WeekOutOfRangeException);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should throw WeekOutOfRangeException when week starts before semester', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        // days before semester start (at least 1)
        fc.integer({ min: 1, max: 30 }),
        // week length
        fc.integer({ min: 0, max: 6 }),
        async (semesterId: string, daysBefore: number, weekLength: number) => {
          const semStart = '2024-03-01';
          const semEnd = '2024-07-31';

          // Week starts before semester
          const weekStart = addDays(semStart, -daysBefore);
          const weekEnd = addDays(weekStart, weekLength);

          // Ensure startDate <= endDate (valid ordering)
          if (weekStart > weekEnd) return;

          const mockSemester = {
            id: semesterId,
            startDate: semStart,
            endDate: semEnd,
          } as SemesterEntity;
          mockSemesterRepository.findById.mockResolvedValue(mockSemester);

          const dto = {
            semesterId,
            startDate: weekStart,
            endDate: weekEnd,
            weekType: WeekType.REGULAR,
          };

          await expect(service.create(dto, 'school-1')).rejects.toThrow(
            WeekOutOfRangeException,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should throw WeekOutOfRangeException when week ends after semester', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        // days after semester end (at least 1)
        fc.integer({ min: 1, max: 30 }),
        // week length
        fc.integer({ min: 0, max: 6 }),
        async (semesterId: string, daysAfter: number, weekLength: number) => {
          const semStart = '2024-03-01';
          const semEnd = '2024-07-31';

          // Week ends after semester
          const weekEnd = addDays(semEnd, daysAfter);
          const weekStart = addDays(weekEnd, -weekLength);

          // Ensure startDate <= endDate
          if (weekStart > weekEnd) return;

          // Ensure the week start is still within semester to isolate the "end after" case
          // If weekStart < semStart, it would throw for the "start before" reason
          if (weekStart < semStart) return;

          const mockSemester = {
            id: semesterId,
            startDate: semStart,
            endDate: semEnd,
          } as SemesterEntity;
          mockSemesterRepository.findById.mockResolvedValue(mockSemester);

          const dto = {
            semesterId,
            startDate: weekStart,
            endDate: weekEnd,
            weekType: WeekType.REGULAR,
          };

          await expect(service.create(dto, 'school-1')).rejects.toThrow(
            WeekOutOfRangeException,
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: academic-structure, Property 4: Date Range Non-Overlap', () => {
  let service: WeekService;
  let mockWeekRepository: Record<string, jest.Mock>;
  let mockSemesterRepository: Record<string, jest.Mock>;
  let mockDataSource: Record<string, jest.Mock>;

  const uuidArb = fc.uuid();

  beforeEach(() => {
    mockWeekRepository = {
      findOverlappingWeeks: jest.fn(),
      getNextWeekNumber: jest.fn().mockResolvedValue(1),
      create: jest
        .fn()
        .mockImplementation((data) =>
          Promise.resolve({ id: 'new-id', ...data }),
        ),
      countBySemester: jest.fn().mockResolvedValue(0),
    };

    mockSemesterRepository = {
      findById: jest.fn(),
    };

    mockDataSource = {
      transaction: jest.fn(),
    };

    service = new WeekService(
      mockWeekRepository as unknown as WeekRepository,
      mockSemesterRepository as unknown as SemesterRepository,
      mockDataSource as unknown as DataSource,
    );
  });

  /**
   * Helper: add days to a date string and return ISO date string
   */
  function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  it('should throw WeekOverlapException when new week overlaps existing weeks', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        // existing week start offset from base (0-100 days)
        fc.integer({ min: 0, max: 100 }),
        // existing week length (1-7 days)
        fc.integer({ min: 1, max: 7 }),
        // overlap offset: new week starts within existing week range (-3 to +3 days from existing start)
        fc.integer({ min: 0, max: 5 }),
        async (
          semesterId: string,
          existingStartOffset: number,
          existingLength: number,
          overlapShift: number,
        ) => {
          const baseDate = '2024-03-01';
          const semStart = '2024-01-01';
          const semEnd = '2024-12-31';

          const existingStart = addDays(baseDate, existingStartOffset);
          const existingEnd = addDays(existingStart, existingLength - 1);

          // New week overlaps: starts during existing week
          const newStart = addDays(
            existingStart,
            overlapShift % existingLength,
          );
          const newEnd = addDays(newStart, 3); // 4-day week

          // Ensure dates are valid and within semester
          if (newStart > newEnd) return;
          if (newStart < semStart || newEnd > semEnd) return;

          // The existing week entity that overlaps
          const existingWeek = {
            id: 'existing-week-id',
            semesterId,
            weekNumber: 1,
            startDate: existingStart,
            endDate: existingEnd,
            weekType: WeekType.REGULAR,
          } as WeekEntity;

          const mockSemester = {
            id: semesterId,
            startDate: semStart,
            endDate: semEnd,
          } as SemesterEntity;
          mockSemesterRepository.findById.mockResolvedValue(mockSemester);

          // Repository returns overlapping weeks
          mockWeekRepository.findOverlappingWeeks.mockResolvedValue([
            existingWeek,
          ]);

          const dto = {
            semesterId,
            startDate: newStart,
            endDate: newEnd,
            weekType: WeekType.REGULAR,
          };

          await expect(service.create(dto, 'school-1')).rejects.toThrow(
            WeekOverlapException,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should NOT throw WeekOverlapException when new week does not overlap any existing week', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        // existing week end offset from base (5-50 days)
        fc.integer({ min: 5, max: 50 }),
        // gap between existing week end and new week start (at least 1 day)
        fc.integer({ min: 1, max: 30 }),
        // new week length (1-7 days)
        fc.integer({ min: 1, max: 7 }),
        async (
          semesterId: string,
          existingEndOffset: number,
          gap: number,
          newWeekLength: number,
        ) => {
          const baseDate = '2024-03-01';
          const semStart = '2024-01-01';
          const semEnd = '2024-12-31';

          const existingEnd = addDays(baseDate, existingEndOffset);

          // New week starts after existing week ends + gap
          const newStart = addDays(existingEnd, gap);
          const newEnd = addDays(newStart, newWeekLength - 1);

          // Ensure dates are within semester
          if (newStart < semStart || newEnd > semEnd) return;
          if (newStart > newEnd) return;

          const mockSemester = {
            id: semesterId,
            startDate: semStart,
            endDate: semEnd,
          } as SemesterEntity;
          mockSemesterRepository.findById.mockResolvedValue(mockSemester);

          // No overlapping weeks found
          mockWeekRepository.findOverlappingWeeks.mockResolvedValue([]);
          mockWeekRepository.getNextWeekNumber.mockResolvedValue(2);
          mockWeekRepository.create.mockImplementation((data) =>
            Promise.resolve({ id: 'new-id', ...data }),
          );

          const dto = {
            semesterId,
            startDate: newStart,
            endDate: newEnd,
            weekType: WeekType.REGULAR,
          };

          // Should NOT throw WeekOverlapException
          try {
            await service.create(dto, 'school-1');
          } catch (error) {
            expect(error).not.toBeInstanceOf(WeekOverlapException);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should correctly identify overlap: two weeks overlap iff NOT (A.end < B.start OR B.end < A.start)', async () => {
    // This property tests the overlap logic itself:
    // Given two date ranges A and B, they overlap iff A.start <= B.end AND B.start <= A.end
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        // Generate two date ranges
        fc.integer({ min: 0, max: 200 }), // A start offset
        fc.integer({ min: 1, max: 7 }), // A length
        fc.integer({ min: 0, max: 200 }), // B start offset
        fc.integer({ min: 1, max: 7 }), // B length
        async (
          semesterId: string,
          aStartOffset: number,
          aLength: number,
          bStartOffset: number,
          bLength: number,
        ) => {
          const baseDate = '2024-01-01';
          const semStart = '2023-01-01';
          const semEnd = '2025-12-31';

          const aStart = addDays(baseDate, aStartOffset);
          const aEnd = addDays(aStart, aLength - 1);
          const bStart = addDays(baseDate, bStartOffset);
          const bEnd = addDays(bStart, bLength - 1);

          // Determine expected overlap using the mathematical definition
          const overlaps = aStart <= bEnd && bStart <= aEnd;

          const mockSemester = {
            id: semesterId,
            startDate: semStart,
            endDate: semEnd,
          } as SemesterEntity;
          mockSemesterRepository.findById.mockResolvedValue(mockSemester);

          // Simulate: if B overlaps A, repo returns existing week A
          if (overlaps) {
            const existingWeekA = {
              id: 'week-a-id',
              semesterId,
              weekNumber: 1,
              startDate: aStart,
              endDate: aEnd,
              weekType: WeekType.REGULAR,
            } as WeekEntity;
            mockWeekRepository.findOverlappingWeeks.mockResolvedValue([
              existingWeekA,
            ]);
          } else {
            mockWeekRepository.findOverlappingWeeks.mockResolvedValue([]);
          }

          mockWeekRepository.getNextWeekNumber.mockResolvedValue(2);
          mockWeekRepository.create.mockImplementation((data) =>
            Promise.resolve({ id: 'new-id', ...data }),
          );

          const dto = {
            semesterId,
            startDate: bStart,
            endDate: bEnd,
            weekType: WeekType.REGULAR,
          };

          if (overlaps) {
            await expect(service.create(dto, 'school-1')).rejects.toThrow(
              WeekOverlapException,
            );
          } else {
            // Should NOT throw WeekOverlapException
            try {
              await service.create(dto, 'school-1');
            } catch (error) {
              expect(error).not.toBeInstanceOf(WeekOverlapException);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
