import * as fc from 'fast-check';
import { DataSource } from 'typeorm';
import { ResultMapperService } from '../result-mapper.service';
import { TimetableSlotEntity } from '../../entities/timetable-slot.entity';
import { ParsedSlotDto } from '../../interfaces/fet-dto.interface';

/**
 * Property 7: Result Mapping Field Preservation
 * Feature: fet-generation-pipeline
 *
 * For any array of ParsedSlotDto and a given versionId and schoolId,
 * the Result_Mapper SHALL produce exactly one TimetableSlot record per input DTO
 * where teacherId, classId, subjectId, roomId, dayOfWeek, periodId, and isDoublePeriod
 * fields match the source DTO, and versionId and schoolId are correctly set on every record.
 *
 * **Validates: Requirements 6.1, 6.2, 11.2**
 */
describe('Feature: fet-generation-pipeline, Property 7: Result Mapping Field Preservation', () => {
  // ─── Generators ────────────────────────────────────────────────────────────

  const uuidArbitrary = fc.uuid();

  const nullableUuidArbitrary = fc.option(uuidArbitrary, { nil: null });

  const dayOfWeekArbitrary = fc.integer({ min: 0, max: 6 });

  const parsedSlotDtoArbitrary: fc.Arbitrary<ParsedSlotDto> = fc.record({
    teacherId: uuidArbitrary,
    classId: uuidArbitrary,
    subjectId: uuidArbitrary,
    roomId: nullableUuidArbitrary,
    dayOfWeek: dayOfWeekArbitrary,
    periodId: uuidArbitrary,
    isDoublePeriod: fc.boolean(),
  });

  const slotArrayArbitrary = fc.array(parsedSlotDtoArbitrary, {
    minLength: 1,
    maxLength: 50,
  });

  // ─── Test Helper ───────────────────────────────────────────────────────────

  function createServiceWithCapture(): {
    service: ResultMapperService;
    getSavedEntities: () => TimetableSlotEntity[];
  } {
    let savedEntities: TimetableSlotEntity[] = [];

    const mockManager = {
      save: jest
        .fn()
        .mockImplementation(
          (_entityClass: unknown, entities: TimetableSlotEntity[]) => {
            savedEntities = [...entities];
            return Promise.resolve(entities);
          },
        ),
    };

    const mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation(
          async (cb: (manager: typeof mockManager) => Promise<unknown>) => {
            return cb(mockManager);
          },
        ),
    };

    const service = new ResultMapperService(
      mockDataSource as unknown as DataSource,
    );

    return {
      service,
      getSavedEntities: () => savedEntities,
    };
  }

  // ─── Property Tests ────────────────────────────────────────────────────────

  it('should produce exactly one TimetableSlot per input DTO with all fields matching', () => {
    fc.assert(
      fc.asyncProperty(
        uuidArbitrary,
        uuidArbitrary,
        slotArrayArbitrary,
        async (versionId, schoolId, slots) => {
          const { service, getSavedEntities } = createServiceWithCapture();

          await service.persistSlots(versionId, slots, schoolId);

          const entities = getSavedEntities();

          // Exactly one TimetableSlot per DTO
          expect(entities).toHaveLength(slots.length);

          // Each entity's fields match the corresponding DTO
          for (let i = 0; i < slots.length; i++) {
            const dto = slots[i];
            const entity = entities[i];

            expect(entity).toBeInstanceOf(TimetableSlotEntity);
            expect(entity.teacherId).toBe(dto.teacherId);
            expect(entity.classId).toBe(dto.classId);
            expect(entity.subjectId).toBe(dto.subjectId);
            expect(entity.roomId).toBe(dto.roomId);
            expect(entity.dayOfWeek).toBe(dto.dayOfWeek);
            expect(entity.periodId).toBe(dto.periodId);
            expect(entity.isDoublePeriod).toBe(dto.isDoublePeriod);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should set versionId and schoolId correctly on every record', () => {
    fc.assert(
      fc.asyncProperty(
        uuidArbitrary,
        uuidArbitrary,
        slotArrayArbitrary,
        async (versionId, schoolId, slots) => {
          const { service, getSavedEntities } = createServiceWithCapture();

          await service.persistSlots(versionId, slots, schoolId);

          const entities = getSavedEntities();

          for (const entity of entities) {
            expect(entity.versionId).toBe(versionId);
            expect(entity.schoolId).toBe(schoolId);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
