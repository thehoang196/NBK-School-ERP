/**
 * Feature: timetable-management-features, Property 5: Export data completeness
 *
 * Validates: Requirements 2.1, 2.2
 *
 * Property: For any TimetableVersion with slots, exporting to Excel SHALL produce a workbook
 * where every slot in the version appears exactly once in the correct cell (grade sheet,
 * row = day+period, column = class) with correct subject code and teacher name.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as fc from 'fast-check';
import * as ExcelJS from 'exceljs';
import { TimetableExportService } from '../services/timetable-export.service';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import { TimetableVersionRepository } from '../repositories/timetable-version.repository';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { ClassEntity } from '../../class/entities/class.entity';
import { GradeEntity } from '../../class/entities/grade.entity';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { SubjectEntity } from '../../subject/entities/subject.entity';
import { PeriodDefinitionEntity } from '../../academic/entities/period-definition.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { SemesterEntity } from '../../academic/entities/semester.entity';
import { TimetableStatus } from '../../../common/enums/status.enum';

// --- Generators ---

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Generate a unique set of (dayOfWeek, periodNumber, classIndex) tuples - no duplicates */
const slotKeyArb = (classCount: number, maxPeriod: number) =>
  fc.tuple(
    fc.integer({ min: 2, max: 7 }),        // dayOfWeek
    fc.integer({ min: 1, max: maxPeriod }), // periodNumber
    fc.integer({ min: 0, max: classCount - 1 }), // classIndex
  );

interface GeneratedTestData {
  grade: GradeEntity;
  classes: ClassEntity[];
  teachers: TeacherEntity[];
  subjects: SubjectEntity[];
  periods: PeriodDefinitionEntity[];
  slots: TimetableSlotEntity[];
  version: TimetableVersionEntity;
  semester: SemesterEntity;
  school: SchoolEntity;
}

/**
 * Arbitrary that generates a complete set of test data:
 * - 1 grade with 1-4 classes
 * - 1-5 teachers, 1-5 subjects
 * - Up to 8 periods
 * - 1-20 unique slots (unique by classId + dayOfWeek + periodNumber)
 */
const testDataArb: fc.Arbitrary<GeneratedTestData> = fc
  .tuple(
    fc.integer({ min: 1, max: 4 }),  // classCount
    fc.integer({ min: 1, max: 5 }),  // teacherCount
    fc.integer({ min: 1, max: 5 }),  // subjectCount
    fc.integer({ min: 2, max: 8 }),  // maxPeriods
    fc.integer({ min: 1, max: 20 }), // slotCount
  )
  .chain(([classCount, teacherCount, subjectCount, maxPeriods, slotCount]) => {
    // Generate unique slot keys (no duplicates in classIndex+day+period)
    const maxPossibleSlots = classCount * 6 * maxPeriods; // 6 days, maxPeriods periods
    const actualSlotCount = Math.min(slotCount, maxPossibleSlots);

    return fc
      .uniqueArray(slotKeyArb(classCount, maxPeriods), {
        minLength: Math.min(actualSlotCount, maxPossibleSlots),
        maxLength: Math.min(actualSlotCount, maxPossibleSlots),
        comparator: (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2],
      })
      .map((slotKeys) => {
        const schoolId = uuid();
        const gradeId = uuid();
        const semesterId = uuid();
        const versionId = uuid();
        const academicYearId = uuid();

        const school = {
          id: schoolId,
          name: 'Test School',
        } as SchoolEntity;

        const grade: GradeEntity = {
          id: gradeId,
          schoolId,
          name: 'Khối 10',
          level: 10,
        } as GradeEntity;

        const classes: ClassEntity[] = Array.from({ length: classCount }, (_, i) => ({
          id: uuid(),
          schoolId,
          gradeId,
          name: `10A${i + 1}`,
          academicYearId,
          homeroomTeacherId: null,
          studentCount: 30,
          status: 'active',
        })) as unknown as ClassEntity[];

        const teachers: TeacherEntity[] = Array.from({ length: teacherCount }, (_, i) => ({
          id: uuid(),
          schoolId,
          employeeCode: `GV${String(i + 1).padStart(3, '0')}`,
          fullName: `Nguyen Van ${String.fromCharCode(65 + i)}`,
          shortName: `${String.fromCharCode(65 + i)} N.V`,
        })) as unknown as TeacherEntity[];

        const subjects: SubjectEntity[] = Array.from({ length: subjectCount }, (_, i) => ({
          id: uuid(),
          schoolId,
          code: `MON${String(i + 1).padStart(2, '0')}`,
          name: `Mon hoc ${i + 1}`,
          shortName: `MH${i + 1}`,
        })) as unknown as SubjectEntity[];

        const periods: PeriodDefinitionEntity[] = Array.from({ length: maxPeriods }, (_, i) => ({
          id: uuid(),
          schoolId,
          periodNumber: i + 1,
          startTime: `0${7 + i}:00`,
          endTime: `0${7 + i}:45`,
          isBreak: false,
          isExtra: false,
        })) as unknown as PeriodDefinitionEntity[];

        const semester = {
          id: semesterId,
          semesterNumber: 1,
          academicYear: { id: academicYearId, schoolId, name: '2024-2025' },
        } as unknown as SemesterEntity;

        const version: TimetableVersionEntity = {
          id: versionId,
          schoolId,
          semesterId,
          name: 'Test Version',
          versionNumber: 1,
          status: TimetableStatus.DRAFT,
          effectiveDate: null,
          publishedAt: null,
          publishedBy: null,
          note: null,
        } as unknown as TimetableVersionEntity;

        // Build slots from unique keys
        const slots: TimetableSlotEntity[] = slotKeys.map(([dayOfWeek, periodNum, classIdx]) => {
          const teacherIdx = Math.floor(Math.random() * teacherCount);
          const subjectIdx = Math.floor(Math.random() * subjectCount);
          const period = periods[periodNum - 1];
          const cls = classes[classIdx];
          const teacher = teachers[teacherIdx];
          const subject = subjects[subjectIdx];

          return {
            id: uuid(),
            versionId,
            dayOfWeek,
            periodId: period.id,
            period,
            classId: cls.id,
            class: cls,
            teacherId: teacher.id,
            teacher,
            subjectId: subject.id,
            subject,
            roomId: null,
            room: null,
            isDoublePeriod: false,
            deletedAt: null,
          } as unknown as TimetableSlotEntity;
        });

        return {
          grade,
          classes,
          teachers,
          subjects,
          periods,
          slots,
          version,
          semester,
          school,
        };
      });
  });

