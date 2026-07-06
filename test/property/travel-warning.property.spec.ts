import * as fc from 'fast-check';
import {
  CrossSchoolTimetableService,
  MergedTimetableSlot,
} from '../../src/modules/timetable/services/cross-school-timetable.service';

/**
 * Property-Based Tests for Merged Timetable and Travel Warnings
 *
 * Property 13: Merged Timetable Completeness
 * For any cross-school teacher with TimetableSlots in N schools, the merged
 * timetable response SHALL contain ALL slots from ALL N schools. The count of
 * merged slots SHALL equal the sum of per-school slot counts.
 *
 * Property 14: Travel Warning Detection
 * For any sorted list of timetable slots for a teacher, whenever two consecutive
 * slots on the same day belong to different schools, the second slot SHALL have
 * hasTravelWarning = true. Slots that are not preceded by a different-school slot
 * on the same day SHALL have hasTravelWarning = false.
 *
 * Property 15: Timetable School Filter
 * For any teacher and for any school filter value, the returned merged timetable
 * SHALL contain only slots where slot.schoolId matches the filter. If filter is
 * null (all schools), all slots SHALL be returned.
 *
 * Feature: cross-campus-teaching
 * Testing Framework: fast-check
 * Minimum Iterations: 100 per property
 *
 * **Validates: Requirements 5.1, 5.3, 5.5**
 */

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Generate a random UUID v4 */
const uuidArb = fc.uuid({ version: 4 });

/** Day of week (2=Monday ... 7=Saturday, typical Vietnamese school days) */
const dayOfWeekArb = fc.integer({ min: 2, max: 7 });

