/**
 * Feature: timetable-management-features, Property 13: Status-based write protection
 *
 * **Validates: Requirements 4.5**
 *
 * Property: For any TimetableVersion with status PUBLISHED or ARCHIVED,
 * write operations (update slots, delete) SHALL be rejected, and only
 * read and clone operations SHALL be permitted.
 */
import * as fc from 'fast-check';
import { BadRequestException } from '@nestjs/common';
import { TimetableVersionService } from '../services/timetable-version.service';
import { TimetableVersionRepository } from '../repositories/timetable-version.repository';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { CreateSlotDto } from '../dto/create-slot.dto';
import { TimetableVersionStatus } from '../../../common/enums/status.enum';
import { DataSource } from 'typeorm';

describe('Feature: timetable-management-features, Property 13: Status-based write protection', () => {
  let service: TimetableVersionService;
  let mockVersionRepo: Record<string, jest.Mock>;
  let mockDataSource: Record<string, jest.Mock>;

  // Arbitrary: generate a valid UUID v4
  const uuidArb = fc.uuid();

  // Arbitrary: generate a non-DRAFT status (only PUBLISHED or ARCHIVED)
  const nonDraftStatusArb = fc.constantFrom(
    TimetableVersionStatus.PUBLISHED,
    TimetableVersionStatus.ARCHIVED,
  );

  // Arbitrary: generate a random CreateSlotDto
  const slotDtoArb: fc.Arbitrary<CreateSlotDto> = fc.record({
    classId: fc.uuid(),
    dayOfWeek: fc.integer({ min: 2, max: 7 }),
    periodId: fc.uuid(),
    subjectId: fc.uuid(),
    teacherId: fc.uuid(),
    roomId: fc.option(fc.uuid(), { nil: undefined }),
    isDoublePeriod: fc.option(fc.boolean(), { nil: undefined }),
  }) as fc.Arbitrary<CreateSlotDto>;

  // Arbitrary: generate a non-empty array of slots (1 to 10 slots)
  const slotsArrayArb = fc.array(slotDtoArb, { minLength: 1, maxLength: 10 });

  // Helper: build a mock TimetableVersionEntity with given status
  function buildVersionEntity(
    id: string,
    status: TimetableVersionStatus,
  ): Partial<TimetableVersionEntity> {
    return {
      id,
      name: 'Test Version',
      versionNumber: 1,
      status,
      semesterId: '00000000-0000-0000-0000-000000000001',
      effectiveDate: null,
      note: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
  }

  beforeEach(() => {
    mockVersionRepo = {
      findById: jest.fn(),
      findByIdWithSlots: jest.fn(),
      getNextVersionNumber: jest.fn().mockResolvedValue(2),
      softDelete: jest.fn().mockResolvedValue(undefined),
      update: jest.fn(),
    };
    mockDataSource = {
      transaction: jest.fn(),
    };

    service = new TimetableVersionService(
      mockVersionRepo as unknown as TimetableVersionRepository,
      {} as unknown as TimetableSlotRepository,
      mockDataSource as unknown as DataSource,
    );
  });

  it('should reject overwriteSlots for ALL non-DRAFT statuses (PUBLISHED, ARCHIVED)', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        nonDraftStatusArb,
        slotsArrayArb,
        async (
          versionId: string,
          status: TimetableVersionStatus,
          slots: CreateSlotDto[],
        ) => {
          // Mock: version exists with non-DRAFT status
          const versionEntity = buildVersionEntity(versionId, status);
          mockVersionRepo.findById.mockResolvedValue(versionEntity);

          // Act & Assert: overwriteSlots should throw BadRequestException
          await expect(
            service.overwriteSlots(versionId, slots),
          ).rejects.toThrow(BadRequestException);

          await expect(
            service.overwriteSlots(versionId, slots),
          ).rejects.toThrow('Chỉ có thể chỉnh sửa phiên bản ở trạng thái nháp');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should reject delete for ALL non-DRAFT statuses (PUBLISHED, ARCHIVED)', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        nonDraftStatusArb,
        async (versionId: string, status: TimetableVersionStatus) => {
          // Mock: version exists with non-DRAFT status
          const versionEntity = buildVersionEntity(versionId, status);
          mockVersionRepo.findById.mockResolvedValue(versionEntity);

          // Act & Assert: delete should throw BadRequestException
          await expect(service.delete(versionId)).rejects.toThrow(
            BadRequestException,
          );

          await expect(service.delete(versionId)).rejects.toThrow(
            'Chỉ có thể xóa phiên bản ở trạng thái nháp',
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should reject update for ALL non-DRAFT statuses (PUBLISHED, ARCHIVED)', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        nonDraftStatusArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        async (
          versionId: string,
          status: TimetableVersionStatus,
          newName: string,
        ) => {
          // Mock: version exists with non-DRAFT status
          const versionEntity = buildVersionEntity(versionId, status);
          mockVersionRepo.findById.mockResolvedValue(versionEntity);

          // Act & Assert: update should throw BadRequestException
          await expect(
            service.update(versionId, { name: newName }),
          ).rejects.toThrow(BadRequestException);

          await expect(
            service.update(versionId, { name: newName }),
          ).rejects.toThrow('Chỉ có thể cập nhật phiên bản ở trạng thái nháp');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should ALLOW overwriteSlots for DRAFT status (positive case)', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        slotsArrayArb,
        async (versionId: string, slots: CreateSlotDto[]) => {
          // Mock: version exists with DRAFT status
          const versionEntity = buildVersionEntity(
            versionId,
            TimetableVersionStatus.DRAFT,
          );
          mockVersionRepo.findById.mockResolvedValue(versionEntity);

          // Mock transaction to execute the callback
          mockDataSource.transaction.mockImplementation(
            async (cb: (manager: unknown) => Promise<void>) => {
              const mockManager = {
                createQueryBuilder: jest.fn().mockReturnValue({
                  update: jest.fn().mockReturnThis(),
                  set: jest.fn().mockReturnThis(),
                  where: jest.fn().mockReturnThis(),
                  execute: jest.fn().mockResolvedValue({}),
                }),
                create: jest
                  .fn()
                  .mockImplementation(
                    (_entity: unknown, data: unknown) => data,
                  ),
                save: jest.fn().mockResolvedValue([]),
              };
              return cb(mockManager);
            },
          );

          // Act & Assert: overwriteSlots should NOT throw for DRAFT
          await expect(
            service.overwriteSlots(versionId, slots),
          ).resolves.not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should ALLOW clone for PUBLISHED and ARCHIVED statuses (read/clone permitted)', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        nonDraftStatusArb,
        async (versionId: string, status: TimetableVersionStatus) => {
          // Mock: version exists with PUBLISHED/ARCHIVED status and has slots
          const versionEntity = {
            ...buildVersionEntity(versionId, status),
            slots: [
              {
                id: '00000000-0000-0000-0000-000000000099',
                classId: '00000000-0000-0000-0000-000000000011',
                dayOfWeek: 2,
                periodId: '00000000-0000-0000-0000-000000000012',
                subjectId: '00000000-0000-0000-0000-000000000013',
                teacherId: '00000000-0000-0000-0000-000000000014',
                roomId: null,
                isDoublePeriod: false,
              },
            ],
          };
          mockVersionRepo.findByIdWithSlots.mockResolvedValue(versionEntity);

          // Mock transaction to execute the callback
          mockDataSource.transaction.mockImplementation(
            async (cb: (manager: unknown) => Promise<unknown>) => {
              const mockManager = {
                create: jest
                  .fn()
                  .mockImplementation((_entity: unknown, data: unknown) => ({
                    ...(data as object),
                    id: '00000000-0000-0000-0000-000000000100',
                  })),
                save: jest
                  .fn()
                  .mockImplementation((_entity: unknown, data: unknown) => {
                    if (Array.isArray(data)) return data;
                    return {
                      ...(data as object),
                      id: '00000000-0000-0000-0000-000000000100',
                    };
                  }),
              };
              return cb(mockManager);
            },
          );

          // Act & Assert: clone should NOT throw for PUBLISHED/ARCHIVED
          await expect(service.cloneVersion(versionId)).resolves.not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });
});
