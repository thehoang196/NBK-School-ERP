/**
 * Feature: timetable-management-features, Property 8: Version slot copying preserves all data
 *
 * **Validates: Requirements 3.2, 4.6**
 *
 * Property: For any version copy operation (save-as-new), all slots from the input SHALL be
 * duplicated into the new version with identical field values (classId, dayOfWeek, periodId,
 * subjectId, teacherId, roomId, isDoublePeriod), and the new version SHALL have a version_number
 * equal to the maximum existing version_number in that semester plus one.
 */
import * as fc from 'fast-check';
import { TimetableVersionService } from './timetable-version.service';
import { TimetableVersionRepository } from '../repositories/timetable-version.repository';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { TimetableVersionStatus } from '../../../common/enums/status.enum';
import { SaveTimetableVersionDto } from '../dto/save-timetable-version.dto';
import { CreateSlotDto } from '../dto/create-slot.dto';
import { DataSource } from 'typeorm';

// --- Generators ---

/**
 * Generator for a valid UUID v4 string
 */
const arbUuid = fc.uuid().map((u) => u as string);

/**
 * Generator for dayOfWeek: integer between 2 and 7
 */
const arbDayOfWeek = fc.integer({ min: 2, max: 7 });

/**
 * Generator for a single CreateSlotDto with valid random data
 */
const arbSlotDto: fc.Arbitrary<CreateSlotDto> = fc.record({
  classId: arbUuid,
  dayOfWeek: arbDayOfWeek,
  periodId: arbUuid,
  subjectId: arbUuid,
  teacherId: arbUuid,
  roomId: fc.option(arbUuid, { nil: undefined }),
  isDoublePeriod: fc.option(fc.boolean(), { nil: undefined }),
});

/**
 * Generator for a non-empty array of slots (1 to 30 slots)
 */
const arbSlotArray = fc.array(arbSlotDto, { minLength: 1, maxLength: 30 });

/**
 * Generator for existing max version number in the semester (0 means no existing versions)
 */
const arbExistingMaxVersion = fc.integer({ min: 0, max: 100 });

