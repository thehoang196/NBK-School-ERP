/**
 * Feature: timetable-management-features, Property 9: Version name validation rejects invalid inputs
 *
 * **Validates: Requirements 3.4**
 *
 * Property: For any string that is empty, composed entirely of whitespace,
 * or exceeds 100 characters, attempting to save a version with that name
 * SHALL be rejected with an appropriate error.
 */
import * as fc from 'fast-check';
import { BadRequestException } from '@nestjs/common';
import { TimetableVersionService } from '../services/timetable-version.service';
import { TimetableVersionRepository } from '../repositories/timetable-version.repository';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import { SaveTimetableVersionDto } from '../dto/save-timetable-version.dto';
import { DataSource } from 'typeorm';

describe('Feature: timetable-management-features, Property 9: Version name validation rejects invalid inputs', () => {
  let service: TimetableVersionService;
  let mockVersionRepo: jest.Mocked<Partial<TimetableVersionRepository>>;
  let mockSlotRepo: jest.Mocked<Partial<TimetableSlotRepository>>;
  let mockDataSource: jest.Mocked<Partial<DataSource>>;

  const schoolId = '00000000-0000-0000-0000-000000000001';

  // Build a valid DTO with a given name
  function buildDto(name: string): SaveTimetableVersionDto {
    const dto = new SaveTimetableVersionDto();
    dto.name = name;
    dto.semesterId = '00000000-0000-0000-0000-000000000002';
    dto.slots = [
      {
        classId: '00000000-0000-0000-0000-000000000003',
        dayOfWeek: 2,
        periodId: '00000000-0000-0000-0000-000000000004',
        subjectId: '00000000-0000-0000-0000-000000000005',
        teacherId: '00000000-0000-0000-0000-000000000006',
      },
    ];
    return dto;
  }

  beforeEach(() => {
    mockVersionRepo = {
      getNextVersionNumber: jest.fn().mockResolvedValue(1),
    };
    mockSlotRepo = {};
    mockDataSource = {
      transaction: jest.fn(),
    };

    service = new TimetableVersionService(
      mockVersionRepo as unknown as TimetableVersionRepository,
      mockSlotRepo as unknown as TimetableSlotRepository,
      mockDataSource as unknown as DataSource,
    );
  });

  it('should reject empty strings as version name', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate empty string (only the literal empty string)
        fc.constant(''),
        async (name: string) => {
          const dto = buildDto(name);
          await expect(service.saveAsNewVersion(dto, schoolId)).rejects.toThrow(
            BadRequestException,
          );
          await expect(service.saveAsNewVersion(dto, schoolId)).rejects.toThrow(
            'Tên phiên bản không được để trống',
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should reject whitespace-only strings as version name', async () => {
    // Generate whitespace-only strings using array of whitespace chars joined together
    const whitespaceArb = fc
      .array(fc.constantFrom(' ', '\t', '\n', '\r'), {
        minLength: 1,
        maxLength: 50,
      })
      .map((chars) => chars.join(''));

    await fc.assert(
      fc.asyncProperty(whitespaceArb, async (name: string) => {
        const dto = buildDto(name);
        await expect(service.saveAsNewVersion(dto, schoolId)).rejects.toThrow(
          BadRequestException,
        );
        await expect(service.saveAsNewVersion(dto, schoolId)).rejects.toThrow(
          'Tên phiên bản không được để trống',
        );
      }),
      { numRuns: 100 },
    );
  });

  it('should reject strings exceeding 100 characters as version name', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate strings with length > 100 (101 to 500 characters)
        // Use non-whitespace characters to ensure they don't get caught by whitespace check
        fc
          .string({ minLength: 101, maxLength: 500 })
          .filter((s) => s.trim().length > 0),
        async (name: string) => {
          // Ensure the generated name is actually > 100 chars
          fc.pre(name.length > 100);
          const dto = buildDto(name);
          await expect(service.saveAsNewVersion(dto, schoolId)).rejects.toThrow(
            BadRequestException,
          );
          await expect(service.saveAsNewVersion(dto, schoolId)).rejects.toThrow(
            'Tên phiên bản tối đa 100 ký tự',
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should reject all categories of invalid names (combined property)', async () => {
    // Arbitrary for generating invalid names from all 3 categories
    const invalidNameArb = fc.oneof(
      // Category 1: Empty string
      fc.constant(''),
      // Category 2: Whitespace-only strings
      fc
        .array(fc.constantFrom(' ', '\t', '\n', '\r'), {
          minLength: 1,
          maxLength: 30,
        })
        .map((chars) => chars.join('')),
      // Category 3: Strings > 100 characters (non-whitespace content)
      fc
        .string({ minLength: 101, maxLength: 300 })
        .filter((s) => s.trim().length > 0),
    );

    await fc.assert(
      fc.asyncProperty(invalidNameArb, async (name: string) => {
        const dto = buildDto(name);
        await expect(service.saveAsNewVersion(dto, schoolId)).rejects.toThrow(
          BadRequestException,
        );
      }),
      { numRuns: 100 },
    );
  });
});
