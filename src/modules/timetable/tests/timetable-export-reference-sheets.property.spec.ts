/**
 * Feature: timetable-management-features, Property 6: Export reference sheets contain all unique entities
 *
 * **Validates: Requirements 2.3, 2.4**
 *
 * Property: For any export result, the "Mã môn học" sheet SHALL contain all unique subjects
 * appearing in the TKB slots, and the "Mã giáo viên" sheet SHALL contain all unique teachers,
 * with no duplicates and no missing entries.
 */
import * as fc from 'fast-check';
import * as ExcelJS from 'exceljs';
import { DataSource } from 'typeorm';
import { TimetableExportService } from '../services/timetable-export.service';
import { TimetableSlotRepository } from '../repositories/timetable-slot.repository';
import { TimetableVersionRepository } from '../repositories/timetable-version.repository';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { TimetableVersionStatus } from '../../../common/enums/status.enum';

// --- Interfaces for generated data ---

interface GeneratedSubject {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
}

interface GeneratedTeacher {
  id: string;
  employeeCode: string;
  fullName: string;
  shortName: string | null;
}

interface GeneratedSlot {
  subjectId: string;
  teacherId: string;
  classId: string;
  dayOfWeek: number;
  periodNumber: number;
}

// --- Generators ---

const arbUuid = fc.uuid().map((u) => u as string);

const alphanumChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const arbCode: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...alphanumChars.split('')), {
    minLength: 2,
    maxLength: 8,
  })
  .map((chars) => chars.join(''));

const nameChars = 'abcdefghijklmnopqrstuvwxyz AEIOU';
const arbName: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...nameChars.split('')), {
    minLength: 3,
    maxLength: 25,
  })
  .map((chars) => chars.join(''));

const arbShortName: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...nameChars.split('')), {
    minLength: 2,
    maxLength: 15,
  })
  .map((chars) => chars.join(''));

const arbSubject: fc.Arbitrary<GeneratedSubject> = fc.record({
  id: arbUuid,
  code: arbCode,
  name: arbName,
  shortName: fc.option(arbCode, { nil: null }),
});

const arbTeacher: fc.Arbitrary<GeneratedTeacher> = fc.record({
  id: arbUuid,
  employeeCode: arbCode,
  fullName: arbName,
  shortName: fc.option(arbShortName, { nil: null }),
});

const arbDayOfWeek = fc.integer({ min: 2, max: 7 });
const arbPeriodNumber = fc.integer({ min: 1, max: 10 });

/**
 * Generator that produces a coherent set: unique subjects, unique teachers,
 * and slots referencing those entities.
 */
const arbSlotData = fc
  .tuple(
    fc.array(arbSubject, { minLength: 1, maxLength: 10 }),
    fc.array(arbTeacher, { minLength: 1, maxLength: 10 }),
  )
  .chain(([subjects, teachers]) => {
    // Ensure subjects have unique IDs
    const uniqueSubjects = subjects.reduce<GeneratedSubject[]>((acc, s) => {
      if (!acc.find((x) => x.id === s.id)) acc.push(s);
      return acc;
    }, []);
    // Ensure teachers have unique IDs
    const uniqueTeachers = teachers.reduce<GeneratedTeacher[]>((acc, t) => {
      if (!acc.find((x) => x.id === t.id)) acc.push(t);
      return acc;
    }, []);

    // Generate slots referencing these entities
    const slotArb: fc.Arbitrary<GeneratedSlot> = fc.record({
      subjectId: fc.constantFrom(...uniqueSubjects.map((s) => s.id)),
      teacherId: fc.constantFrom(...uniqueTeachers.map((t) => t.id)),
      classId: arbUuid,
      dayOfWeek: arbDayOfWeek,
      periodNumber: arbPeriodNumber,
    });

    return fc.array(slotArb, { minLength: 1, maxLength: 30 }).map((slots) => ({
      subjects: uniqueSubjects,
      teachers: uniqueTeachers,
      slots,
    }));
  });

// --- Helper: Build mock TimetableSlotEntity[] from generated data ---

function buildMockSlots(data: {
  subjects: GeneratedSubject[];
  teachers: GeneratedTeacher[];
  slots: GeneratedSlot[];
}): TimetableSlotEntity[] {
  const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));
  const teacherMap = new Map(data.teachers.map((t) => [t.id, t]));

  return data.slots.map((slot, idx) => {
    const subject = subjectMap.get(slot.subjectId)!;
    const teacher = teacherMap.get(slot.teacherId)!;

    return {
      id: `slot-${idx}`,
      versionId: 'version-1',
      dayOfWeek: slot.dayOfWeek,
      periodId: `period-${slot.periodNumber}`,
      classId: slot.classId,
      teacherId: slot.teacherId,
      subjectId: slot.subjectId,
      roomId: null,
      isDoublePeriod: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      period: {
        id: `period-${slot.periodNumber}`,
        periodNumber: slot.periodNumber,
      },
      class: { id: slot.classId, name: `Class-${idx}`, gradeId: 'grade-1' },
      teacher: {
        id: teacher.id,
        employeeCode: teacher.employeeCode,
        fullName: teacher.fullName,
        shortName: teacher.shortName,
      },
      subject: {
        id: subject.id,
        code: subject.code,
        name: subject.name,
        shortName: subject.shortName,
      },
      room: null,
      version: null,
    } as unknown as TimetableSlotEntity;
  });
}