describe('Property 5: Export data completeness', () => {
  let service: TimetableExportService;
  let mockSlotRepo: Partial<TimetableSlotRepository>;
  let mockVersionRepo: Partial<TimetableVersionRepository>;
  let mockDataSource: Partial<DataSource>;

  /**
   * Setup the service with mocks that will be configured per-test-run.
   */
  beforeAll(async () => {
    mockSlotRepo = {
      findByVersion: jest.fn(),
    };

    mockVersionRepo = {
      findById: jest.fn(),
    };

    mockDataSource = {
      getRepository: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableExportService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: TimetableSlotRepository, useValue: mockSlotRepo },
        { provide: TimetableVersionRepository, useValue: mockVersionRepo },
      ],
    }).compile();

    service = module.get<TimetableExportService>(TimetableExportService);
  });

  /**
   * Helper: configure mocks for a specific test data set
   */
  function configureMocks(data: GeneratedTestData): void {
    (mockVersionRepo.findById as jest.Mock).mockResolvedValue(data.version);
    (mockSlotRepo.findByVersion as jest.Mock).mockResolvedValue(data.slots);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockRepos: Record<string, Record<string, jest.Mock>> = {};

    // SemesterEntity repo
    mockRepos['SemesterEntity'] = {
      findOne: jest.fn().mockResolvedValue(data.semester),
    };

    // GradeEntity repo
    mockRepos['GradeEntity'] = {
      findOne: jest.fn().mockResolvedValue(data.grade),
      find: jest.fn().mockResolvedValue([data.grade]),
    };

    // ClassEntity repo
    mockRepos['ClassEntity'] = {
      find: jest.fn().mockResolvedValue(data.classes),
    };

    // SchoolEntity repo
    mockRepos['SchoolEntity'] = {
      findOne: jest.fn().mockResolvedValue(data.school),
    };

    (mockDataSource.getRepository as jest.Mock).mockImplementation((entity: unknown) => {
      const entityName = (entity as { name: string }).name;
      return mockRepos[entityName] || { find: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null) };
    });
  }

  /**
   * Helper: parse Excel buffer and extract slot data from grade sheet
   */
  async function parseExcelSlots(
    buffer: Buffer,
    data: GeneratedTestData,
  ): Promise<Map<string, { subjectDisplay: string; teacherDisplay: string }>> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const sheetName = `Khối ${data.grade.level}`;
    const sheet = workbook.getWorksheet(sheetName);

    if (!sheet) {
      return new Map();
    }

    // The grade sheet structure:
    // Row 1: school name header
    // Row 2: TKB title
    // Row 3: class names header (Thứ, Tiết, Class1, Class2, ...)
    // Row 4: sub-header (empty, empty, Môn, GV, Môn, GV, ...)
    // Row 5+: data rows (day, period, subject/teacher pairs per class)

    const classCount = data.classes.length;
    const dataStartRow = 5; // After headers

    // Build a map of extracted cell data: key = "classId-dayOfWeek-periodNumber"
    const extractedSlots = new Map<string, { subjectDisplay: string; teacherDisplay: string }>();

    // Calculate maxPeriods the same way the export service does:
    // uses max period number from actual slots in this grade
    const classIds = data.classes.map((c) => c.id);
    const gradeSlots = data.slots.filter((s) => classIds.includes(s.classId));
    const periodNumbers = [...new Set(gradeSlots.map((s) => s.period?.periodNumber || 0))].sort(
      (a, b) => a - b,
    );
    const maxPeriod = periodNumbers.length > 0 ? Math.max(...periodNumbers) : 8;
    const DAYS = [2, 3, 4, 5, 6, 7];

    for (let dayIdx = 0; dayIdx < DAYS.length; dayIdx++) {
      const day = DAYS[dayIdx];
      for (let period = 1; period <= maxPeriod; period++) {
        const rowNum = dataStartRow + dayIdx * maxPeriod + (period - 1);

        for (let classIdx = 0; classIdx < classCount; classIdx++) {
          const subjectCol = 3 + classIdx * 2;
          const teacherCol = 4 + classIdx * 2;

          const subjectCell = sheet.getCell(rowNum, subjectCol);
          const teacherCell = sheet.getCell(rowNum, teacherCol);

          const subjectValue = subjectCell.value?.toString()?.trim() || '';
          const teacherValue = teacherCell.value?.toString()?.trim() || '';

          if (subjectValue || teacherValue) {
            const classId = data.classes[classIdx].id;
            const key = `${classId}-${day}-${period}`;
            extractedSlots.set(key, {
              subjectDisplay: subjectValue,
              teacherDisplay: teacherValue,
            });
          }
        }
      }
    }

    return extractedSlots;
  }

  /**
   * **Validates: Requirements 2.1, 2.2**
   *
   * For any random set of timetable slots, exporting to Excel and parsing back
   * should produce exactly the same number of non-empty cells as input slots,
   * and each slot should appear at the correct position.
   */
  it('should export every slot exactly once at the correct position in the Excel', async () => {
    await fc.assert(
      fc.asyncProperty(testDataArb, async (data: GeneratedTestData) => {
        configureMocks(data);

        const result = await service.exportToExcel({ versionId: data.version.id });
        const extractedSlots = await parseExcelSlots(result.buffer, data);

        // Every input slot should appear in the extracted output
        for (const slot of data.slots) {
          const periodNum = slot.period.periodNumber;
          const key = `${slot.classId}-${slot.dayOfWeek}-${periodNum}`;

          const extracted = extractedSlots.get(key);

          // Slot must exist in the output
          expect(extracted).toBeDefined();

          if (extracted) {
            // Verify subject display matches
            const expectedSubject = slot.subject?.shortName || slot.subject?.code || slot.subject?.name || '';
            expect(extracted.subjectDisplay).toBe(expectedSubject);

            // Verify teacher display matches
            const expectedTeacher = slot.teacher?.shortName || slot.teacher?.fullName || '';
            expect(extracted.teacherDisplay).toBe(expectedTeacher);
          }
        }

        // The number of extracted non-empty cells should equal input slot count
        expect(extractedSlots.size).toBe(data.slots.length);
      }),
      { numRuns: 100 },
    );
  }, 120000);

  /**
   * **Validates: Requirements 2.1, 2.2**
   *
   * Each slot appears exactly once — no duplicates in the export.
   * We verify by counting total non-empty cells equals total slots.
   */
  it('should not produce duplicate slot entries in the export', async () => {
    await fc.assert(
      fc.asyncProperty(testDataArb, async (data: GeneratedTestData) => {
        configureMocks(data);

        const result = await service.exportToExcel({ versionId: data.version.id });
        const extractedSlots = await parseExcelSlots(result.buffer, data);

        // Total extracted cells must equal total input slots (no duplicates, no missing)
        expect(extractedSlots.size).toBe(data.slots.length);

        // Verify each key from input is unique (already guaranteed by generator,
        // but double-check the output doesn't merge or duplicate)
        const inputKeys = new Set(
          data.slots.map((s) => `${s.classId}-${s.dayOfWeek}-${s.period.periodNumber}`),
        );
        expect(inputKeys.size).toBe(data.slots.length);
        expect(extractedSlots.size).toBe(inputKeys.size);
      }),
      { numRuns: 100 },
    );
  }, 120000);

  /**
   * **Validates: Requirements 2.1, 2.2**
   *
   * For any slot, it must be placed in the correct grade sheet (sheet name matches grade level).
   */
  it('should place all slots in the correct grade sheet', async () => {
    await fc.assert(
      fc.asyncProperty(testDataArb, async (data: GeneratedTestData) => {
        configureMocks(data);

        const result = await service.exportToExcel({ versionId: data.version.id });

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(result.buffer as unknown as ArrayBuffer);

        // The grade sheet must exist
        const expectedSheetName = `Khối ${data.grade.level}`;
        const sheet = workbook.getWorksheet(expectedSheetName);
        expect(sheet).toBeDefined();
      }),
      { numRuns: 100 },
    );
  }, 120000);
});
