/**
 * Property-Based Test: Import row parsing produces correct field extraction
 *
 * Feature: timetable-management-features, Property 1: Import row parsing produces correct field extraction
 * Validates: Requirements 1.2
 *
 * For any valid Excel row with 6 columns (Lớp, Thứ, Tiết, Môn, GV, Phòng),
 * parsing that row SHALL produce a parsed object with matching field values for
 * className, dayOfWeek, periodNumber, subjectCode, teacherCode, and roomCode.
 */
import * as fc from 'fast-check';
import * as ExcelJS from 'exceljs';
import { TimetableImportService } from '../services/timetable-import.service';
import { ParsedTimetableRow } from '../interfaces/timetable-import.interface';

describe('Feature: timetable-management-features, Property 1: Import row parsing produces correct field extraction', () => {
  let service: TimetableImportService;

  beforeAll(() => {
    // Create service instance with null dependencies since parseExcelRows doesn't use them
    service = new TimetableImportService(
      null as any, // dataSource
      null as any, // versionRepo
      null as any, // teacherRepo
      null as any, // subjectRepo
      null as any, // classRepo
      null as any, // periodRepo
      null as any, // roomRepo
    );
  });

  /**
   * Helper: Generate an Excel buffer from an array of row data
   */
  async function createExcelBuffer(
    rows: Array<{
      className: string;
      dayOfWeek: number;
      periodNumber: number;
      subjectCode: string;
      teacherCode: string;
      roomCode: string;
    }>,
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

  // Arbitraries for generating valid timetable row data
  const alphanumChars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const nonEmptyAlphanumString: fc.Arbitrary<string> = fc
    .array(fc.constantFrom(...alphanumChars.split('')), {
      minLength: 1,
      maxLength: 20,
    })
    .map((chars) => chars.join(''));

  const dayOfWeekArb = fc.integer({ min: 2, max: 7 });
  const periodNumberArb = fc.integer({ min: 1, max: 15 });

  interface TimetableRowInput {
    className: string;
    dayOfWeek: number;
    periodNumber: number;
    subjectCode: string;
    teacherCode: string;
    roomCode: string;
  }

  const timetableRowArb: fc.Arbitrary<TimetableRowInput> = fc.record({
    className: nonEmptyAlphanumString,
    dayOfWeek: dayOfWeekArb,
    periodNumber: periodNumberArb,
    subjectCode: nonEmptyAlphanumString,
    teacherCode: nonEmptyAlphanumString,
    roomCode: nonEmptyAlphanumString,
  });

  it('should correctly parse a single valid Excel row with all 6 fields', async () => {
    await fc.assert(
      fc.asyncProperty(timetableRowArb, async (inputRow) => {
        // Create Excel buffer with the generated row
        const buffer = await createExcelBuffer([inputRow]);

        // Parse the buffer
        const result: ParsedTimetableRow[] =
          await service.parseExcelRows(buffer);

        // Verify exactly 1 row parsed
        expect(result).toHaveLength(1);

        // Verify all fields match
        const parsed = result[0];
        expect(parsed.className).toBe(inputRow.className);
        expect(parsed.dayOfWeek).toBe(inputRow.dayOfWeek);
        expect(parsed.periodNumber).toBe(inputRow.periodNumber);
        expect(parsed.subjectCode).toBe(inputRow.subjectCode);
        expect(parsed.teacherCode).toBe(inputRow.teacherCode);
        expect(parsed.roomCode).toBe(inputRow.roomCode);
      }),
      { numRuns: 100 },
    );
  });

  it('should correctly parse multiple valid Excel rows preserving order and values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(timetableRowArb, { minLength: 1, maxLength: 20 }),
        async (inputRows) => {
          // Create Excel buffer with multiple rows
          const buffer = await createExcelBuffer(inputRows);

          // Parse the buffer
          const result: ParsedTimetableRow[] =
            await service.parseExcelRows(buffer);

          // Verify correct number of rows
          expect(result).toHaveLength(inputRows.length);

          // Verify each row matches corresponding input
          for (let i = 0; i < inputRows.length; i++) {
            const input = inputRows[i];
            const parsed = result[i];

            expect(parsed.className).toBe(input.className);
            expect(parsed.dayOfWeek).toBe(input.dayOfWeek);
            expect(parsed.periodNumber).toBe(input.periodNumber);
            expect(parsed.subjectCode).toBe(input.subjectCode);
            expect(parsed.teacherCode).toBe(input.teacherCode);
            expect(parsed.roomCode).toBe(input.roomCode);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should handle empty roomCode (optional field) correctly', async () => {
    const rowWithOptionalRoom: fc.Arbitrary<TimetableRowInput> = fc.record({
      className: nonEmptyAlphanumString,
      dayOfWeek: dayOfWeekArb,
      periodNumber: periodNumberArb,
      subjectCode: nonEmptyAlphanumString,
      teacherCode: nonEmptyAlphanumString,
      roomCode: fc.constant(''),
    });

    await fc.assert(
      fc.asyncProperty(rowWithOptionalRoom, async (inputRow) => {
        const buffer = await createExcelBuffer([inputRow]);
        const result = await service.parseExcelRows(buffer);

        expect(result).toHaveLength(1);
        const parsed = result[0];
        expect(parsed.className).toBe(inputRow.className);
        expect(parsed.dayOfWeek).toBe(inputRow.dayOfWeek);
        expect(parsed.periodNumber).toBe(inputRow.periodNumber);
        expect(parsed.subjectCode).toBe(inputRow.subjectCode);
        expect(parsed.teacherCode).toBe(inputRow.teacherCode);
        expect(parsed.roomCode).toBe('');
      }),
      { numRuns: 100 },
    );
  });

  it('should return empty array for Excel with only header row', async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('TKB');
    worksheet.addRow(['Lớp', 'Thứ', 'Tiết', 'Môn', 'Giáo viên', 'Phòng']);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const result = await service.parseExcelRows(buffer);

    expect(result).toHaveLength(0);
  });
});