// --- Helper: Parse Excel buffer and extract reference sheets ---

async function parseReferenceSheets(buffer: Buffer): Promise<{
  subjectRows: Array<{ stt: number; code: string; name: string }>;
  teacherRows: Array<{
    stt: number;
    code: string;
    fullName: string;
    shortName: string;
  }>;
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  // Parse "Mã môn học" sheet
  const subjectSheet = workbook.getWorksheet('Mã môn học');
  const subjectRows: Array<{ stt: number; code: string; name: string }> = [];
  if (subjectSheet) {
    subjectSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const stt = row.getCell(1).value as number;
      const code = String(row.getCell(2).value || '');
      const name = String(row.getCell(3).value || '');
      if (stt && code) {
        subjectRows.push({ stt, code, name });
      }
    });
  }

  // Parse "Mã giáo viên" sheet
  const teacherSheet = workbook.getWorksheet('Mã giáo viên');
  const teacherRows: Array<{
    stt: number;
    code: string;
    fullName: string;
    shortName: string;
  }> = [];
  if (teacherSheet) {
    teacherSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const stt = row.getCell(1).value as number;
      const code = String(row.getCell(2).value || '');
      const fullName = String(row.getCell(3).value || '');
      const shortName = String(row.getCell(4).value || '');
      if (stt && code) {
        teacherRows.push({ stt, code, fullName, shortName });
      }
    });
  }

  return { subjectRows, teacherRows };
}

