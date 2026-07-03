/**
 * Feature: timetable-management-features, Property 12: Edit overwrites same version (no new version created)
 *
 * **Validates: Requirements 4.4**
 *
 * Property: For any edit operation on a DRAFT version, saving SHALL update
 * the same version entity (same id, same version_number) with the new slot data,
 * without creating a new TimetableVersion record.
 */
import * as fc from 'fast-check';
import { TimetableVersionService } from '../services/timetable-version.service';
import { TimetableVersionRepository } from '../repositories/timetable-version.repository';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { CreateSlotDto } from '../dto/create-slot.dto';
import { TimetableStatus } from '../../../common/enums/status.enum';
import { DataSource } from 'typeorm';

describe('Feature: timetable-management-features, Property 12: Edit overwrites same version (no new version created)', () => {
  let service: TimetableVersionService;
  let mockVersionRepo: Record<string, jest.Mock>;
  let mockDataSource: Record<string, jest.Mock>;

  // Arbitrary: generate a valid UUID v4
  const uuidArb = fc.uuid();

  // Arbitrary: generate a random version number (1 to 100)
  const versionNumberArb = fc.integer({ min: 1, max: 100 });

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

  // Arbitrary: generate an array of slots (0 to 20 slots)
  const slotsArrayArb = fc.array(slotDtoArb, { minLength: 0, maxLength: 20 });

  // Helper: build a mock DRAFT TimetableVersionEntity
  function buildDraftVersionEntity(
    id: string,
    versionNumber: number,
  ): Partial<TimetableVersionEntity> {
    return {
      id,
      name: 'Draft Version',
      versionNumber,
      status: TimetableStatus.DRAFT,
      semesterId: '00000000-0000-0000-0000-000000000001',
      effectiveDate: null,
      note: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      deletedAt: null,
    };
  }

  beforeEach(() => {
    mockVersionRepo = {
      findById: jest.fn(),
      findByIdWithSlots: jest.fn(),
      getNextVersionNumber: jest.fn(),
      softDelete: jest.fn(),
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

  it('should NOT create a new TimetableVersion record when overwriting slots on a DRAFT version', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        versionNumberArb,
        slotsArrayArb,
        async (versionId: string, versionNumber: number, slots: CreateSlotDto[]) => {
          // Track all operations performed by the transaction
          const operations: string[] = [];
          let versionSaveCallCount = 0;
          let versionCreateCallCount = 0;

          // Mock: version exists with DRAFT status
          const versionEntity = buildDraftVersionEntity(versionId, versionNumber);
          mockVersionRepo.findById.mockResolvedValue(versionEntity);

          // Mock transaction to execute the callback and track operations
          mockDataSource.transaction.mockImplementation(
            async (cb: (manager: unknown) => Promise<void>) => {
              const mockManager = {
                createQueryBuilder: jest.fn().mockReturnValue({
                  update: jest.fn().mockReturnThis(),
                  set: jest.fn().mockReturnThis(),
                  where: jest.fn().mockReturnThis(),
                  execute: jest.fn().mockImplementation(() => {
                    operations.push('soft-delete-slots');
                    return Promise.resolve({});
                  }),
                }),
                create: jest.fn().mockImplementation(
                  (entity: unknown, data: unknown) => {
                    if (entity === TimetableVersionEntity) {
                      versionCreateCallCount++;
                      operations.push('create-version');
                    } else {
                      operations.push('create-slot');
                    }
                    return data;
                  },
                ),
                save: jest.fn().mockImplementation(
                  (entity: unknown, data: unknown) => {
                    if (entity === TimetableVersionEntity) {
                      versionSaveCallCount++;
                      operations.push('save-version');
                    } else {
                      operations.push('save-slots');
                    }
                    return Promise.resolve(Array.isArray(data) ? data : data);
                  },
                ),
              };
              return cb(mockManager);
            },
          );

          // Act: call overwriteSlots
          await service.overwriteSlots(versionId, slots);

          // Assert: No new TimetableVersion record is created
          expect(versionCreateCallCount).toBe(0);
          expect(versionSaveCallCount).toBe(0);

          // Assert: Only slot operations happen (soft-delete old + insert new)
          expect(operations).toContain('soft-delete-slots');
          if (slots.length > 0) {
            expect(operations).toContain('save-slots');
          }
          expect(operations).not.toContain('create-version');
          expect(operations).not.toContain('save-version');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should preserve the same version_id and version_number after overwriteSlots', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        versionNumberArb,
        slotsArrayArb,
        async (versionId: string, versionNumber: number, slots: CreateSlotDto[]) => {
          // Mock: version exists with DRAFT status
          const versionEntity = buildDraftVersionEntity(versionId, versionNumber);
          mockVersionRepo.findById.mockResolvedValue(versionEntity);

          // Mock transaction
          mockDataSource.transaction.mockImplementation(
            async (cb: (manager: unknown) => Promise<void>) => {
              const mockManager = {
                createQueryBuilder: jest.fn().mockReturnValue({
                  update: jest.fn().mockReturnThis(),
                  set: jest.fn().mockReturnThis(),
                  where: jest.fn().mockReturnThis(),
                  execute: jest.fn().mockResolvedValue({}),
                }),
                create: jest.fn().mockImplementation((_entity: unknown, data: unknown) => data),
                save: jest.fn().mockResolvedValue([]),
              };
              return cb(mockManager);
            },
          );

          // Act: call overwriteSlots
          await service.overwriteSlots(versionId, slots);

          // Assert: The version_id passed to the transaction is the same original one
          // (verified by checking the findById was called with the same versionId
          // and no new version was created in the transaction)
          expect(mockVersionRepo.findById).toHaveBeenCalledWith(versionId);

          // Assert: The version entity itself is NOT modified (no update call on version repo)
          expect(mockVersionRepo.update).not.toHaveBeenCalled();

          // Assert: getNextVersionNumber was NOT called (no new version number needed)
          expect(mockVersionRepo.getNextVersionNumber).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should NOT modify the version entity fields (name, status, versionNumber remain unchanged)', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        versionNumberArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        slotsArrayArb,
        async (
          versionId: string,
          versionNumber: number,
          versionName: string,
          slots: CreateSlotDto[],
        ) => {
          // Mock: version exists with DRAFT status and specific properties
          const versionEntity = {
            ...buildDraftVersionEntity(versionId, versionNumber),
            name: versionName,
          };
          mockVersionRepo.findById.mockResolvedValue(versionEntity);

          // Track if version entity gets modified
          let versionEntityModified = false;
          const originalVersion = { ...versionEntity };

          // Mock transaction
          mockDataSource.transaction.mockImplementation(
            async (cb: (manager: unknown) => Promise<void>) => {
              const mockManager = {
                createQueryBuilder: jest.fn().mockReturnValue({
                  update: jest.fn().mockReturnThis(),
                  set: jest.fn().mockReturnThis(),
                  where: jest.fn().mockReturnThis(),
                  execute: jest.fn().mockResolvedValue({}),
                }),
                create: jest.fn().mockImplementation((_entity: unknown, data: unknown) => data),
                save: jest.fn().mockImplementation(
                  (entity: unknown, data: unknown) => {
                    if (entity === TimetableVersionEntity) {
                      versionEntityModified = true;
                    }
                    return Promise.resolve(Array.isArray(data) ? data : data);
                  },
                ),
              };
              return cb(mockManager);
            },
          );

          // Act: call overwriteSlots
          await service.overwriteSlots(versionId, slots);

          // Assert: version entity was NOT saved/modified in the transaction
          expect(versionEntityModified).toBe(false);

          // Assert: version entity fields remain the same
          expect(versionEntity.id).toBe(originalVersion.id);
          expect(versionEntity.versionNumber).toBe(originalVersion.versionNumber);
          expect(versionEntity.name).toBe(originalVersion.name);
          expect(versionEntity.status).toBe(originalVersion.status);
          expect(versionEntity.semesterId).toBe(originalVersion.semesterId);
        },
      ),
      { numRuns: 100 },
    );
  });
});
