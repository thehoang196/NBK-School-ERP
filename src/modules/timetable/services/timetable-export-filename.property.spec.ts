/**
 * Feature: timetable-management-features, Property 7: Export filename matches format
 *
 * Validates: Requirements 2.7
 *
 * Property: For any grade name (or "TatCa") and export date, the generated filename
 * SHALL match the pattern `TKB_{gradeName}_{YYYY-MM-DD}.xlsx` where the date is the
 * current export date.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as fc from 'fast-check';
import { TimetableExportService } from './timetable-export.service';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import { TimetableVersionRepository } from '../repositories/timetable-version.repository';

describe('Property 7: Export filename matches format', () => {
  let service: TimetableExportService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableExportService,
        { provide: DataSource, useValue: {} },
        { provide: TimetableSlotRepository, useValue: {} },
        { provide: TimetableVersionRepository, useValue: {} },
      ],
    }).compile();

    service = module.get<TimetableExportService>(TimetableExportService);
  });

  // Generator for grade names that contain at least one alphanumeric character
  const alphaNumChar = fc.constantFrom(
    ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''),
  );
  const gradeNameArb = fc
    .tuple(
      fc.string({ minLength: 0, maxLength: 10 }),
      fc.array(alphaNumChar, { minLength: 1, maxLength: 10 }).map((chars) => chars.join('')),
      fc.string({ minLength: 0, maxLength: 10 }),
    )
    .map(([prefix, alphaNum, suffix]) => `${prefix}${alphaNum}${suffix}`);

  // Generator for valid dates (avoids NaN dates)
  const validDateArb = fc.integer({ min: 0, max: 4102444800000 }).map((ms) => new Date(ms));

  /**
   * **Validates: Requirements 2.7**
   *
   * For any random grade name (containing at least one alphanumeric char) and valid date,
   * the filename must match pattern: TKB_{sanitizedName}_{YYYY-MM-DD}.xlsx
   */
  it('should always match pattern TKB_{name}_{YYYY-MM-DD}.xlsx for any grade name and date', () => {
    const filenamePattern = /^TKB_[a-zA-Z0-9]+_\d{4}-\d{2}-\d{2}\.xlsx$/;

    fc.assert(
      fc.property(gradeNameArb, validDateArb, (gradeName: string, exportDate: Date) => {
        const filename = service.generateFilename(gradeName, exportDate);

        // Filename must match the overall pattern
        expect(filename).toMatch(filenamePattern);

        // Filename must start with TKB_
        expect(filename.startsWith('TKB_')).toBe(true);

        // Filename must end with .xlsx
        expect(filename.endsWith('.xlsx')).toBe(true);

        // Date portion must be valid YYYY-MM-DD matching the input date
        const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})\.xlsx$/);
        expect(dateMatch).not.toBeNull();

        if (dateMatch) {
          const [yearStr, monthStr, dayStr] = dateMatch[1].split('-');
          const year = parseInt(yearStr, 10);
          const month = parseInt(monthStr, 10);
          const day = parseInt(dayStr, 10);

          expect(year).toBe(exportDate.getFullYear());
          expect(month).toBe(exportDate.getMonth() + 1);
          expect(day).toBe(exportDate.getDate());
        }
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 2.7**
   *
   * When gradeName is null, filename must use "TatCa" as the name portion.
   */
  it('should use "TatCa" when gradeName is null for any date', () => {
    fc.assert(
      fc.property(validDateArb, (exportDate: Date) => {
        const filename = service.generateFilename(null, exportDate);

        // Must contain "TatCa" as the name portion
        expect(filename).toMatch(/^TKB_TatCa_\d{4}-\d{2}-\d{2}\.xlsx$/);

        // Verify date correctness
        const year = exportDate.getFullYear();
        const month = String(exportDate.getMonth() + 1).padStart(2, '0');
        const day = String(exportDate.getDate()).padStart(2, '0');
        const expectedFilename = `TKB_TatCa_${year}-${month}-${day}.xlsx`;

        expect(filename).toBe(expectedFilename);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 2.7**
   *
   * Date format must always be zero-padded YYYY-MM-DD.
   */
  it('should always produce zero-padded date format YYYY-MM-DD', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, 'Khoi10', 'Khoi11', 'Khoi12'),
        validDateArb,
        (gradeName: string | null, exportDate: Date) => {
          const filename = service.generateFilename(gradeName, exportDate);

          // Extract the date part
          const dateMatch = filename.match(/_(\d{4}-\d{2}-\d{2})\.xlsx$/);
          expect(dateMatch).not.toBeNull();

          if (dateMatch) {
            const datePart = dateMatch[1];
            // Verify format is exactly YYYY-MM-DD (10 chars)
            expect(datePart).toHaveLength(10);

            const [yearStr, monthStr, dayStr] = datePart.split('-');
            // Year is 4 digits
            expect(yearStr).toHaveLength(4);
            // Month is 2 digits (zero-padded)
            expect(monthStr).toHaveLength(2);
            // Day is 2 digits (zero-padded)
            expect(dayStr).toHaveLength(2);

            // Month should be between 01 and 12
            const month = parseInt(monthStr, 10);
            expect(month).toBeGreaterThanOrEqual(1);
            expect(month).toBeLessThanOrEqual(12);

            // Day should be between 01 and 31
            const day = parseInt(dayStr, 10);
            expect(day).toBeGreaterThanOrEqual(1);
            expect(day).toBeLessThanOrEqual(31);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 2.7**
   *
   * Grade name with Vietnamese diacritics and special characters should be sanitized
   * (only alphanumeric chars remain in the filename).
   */
  it('should sanitize grade names removing diacritics and special characters', () => {
    const vietnameseNames = fc.constantFrom(
      'Khối 10',
      'Khối 11',
      'Khối 12',
      'Lớp Đặc biệt',
      'Khối Mầm non',
      'Tiểu học',
    );

    fc.assert(
      fc.property(vietnameseNames, validDateArb, (gradeName: string, exportDate: Date) => {
        const filename = service.generateFilename(gradeName, exportDate);

        // Extract the name portion between TKB_ and _YYYY-MM-DD.xlsx
        const nameMatch = filename.match(/^TKB_(.+)_\d{4}-\d{2}-\d{2}\.xlsx$/);
        expect(nameMatch).not.toBeNull();

        if (nameMatch) {
          const namePortion = nameMatch[1];
          // Name portion should only contain alphanumeric characters (no spaces, diacritics, or special chars)
          expect(namePortion).toMatch(/^[a-zA-Z0-9]+$/);
          // Name portion should not be empty
          expect(namePortion.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 200 },
    );
  });
});