describe('Property 6: Export reference sheets contain all unique entities', () => {
  let service: TimetableExportService;
  let mockSlotRepo: { findByVersion: jest.Mock };
  let mockVersionRepo: { findById: jest.Mock };
  let mockDataSource: Partial<DataSource>;

  beforeEach(() => {
    mockSlotRepo = {
      findByVersion: jest.fn(),
    };

    mockVersionRepo = {
      findById: jest.fn(),
    };

    // Mock DataSource.getRepository to return mock repositories for Grade, Class, Semester, School
    const mockGradeRepo = {
      find: jest
        .fn()
        .mockResolvedValue([
          { id: 'grade-1', name: 'Khối 10', level: 10, schoolId: 'school-1' },
        ]),
      findOne: jest.fn().mockResolvedValue(null),
    };

    const mockClassRepo = {
      find: jest
        .fn()
        .mockResolvedValue([
          { id: 'class-1', name: '10A1', gradeId: 'grade-1' },
        ]),
    };

    const mockSemesterRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'semester-1',
        semesterNumber: 1,
        academicYear: { id: 'ay-1', name: '2024-2025', schoolId: 'school-1' },
      }),
    };

    const mockSchoolRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'school-1',
        name: 'Trường Test',
      }),
    };

    mockDataSource = {
      getRepository: jest.fn().mockImplementation((entity: unknown) => {
        const entityName = (entity as { name?: string })?.name || '';
        if (entityName.includes('Grade')) return mockGradeRepo;
        if (entityName.includes('Class')) return mockClassRepo;
        if (entityName.includes('Semester')) return mockSemesterRepo;
        if (entityName.includes('School')) return mockSchoolRepo;
        return {};
      }),
    };

    service = new TimetableExportService(
      mockDataSource as unknown as DataSource,
      mockSlotRepo as unknown as TimetableSlotRepository,
      mockVersionRepo as unknown as TimetableVersionRepository,
    );
  });

  /**
   * **Validates: Requirements 2.3, 2.4**
   *
   * For any set of TKB slots with multiple subjects and teachers,
   * the "Mã môn học" sheet must contain ALL unique subjects (no missing, no duplicates),
   * and the "Mã giáo viên" sheet must contain ALL unique teachers (no missing, no duplicates).
   */
  it('should contain all unique subjects and teachers in reference sheets with no duplicates and no missing entries', async () => {
    await fc.assert(
      fc.asyncProperty(arbSlotData, async (data) => {
        const mockSlots = buildMockSlots(data);

        // Setup mocks
        mockVersionRepo.findById.mockResolvedValue({
          id: 'version-1',
          name: 'Test Version',
          versionNumber: 1,
          status: TimetableVersionStatus.DRAFT,
          semesterId: 'semester-1',
        } as Partial<TimetableVersionEntity>);

        mockSlotRepo.findByVersion.mockResolvedValue(mockSlots);

        // Execute export
        const result = await service.exportToExcel({ versionId: 'version-1' });

        // Parse reference sheets
        const { subjectRows, teacherRows } = await parseReferenceSheets(
          result.buffer,
        );

        // Determine expected unique subjects from slots
        const expectedSubjectIds = new Set(data.slots.map((s) => s.subjectId));
        const expectedSubjects = data.subjects.filter((s) =>
          expectedSubjectIds.has(s.id),
        );

        // Determine expected unique teachers from slots
        const expectedTeacherIds = new Set(data.slots.map((s) => s.teacherId));
        const expectedTeachers = data.teachers.filter((t) =>
          expectedTeacherIds.has(t.id),
        );

        // PROPERTY 1: Count verification — unique subjects in slots = rows in "Mã môn học"
        expect(subjectRows.length).toBe(expectedSubjects.length);

        // PROPERTY 2: Count verification — unique teachers in slots = rows in "Mã giáo viên"
        expect(teacherRows.length).toBe(expectedTeachers.length);

        // PROPERTY 3: No missing subjects — every unique subject code appears in the sheet
        const subjectCodesInSheet = new Set(subjectRows.map((r) => r.code));
        for (const subject of expectedSubjects) {
          expect(subjectCodesInSheet.has(subject.code)).toBe(true);
        }

        // PROPERTY 4: No missing teachers — every unique teacher code appears in the sheet
        const teacherCodesInSheet = new Set(teacherRows.map((r) => r.code));
        for (const teacher of expectedTeachers) {
          expect(teacherCodesInSheet.has(teacher.employeeCode)).toBe(true);
        }

        // PROPERTY 5: No duplicate subjects (STT should be sequential 1..N)
        const subjectStts = subjectRows.map((r) => r.stt);
        const expectedSubjectStts = Array.from(
          { length: expectedSubjects.length },
          (_, i) => i + 1,
        );
        expect(subjectStts).toEqual(expectedSubjectStts);

        // PROPERTY 6: No duplicate teachers (STT should be sequential 1..N)
        const teacherStts = teacherRows.map((r) => r.stt);
        const expectedTeacherStts = Array.from(
          { length: expectedTeachers.length },
          (_, i) => i + 1,
        );
        expect(teacherStts).toEqual(expectedTeacherStts);
      }),
      { numRuns: 100 },
    );
  }, 60000);

  /**
   * **Validates: Requirements 2.3, 2.4**
   *
   * When slots share the same subject or teacher (duplicates in slots),
   * the reference sheets should still contain only unique entries.
   */
  it('should deduplicate subjects and teachers even when multiple slots reference the same entity', async () => {
    // Generator that guarantees duplicate references in slots
    const arbDuplicateSlotData = fc
      .tuple(
        fc.array(arbSubject, { minLength: 1, maxLength: 5 }),
        fc.array(arbTeacher, { minLength: 1, maxLength: 5 }),
      )
      .chain(([subjects, teachers]) => {
        const uniqueSubjects = subjects.reduce<GeneratedSubject[]>((acc, s) => {
          if (!acc.find((x) => x.id === s.id)) acc.push(s);
          return acc;
        }, []);
        const uniqueTeachers = teachers.reduce<GeneratedTeacher[]>((acc, t) => {
          if (!acc.find((x) => x.id === t.id)) acc.push(t);
          return acc;
        }, []);

        // Force more slots than entities to guarantee duplicates
        const slotCount = Math.max(
          (uniqueSubjects.length + uniqueTeachers.length) * 2,
          5,
        );

        const slotArb: fc.Arbitrary<GeneratedSlot> = fc.record({
          subjectId: fc.constantFrom(...uniqueSubjects.map((s) => s.id)),
          teacherId: fc.constantFrom(...uniqueTeachers.map((t) => t.id)),
          classId: arbUuid,
          dayOfWeek: arbDayOfWeek,
          periodNumber: arbPeriodNumber,
        });

        return fc
          .array(slotArb, { minLength: slotCount, maxLength: slotCount + 10 })
          .map((slots) => ({
            subjects: uniqueSubjects,
            teachers: uniqueTeachers,
            slots,
          }));
      });

    await fc.assert(
      fc.asyncProperty(arbDuplicateSlotData, async (data) => {
        const mockSlots = buildMockSlots(data);

        mockVersionRepo.findById.mockResolvedValue({
          id: 'version-1',
          name: 'Test Version',
          versionNumber: 1,
          status: TimetableVersionStatus.DRAFT,
          semesterId: 'semester-1',
        } as Partial<TimetableVersionEntity>);

        mockSlotRepo.findByVersion.mockResolvedValue(mockSlots);

        const result = await service.exportToExcel({ versionId: 'version-1' });
        const { subjectRows, teacherRows } = await parseReferenceSheets(
          result.buffer,
        );

        // Unique subject IDs referenced in slots
        const uniqueSubjectIds = new Set(data.slots.map((s) => s.subjectId));
        const uniqueTeacherIds = new Set(data.slots.map((s) => s.teacherId));

        // Even though slots have many duplicate references, reference sheets
        // should only have unique entries
        expect(subjectRows.length).toBe(uniqueSubjectIds.size);
        expect(teacherRows.length).toBe(uniqueTeacherIds.size);

        // Verify no duplicate codes in subject sheet
        const subjectCodes = subjectRows.map((r) => r.code);
        expect(new Set(subjectCodes).size).toBe(subjectCodes.length);

        // Verify no duplicate codes in teacher sheet
        const teacherCodes = teacherRows.map((r) => r.code);
        expect(new Set(teacherCodes).size).toBe(teacherCodes.length);
      }),
      { numRuns: 100 },
    );
  }, 60000);
});