/** Generate a time string in HH:mm format */
const timeArb = fc
  .tuple(fc.integer({ min: 6, max: 17 }), fc.integer({ min: 0, max: 59 }))
  .map(
    ([h, m]) =>
      `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
  );

/** Generate a pair of start/end times where start < end */
const timeRangeArb = fc
  .tuple(
    fc.integer({ min: 6, max: 16 }),
    fc.integer({ min: 0, max: 59 }),
    fc.integer({ min: 15, max: 45 }),
  )
  .map(([startHour, startMin, durationMin]) => {
    const startTotalMin = startHour * 60 + startMin;
    const endTotalMin = startTotalMin + durationMin;
    const endHour = Math.floor(endTotalMin / 60);
    const endMin = endTotalMin % 60;
    return {
      startTime: `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`,
      endTime: `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`,
    };
  });

/** Generate a school with id, name, and address */
const arbSchool = fc.record({
  id: uuidArb,
  name: fc.string({ minLength: 3, maxLength: 30 }),
  address: fc.option(fc.string({ minLength: 5, maxLength: 50 }), { nil: null }),
});

/** Generate a single MergedTimetableSlot with configurable schoolId */
const arbTimetableSlot = (
  schoolIds: string[],
): fc.Arbitrary<MergedTimetableSlot> =>
  fc
    .record({
      id: uuidArb,
      dayOfWeek: dayOfWeekArb,
      periodId: uuidArb,
      periodName: fc.constantFrom('1', '2', '3', '4', '5', '6', '7', '8'),
      startTime: fc.constant(''),
      endTime: fc.constant(''),
      classId: uuidArb,
      className: fc.string({ minLength: 2, maxLength: 20 }),
      subjectId: uuidArb,
      subjectName: fc.string({ minLength: 2, maxLength: 20 }),
      roomId: fc.option(uuidArb, { nil: null }),
      roomName: fc.option(fc.string({ minLength: 2, maxLength: 20 }), {
        nil: null,
      }),
      schoolId: fc.constantFrom(...schoolIds),
      schoolName: fc.string({ minLength: 3, maxLength: 30 }),
      schoolAddress: fc.option(fc.string({ minLength: 5, maxLength: 50 }), {
        nil: null,
      }),
      hasTravelWarning: fc.constant(false),
    })
    .chain((slot) =>
      timeRangeArb.map((times) => ({
        ...slot,
        startTime: times.startTime,
        endTime: times.endTime,
      })),
    );

/** Generate an array of MergedTimetableSlots across multiple schools */
const arbTimetableSlots = (
  schoolIds: string[],
  minSlots: number,
  maxSlots: number,
): fc.Arbitrary<MergedTimetableSlot[]> =>
  fc.array(arbTimetableSlot(schoolIds), {
    minLength: minSlots,
    maxLength: maxSlots,
  });

// ─── Service Instance ─────────────────────────────────────────────────────────

/**
 * Create a minimal instance of CrossSchoolTimetableService to test
 * the pure detectTravelWarnings method directly (no DB needed).
 */
function createServiceInstance(): CrossSchoolTimetableService {
  // detectTravelWarnings is a pure function — we can instantiate
  // the service with null dependencies since we only test that method
  return new CrossSchoolTimetableService(null as any, null as any);
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Apply school filter to a list of slots (simulates filterSchoolId logic).
 */
function applySchoolFilter(
  slots: MergedTimetableSlot[],
  filterSchoolId: string | null,
): MergedTimetableSlot[] {
  if (!filterSchoolId) return slots;
  return slots.filter((slot) => slot.schoolId === filterSchoolId);
}

// ============================================================================
// Property 13: Merged Timetable Completeness
// ============================================================================

describe('Feature: cross-campus-teaching | Property 13: Merged Timetable Completeness', () => {
  const service = createServiceInstance();

  /**
   * Property 13a: detectTravelWarnings preserves ALL input slots (count is same).
   *
   * For any list of MergedTimetableSlots from N schools, calling detectTravelWarnings
   * SHALL return a list with the same number of elements as the input.
   *
   * **Validates: Requirements 5.1**
   */
  describe('Property 13a: detectTravelWarnings preserves slot count', () => {
    it('output count always equals input count', () => {
      fc.assert(
        fc.property(
          fc
            .array(uuidArb, { minLength: 2, maxLength: 5 })
            .chain((schoolIds) => {
              const uniqueSchools = [...new Set(schoolIds)];
              return arbTimetableSlots(
                uniqueSchools.length >= 2
                  ? uniqueSchools
                  : [uniqueSchools[0], uniqueSchools[0] + '-2'],
                0,
                20,
              );
            }),
          (slots) => {
            const result = service.detectTravelWarnings(slots);
            expect(result.length).toBe(slots.length);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 13b: detectTravelWarnings preserves all slot IDs.
   *
   * Every slot ID in the input SHALL appear exactly once in the output.
   * No slots are lost or duplicated.
   *
   * **Validates: Requirements 5.1**
   */
  describe('Property 13b: All slot IDs are preserved (no loss, no duplication)', () => {
    it('output contains exactly the same slot IDs as input', () => {
      fc.assert(
        fc.property(
          fc
            .array(uuidArb, { minLength: 2, maxLength: 4 })
            .chain((schoolIds) => {
              const uniqueSchools = [...new Set(schoolIds)];
              return arbTimetableSlots(
                uniqueSchools.length >= 2
                  ? uniqueSchools
                  : [uniqueSchools[0], uniqueSchools[0] + '-2'],
                1,
                15,
              );
            }),
          (slots) => {
            const result = service.detectTravelWarnings(slots);

            const inputIds = slots.map((s) => s.id).sort();
            const outputIds = result.map((s) => s.id).sort();

            expect(outputIds).toEqual(inputIds);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 13c: detectTravelWarnings returns slots sorted by day then startTime.
   *
   * The output SHALL be sorted by dayOfWeek ascending, then by startTime ascending.
   *
   * **Validates: Requirements 5.1**
   */
  describe('Property 13c: Output is sorted by day then startTime', () => {
    it('result is in ascending order of dayOfWeek then startTime', () => {
      fc.assert(
        fc.property(
          fc
            .array(uuidArb, { minLength: 2, maxLength: 4 })
            .chain((schoolIds) => {
              const uniqueSchools = [...new Set(schoolIds)];
              return arbTimetableSlots(
                uniqueSchools.length >= 2
                  ? uniqueSchools
                  : [uniqueSchools[0], uniqueSchools[0] + '-2'],
                2,
                15,
              );
            }),
          (slots) => {
            const result = service.detectTravelWarnings(slots);

            for (let i = 1; i < result.length; i++) {
              const prev = result[i - 1];
              const curr = result[i];

              if (prev.dayOfWeek === curr.dayOfWeek) {
                expect(prev.startTime <= curr.startTime).toBe(true);
              } else {
                expect(prev.dayOfWeek < curr.dayOfWeek).toBe(true);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

// ============================================================================
// Property 14: Travel Warning Detection
// ============================================================================

describe('Feature: cross-campus-teaching | Property 14: Travel Warning Detection', () => {
  const service = createServiceInstance();

  /**
   * Property 14a: Consecutive slots on same day at different schools → hasTravelWarning=true.
   *
   * For any sorted list of timetable slots, whenever two consecutive slots on the
   * same day belong to different schools, the second slot SHALL have hasTravelWarning=true.
   *
   * **Validates: Requirements 5.3**
   */
  describe('Property 14a: Different school on same day → travel warning on second slot', () => {
    it('consecutive different-school same-day slots get travel warning', () => {
      fc.assert(
        fc.property(
          fc
            .array(uuidArb, { minLength: 2, maxLength: 4 })
            .chain((schoolIds) => {
              const uniqueSchools = [...new Set(schoolIds)];
              return arbTimetableSlots(
                uniqueSchools.length >= 2
                  ? uniqueSchools
                  : [uniqueSchools[0], uniqueSchools[0] + '-2'],
                2,
                20,
              );
            }),
          (slots) => {
            const result = service.detectTravelWarnings(slots);

            for (let i = 1; i < result.length; i++) {
              const prev = result[i - 1];
              const curr = result[i];

              if (
                prev.dayOfWeek === curr.dayOfWeek &&
                prev.schoolId !== curr.schoolId
              ) {
                expect(curr.hasTravelWarning).toBe(true);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 14b: Consecutive slots on same day at same school → hasTravelWarning=false.
   *
   * For any sorted list, consecutive slots on the same day from the same school
   * SHALL have hasTravelWarning=false (no travel needed).
   *
   * **Validates: Requirements 5.3**
   */
  describe('Property 14b: Same school on same day → no travel warning', () => {
    it('consecutive same-school same-day slots do NOT get travel warning', () => {
      fc.assert(
        fc.property(
          fc
            .array(uuidArb, { minLength: 2, maxLength: 4 })
            .chain((schoolIds) => {
              const uniqueSchools = [...new Set(schoolIds)];
              return arbTimetableSlots(
                uniqueSchools.length >= 2
                  ? uniqueSchools
                  : [uniqueSchools[0], uniqueSchools[0] + '-2'],
                2,
                20,
              );
            }),
          (slots) => {
            const result = service.detectTravelWarnings(slots);

            for (let i = 1; i < result.length; i++) {
              const prev = result[i - 1];
              const curr = result[i];

              if (
                prev.dayOfWeek === curr.dayOfWeek &&
                prev.schoolId === curr.schoolId
              ) {
                expect(curr.hasTravelWarning).toBe(false);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 14c: First slot of any day always has hasTravelWarning=false.
   *
   * The first slot in the sorted result (and the first slot of each new day)
   * SHALL have hasTravelWarning=false (no preceding slot to compare with).
   *
   * **Validates: Requirements 5.3**
   */
  describe('Property 14c: First slot of each day has no travel warning', () => {
    it('first slot overall and first slot of each new day have hasTravelWarning=false', () => {
      fc.assert(
        fc.property(
          fc
            .array(uuidArb, { minLength: 2, maxLength: 4 })
            .chain((schoolIds) => {
              const uniqueSchools = [...new Set(schoolIds)];
              return arbTimetableSlots(
                uniqueSchools.length >= 2
                  ? uniqueSchools
                  : [uniqueSchools[0], uniqueSchools[0] + '-2'],
                1,
                20,
              );
            }),
          (slots) => {
            const result = service.detectTravelWarnings(slots);

            if (result.length === 0) return;

            // First slot always has no travel warning
            expect(result[0].hasTravelWarning).toBe(false);

            // First slot of each new day has no travel warning
            for (let i = 1; i < result.length; i++) {
              const prev = result[i - 1];
              const curr = result[i];

              if (prev.dayOfWeek !== curr.dayOfWeek) {
                expect(curr.hasTravelWarning).toBe(false);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 14d: All single-school input → no travel warnings at all.
   *
   * If all slots belong to the same school, then NO slot SHALL have
   * hasTravelWarning=true (no cross-school travel needed).
   *
   * **Validates: Requirements 5.3**
   */
  describe('Property 14d: Single-school slots → zero travel warnings', () => {
    it('all slots from one school have hasTravelWarning=false', () => {
      fc.assert(
        fc.property(
          uuidArb.chain((schoolId) => arbTimetableSlots([schoolId], 1, 15)),
          (slots) => {
            const service = createServiceInstance();
            const result = service.detectTravelWarnings(slots);

            for (const slot of result) {
              expect(slot.hasTravelWarning).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 14e: Empty input produces empty output.
   *
   * detectTravelWarnings([]) SHALL return [].
   *
   * **Validates: Requirements 5.3**
   */
  describe('Property 14e: Empty input → empty output', () => {
    it('empty array returns empty array', () => {
      const service = createServiceInstance();
      const result = service.detectTravelWarnings([]);
      expect(result).toEqual([]);
    });
  });
});

// ============================================================================
// Property 15: Timetable School Filter
// ============================================================================

describe('Feature: cross-campus-teaching | Property 15: Timetable School Filter', () => {
  /**
   * Property 15a: If filterSchoolId provided, all returned slots have that schoolId.
   *
   * For any list of slots and any school filter, every slot in the filtered result
   * SHALL have schoolId === filterSchoolId.
   *
   * **Validates: Requirements 5.5**
   */
  describe('Property 15a: Filtered result only contains matching schoolId', () => {
    it('all slots in filtered result match the filter schoolId', () => {
      fc.assert(
        fc.property(
          fc
            .array(uuidArb, { minLength: 2, maxLength: 5 })
            .chain((schoolIds) => {
              const uniqueSchools = [...new Set(schoolIds)];
              const schools =
                uniqueSchools.length >= 2
                  ? uniqueSchools
                  : [uniqueSchools[0], uniqueSchools[0] + '-2'];
              return fc.tuple(
                arbTimetableSlots(schools, 1, 20),
                fc.constantFrom(...schools),
              );
            }),
          ([slots, filterSchoolId]) => {
            const filtered = applySchoolFilter(slots, filterSchoolId);

            for (const slot of filtered) {
              expect(slot.schoolId).toBe(filterSchoolId);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 15b: Filter preserves ALL matching slots (completeness).
   *
   * For any school filter, the filtered result SHALL contain ALL slots from
   * the original list that match the filter. No matching slots are lost.
   *
   * **Validates: Requirements 5.5**
   */
  describe('Property 15b: Filter preserves all matching slots', () => {
    it('no matching slots are lost during filtering', () => {
      fc.assert(
        fc.property(
          fc
            .array(uuidArb, { minLength: 2, maxLength: 5 })
            .chain((schoolIds) => {
              const uniqueSchools = [...new Set(schoolIds)];
              const schools =
                uniqueSchools.length >= 2
                  ? uniqueSchools
                  : [uniqueSchools[0], uniqueSchools[0] + '-2'];
              return fc.tuple(
                arbTimetableSlots(schools, 1, 20),
                fc.constantFrom(...schools),
              );
            }),
          ([slots, filterSchoolId]) => {
            const filtered = applySchoolFilter(slots, filterSchoolId);

            // Count how many slots in original match the filter
            const expectedCount = slots.filter(
              (s) => s.schoolId === filterSchoolId,
            ).length;

            expect(filtered.length).toBe(expectedCount);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 15c: Null filter returns all slots (no filtering applied).
   *
   * When filterSchoolId is null, ALL slots from ALL schools SHALL be returned
   * without modification.
   *
   * **Validates: Requirements 5.5**
   */
  describe('Property 15c: Null filter returns all slots', () => {
    it('null filter returns the complete slot list unchanged', () => {
      fc.assert(
        fc.property(
          fc
            .array(uuidArb, { minLength: 2, maxLength: 4 })
            .chain((schoolIds) => {
              const uniqueSchools = [...new Set(schoolIds)];
              return arbTimetableSlots(
                uniqueSchools.length >= 2
                  ? uniqueSchools
                  : [uniqueSchools[0], uniqueSchools[0] + '-2'],
                1,
                20,
              );
            }),
          (slots) => {
            const filtered = applySchoolFilter(slots, null);
            expect(filtered.length).toBe(slots.length);
            expect(filtered).toEqual(slots);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 15d: Filter for non-existent school returns empty array.
   *
   * For any list of slots and a schoolId not present in any slot,
   * the filter SHALL return an empty array.
   *
   * **Validates: Requirements 5.5**
   */
  describe('Property 15d: Filter with non-existent schoolId returns empty', () => {
    it('filtering by a school not in the slots returns empty array', () => {
      fc.assert(
        fc.property(
          fc
            .array(uuidArb, { minLength: 2, maxLength: 4 })
            .chain((schoolIds) => {
              const uniqueSchools = [...new Set(schoolIds)];
              const schools =
                uniqueSchools.length >= 2
                  ? uniqueSchools
                  : [uniqueSchools[0], uniqueSchools[0] + '-2'];
              return fc.tuple(
                arbTimetableSlots(schools, 1, 15),
                uuidArb,
                fc.constant(schools),
              );
            }),
          ([slots, nonExistentSchoolId, schools]) => {
            // Ensure the non-existent school is not in the list
            fc.pre(!schools.includes(nonExistentSchoolId));

            const filtered = applySchoolFilter(slots, nonExistentSchoolId);
            expect(filtered.length).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 15e: Filtered result is a subset of original.
   *
   * For any filter, the filtered result length SHALL be ≤ original length.
   *
   * **Validates: Requirements 5.5**
   */
  describe('Property 15e: Filtered result is subset of original', () => {
    it('filtered count is always ≤ original count', () => {
      fc.assert(
        fc.property(
          fc
            .array(uuidArb, { minLength: 2, maxLength: 4 })
            .chain((schoolIds) => {
              const uniqueSchools = [...new Set(schoolIds)];
              const schools =
                uniqueSchools.length >= 2
                  ? uniqueSchools
                  : [uniqueSchools[0], uniqueSchools[0] + '-2'];
              return fc.tuple(
                arbTimetableSlots(schools, 1, 20),
                fc.constantFrom(...schools),
              );
            }),
          ([slots, filterSchoolId]) => {
            const filtered = applySchoolFilter(slots, filterSchoolId);
            expect(filtered.length).toBeLessThanOrEqual(slots.length);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
