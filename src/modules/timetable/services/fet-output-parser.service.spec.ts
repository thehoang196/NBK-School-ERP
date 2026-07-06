import { FetOutputParserService } from './fet-output-parser.service';
import {
  FetParseContext,
  ActivityMetadata,
} from '../interfaces/fet-dto.interface';
import { FetParseException } from '../exceptions';

describe('FetOutputParserService', () => {
  let service: FetOutputParserService;

  beforeEach(() => {
    service = new FetOutputParserService();
  });

  // ─── Helper Functions ──────────────────────────────────────────────────────

  function buildContext(overrides?: Partial<FetParseContext>): FetParseContext {
    const activityMap = new Map<string, ActivityMetadata>([
      [
        '1',
        {
          teachingAssignmentId: 'ta-001',
          teacherId: 'teacher-uuid-1',
          classId: 'class-uuid-1',
          subjectId: 'subject-uuid-1',
          duration: 1,
        },
      ],
      [
        '2',
        {
          teachingAssignmentId: 'ta-002',
          teacherId: 'teacher-uuid-2',
          classId: 'class-uuid-2',
          subjectId: 'subject-uuid-2',
          duration: 1,
        },
      ],
      [
        '3',
        {
          teachingAssignmentId: 'ta-003',
          teacherId: 'teacher-uuid-1',
          classId: 'class-uuid-1',
          subjectId: 'subject-uuid-1',
          duration: 1,
        },
      ],
    ]);

    const dayMap = new Map<string, number>([
      ['Thứ 2', 0],
      ['Thứ 3', 1],
      ['Thứ 4', 2],
      ['Thứ 5', 3],
      ['Thứ 6', 4],
      ['Thứ 7', 5],
    ]);

    const periodMap = new Map<string, string>([
      ['Tiết 1', 'period-uuid-1'],
      ['Tiết 2', 'period-uuid-2'],
      ['Tiết 3', 'period-uuid-3'],
      ['Tiết 4', 'period-uuid-4'],
      ['Tiết 5', 'period-uuid-5'],
    ]);

    const roomMap = new Map<string, string>([
      ['Phòng 101', 'room-uuid-1'],
      ['Phòng 102', 'room-uuid-2'],
    ]);

    const classMap = new Map<string, string>([
      ['Lớp 6A', 'class-uuid-1'],
      ['Lớp 7A', 'class-uuid-2'],
    ]);

    const teacherMap = new Map<string, string>([
      ['Nguyễn Văn A', 'teacher-uuid-1'],
      ['Trần Thị B', 'teacher-uuid-2'],
    ]);

    return {
      activityMap,
      dayMap,
      periodMap,
      roomMap,
      classMap,
      teacherMap,
      ...overrides,
    };
  }

  function buildValidXml(activities: string[] = []): string {
    const activityElements =
      activities.length > 0
        ? activities.join('\n    ')
        : `<Activity>
      <Id>1</Id>
      <Day>Thứ 2</Day>
      <Hour>Tiết 1</Hour>
      <Room>Phòng 101</Room>
    </Activity>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<fet version="6.2.7">
  <Timetable_Data>
    ${activityElements}
  </Timetable_Data>
</fet>`;
  }

  // ─── Happy Path Tests ──────────────────────────────────────────────────────

  describe('parse - happy path', () => {
    it('should parse a single activity successfully', () => {
      const xml = buildValidXml();
      const context = buildContext();

      const result = service.parse(xml, context);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.slots).toHaveLength(1);
      expect(result.slots[0]).toEqual({
        teacherId: 'teacher-uuid-1',
        classId: 'class-uuid-1',
        subjectId: 'subject-uuid-1',
        roomId: 'room-uuid-1',
        dayOfWeek: 0,
        periodId: 'period-uuid-1',
        isDoublePeriod: false,
      });
    });

    it('should parse multiple activities successfully', () => {
      const xml = buildValidXml([
        `<Activity><Id>1</Id><Day>Thứ 2</Day><Hour>Tiết 1</Hour><Room>Phòng 101</Room></Activity>`,
        `<Activity><Id>2</Id><Day>Thứ 3</Day><Hour>Tiết 2</Hour><Room>Phòng 102</Room></Activity>`,
      ]);
      const context = buildContext();

      const result = service.parse(xml, context);

      expect(result.success).toBe(true);
      expect(result.slots).toHaveLength(2);
      expect(result.slots[0].teacherId).toBe('teacher-uuid-1');
      expect(result.slots[0].dayOfWeek).toBe(0);
      expect(result.slots[1].teacherId).toBe('teacher-uuid-2');
      expect(result.slots[1].dayOfWeek).toBe(1);
    });

    it('should handle activity with empty room (null roomId)', () => {
      const xml = buildValidXml([
        `<Activity><Id>1</Id><Day>Thứ 2</Day><Hour>Tiết 1</Hour><Room></Room></Activity>`,
      ]);
      const context = buildContext();

      const result = service.parse(xml, context);

      expect(result.success).toBe(true);
      expect(result.slots[0].roomId).toBeNull();
    });

    it('should handle activity with no Room element', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fet version="6.2.7">
  <Timetable_Data>
    <Activity>
      <Id>1</Id>
      <Day>Thứ 2</Day>
      <Hour>Tiết 1</Hour>
    </Activity>
  </Timetable_Data>
</fet>`;
      const context = buildContext();

      const result = service.parse(xml, context);

      expect(result.success).toBe(true);
      expect(result.slots[0].roomId).toBeNull();
    });

    it('should return warning when no activities found', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fet version="6.2.7">
  <Timetable_Data>
    <GenerationDate>2024-01-01</GenerationDate>
  </Timetable_Data>
</fet>`;
      const context = buildContext();

      const result = service.parse(xml, context);

      expect(result.success).toBe(true);
      expect(result.slots).toHaveLength(0);
      expect(result.warnings).toContain(
        'Không tìm thấy hoạt động nào trong kết quả FET',
      );
    });
  });

  // ─── Double Period Detection ───────────────────────────────────────────────

  describe('parse - double period detection', () => {
    it('should mark consecutive same-teacher+class+subject slots as double periods', () => {
      const xml = buildValidXml([
        `<Activity><Id>1</Id><Day>Thứ 2</Day><Hour>Tiết 1</Hour><Room>Phòng 101</Room></Activity>`,
        `<Activity><Id>3</Id><Day>Thứ 2</Day><Hour>Tiết 2</Hour><Room>Phòng 101</Room></Activity>`,
      ]);
      const context = buildContext();

      const result = service.parse(xml, context);

      expect(result.success).toBe(true);
      expect(result.slots).toHaveLength(2);
      // Both should be marked as double period
      // (same dayOfWeek=0, same teacherId, classId, subjectId)
      expect(result.slots[0].isDoublePeriod).toBe(true);
      expect(result.slots[1].isDoublePeriod).toBe(true);
    });

    it('should NOT mark slots on different days as double periods', () => {
      const xml = buildValidXml([
        `<Activity><Id>1</Id><Day>Thứ 2</Day><Hour>Tiết 1</Hour><Room>Phòng 101</Room></Activity>`,
        `<Activity><Id>3</Id><Day>Thứ 3</Day><Hour>Tiết 1</Hour><Room>Phòng 101</Room></Activity>`,
      ]);
      const context = buildContext();

      const result = service.parse(xml, context);

      expect(result.success).toBe(true);
      expect(result.slots[0].isDoublePeriod).toBe(false);
      expect(result.slots[1].isDoublePeriod).toBe(false);
    });

    it('should NOT mark different teacher+class+subject combinations as double periods', () => {
      const xml = buildValidXml([
        `<Activity><Id>1</Id><Day>Thứ 2</Day><Hour>Tiết 1</Hour><Room>Phòng 101</Room></Activity>`,
        `<Activity><Id>2</Id><Day>Thứ 2</Day><Hour>Tiết 2</Hour><Room>Phòng 102</Room></Activity>`,
      ]);
      const context = buildContext();

      const result = service.parse(xml, context);

      expect(result.success).toBe(true);
      expect(result.slots[0].isDoublePeriod).toBe(false);
      expect(result.slots[1].isDoublePeriod).toBe(false);
    });
  });

  // ─── Referential Integrity Validation ──────────────────────────────────────

  describe('parse - referential integrity errors', () => {
    it('should report error for unknown activity ID', () => {
      const xml = buildValidXml([
        `<Activity><Id>999</Id><Day>Thứ 2</Day><Hour>Tiết 1</Hour><Room>Phòng 101</Room></Activity>`,
      ]);
      const context = buildContext();

      const result = service.parse(xml, context);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        activityId: '999',
        field: 'activityId',
        message: "Hoạt động '999' không tồn tại trong dữ liệu đầu vào",
        rawValue: '999',
      });
    });

    it('should report error for unknown Day', () => {
      const xml = buildValidXml([
        `<Activity><Id>1</Id><Day>Chủ nhật</Day><Hour>Tiết 1</Hour><Room>Phòng 101</Room></Activity>`,
      ]);
      const context = buildContext();

      const result = service.parse(xml, context);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        activityId: '1',
        field: 'Day',
        message: "Ngày 'Chủ nhật' không tồn tại trong danh sách ngày",
        rawValue: 'Chủ nhật',
      });
    });

    it('should report error for unknown Hour', () => {
      const xml = buildValidXml([
        `<Activity><Id>1</Id><Day>Thứ 2</Day><Hour>Tiết 99</Hour><Room>Phòng 101</Room></Activity>`,
      ]);
      const context = buildContext();

      const result = service.parse(xml, context);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        activityId: '1',
        field: 'Hour',
        message: "Tiết 'Tiết 99' không tồn tại trong danh sách tiết học",
        rawValue: 'Tiết 99',
      });
    });

    it('should report error for unknown Room (non-empty)', () => {
      const xml = buildValidXml([
        `<Activity><Id>1</Id><Day>Thứ 2</Day><Hour>Tiết 1</Hour><Room>Phòng ABC</Room></Activity>`,
      ]);
      const context = buildContext();

      const result = service.parse(xml, context);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        activityId: '1',
        field: 'Room',
        message: "Phòng 'Phòng ABC' không tồn tại trong danh sách phòng học",
        rawValue: 'Phòng ABC',
      });
    });

    it('should collect multiple errors from different activities', () => {
      const xml = buildValidXml([
        `<Activity><Id>999</Id><Day>Thứ 2</Day><Hour>Tiết 1</Hour><Room>Phòng 101</Room></Activity>`,
        `<Activity><Id>1</Id><Day>Invalid</Day><Hour>Tiết 1</Hour><Room>Phòng 101</Room></Activity>`,
        `<Activity><Id>2</Id><Day>Thứ 3</Day><Hour>Tiết 2</Hour><Room>Phòng 102</Room></Activity>`,
      ]);
      const context = buildContext();

      const result = service.parse(xml, context);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(2);
      // Valid activity should still produce a slot
      expect(result.slots).toHaveLength(1);
      expect(result.slots[0].teacherId).toBe('teacher-uuid-2');
    });
  });

  // ─── XML Parsing Failure Tests ─────────────────────────────────────────────

  describe('parse - malformed XML', () => {
    it('should throw FetParseException on completely invalid XML', () => {
      const xml = 'this is not xml at all <<<<>';
      const context = buildContext();

      expect(() => service.parse(xml, context)).toThrow(FetParseException);
    });

    it('should throw FetParseException when <fet> root is missing', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<notfet>
  <Timetable_Data></Timetable_Data>
</notfet>`;
      const context = buildContext();

      expect(() => service.parse(xml, context)).toThrow(FetParseException);
      expect(() => service.parse(xml, context)).toThrow(
        'Thiếu phần tử gốc <fet>',
      );
    });

    it('should throw FetParseException when <Timetable_Data> is missing', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fet version="6.2.7">
  <Other_Data></Other_Data>
</fet>`;
      const context = buildContext();

      expect(() => service.parse(xml, context)).toThrow(FetParseException);
      expect(() => service.parse(xml, context)).toThrow(
        'Thiếu phần <Timetable_Data>',
      );
    });
  });

  // ─── Edge Cases ────────────────────────────────────────────────────────────

  describe('parse - edge cases', () => {
    it('should handle numeric activity IDs (parsed as numbers by fast-xml-parser)', () => {
      const xml = buildValidXml([
        `<Activity><Id>1</Id><Day>Thứ 2</Day><Hour>Tiết 1</Hour><Room>Phòng 101</Room></Activity>`,
      ]);
      const context = buildContext();

      const result = service.parse(xml, context);

      expect(result.success).toBe(true);
      expect(result.slots).toHaveLength(1);
    });

    it('should trim whitespace from Day, Hour, and Room values', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fet version="6.2.7">
  <Timetable_Data>
    <Activity>
      <Id>1</Id>
      <Day>  Thứ 2  </Day>
      <Hour>  Tiết 1  </Hour>
      <Room>  Phòng 101  </Room>
    </Activity>
  </Timetable_Data>
</fet>`;
      const context = buildContext();

      const result = service.parse(xml, context);

      expect(result.success).toBe(true);
      expect(result.slots).toHaveLength(1);
      expect(result.slots[0].dayOfWeek).toBe(0);
      expect(result.slots[0].periodId).toBe('period-uuid-1');
      expect(result.slots[0].roomId).toBe('room-uuid-1');
    });

    it('should handle large number of activities', () => {
      // Build context with many activities
      const activityMap = new Map<string, ActivityMetadata>();
      const activities: string[] = [];

      for (let i = 1; i <= 100; i++) {
        activityMap.set(String(i), {
          teachingAssignmentId: `ta-${i}`,
          teacherId: 'teacher-uuid-1',
          classId: 'class-uuid-1',
          subjectId: 'subject-uuid-1',
          duration: 1,
        });
        activities.push(
          `<Activity><Id>${i}</Id><Day>Thứ 2</Day><Hour>Tiết 1</Hour><Room>Phòng 101</Room></Activity>`,
        );
      }

      const context = buildContext({ activityMap });
      const xml = buildValidXml(activities);

      const result = service.parse(xml, context);

      expect(result.success).toBe(true);
      expect(result.slots).toHaveLength(100);
    });
  });
});
