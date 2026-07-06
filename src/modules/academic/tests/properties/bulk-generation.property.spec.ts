/**
 * Feature: academic-structure, Property 12: Bulk Week Generation Coverage and Structure
 *
 * **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
 *
 * For any semester with date range [start, end] and no existing weeks, bulk generation
 * SHALL produce weeks that:
 * (a) collectively cover every calendar date from start to end without gaps or overlaps
 * (b) all have week_type = regular
 * (c) have sequential week_number starting at 1
 * (d) internal weeks start on Monday and end on Sunday while the first week starts on
 *     start and the last week ends on end
 */
import * as fc from 'fast-check';
import { WeekService } from '../../services/week.service';
import { WeekRepository } from '../../repositories/week.repository';
import { SemesterRepository } from '../../repositories/semester.repository';
import { SemesterEntity } from '../../entities/semester.entity';
import { WeekEntity } from '../../entities/week.entity';
import { WeekType } from '../../enums';
import { DataSource } from 'typeorm';

describe('Feature: academic-structure, Property 12: Bulk Week Generation Coverage and Structure', () => {
  let service: WeekService;
  let mockWeekRepository: Record<string, jest.Mock>;
  let mockSemesterRepository: Record<string, jest.Mock>;
  let mockDataSource: { transaction: jest.Mock };

  /**
   * Arbitrary: generate a semester start as an offset in days from 2020-01-01
   * This avoids NaN dates that fc.date() can produce during shrinking.
   */
  const startOffsetArb = fc.integer({ min: 0, max: 3000 }); // ~8 years range

  /**
   * Arbitrary: semester duration in days (at least 1 day, up to 180 days)
   */
  const durationArb = fc.integer({ min: 1, max: 180 });

  const uuidArb = fc.uuid();

  const BASE_DATE = new Date('2020-01-01');

  /**
   * Helper: format Date to YYYY-MM-DD string
   */
  function formatDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  /**
   * Helper: add days to a Date
   */
  function addDays(d: Date, days: number): Date {
    const result = new Date(d);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Helper: count calendar days between two date strings (inclusive)
   */
  function daysBetween(start: string, end: string): number {
    const s = new Date(start);
    const e = new Date(end);
    return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  }

  /**
   * Helper: get day of week (0=Sun, 1=Mon, ..., 6=Sat)
   */
  function getDayOfWeek(dateStr: string): number {
    return new Date(dateStr).getDay();
  }

  beforeEach(() => {
    mockWeekRepository = {
      findOverlappingWeeks: jest.fn().mockResolvedValue([]),
      getNextWeekNumber: jest.fn().mockResolvedValue(1),
      create: jest.fn(),
      countBySemester: jest.fn().mockResolvedValue(0),
      findBySemester: jest.fn().mockResolvedValue([]),
    };

    mockSemesterRepository = {
      findById: jest.fn(),
    };

    // Mock DataSource.transaction to execute the callback with a mock manager
    mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation(
          async (cb: (manager: unknown) => Promise<unknown>) => {
            let savedEntities: Partial<WeekEntity>[] = [];
            const mockManager = {
              getRepository: () => ({
                create: (data: Partial<WeekEntity>[]) => {
                  savedEntities = data.map((d, i) => ({
                    id: `week-${i + 1}`,
                    ...d,
                  }));
                  return savedEntities;
                },
                save: (entities: Partial<WeekEntity>[]) =>
                  Promise.resolve(entities),
              }),
            };
            return cb(mockManager);
          },
        ),
    };

    service = new WeekService(
      mockWeekRepository as unknown as WeekRepository,
      mockSemesterRepository as unknown as SemesterRepository,
      mockDataSource as unknown as DataSource,
    );
  });

  it('(a) generated weeks collectively cover every calendar date from start to end without gaps or overlaps', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        startOffsetArb,
        durationArb,
        async (semesterId: string, startOffset: number, duration: number) => {
          const startDate = addDays(BASE_DATE, startOffset);
          const semStart = formatDate(startDate);
          const semEnd = formatDate(addDays(startDate, duration - 1));

          const mockSemester = {
            id: semesterId,
            startDate: semStart,
            endDate: semEnd,
          } as SemesterEntity;
          mockSemesterRepository.findById.mockResolvedValue(mockSemester);
          mockWeekRepository.countBySemester.mockResolvedValue(0);

          const result = await service.bulkGenerate(semesterId, 'school-1');
          const weeks = result.weeks;

          // Must have at least one week
          expect(weeks.length).toBeGreaterThan(0);

          // Total days covered by all weeks must equal semester length
          const totalDaysCovered = weeks.reduce(
            (sum, w) => sum + daysBetween(w.startDate, w.endDate),
            0,
          );
          const semesterDays = daysBetween(semStart, semEnd);
          expect(totalDaysCovered).toBe(semesterDays);

          // No gaps: each week starts the day after the previous week ends
          for (let i = 1; i < weeks.length; i++) {
            const prevEnd = new Date(weeks[i - 1].endDate);
            const currStart = new Date(weeks[i].startDate);
            const expectedStart = addDays(prevEnd, 1);
            expect(formatDate(currStart)).toBe(formatDate(expectedStart));
          }

          // First week starts on semester start
          expect(weeks[0].startDate).toBe(semStart);

          // Last week ends on semester end
          expect(weeks[weeks.length - 1].endDate).toBe(semEnd);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('(b) all generated weeks have week_type = regular', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        startOffsetArb,
        durationArb,
        async (semesterId: string, startOffset: number, duration: number) => {
          const startDate = addDays(BASE_DATE, startOffset);
          const semStart = formatDate(startDate);
          const semEnd = formatDate(addDays(startDate, duration - 1));

          const mockSemester = {
            id: semesterId,
            startDate: semStart,
            endDate: semEnd,
          } as SemesterEntity;
          mockSemesterRepository.findById.mockResolvedValue(mockSemester);
          mockWeekRepository.countBySemester.mockResolvedValue(0);

          const result = await service.bulkGenerate(semesterId, 'school-1');

          for (const week of result.weeks) {
            expect(week.weekType).toBe(WeekType.REGULAR);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('(c) generated weeks have sequential week_number starting at 1', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        startOffsetArb,
        durationArb,
        async (semesterId: string, startOffset: number, duration: number) => {
          const startDate = addDays(BASE_DATE, startOffset);
          const semStart = formatDate(startDate);
          const semEnd = formatDate(addDays(startDate, duration - 1));

          const mockSemester = {
            id: semesterId,
            startDate: semStart,
            endDate: semEnd,
          } as SemesterEntity;
          mockSemesterRepository.findById.mockResolvedValue(mockSemester);
          mockWeekRepository.countBySemester.mockResolvedValue(0);

          const result = await service.bulkGenerate(semesterId, 'school-1');

          for (let i = 0; i < result.weeks.length; i++) {
            expect(result.weeks[i].weekNumber).toBe(i + 1);
          }

          // Count matches actual length
          expect(result.count).toBe(result.weeks.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('(d) internal weeks start on Monday and end on Sunday; first week starts on semester start; last week ends on semester end', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        startOffsetArb,
        // Use at least 14 days to ensure there are internal weeks
        fc.integer({ min: 14, max: 180 }),
        async (semesterId: string, startOffset: number, duration: number) => {
          const startDate = addDays(BASE_DATE, startOffset);
          const semStart = formatDate(startDate);
          const semEnd = formatDate(addDays(startDate, duration - 1));

          const mockSemester = {
            id: semesterId,
            startDate: semStart,
            endDate: semEnd,
          } as SemesterEntity;
          mockSemesterRepository.findById.mockResolvedValue(mockSemester);
          mockWeekRepository.countBySemester.mockResolvedValue(0);

          const result = await service.bulkGenerate(semesterId, 'school-1');
          const weeks = result.weeks;

          // First week starts on semester start date (any day of the week)
          expect(weeks[0].startDate).toBe(semStart);

          // Last week ends on semester end date
          expect(weeks[weeks.length - 1].endDate).toBe(semEnd);

          // Internal weeks (not first, not last) start on Monday (1) and end on Sunday (0)
          for (let i = 1; i < weeks.length - 1; i++) {
            const startDay = getDayOfWeek(weeks[i].startDate);
            const endDay = getDayOfWeek(weeks[i].endDate);
            expect(startDay).toBe(1); // Monday
            expect(endDay).toBe(0); // Sunday
          }

          // First week ends on Sunday (unless it's also the last week)
          if (weeks.length > 1) {
            const firstWeekEndDay = getDayOfWeek(weeks[0].endDate);
            expect(firstWeekEndDay).toBe(0); // Sunday
          }

          // Last week starts on Monday (unless it's also the first week)
          if (weeks.length > 1) {
            const lastWeekStartDay = getDayOfWeek(
              weeks[weeks.length - 1].startDate,
            );
            expect(lastWeekStartDay).toBe(1); // Monday
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