describe('Property 8: Version slot copying preserves all data', () => {
  let service: TimetableVersionService;
  let mockVersionRepo: { getNextVersionNumber: jest.Mock };
  let mockSlotRepo: Record<string, unknown>;
  let mockDataSource: Partial<DataSource>;

  // Track what was saved in the mock transaction
  let savedVersion: TimetableVersionEntity | null;
  let savedSlots: TimetableSlotEntity[];

  beforeEach(() => {
    savedVersion = null;
    savedSlots = [];

    mockVersionRepo = {
      getNextVersionNumber: jest.fn(),
    };

    mockSlotRepo = {} as Record<string, unknown>;

    // Mock DataSource.transaction to capture what's being saved
    mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation(
          async (callback: (manager: unknown) => Promise<unknown>) => {
            const mockManager = {
              create: jest
                .fn()
                .mockImplementation(
                  (EntityClass: unknown, data: Record<string, unknown>) => {
                    return { ...data } as unknown;
                  },
                ),
              save: jest
                .fn()
                .mockImplementation((EntityClass: unknown, entity: unknown) => {
                  if (Array.isArray(entity)) {
                    // Bulk save slots — assign IDs
                    const slotsWithIds = entity.map(
                      (s: Record<string, unknown>, idx: number) => ({
                        ...s,
                        id: `slot-id-${idx}`,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        deletedAt: null,
                      }),
                    );
                    savedSlots =
                      slotsWithIds as unknown as TimetableSlotEntity[];
                    return Promise.resolve(slotsWithIds);
                  } else {
                    // Single save version — assign id
                    const versionWithId = {
                      ...(entity as Record<string, unknown>),
                      id: 'new-version-id',
                      createdAt: new Date(),
                      updatedAt: new Date(),
                      deletedAt: null,
                    };
                    savedVersion =
                      versionWithId as unknown as TimetableVersionEntity;
                    return Promise.resolve(versionWithId);
                  }
                }),
            };
            return callback(mockManager);
          },
        ),
    };

    service = new TimetableVersionService(
      mockVersionRepo as unknown as TimetableVersionRepository,
      mockSlotRepo as unknown as TimetableSlotRepository,
      mockDataSource as unknown as DataSource,
    );
  });

  it('should preserve all slot data fields when saving as new version', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSlotArray,
        arbUuid,
        arbExistingMaxVersion,
        fc.string({ minLength: 1, maxLength: 50 }),
        async (slots, semesterId, existingMaxVersion, name) => {
          // Reset state
          savedVersion = null;
          savedSlots = [];

          // Setup mock
          const expectedNextVersion = existingMaxVersion + 1;
          mockVersionRepo.getNextVersionNumber.mockResolvedValue(
            expectedNextVersion,
          );

          // Build DTO
          const dto: SaveTimetableVersionDto = {
            name,
            semesterId,
            slots,
          };

          // Act
          await service.saveAsNewVersion(dto, 'school-id-123');

          // Assert 1: version_number = existingMax + 1
          expect(savedVersion).not.toBeNull();
          expect(savedVersion!.versionNumber).toBe(expectedNextVersion);

          // Assert 2: all slots are saved with correct count
          expect(savedSlots.length).toBe(slots.length);

          // Assert 3: each slot preserves all data fields exactly
          for (let i = 0; i < slots.length; i++) {
            const inputSlot = slots[i];
            const outputSlot = savedSlots[i];

            expect(outputSlot.classId).toBe(inputSlot.classId);
            expect(outputSlot.dayOfWeek).toBe(inputSlot.dayOfWeek);
            expect(outputSlot.periodId).toBe(inputSlot.periodId);
            expect(outputSlot.subjectId).toBe(inputSlot.subjectId);
            expect(outputSlot.teacherId).toBe(inputSlot.teacherId);
            expect(outputSlot.roomId).toBe(inputSlot.roomId || null);
            expect(outputSlot.isDoublePeriod).toBe(
              inputSlot.isDoublePeriod || false,
            );
          }

          // Assert 4: all slots reference the new version
          for (const slot of savedSlots) {
            expect(slot.versionId).toBe('new-version-id');
          }

          // Assert 5: version status is DRAFT
          expect(savedVersion!.status).toBe(TimetableVersionStatus.DRAFT);

          // Assert 6: version has correct semesterId
          expect(savedVersion!.semesterId).toBe(semesterId);
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);

  it('should correctly handle roomId presence and absence', async () => {
    await fc.assert(
      fc.asyncProperty(arbSlotArray, arbUuid, async (slots, semesterId) => {
        // Reset state
        savedVersion = null;
        savedSlots = [];

        mockVersionRepo.getNextVersionNumber.mockResolvedValue(1);

        const dto: SaveTimetableVersionDto = {
          name: 'Test Version',
          semesterId,
          slots,
        };

        await service.saveAsNewVersion(dto, 'school-id-123');

        // Verify roomId handling: undefined/null input → null output
        for (let i = 0; i < slots.length; i++) {
          const inputSlot = slots[i];
          const outputSlot = savedSlots[i];

          if (inputSlot.roomId) {
            expect(outputSlot.roomId).toBe(inputSlot.roomId);
          } else {
            expect(outputSlot.roomId).toBeNull();
          }
        }
      }),
      { numRuns: 100 },
    );
  }, 30000);

  it('should correctly handle isDoublePeriod boolean defaults', async () => {
    await fc.assert(
      fc.asyncProperty(arbSlotArray, arbUuid, async (slots, semesterId) => {
        // Reset state
        savedVersion = null;
        savedSlots = [];

        mockVersionRepo.getNextVersionNumber.mockResolvedValue(5);

        const dto: SaveTimetableVersionDto = {
          name: 'Test Version',
          semesterId,
          slots,
        };

        await service.saveAsNewVersion(dto, 'school-id-123');

        // Verify isDoublePeriod: undefined input → false output
        for (let i = 0; i < slots.length; i++) {
          const inputSlot = slots[i];
          const outputSlot = savedSlots[i];

          if (inputSlot.isDoublePeriod === true) {
            expect(outputSlot.isDoublePeriod).toBe(true);
          } else {
            expect(outputSlot.isDoublePeriod).toBe(false);
          }
        }
      }),
      { numRuns: 100 },
    );
  }, 30000);

  it('should always assign version_number = getNextVersionNumber result', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSlotArray,
        arbUuid,
        arbExistingMaxVersion,
        async (slots, semesterId, existingMaxVersion) => {
          savedVersion = null;
          savedSlots = [];

          const expectedNextVersion = existingMaxVersion + 1;
          mockVersionRepo.getNextVersionNumber.mockResolvedValue(
            expectedNextVersion,
          );

          const dto: SaveTimetableVersionDto = {
            name: 'Version Name',
            semesterId,
            slots,
          };

          await service.saveAsNewVersion(dto, 'school-id-123');

          // version_number should always equal what getNextVersionNumber returns
          expect(savedVersion!.versionNumber).toBe(expectedNextVersion);

          // Verify the repo was called with the correct semesterId
          expect(mockVersionRepo.getNextVersionNumber).toHaveBeenCalledWith(
            semesterId,
          );
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);
});
