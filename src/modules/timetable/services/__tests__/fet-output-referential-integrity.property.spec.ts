import * as fc from 'fast-check';
import { FetOutputParserService } from '../fet-output-parser.service';
import {
  FetParseContext,
  FetParseResult,
  ActivityMetadata,
} from '../../interfaces/fet-dto.interface';

/**
 * Property 6: FET Output Referential Integrity
 * Feature: fet-generation-pipeline
 *
 * For any FET output XML containing activity elements, every activity's
 * teacher, class, subject, and period references SHALL be validated against
 * the original input context. If any reference does not exist in the input,
 * the parser SHALL report the specific invalid reference(s) with activity ID
 * and field name.
 *
 * **Validates: Requirements 5.4, 5.5**
 */
describe('Feature: fet-generation-pipeline, Property 6: FET Output Referential Integrity', () => {
  let parser: FetOutputParserService;

  beforeEach(() => {
    parser = new FetOutputParserService();
  });

  // --- Generators ---

  /** Generate a unique string ID */
  const idArb = fc.stringMatching(/^[a-z][a-z0-9]{3,9}$/);

  /** Generate a unique numeric activity ID (FET uses numeric IDs) */
  const activityIdArb = fc.integer({ min: 1, max: 9999 }).map(String);

  /** Generate a valid FetParseContext with known entries */
  const contextArb = fc
    .record({
      activityIds: fc.uniqueArray(activityIdArb, {
        minLength: 1,
        maxLength: 10,
      }),
      dayNames: fc.uniqueArray(idArb, { minLength: 1, maxLength: 5 }),
      hourNames: fc.uniqueArray(idArb, { minLength: 1, maxLength: 8 }),
      roomNames: fc.uniqueArray(idArb, { minLength: 1, maxLength: 5 }),
    })
    .map(({ activityIds, dayNames, hourNames, roomNames }) => {
      const activityMap = new Map<string, ActivityMetadata>();
      for (const id of activityIds) {
        activityMap.set(id, {
          teachingAssignmentId: `ta-${id}`,
          teacherId: `teacher-${id}`,
          classId: `class-${id}`,
          subjectId: `subject-${id}`,
          duration: 1,
        });
      }

      const dayMap = new Map<string, number>();
      dayNames.forEach((name, idx) => dayMap.set(name, idx));

      const periodMap = new Map<string, string>();
      hourNames.forEach((name) => periodMap.set(name, `period-${name}`));

      const roomMap = new Map<string, string>();
      roomNames.forEach((name) => roomMap.set(name, `room-${name}`));

      const classMap = new Map<string, string>();
      const teacherMap = new Map<string, string>();

      const context: FetParseContext = {
        activityMap,
        dayMap,
        periodMap,
        roomMap,
        classMap,
        teacherMap,
      };

      return {
        context,
        validActivityIds: activityIds,
        validDayNames: dayNames,
        validHourNames: hourNames,
        validRoomNames: roomNames,
      };
    });

  /**
   * Describes a single activity element in FET output with its expected validity.
   */
  interface GeneratedActivity {
    id: string;
    day: string;
    hour: string;
    room: string;
    invalidFields: string[]; // Fields that have invalid references
  }

  /**
   * For a given context, generate a mix of valid and invalid activities.
   */
  const activitiesArb = (ctx: {
    validActivityIds: string[];
    validDayNames: string[];
    validHourNames: string[];
    validRoomNames: string[];
  }) => {
    const INVALID_PREFIX = 'INVALID_';

    return fc
      .array(
        fc.record({
          // Use valid or invalid activity ID
          useValidId: fc.boolean(),
          // Use valid or invalid Day
          useValidDay: fc.boolean(),
          // Use valid or invalid Hour
          useValidHour: fc.boolean(),
          // Use valid or invalid Room (or empty)
          roomStrategy: fc.constantFrom('valid', 'invalid', 'empty'),
          // Indices for selecting from valid arrays
          idIdx: fc.nat(),
          dayIdx: fc.nat(),
          hourIdx: fc.nat(),
          roomIdx: fc.nat(),
          // Random invalid IDs
          invalidId: fc.stringMatching(/^[A-Z][A-Z0-9]{4,8}$/),
          invalidDay: fc.stringMatching(/^BADDAY_[a-z]{2,5}$/),
          invalidHour: fc.stringMatching(/^BADHOUR_[a-z]{2,5}$/),
          invalidRoom: fc.stringMatching(/^BADROOM_[a-z]{2,5}$/),
        }),
        { minLength: 1, maxLength: 15 },
      )
      .map((configs) => {
        const activities: GeneratedActivity[] = [];
        const usedIds = new Set<string>();

        for (const config of configs) {
          const invalidFields: string[] = [];

          // Activity ID
          let id: string;
          if (config.useValidId) {
            id =
              ctx.validActivityIds[config.idIdx % ctx.validActivityIds.length];
          } else {
            id = INVALID_PREFIX + config.invalidId;
            invalidFields.push('activityId');
          }

          // Skip duplicate IDs (FET output shouldn't have duplicates)
          if (usedIds.has(id)) continue;
          usedIds.add(id);

          // Day
          let day: string;
          if (config.useValidDay && !invalidFields.includes('activityId')) {
            day = ctx.validDayNames[config.dayIdx % ctx.validDayNames.length];
          } else if (invalidFields.includes('activityId')) {
            // If activityId is already invalid, parser stops at activityId
            // so day/hour/room validity doesn't matter for error reporting
            day = ctx.validDayNames[config.dayIdx % ctx.validDayNames.length];
          } else {
            day = config.invalidDay;
            invalidFields.push('Day');
          }

          // Hour - only matters if activityId and Day are valid
          let hour: string;
          if (
            config.useValidHour ||
            invalidFields.includes('activityId') ||
            invalidFields.includes('Day')
          ) {
            hour =
              ctx.validHourNames[config.hourIdx % ctx.validHourNames.length];
          } else {
            hour = config.invalidHour;
            invalidFields.push('Hour');
          }

          // Room - only matters if activityId, Day, and Hour are valid
          let room: string;
          if (
            invalidFields.includes('activityId') ||
            invalidFields.includes('Day') ||
            invalidFields.includes('Hour')
          ) {
            room = '';
          } else if (
            config.roomStrategy === 'valid' &&
            ctx.validRoomNames.length > 0
          ) {
            room =
              ctx.validRoomNames[config.roomIdx % ctx.validRoomNames.length];
          } else if (config.roomStrategy === 'invalid') {
            room = config.invalidRoom;
            invalidFields.push('Room');
          } else {
            room = '';
          }

          activities.push({ id, day, hour, room, invalidFields });
        }

        return activities;
      })
      .filter((activities) => activities.length > 0);
  };

  /**
   * Build FET output XML from activity elements.
   */
  function buildFetOutputXml(activities: GeneratedActivity[]): string {
    const activityElements = activities
      .map(
        (a) =>
          `    <Activity>
      <Id>${a.id}</Id>
      <Day>${a.day}</Day>
      <Hour>${a.hour}</Hour>${a.room ? `\n      <Room>${a.room}</Room>` : ''}
    </Activity>`,
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<fet version="6.2.7">
  <Timetable_Data>
${activityElements}
  </Timetable_Data>
</fet>`;
  }

  // --- Properties ---

  it('should report errors for every activity with invalid references and produce valid slots for valid activities', () => {
    fc.assert(
      fc.property(
        contextArb.chain((ctx) =>
          activitiesArb(ctx).map((activities) => ({ ...ctx, activities })),
        ),
        ({ context, activities }) => {
          const xml = buildFetOutputXml(activities);
          const result: FetParseResult = parser.parse(xml, context);

          const activitiesWithErrors = activities.filter(
            (a) => a.invalidFields.length > 0,
          );
          const validActivities = activities.filter(
            (a) => a.invalidFields.length === 0,
          );

          // Every activity with an invalid reference produces a corresponding error
          for (const activity of activitiesWithErrors) {
            // The parser validates fields in order: activityId → Day → Hour → Room
            // It reports the FIRST invalid field and stops for that activity
            const firstInvalidField = activity.invalidFields[0];

            const matchingError = result.errors.find(
              (err) =>
                err.activityId === activity.id &&
                err.field === firstInvalidField,
            );

            expect(matchingError).toBeDefined();
            expect(matchingError!.activityId).toBe(activity.id);
            expect(matchingError!.field).toBe(firstInvalidField);
            expect(matchingError!.message).toBeTruthy();
            expect(matchingError!.rawValue).toBeTruthy();
          }

          // Valid activities produce valid slots without errors
          for (const activity of validActivities) {
            const hasError = result.errors.some(
              (err) => err.activityId === activity.id,
            );
            expect(hasError).toBe(false);
          }

          // Number of errors should match activities with invalid references
          expect(result.errors.length).toBe(activitiesWithErrors.length);

          // Number of slots should match valid activities
          expect(result.slots.length).toBe(validActivities.length);

          // If there are any errors, success should be false
          if (activitiesWithErrors.length > 0) {
            expect(result.success).toBe(false);
          }

          // If all activities are valid, success should be true
          if (activitiesWithErrors.length === 0) {
            expect(result.success).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should correctly identify the invalid field name in the error', () => {
    fc.assert(
      fc.property(
        contextArb.chain((ctx) =>
          activitiesArb(ctx).map((activities) => ({ ...ctx, activities })),
        ),
        ({ context, activities }) => {
          const xml = buildFetOutputXml(activities);
          const result: FetParseResult = parser.parse(xml, context);

          // For each error, verify the field name is one of the expected values
          for (const error of result.errors) {
            expect(['activityId', 'Day', 'Hour', 'Room']).toContain(
              error.field,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should include the raw invalid value in the error report', () => {
    fc.assert(
      fc.property(
        contextArb.chain((ctx) =>
          activitiesArb(ctx).map((activities) => ({ ...ctx, activities })),
        ),
        ({ context, activities }) => {
          const xml = buildFetOutputXml(activities);
          const result: FetParseResult = parser.parse(xml, context);

          // For each reported error, the rawValue should be non-empty
          for (const error of result.errors) {
            expect(error.rawValue).toBeTruthy();
            expect(typeof error.rawValue).toBe('string');
            expect(error.rawValue.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
