import { FetInputExporterService } from './fet-input-exporter.service';
import {
  FetInputData,
  TeacherDto,
  ClassDto,
  SubjectDto,
  TeachingAssignmentDto,
  PeriodDefinitionDto,
  RoomDto,
  TeacherAvailabilityDto,
  RoomConstraintDto,
} from '../interfaces/fet-dto.interface';
import { GenerationValidationException } from '../exceptions';

describe('FetInputExporterService', () => {
  let service: FetInputExporterService;

  beforeEach(() => {
    service = new FetInputExporterService();
  });

  // ─── Test Data Helpers ────────────────────────────────────────────────

  function createValidInput(overrides?: Partial<FetInputData>): FetInputData {
    const teachers: TeacherDto[] = [
      { id: 'teacher-1', name: 'Nguyễn Văn A', maxPeriodsPerDay: 6 },
      { id: 'teacher-2', name: 'Trần Thị B', maxPeriodsPerDay: 5 },
    ];

    const classes: ClassDto[] = [
      { id: 'class-1', name: '6A1', gradeId: 'grade-6' },
      { id: 'class-2', name: '6A2', gradeId: 'grade-6' },
    ];

    const subjects: SubjectDto[] = [
      { id: 'subject-1', name: 'Toán' },
      { id: 'subject-2', name: 'Văn' },
    ];

    const teachingAssignments: TeachingAssignmentDto[] = [
      {
        id: 'assign-1',
        teacherId: 'teacher-1',
        classId: 'class-1',
        subjectId: 'subject-1',
        periodsPerWeek: 4,
      },
      {
        id: 'assign-2',
        teacherId: 'teacher-2',
        classId: 'class-2',
        subjectId: 'subject-2',
        periodsPerWeek: 3,
      },
    ];

    const periodDefinitions: PeriodDefinitionDto[] = [
      {
        id: 'period-1',
        periodNumber: 1,
        name: 'Tiết 1',
        sessionId: 'session-1',
      },
      {
        id: 'period-2',
        periodNumber: 2,
        name: 'Tiết 2',
        sessionId: 'session-1',
      },
      {
        id: 'period-3',
        periodNumber: 3,
        name: 'Tiết 3',
        sessionId: 'session-1',
      },
      {
        id: 'period-4',
        periodNumber: 4,
        name: 'Tiết 4',
        sessionId: 'session-1',
      },
      {
        id: 'period-5',
        periodNumber: 5,
        name: 'Tiết 5',
        sessionId: 'session-2',
      },
    ];

    const rooms: RoomDto[] = [
      { id: 'room-1', name: 'Phòng 101', capacity: 40 },
      { id: 'room-2', name: 'Phòng 102', capacity: 35 },
    ];

    const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];

    return {
      institution: 'Trường THCS Nguyễn Bỉnh Khiêm',
      schoolId: 'school-1',
      semesterId: 'semester-1',
      teachers,
      classes,
      subjects,
      teachingAssignments,
      periodDefinitions,
      rooms,
      days,
      teacherAvailability: [],
      roomConstraints: [],
      ...overrides,
    };
  }

  // ─── validate() Tests ─────────────────────────────────────────────────

  describe('validate()', () => {
    it('should return valid for complete, correct input', () => {
      const input = createValidInput();
      const result = service.validate(input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report error when teachers array is empty', () => {
      const input = createValidInput({ teachers: [] });
      const result = service.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'teachers' }),
        ]),
      );
    });

    it('should report error when classes array is empty', () => {
      const input = createValidInput({ classes: [] });
      const result = service.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'classes' })]),
      );
    });

    it('should report error when subjects array is empty', () => {
      const input = createValidInput({ subjects: [] });
      const result = service.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'subjects' }),
        ]),
      );
    });

    it('should report error when teachingAssignments array is empty', () => {
      const input = createValidInput({ teachingAssignments: [] });
      const result = service.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'teachingAssignments' }),
        ]),
      );
    });

    it('should report error when periodDefinitions array is empty', () => {
      const input = createValidInput({ periodDefinitions: [] });
      const result = service.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'periodDefinitions' }),
        ]),
      );
    });

    it('should report error when days array is empty', () => {
      const input = createValidInput({ days: [] });
      const result = service.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'days' })]),
      );
    });

    it('should report error when teachingAssignment references non-existent teacher', () => {
      const input = createValidInput({
        teachingAssignments: [
          {
            id: 'assign-bad',
            teacherId: 'non-existent-teacher',
            classId: 'class-1',
            subjectId: 'subject-1',
            periodsPerWeek: 3,
          },
        ],
      });
      const result = service.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'teachingAssignments[assign-bad].teacherId',
          }),
        ]),
      );
    });

    it('should report error when teachingAssignment references non-existent class', () => {
      const input = createValidInput({
        teachingAssignments: [
          {
            id: 'assign-bad',
            teacherId: 'teacher-1',
            classId: 'non-existent-class',
            subjectId: 'subject-1',
            periodsPerWeek: 3,
          },
        ],
      });
      const result = service.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'teachingAssignments[assign-bad].classId',
          }),
        ]),
      );
    });

    it('should report error when teachingAssignment references non-existent subject', () => {
      const input = createValidInput({
        teachingAssignments: [
          {
            id: 'assign-bad',
            teacherId: 'teacher-1',
            classId: 'class-1',
            subjectId: 'non-existent-subject',
            periodsPerWeek: 3,
          },
        ],
      });
      const result = service.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'teachingAssignments[assign-bad].subjectId',
          }),
        ]),
      );
    });

    it('should report error when periodsPerWeek is zero', () => {
      const input = createValidInput({
        teachingAssignments: [
          {
            id: 'assign-bad',
            teacherId: 'teacher-1',
            classId: 'class-1',
            subjectId: 'subject-1',
            periodsPerWeek: 0,
          },
        ],
      });
      const result = service.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'teachingAssignments[assign-bad].periodsPerWeek',
          }),
        ]),
      );
    });

    it('should report error when periodsPerWeek is negative', () => {
      const input = createValidInput({
        teachingAssignments: [
          {
            id: 'assign-bad',
            teacherId: 'teacher-1',
            classId: 'class-1',
            subjectId: 'subject-1',
            periodsPerWeek: -2,
          },
        ],
      });
      const result = service.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'teachingAssignments[assign-bad].periodsPerWeek',
          }),
        ]),
      );
    });

    it('should report error when teacherAvailability references non-existent teacher', () => {
      const availability: TeacherAvailabilityDto[] = [
        {
          teacherId: 'non-existent-teacher',
          unavailableSlots: [{ dayOfWeek: 0, periodId: 'period-1' }],
        },
      ];
      const input = createValidInput({ teacherAvailability: availability });
      const result = service.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'teacherAvailability[non-existent-teacher].teacherId',
          }),
        ]),
      );
    });

    it('should report error when roomConstraint references non-existent room', () => {
      const constraints: RoomConstraintDto[] = [
        { subjectId: 'subject-1', roomId: 'non-existent-room', weight: 100 },
      ];
      const input = createValidInput({ roomConstraints: constraints });
      const result = service.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'roomConstraints[subject-1].roomId',
          }),
        ]),
      );
    });

    it('should report error when roomConstraint references non-existent subject', () => {
      const constraints: RoomConstraintDto[] = [
        { subjectId: 'non-existent-subject', roomId: 'room-1', weight: 100 },
      ];
      const input = createValidInput({ roomConstraints: constraints });
      const result = service.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'roomConstraints[non-existent-subject].subjectId',
          }),
        ]),
      );
    });

    it('should report multiple errors for multiple invalid fields', () => {
      const input = createValidInput({
        teachers: [],
        classes: [],
        days: [],
      });
      const result = service.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ─── export() Tests ───────────────────────────────────────────────────

  describe('export()', () => {
    it('should throw GenerationValidationException for invalid input', () => {
      const input = createValidInput({ teachers: [] });

      expect(() => service.export(input)).toThrow(
        GenerationValidationException,
      );
    });

    it('should produce valid XML with correct header', () => {
      const input = createValidInput();
      const result = service.export(input);

      expect(result.xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result.xml).toContain('<fet');
      expect(result.xml).toContain('version="6.2.7"');
    });

    it('should include institution name in XML', () => {
      const input = createValidInput();
      const result = service.export(input);

      expect(result.xml).toContain(
        '<Institution_Name>Trường THCS Nguyễn Bỉnh Khiêm</Institution_Name>',
      );
    });

    it('should include comments in XML', () => {
      const input = createValidInput();
      const result = service.export(input);

      expect(result.xml).toContain('<Comments>Generated by NBK_EMS</Comments>');
    });

    it('should include days list with correct count', () => {
      const input = createValidInput();
      const result = service.export(input);

      expect(result.xml).toContain('<Number_of_Days>5</Number_of_Days>');
      expect(result.xml).toContain('<Name>Thứ 2</Name>');
      expect(result.xml).toContain('<Name>Thứ 6</Name>');
    });

    it('should include hours list with correct count', () => {
      const input = createValidInput();
      const result = service.export(input);

      expect(result.xml).toContain('<Number_of_Hours>5</Number_of_Hours>');
      expect(result.xml).toContain('<Name>Tiết 1</Name>');
      expect(result.xml).toContain('<Name>Tiết 5</Name>');
    });

    it('should include teachers list', () => {
      const input = createValidInput();
      const result = service.export(input);

      expect(result.xml).toContain('<Teachers_List>');
      expect(result.xml).toContain('<Name>Nguyễn Văn A</Name>');
      expect(result.xml).toContain('<Name>Trần Thị B</Name>');
    });

    it('should include subjects list', () => {
      const input = createValidInput();
      const result = service.export(input);

      expect(result.xml).toContain('<Subjects_List>');
      expect(result.xml).toContain('<Name>Toán</Name>');
      expect(result.xml).toContain('<Name>Văn</Name>');
    });

    it('should include students list grouped by grade', () => {
      const input = createValidInput();
      const result = service.export(input);

      expect(result.xml).toContain('<Students_List>');
      expect(result.xml).toContain('<Name>grade-6</Name>');
      expect(result.xml).toContain('<Name>6A1</Name>');
      expect(result.xml).toContain('<Name>6A2</Name>');
    });

    it('should include activities with correct structure', () => {
      const input = createValidInput();
      const result = service.export(input);

      expect(result.xml).toContain('<Activities_List>');
      expect(result.xml).toContain('<Id>1</Id>');
      expect(result.xml).toContain('<Teacher>Nguyễn Văn A</Teacher>');
      expect(result.xml).toContain('<Subject>Toán</Subject>');
      expect(result.xml).toContain('<Students>6A1</Students>');
      expect(result.xml).toContain('<Duration>1</Duration>');
      expect(result.xml).toContain('<Total_Duration>4</Total_Duration>');
      expect(result.xml).toContain('<Active>true</Active>');
    });

    it('should include rooms list', () => {
      const input = createValidInput();
      const result = service.export(input);

      expect(result.xml).toContain('<Rooms_List>');
      expect(result.xml).toContain('<Name>Phòng 101</Name>');
      expect(result.xml).toContain('<Capacity>40</Capacity>');
    });

    it('should generate sequential activity IDs starting from 1', () => {
      const input = createValidInput();
      const result = service.export(input);

      expect(result.xml).toContain('<Id>1</Id>');
      expect(result.xml).toContain('<Id>2</Id>');
    });

    it('should build correct activityMap with one entry per assignment', () => {
      const input = createValidInput();
      const result = service.export(input);

      expect(result.activityMap.size).toBe(2);

      const activity1 = result.activityMap.get('1');
      expect(activity1).toEqual({
        teachingAssignmentId: 'assign-1',
        teacherId: 'teacher-1',
        classId: 'class-1',
        subjectId: 'subject-1',
        duration: 1,
      });

      const activity2 = result.activityMap.get('2');
      expect(activity2).toEqual({
        teachingAssignmentId: 'assign-2',
        teacherId: 'teacher-2',
        classId: 'class-2',
        subjectId: 'subject-2',
        duration: 1,
      });
    });

    it('should produce deterministic output (same input → same XML)', () => {
      const input = createValidInput();
      const result1 = service.export(input);
      const result2 = service.export(input);

      expect(result1.xml).toBe(result2.xml);
    });

    it('should include teacher max hours daily constraint', () => {
      const input = createValidInput();
      const result = service.export(input);

      expect(result.xml).toContain('<ConstraintTeacherMaxHoursDaily>');
      expect(result.xml).toContain(
        '<Maximum_Hours_Daily>6</Maximum_Hours_Daily>',
      );
      expect(result.xml).toContain(
        '<Maximum_Hours_Daily>5</Maximum_Hours_Daily>',
      );
    });

    it('should include teacher not available constraints', () => {
      const availability: TeacherAvailabilityDto[] = [
        {
          teacherId: 'teacher-1',
          unavailableSlots: [
            { dayOfWeek: 0, periodId: 'period-1' },
            { dayOfWeek: 2, periodId: 'period-3' },
          ],
        },
      ];
      const input = createValidInput({ teacherAvailability: availability });
      const result = service.export(input);

      expect(result.xml).toContain('<ConstraintTeacherNotAvailableTimes>');
      expect(result.xml).toContain('<Teacher>Nguyễn Văn A</Teacher>');
      expect(result.xml).toContain(
        '<Number_of_Not_Available_Times>2</Number_of_Not_Available_Times>',
      );
      expect(result.xml).toContain('<Day>Thứ 2</Day>');
      expect(result.xml).toContain('<Hour>Tiết 1</Hour>');
      expect(result.xml).toContain('<Day>Thứ 4</Day>');
      expect(result.xml).toContain('<Hour>Tiết 3</Hour>');
    });

    it('should include space constraints for room-subject mappings', () => {
      const constraints: RoomConstraintDto[] = [
        { subjectId: 'subject-1', roomId: 'room-1', weight: 100 },
      ];
      const input = createValidInput({ roomConstraints: constraints });
      const result = service.export(input);

      expect(result.xml).toContain('<ConstraintActivityPreferredRoom>');
      expect(result.xml).toContain(
        '<Weight_Percentage>100</Weight_Percentage>',
      );
      expect(result.xml).toContain('<Activity_Id>1</Activity_Id>');
      expect(result.xml).toContain('<Room>Phòng 101</Room>');
    });

    it('should handle input with no rooms gracefully', () => {
      const input = createValidInput({ rooms: [], roomConstraints: [] });
      const result = service.export(input);

      expect(result.xml).toBeDefined();
      expect(result.xml).not.toContain('<Room>');
    });

    it('should handle input with no teacher availability', () => {
      const input = createValidInput({ teacherAvailability: [] });
      const result = service.export(input);

      expect(result.xml).toBeDefined();
      // Should still have time constraints for maxPeriodsPerDay
      expect(result.xml).toContain('<ConstraintTeacherMaxHoursDaily>');
    });
  });
});
