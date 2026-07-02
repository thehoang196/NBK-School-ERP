import { TimetableGeneratorService, FetActivity } from './timetable-generator.service';

describe('TimetableGeneratorService', () => {
  let service: TimetableGeneratorService;

  beforeEach(() => {
    // Create instance with null dependencies (we only test parseFetOutput which doesn't use them)
    service = new TimetableGeneratorService(null as never, null as never);
  });

  describe('parseFetOutput', () => {
    const versionId = 'version-uuid-001';

    const activities: FetActivity[] = [
      { id: 'act-1', teacherId: 'teacher-1', subjectId: 'subject-1', studentsSet: 'Class10A', duration: 1 },
      { id: 'act-2', teacherId: 'teacher-2', subjectId: 'subject-2', studentsSet: 'Class10B', duration: 2 },
      { id: 'act-3', teacherId: 'teacher-1', subjectId: 'subject-3', studentsSet: 'Class11A', duration: 1 },
    ];

    const periodMap = new Map<string, string>([
      ['Period1', 'period-uuid-1'],
      ['Period2', 'period-uuid-2'],
      ['Period3', 'period-uuid-3'],
    ]);

    const roomMap = new Map<string, string>([
      ['Room101', 'room-uuid-1'],
      ['Room102', 'room-uuid-2'],
    ]);

    const classMap = new Map<string, string>([
      ['Class10A', 'class-uuid-10a'],
      ['Class10B', 'class-uuid-10b'],
      ['Class11A', 'class-uuid-11a'],
    ]);

    it('should parse valid FET output XML correctly', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Solution>
  <Activity>
    <Id>act-1</Id>
    <Day>Mon</Day>
    <Hour>Period1</Hour>
    <Room>Room101</Room>
  </Activity>
  <Activity>
    <Id>act-2</Id>
    <Day>Wed</Day>
    <Hour>Period2</Hour>
    <Room>Room102</Room>
  </Activity>
  <Activity>
    <Id>act-3</Id>
    <Day>Fri</Day>
    <Hour>Period3</Hour>
    <Room>Room101</Room>
  </Activity>
</Solution>`;

      const result = service.parseFetOutput(xml, versionId, activities, periodMap, roomMap, classMap);

      expect(result).toHaveLength(3);

      expect(result[0]).toEqual({
        versionId,
        dayOfWeek: 2, // Mon
        periodId: 'period-uuid-1',
        classId: 'class-uuid-10a',
        teacherId: 'teacher-1',
        subjectId: 'subject-1',
        roomId: 'room-uuid-1',
        isDoublePeriod: false,
      });

      expect(result[1]).toEqual({
        versionId,
        dayOfWeek: 4, // Wed
        periodId: 'period-uuid-2',
        classId: 'class-uuid-10b',
        teacherId: 'teacher-2',
        subjectId: 'subject-2',
        roomId: 'room-uuid-2',
        isDoublePeriod: true, // duration > 1
      });

      expect(result[2]).toEqual({
        versionId,
        dayOfWeek: 6, // Fri
        periodId: 'period-uuid-3',
        classId: 'class-uuid-11a',
        teacherId: 'teacher-1',
        subjectId: 'subject-3',
        roomId: 'room-uuid-1',
        isDoublePeriod: false,
      });
    });

    it('should handle single activity (non-array)', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Solution>
  <Activity>
    <Id>act-1</Id>
    <Day>Tue</Day>
    <Hour>Period2</Hour>
    <Room>Room101</Room>
  </Activity>
</Solution>`;

      const result = service.parseFetOutput(xml, versionId, activities, periodMap, roomMap, classMap);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        versionId,
        dayOfWeek: 3, // Tue
        periodId: 'period-uuid-2',
        classId: 'class-uuid-10a',
        teacherId: 'teacher-1',
        subjectId: 'subject-1',
        roomId: 'room-uuid-1',
        isDoublePeriod: false,
      });
    });

    it('should handle activity without Room element', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Solution>
  <Activity>
    <Id>act-1</Id>
    <Day>Mon</Day>
    <Hour>Period1</Hour>
  </Activity>
</Solution>`;

      const result = service.parseFetOutput(xml, versionId, activities, periodMap, roomMap, classMap);

      expect(result).toHaveLength(1);
      expect(result[0].roomId).toBeNull();
    });

    it('should skip entries with invalid day names', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Solution>
  <Activity>
    <Id>act-1</Id>
    <Day>InvalidDay</Day>
    <Hour>Period1</Hour>
    <Room>Room101</Room>
  </Activity>
  <Activity>
    <Id>act-2</Id>
    <Day>Wed</Day>
    <Hour>Period2</Hour>
    <Room>Room102</Room>
  </Activity>
</Solution>`;

      const result = service.parseFetOutput(xml, versionId, activities, periodMap, roomMap, classMap);

      expect(result).toHaveLength(1);
      expect(result[0].dayOfWeek).toBe(4); // Wed
    });

    it('should skip entries with unknown hour names', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Solution>
  <Activity>
    <Id>act-1</Id>
    <Day>Mon</Day>
    <Hour>UnknownPeriod</Hour>
    <Room>Room101</Room>
  </Activity>
</Solution>`;

      const result = service.parseFetOutput(xml, versionId, activities, periodMap, roomMap, classMap);

      expect(result).toHaveLength(0);
    });

    it('should skip entries with unknown activity IDs', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Solution>
  <Activity>
    <Id>unknown-act</Id>
    <Day>Mon</Day>
    <Hour>Period1</Hour>
    <Room>Room101</Room>
  </Activity>
</Solution>`;

      const result = service.parseFetOutput(xml, versionId, activities, periodMap, roomMap, classMap);

      expect(result).toHaveLength(0);
    });

    it('should skip entries with unknown class (studentsSet)', () => {
      const activitiesWithUnknownClass: FetActivity[] = [
        { id: 'act-x', teacherId: 'teacher-1', subjectId: 'subject-1', studentsSet: 'UnknownClass', duration: 1 },
      ];

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Solution>
  <Activity>
    <Id>act-x</Id>
    <Day>Mon</Day>
    <Hour>Period1</Hour>
    <Room>Room101</Room>
  </Activity>
</Solution>`;

      const result = service.parseFetOutput(xml, versionId, activitiesWithUnknownClass, periodMap, roomMap, classMap);

      expect(result).toHaveLength(0);
    });

    it('should set roomId to null when room name is not in roomMap', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Solution>
  <Activity>
    <Id>act-1</Id>
    <Day>Mon</Day>
    <Hour>Period1</Hour>
    <Room>UnknownRoom</Room>
  </Activity>
</Solution>`;

      const result = service.parseFetOutput(xml, versionId, activities, periodMap, roomMap, classMap);

      expect(result).toHaveLength(1);
      expect(result[0].roomId).toBeNull();
    });

    it('should return empty array for malformed XML', () => {
      const xml = 'not valid xml <<>>';

      const result = service.parseFetOutput(xml, versionId, activities, periodMap, roomMap, classMap);

      // fast-xml-parser is lenient, so this might still parse to something
      // But it won't have Solution/Activity elements
      expect(result).toEqual([]);
    });

    it('should return empty array for XML without Solution element', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?><Root><Data>nothing</Data></Root>`;

      const result = service.parseFetOutput(xml, versionId, activities, periodMap, roomMap, classMap);

      expect(result).toEqual([]);
    });

    it('should map all day names correctly', () => {
      const dayTests = [
        { day: 'Mon', expected: 2 },
        { day: 'Tue', expected: 3 },
        { day: 'Wed', expected: 4 },
        { day: 'Thu', expected: 5 },
        { day: 'Fri', expected: 6 },
        { day: 'Sat', expected: 7 },
      ];

      for (const { day, expected } of dayTests) {
        const xml = `<Solution><Activity><Id>act-1</Id><Day>${day}</Day><Hour>Period1</Hour></Activity></Solution>`;
        const result = service.parseFetOutput(xml, versionId, activities, periodMap, roomMap, classMap);
        expect(result[0].dayOfWeek).toBe(expected);
      }
    });
  });
});
