import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import { TimetableImportService } from './timetable-import.service';
import { TimetableVersionRepository } from '../repositories/timetable-version.repository';
import { TimetableVersionEntity } from '../entities/timetable-version.entity';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { SubjectEntity } from '../../subject/entities/subject.entity';
import { ClassEntity } from '../../class/entities/class.entity';
import { PeriodDefinitionEntity } from '../../academic/entities/period-definition.entity';
import { RoomEntity } from '../../room/entities/room.entity';
import {
  ParsedTimetableRow,
  ImportTimetableOptions,
} from '../interfaces/timetable-import.interface';

describe('TimetableImportService - generateTemplate', () => {
  let service: TimetableImportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableImportService,
        { provide: DataSource, useValue: {} },
        { provide: TimetableVersionRepository, useValue: {} },
        { provide: getRepositoryToken(TeacherEntity), useValue: {} },
        { provide: getRepositoryToken(SubjectEntity), useValue: {} },
        { provide: getRepositoryToken(ClassEntity), useValue: {} },
        { provide: getRepositoryToken(PeriodDefinitionEntity), useValue: {} },
        { provide: getRepositoryToken(RoomEntity), useValue: {} },
      ],
    }).compile();

    service = module.get<TimetableImportService>(TimetableImportService);
  });

  it('should return a Buffer', async () => {
    const result = await service.generateTemplate();
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('should create a valid Excel workbook with 1 sheet named "Template Import TKB"', async () => {
    const buffer = await service.generateTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    expect(workbook.worksheets).toHaveLength(1);
    expect(workbook.worksheets[0].name).toBe('Template Import TKB');
  });

  it('should have 6 columns with correct headers', async () => {
    const buffer = await service.generateTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const worksheet = workbook.worksheets[0];
    const headerRow = worksheet.getRow(1);

    expect(headerRow.getCell(1).value).toBe('Lớp');
    expect(headerRow.getCell(2).value).toBe('Thứ');
    expect(headerRow.getCell(3).value).toBe('Tiết');
    expect(headerRow.getCell(4).value).toBe('Môn');
    expect(headerRow.getCell(5).value).toBe('Giáo viên');
    expect(headerRow.getCell(6).value).toBe('Phòng');
  });

  it('should have bold font on header row', async () => {
    const buffer = await service.generateTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const worksheet = workbook.worksheets[0];
    const headerRow = worksheet.getRow(1);

    expect(headerRow.font?.bold).toBe(true);
  });

  it('should have 1 sample data row with correct values', async () => {
    const buffer = await service.generateTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const worksheet = workbook.worksheets[0];
    const dataRow = worksheet.getRow(2);

    expect(dataRow.getCell(1).value).toBe('10A1');
    expect(dataRow.getCell(2).value).toBe(2);
    expect(dataRow.getCell(3).value).toBe(1);
    expect(dataRow.getCell(4).value).toBe('TOAN');
    expect(dataRow.getCell(5).value).toBe('GV001');
    expect(dataRow.getCell(6).value).toBe('P101');
  });

  it('should have exactly 2 rows (1 header + 1 data)', async () => {
    const buffer = await service.generateTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const worksheet = workbook.worksheets[0];
    expect(worksheet.rowCount).toBe(2);
  });
});

describe('TimetableImportService - validateRows', () => {
  let service: TimetableImportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableImportService,
        { provide: DataSource, useValue: {} },
        { provide: TimetableVersionRepository, useValue: {} },
        { provide: getRepositoryToken(TeacherEntity), useValue: {} },
        { provide: getRepositoryToken(SubjectEntity), useValue: {} },
        { provide: getRepositoryToken(ClassEntity), useValue: {} },
        { provide: getRepositoryToken(PeriodDefinitionEntity), useValue: {} },
        { provide: getRepositoryToken(RoomEntity), useValue: {} },
      ],
    }).compile();

    service = module.get<TimetableImportService>(TimetableImportService);
  });

  const createValidRow = (
    overrides?: Partial<ParsedTimetableRow>,
  ): ParsedTimetableRow => ({
    className: '10A1',
    dayOfWeek: 2,
    periodNumber: 1,
    subjectCode: 'TOAN',
    teacherCode: 'GV001',
    roomCode: 'P101',
    ...overrides,
  });

  it('should return all rows as valid when all rows are correct', () => {
    const rows: ParsedTimetableRow[] = [
      createValidRow(),
      createValidRow({ className: '10A2', dayOfWeek: 3, periodNumber: 2 }),
    ];

    const result = service.validateRows(rows);

    expect(result.validRows).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject dayOfWeek < 2', () => {
    const rows: ParsedTimetableRow[] = [createValidRow({ dayOfWeek: 1 })];

    const result = service.validateRows(rows);

    expect(result.validRows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      row: 2,
      field: 'Thứ',
      message: 'Giá trị Thứ phải từ 2 đến 7',
      value: '1',
    });
  });

  it('should reject dayOfWeek > 7', () => {
    const rows: ParsedTimetableRow[] = [createValidRow({ dayOfWeek: 8 })];

    const result = service.validateRows(rows);

    expect(result.validRows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      row: 2,
      field: 'Thứ',
      message: 'Giá trị Thứ phải từ 2 đến 7',
      value: '8',
    });
  });

  it('should accept dayOfWeek = 2 (Monday)', () => {
    const rows: ParsedTimetableRow[] = [createValidRow({ dayOfWeek: 2 })];

    const result = service.validateRows(rows);

    expect(result.validRows).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept dayOfWeek = 7 (Saturday)', () => {
    const rows: ParsedTimetableRow[] = [createValidRow({ dayOfWeek: 7 })];

    const result = service.validateRows(rows);

    expect(result.validRows).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject empty className', () => {
    const rows: ParsedTimetableRow[] = [createValidRow({ className: '' })];

    const result = service.validateRows(rows);

    expect(result.validRows).toHaveLength(0);
    expect(result.errors).toContainEqual({
      row: 2,
      field: 'Lớp',
      message: 'Tên lớp không được để trống',
      value: '',
    });
  });

  it('should reject empty subjectCode', () => {
    const rows: ParsedTimetableRow[] = [createValidRow({ subjectCode: '' })];

    const result = service.validateRows(rows);

    expect(result.validRows).toHaveLength(0);
    expect(result.errors).toContainEqual({
      row: 2,
      field: 'Môn',
      message: 'Mã môn không được để trống',
      value: '',
    });
  });

  it('should reject empty teacherCode', () => {
    const rows: ParsedTimetableRow[] = [createValidRow({ teacherCode: '' })];

    const result = service.validateRows(rows);

    expect(result.validRows).toHaveLength(0);
    expect(result.errors).toContainEqual({
      row: 2,
      field: 'Giáo viên',
      message: 'Mã giáo viên không được để trống',
      value: '',
    });
  });

  it('should reject periodNumber <= 0', () => {
    const rows: ParsedTimetableRow[] = [createValidRow({ periodNumber: 0 })];

    const result = service.validateRows(rows);

    expect(result.validRows).toHaveLength(0);
    expect(result.errors).toContainEqual({
      row: 2,
      field: 'Tiết',
      message: 'Số tiết phải lớn hơn 0',
      value: '0',
    });
  });

  it('should detect duplicate className+dayOfWeek+periodNumber combination', () => {
    const rows: ParsedTimetableRow[] = [
      createValidRow({ className: '10A1', dayOfWeek: 2, periodNumber: 1 }),
      createValidRow({
        className: '10A1',
        dayOfWeek: 2,
        periodNumber: 1,
        subjectCode: 'LY',
      }),
    ];

    const result = service.validateRows(rows);

    expect(result.validRows).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      row: 3,
      field: 'Lớp+Thứ+Tiết',
      message: 'Trùng lặp tổ hợp Lớp+Thứ+Tiết trong file',
      value: '10A1-Thứ 2-Tiết 1',
    });
  });

  it('should allow same period in different classes', () => {
    const rows: ParsedTimetableRow[] = [
      createValidRow({ className: '10A1', dayOfWeek: 2, periodNumber: 1 }),
      createValidRow({ className: '10A2', dayOfWeek: 2, periodNumber: 1 }),
    ];

    const result = service.validateRows(rows);

    expect(result.validRows).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('should compute correct Excel row numbers (index + 2)', () => {
    const rows: ParsedTimetableRow[] = [
      createValidRow(),
      createValidRow({ dayOfWeek: 0 }), // row index 1 → Excel row 3
      createValidRow({ className: '10A2', dayOfWeek: 3, periodNumber: 2 }),
    ];

    const result = service.validateRows(rows);

    expect(result.validRows).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(3);
  });

  it('should collect multiple errors for a single row with multiple issues', () => {
    const rows: ParsedTimetableRow[] = [
      createValidRow({
        className: '',
        dayOfWeek: 0,
        periodNumber: -1,
        subjectCode: '',
        teacherCode: '',
      }),
    ];

    const result = service.validateRows(rows);

    expect(result.validRows).toHaveLength(0);
    expect(result.errors).toHaveLength(5);
    expect(result.errors.every((e) => e.row === 2)).toBe(true);
  });

  it('should skip invalid rows but continue processing remaining rows', () => {
    const rows: ParsedTimetableRow[] = [
      createValidRow({ dayOfWeek: 0 }), // invalid
      createValidRow({ className: '10A1', dayOfWeek: 3, periodNumber: 2 }), // valid
      createValidRow({ teacherCode: '' }), // invalid
      createValidRow({ className: '10A2', dayOfWeek: 4, periodNumber: 3 }), // valid
    ];

    const result = service.validateRows(rows);

    expect(result.validRows).toHaveLength(2);
    expect(result.validRows[0].className).toBe('10A1');
    expect(result.validRows[1].className).toBe('10A2');
  });

  it('should return empty validRows and empty errors for empty input', () => {
    const result = service.validateRows([]);

    expect(result.validRows).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});

describe('TimetableImportService - lookupEntities', () => {
  let service: TimetableImportService;
  let mockTeacherRepo: Partial<Repository<TeacherEntity>>;
  let mockSubjectRepo: Partial<Repository<SubjectEntity>>;
  let mockClassRepo: Partial<Repository<ClassEntity>>;
  let mockPeriodRepo: Partial<Repository<PeriodDefinitionEntity>>;
  let mockRoomRepo: Partial<Repository<RoomEntity>>;

  const SCHOOL_ID = 'school-uuid-001';

  const mockTeachers = [
    {
      id: 'teacher-uuid-1',
      employeeCode: 'GV001',
      schoolId: SCHOOL_ID,
      deletedAt: null,
    },
    {
      id: 'teacher-uuid-2',
      employeeCode: 'GV002',
      schoolId: SCHOOL_ID,
      deletedAt: null,
    },
  ] as TeacherEntity[];

  const mockSubjects = [
    {
      id: 'subject-uuid-1',
      code: 'TOAN',
      schoolId: SCHOOL_ID,
      deletedAt: null,
    },
    { id: 'subject-uuid-2', code: 'LY', schoolId: SCHOOL_ID, deletedAt: null },
  ] as SubjectEntity[];

  const mockClasses = [
    { id: 'class-uuid-1', name: '10A1', schoolId: SCHOOL_ID, deletedAt: null },
    { id: 'class-uuid-2', name: '10A2', schoolId: SCHOOL_ID, deletedAt: null },
  ] as ClassEntity[];

  const mockPeriods = [
    {
      id: 'period-uuid-1',
      periodNumber: 1,
      schoolId: SCHOOL_ID,
      deletedAt: null,
    },
    {
      id: 'period-uuid-2',
      periodNumber: 2,
      schoolId: SCHOOL_ID,
      deletedAt: null,
    },
  ] as PeriodDefinitionEntity[];

  const mockRooms = [
    { id: 'room-uuid-1', code: 'P101', schoolId: SCHOOL_ID, deletedAt: null },
    { id: 'room-uuid-2', code: 'P102', schoolId: SCHOOL_ID, deletedAt: null },
  ] as RoomEntity[];

  beforeEach(async () => {
    mockTeacherRepo = { find: jest.fn().mockResolvedValue(mockTeachers) };
    mockSubjectRepo = { find: jest.fn().mockResolvedValue(mockSubjects) };
    mockClassRepo = { find: jest.fn().mockResolvedValue(mockClasses) };
    mockPeriodRepo = { find: jest.fn().mockResolvedValue(mockPeriods) };
    mockRoomRepo = { find: jest.fn().mockResolvedValue(mockRooms) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableImportService,
        { provide: DataSource, useValue: {} },
        { provide: TimetableVersionRepository, useValue: {} },
        {
          provide: getRepositoryToken(TeacherEntity),
          useValue: mockTeacherRepo,
        },
        {
          provide: getRepositoryToken(SubjectEntity),
          useValue: mockSubjectRepo,
        },
        { provide: getRepositoryToken(ClassEntity), useValue: mockClassRepo },
        {
          provide: getRepositoryToken(PeriodDefinitionEntity),
          useValue: mockPeriodRepo,
        },
        { provide: getRepositoryToken(RoomEntity), useValue: mockRoomRepo },
      ],
    }).compile();

    service = module.get<TimetableImportService>(TimetableImportService);
  });

  const createValidRow = (
    overrides?: Partial<ParsedTimetableRow>,
  ): ParsedTimetableRow => ({
    className: '10A1',
    dayOfWeek: 2,
    periodNumber: 1,
    subjectCode: 'TOAN',
    teacherCode: 'GV001',
    roomCode: 'P101',
    ...overrides,
  });

  it('should return validSlots when all lookups succeed', async () => {
    const rows = [createValidRow()];

    const result = await service.lookupEntities(rows, SCHOOL_ID);

    expect(result.validSlots).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.validSlots[0]).toEqual({
      classId: 'class-uuid-1',
      dayOfWeek: 2,
      periodId: 'period-uuid-1',
      subjectId: 'subject-uuid-1',
      teacherId: 'teacher-uuid-1',
      roomId: 'room-uuid-1',
    });
  });

  it('should omit roomId when roomCode is empty', async () => {
    const rows = [createValidRow({ roomCode: '' })];

    const result = await service.lookupEntities(rows, SCHOOL_ID);

    expect(result.validSlots).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.validSlots[0].roomId).toBeUndefined();
  });

  it('should return error when teacher not found', async () => {
    const rows = [createValidRow({ teacherCode: 'GV999' })];

    const result = await service.lookupEntities(rows, SCHOOL_ID);

    expect(result.validSlots).toHaveLength(0);
    expect(result.errors).toContainEqual({
      row: 2,
      field: 'Giáo viên',
      message: 'Không tìm thấy giáo viên với mã GV999',
      value: 'GV999',
    });
  });

  it('should return error when subject not found', async () => {
    const rows = [createValidRow({ subjectCode: 'HOA' })];

    const result = await service.lookupEntities(rows, SCHOOL_ID);

    expect(result.validSlots).toHaveLength(0);
    expect(result.errors).toContainEqual({
      row: 2,
      field: 'Môn',
      message: 'Không tìm thấy môn học với mã HOA',
      value: 'HOA',
    });
  });

  it('should return error when class not found', async () => {
    const rows = [createValidRow({ className: '12B1' })];

    const result = await service.lookupEntities(rows, SCHOOL_ID);

    expect(result.validSlots).toHaveLength(0);
    expect(result.errors).toContainEqual({
      row: 2,
      field: 'Lớp',
      message: 'Không tìm thấy lớp 12B1',
      value: '12B1',
    });
  });

  it('should return error when period not found', async () => {
    const rows = [createValidRow({ periodNumber: 99 })];

    const result = await service.lookupEntities(rows, SCHOOL_ID);

    expect(result.validSlots).toHaveLength(0);
    expect(result.errors).toContainEqual({
      row: 2,
      field: 'Tiết',
      message: 'Tiết 99 không hợp lệ',
      value: '99',
    });
  });

  it('should return error when room not found (roomCode provided)', async () => {
    const rows = [createValidRow({ roomCode: 'P999' })];

    const result = await service.lookupEntities(rows, SCHOOL_ID);

    expect(result.validSlots).toHaveLength(0);
    expect(result.errors).toContainEqual({
      row: 2,
      field: 'Phòng',
      message: 'Không tìm thấy phòng với mã P999',
      value: 'P999',
    });
  });

  it('should collect multiple errors for a row with multiple lookup failures', async () => {
    const rows = [
      createValidRow({
        teacherCode: 'GV999',
        subjectCode: 'HOA',
        className: '12B1',
      }),
    ];

    const result = await service.lookupEntities(rows, SCHOOL_ID);

    expect(result.validSlots).toHaveLength(0);
    expect(result.errors).toHaveLength(3);
    expect(result.errors.every((e) => e.row === 2)).toBe(true);
  });

  it('should process multiple rows independently', async () => {
    const rows = [
      createValidRow(), // valid
      createValidRow({
        teacherCode: 'GV999',
        className: '10A2',
        dayOfWeek: 3,
        periodNumber: 2,
      }), // invalid teacher
      createValidRow({
        className: '10A2',
        dayOfWeek: 4,
        periodNumber: 2,
        teacherCode: 'GV002',
      }), // valid
    ];

    const result = await service.lookupEntities(rows, SCHOOL_ID);

    expect(result.validSlots).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(3); // second row = index 1 + 2
  });

  it('should compute correct Excel row numbers (index + 2)', async () => {
    const rows = [
      createValidRow({ teacherCode: 'GV999' }), // index 0 → row 2
      createValidRow({
        className: '10A2',
        dayOfWeek: 3,
        subjectCode: 'UNKNOWN',
      }), // index 1 → row 3
    ];

    const result = await service.lookupEntities(rows, SCHOOL_ID);

    expect(result.errors[0].row).toBe(2);
    expect(result.errors[1].row).toBe(3);
  });

  it('should return empty arrays for empty input', async () => {
    const result = await service.lookupEntities([], SCHOOL_ID);

    expect(result.validSlots).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should batch-load entities with schoolId and deletedAt IsNull filter', async () => {
    await service.lookupEntities([createValidRow()], SCHOOL_ID);

    expect(mockTeacherRepo.find).toHaveBeenCalledWith({
      where: { schoolId: SCHOOL_ID, deletedAt: expect.anything() },
    });
    expect(mockSubjectRepo.find).toHaveBeenCalledWith({
      where: { schoolId: SCHOOL_ID, deletedAt: expect.anything() },
    });
    expect(mockClassRepo.find).toHaveBeenCalledWith({
      where: { schoolId: SCHOOL_ID, deletedAt: expect.anything() },
    });
    expect(mockPeriodRepo.find).toHaveBeenCalledWith({
      where: { schoolId: SCHOOL_ID, deletedAt: expect.anything() },
    });
    expect(mockRoomRepo.find).toHaveBeenCalledWith({
      where: { schoolId: SCHOOL_ID, deletedAt: expect.anything() },
    });
  });
});

/**
 * Helper: Create a valid Excel buffer with given rows (6 columns)
 */
async function createExcelBuffer(
  rows: Array<[string, number, number, string, string, string]>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.addRow(['Lớp', 'Thứ', 'Tiết', 'Môn', 'Giáo viên', 'Phòng']);
  for (const row of rows) {
    sheet.addRow(row);
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}

describe('TimetableImportService - parseExcelRows', () => {
  let service: TimetableImportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableImportService,
        { provide: DataSource, useValue: {} },
        { provide: TimetableVersionRepository, useValue: {} },
        { provide: getRepositoryToken(TeacherEntity), useValue: {} },
        { provide: getRepositoryToken(SubjectEntity), useValue: {} },
        { provide: getRepositoryToken(ClassEntity), useValue: {} },
        { provide: getRepositoryToken(PeriodDefinitionEntity), useValue: {} },
        { provide: getRepositoryToken(RoomEntity), useValue: {} },
      ],
    }).compile();

    service = module.get<TimetableImportService>(TimetableImportService);
  });

  it('should parse valid 6-column Excel buffer correctly', async () => {
    const buffer = await createExcelBuffer([
      ['10A1', 2, 1, 'TOAN', 'GV001', 'P101'],
      ['10A2', 3, 2, 'LY', 'GV002', 'P102'],
    ]);

    const result = await service.parseExcelRows(buffer);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      className: '10A1',
      dayOfWeek: 2,
      periodNumber: 1,
      subjectCode: 'TOAN',
      teacherCode: 'GV001',
      roomCode: 'P101',
    });
    expect(result[1]).toEqual({
      className: '10A2',
      dayOfWeek: 3,
      periodNumber: 2,
      subjectCode: 'LY',
      teacherCode: 'GV002',
      roomCode: 'P102',
    });
  });

  it('should handle optional roomCode (empty or missing)', async () => {
    const buffer = await createExcelBuffer([
      ['10A1', 2, 1, 'TOAN', 'GV001', ''],
    ]);

    const result = await service.parseExcelRows(buffer);

    expect(result).toHaveLength(1);
    expect(result[0].roomCode).toBe('');
  });

  it('should return empty array for header-only file', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');
    sheet.addRow(['Lớp', 'Thứ', 'Tiết', 'Môn', 'Giáo viên', 'Phòng']);
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    const result = await service.parseExcelRows(buffer);

    expect(result).toHaveLength(0);
  });

  it('should parse numeric dayOfWeek and periodNumber correctly', async () => {
    const buffer = await createExcelBuffer([
      ['10A1', 7, 5, 'TOAN', 'GV001', 'P101'],
    ]);

    const result = await service.parseExcelRows(buffer);

    expect(result[0].dayOfWeek).toBe(7);
    expect(result[0].periodNumber).toBe(5);
    expect(typeof result[0].dayOfWeek).toBe('number');
    expect(typeof result[0].periodNumber).toBe('number');
  });

  it('should handle null cell values gracefully (roomCode as empty string)', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');
    sheet.addRow(['Lớp', 'Thứ', 'Tiết', 'Môn', 'Giáo viên', 'Phòng']);
    // Add row with explicit null for room
    const row = sheet.addRow(['10A1', 2, 1, 'TOAN', 'GV001', null]);
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    const result = await service.parseExcelRows(buffer);

    expect(result).toHaveLength(1);
    expect(result[0].roomCode).toBe('');
  });

  it('should parse multiple rows preserving order', async () => {
    const buffer = await createExcelBuffer([
      ['10A1', 2, 1, 'TOAN', 'GV001', 'P101'],
      ['10A2', 3, 2, 'LY', 'GV002', ''],
      ['10A3', 4, 3, 'HOA', 'GV003', 'P103'],
    ]);

    const result = await service.parseExcelRows(buffer);

    expect(result).toHaveLength(3);
    expect(result[0].className).toBe('10A1');
    expect(result[1].className).toBe('10A2');
    expect(result[2].className).toBe('10A3');
  });

  it('should trim whitespace from string values', async () => {
    const buffer = await createExcelBuffer([
      ['  10A1  ', 2, 1, ' TOAN ', ' GV001 ', ' P101 '],
    ]);

    const result = await service.parseExcelRows(buffer);

    expect(result[0].className).toBe('10A1');
    expect(result[0].subjectCode).toBe('TOAN');
    expect(result[0].teacherCode).toBe('GV001');
    expect(result[0].roomCode).toBe('P101');
  });
});

describe('TimetableImportService - importFromExcel (file validation)', () => {
  let service: TimetableImportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableImportService,
        { provide: DataSource, useValue: {} },
        { provide: TimetableVersionRepository, useValue: {} },
        { provide: getRepositoryToken(TeacherEntity), useValue: {} },
        { provide: getRepositoryToken(SubjectEntity), useValue: {} },
        { provide: getRepositoryToken(ClassEntity), useValue: {} },
        { provide: getRepositoryToken(PeriodDefinitionEntity), useValue: {} },
        { provide: getRepositoryToken(RoomEntity), useValue: {} },
      ],
    }).compile();

    service = module.get<TimetableImportService>(TimetableImportService);
  });

  const createMockFile = (
    overrides?: Partial<Express.Multer.File>,
  ): Express.Multer.File => ({
    fieldname: 'file',
    originalname: 'test.xlsx',
    encoding: '7bit',
    mimetype:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 1024,
    buffer: Buffer.from(''),
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  });

  it('should reject non-Excel MIME type (text/plain)', async () => {
    const file = createMockFile({ mimetype: 'text/plain' });
    const options: ImportTimetableOptions = {
      file,
      schoolId: 'school-1',
      semesterId: 'semester-1',
    };

    await expect(service.importFromExcel(options)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.importFromExcel(options)).rejects.toThrow(
      'File phải có định dạng Excel (.xlsx hoặc .xls)',
    );
  });

  it('should reject non-Excel MIME type (application/pdf)', async () => {
    const file = createMockFile({ mimetype: 'application/pdf' });
    const options: ImportTimetableOptions = {
      file,
      schoolId: 'school-1',
      semesterId: 'semester-1',
    };

    await expect(service.importFromExcel(options)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.importFromExcel(options)).rejects.toThrow(
      'File phải có định dạng Excel (.xlsx hoặc .xls)',
    );
  });

  it('should reject files larger than 10MB', async () => {
    const file = createMockFile({
      size: 10 * 1024 * 1024 + 1, // 10MB + 1 byte
    });
    const options: ImportTimetableOptions = {
      file,
      schoolId: 'school-1',
      semesterId: 'semester-1',
    };

    await expect(service.importFromExcel(options)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.importFromExcel(options)).rejects.toThrow(
      'Kích thước file tối đa là 10MB',
    );
  });

  it('should accept files exactly 10MB', async () => {
    const validBuffer = await createExcelBuffer([
      ['10A1', 2, 1, 'TOAN', 'GV001', 'P101'],
    ]);
    const file = createMockFile({
      size: 10 * 1024 * 1024, // exactly 10MB
      buffer: validBuffer,
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    // Should not throw for size — it will proceed to parse and may fail
    // at lookup stage, but should NOT throw file size error
    const options: ImportTimetableOptions = {
      file,
      schoolId: 'school-1',
      semesterId: 'semester-1',
    };

    // Mock lookupEntities dependencies to avoid unrelated errors
    jest.spyOn(service, 'lookupEntities').mockResolvedValue({
      validSlots: [],
      errors: [],
    });

    // Should not throw size error - will throw empty data or proceed
    try {
      await service.importFromExcel(options);
    } catch (e: any) {
      // Should NOT be a size error
      expect(e.message).not.toContain('Kích thước file tối đa là 10MB');
    }
  });

  it('should reject empty files (0 data rows, header only)', async () => {
    const headerOnlyBuffer = await createExcelBuffer([]);
    const file = createMockFile({
      buffer: headerOnlyBuffer,
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const options: ImportTimetableOptions = {
      file,
      schoolId: 'school-1',
      semesterId: 'semester-1',
    };

    await expect(service.importFromExcel(options)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.importFromExcel(options)).rejects.toThrow(
      'File không chứa dữ liệu để import',
    );
  });

  it('should accept valid .xlsx files (correct MIME type)', async () => {
    const validBuffer = await createExcelBuffer([
      ['10A1', 2, 1, 'TOAN', 'GV001', 'P101'],
    ]);
    const file = createMockFile({
      buffer: validBuffer,
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    // Mock dependencies so we only test file validation passes
    jest.spyOn(service, 'lookupEntities').mockResolvedValue({
      validSlots: [],
      errors: [
        { row: 2, field: 'Giáo viên', message: 'Not found', value: 'GV001' },
      ],
    });

    const options: ImportTimetableOptions = {
      file,
      schoolId: 'school-1',
      semesterId: 'semester-1',
    };

    // Should NOT throw file validation error — returns result (no version since 0 valid)
    const result = await service.importFromExcel(options);
    expect(result.totalRows).toBe(1);
    expect(result.versionId).toBeNull();
  });

  it('should accept .xls MIME type', async () => {
    const validBuffer = await createExcelBuffer([
      ['10A1', 2, 1, 'TOAN', 'GV001', 'P101'],
    ]);
    const file = createMockFile({
      buffer: validBuffer,
      mimetype: 'application/vnd.ms-excel',
    });

    jest.spyOn(service, 'lookupEntities').mockResolvedValue({
      validSlots: [],
      errors: [
        { row: 2, field: 'Giáo viên', message: 'Not found', value: 'GV001' },
      ],
    });

    const options: ImportTimetableOptions = {
      file,
      schoolId: 'school-1',
      semesterId: 'semester-1',
    };

    // Should NOT throw file validation error
    const result = await service.importFromExcel(options);
    expect(result.totalRows).toBe(1);
  });
});

describe('TimetableImportService - error aggregation logic', () => {
  let service: TimetableImportService;
  let mockTeacherRepo: Partial<Repository<TeacherEntity>>;
  let mockSubjectRepo: Partial<Repository<SubjectEntity>>;
  let mockClassRepo: Partial<Repository<ClassEntity>>;
  let mockPeriodRepo: Partial<Repository<PeriodDefinitionEntity>>;
  let mockRoomRepo: Partial<Repository<RoomEntity>>;
  let mockVersionRepo: Partial<TimetableVersionRepository>;
  let mockDataSource: Partial<DataSource>;

  const SCHOOL_ID = 'school-uuid-001';
  const SEMESTER_ID = 'semester-uuid-001';

  const mockTeachers = [
    {
      id: 'teacher-uuid-1',
      employeeCode: 'GV001',
      schoolId: SCHOOL_ID,
      deletedAt: null,
    },
  ] as TeacherEntity[];
  const mockSubjects = [
    {
      id: 'subject-uuid-1',
      code: 'TOAN',
      schoolId: SCHOOL_ID,
      deletedAt: null,
    },
  ] as SubjectEntity[];
  const mockClasses = [
    { id: 'class-uuid-1', name: '10A1', schoolId: SCHOOL_ID, deletedAt: null },
  ] as ClassEntity[];
  const mockPeriods = [
    {
      id: 'period-uuid-1',
      periodNumber: 1,
      schoolId: SCHOOL_ID,
      deletedAt: null,
    },
  ] as PeriodDefinitionEntity[];
  const mockRooms = [
    { id: 'room-uuid-1', code: 'P101', schoolId: SCHOOL_ID, deletedAt: null },
  ] as RoomEntity[];

  beforeEach(async () => {
    mockTeacherRepo = { find: jest.fn().mockResolvedValue(mockTeachers) };
    mockSubjectRepo = { find: jest.fn().mockResolvedValue(mockSubjects) };
    mockClassRepo = { find: jest.fn().mockResolvedValue(mockClasses) };
    mockPeriodRepo = { find: jest.fn().mockResolvedValue(mockPeriods) };
    mockRoomRepo = { find: jest.fn().mockResolvedValue(mockRooms) };
    mockVersionRepo = {
      getNextVersionNumber: jest.fn().mockResolvedValue(1),
    };
    mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb: any) => {
        const mockManager = {
          create: jest.fn().mockImplementation((_entity: any, data: any) => ({
            id: 'version-uuid-1',
            ...data,
          })),
          save: jest
            .fn()
            .mockImplementation(async (_entity: any, data: any) => {
              if (Array.isArray(data)) return data;
              return { id: 'version-uuid-1', ...data };
            }),
        };
        return cb(mockManager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableImportService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: TimetableVersionRepository, useValue: mockVersionRepo },
        {
          provide: getRepositoryToken(TeacherEntity),
          useValue: mockTeacherRepo,
        },
        {
          provide: getRepositoryToken(SubjectEntity),
          useValue: mockSubjectRepo,
        },
        { provide: getRepositoryToken(ClassEntity), useValue: mockClassRepo },
        {
          provide: getRepositoryToken(PeriodDefinitionEntity),
          useValue: mockPeriodRepo,
        },
        { provide: getRepositoryToken(RoomEntity), useValue: mockRoomRepo },
      ],
    }).compile();

    service = module.get<TimetableImportService>(TimetableImportService);
  });

  it('should collect errors for invalid dayOfWeek (outside 2-7)', async () => {
    const buffer = await createExcelBuffer([
      ['10A1', 1, 1, 'TOAN', 'GV001', 'P101'], // dayOfWeek = 1 → invalid
    ]);
    const file = {
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 1024,
      buffer,
    } as Express.Multer.File;

    const result = await service.importFromExcel({
      file,
      schoolId: SCHOOL_ID,
      semesterId: SEMESTER_ID,
    });

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        row: 2,
        field: 'Thứ',
        message: 'Giá trị Thứ phải từ 2 đến 7',
        value: '1',
      }),
    );
  });

  it('should collect errors for non-existent teacher code', async () => {
    const buffer = await createExcelBuffer([
      ['10A1', 2, 1, 'TOAN', 'UNKNOWN_GV', 'P101'],
    ]);
    const file = {
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 1024,
      buffer,
    } as Express.Multer.File;

    const result = await service.importFromExcel({
      file,
      schoolId: SCHOOL_ID,
      semesterId: SEMESTER_ID,
    });

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        row: 2,
        field: 'Giáo viên',
        message: 'Không tìm thấy giáo viên với mã UNKNOWN_GV',
        value: 'UNKNOWN_GV',
      }),
    );
  });

  it('should collect errors for non-existent subject code', async () => {
    const buffer = await createExcelBuffer([
      ['10A1', 2, 1, 'UNKNOWN_MON', 'GV001', 'P101'],
    ]);
    const file = {
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 1024,
      buffer,
    } as Express.Multer.File;

    const result = await service.importFromExcel({
      file,
      schoolId: SCHOOL_ID,
      semesterId: SEMESTER_ID,
    });

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        row: 2,
        field: 'Môn',
        message: 'Không tìm thấy môn học với mã UNKNOWN_MON',
        value: 'UNKNOWN_MON',
      }),
    );
  });

  it('should collect errors for non-existent class name', async () => {
    const buffer = await createExcelBuffer([
      ['UNKNOWN_CLASS', 2, 1, 'TOAN', 'GV001', 'P101'],
    ]);
    const file = {
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 1024,
      buffer,
    } as Express.Multer.File;

    const result = await service.importFromExcel({
      file,
      schoolId: SCHOOL_ID,
      semesterId: SEMESTER_ID,
    });

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        row: 2,
        field: 'Lớp',
        message: 'Không tìm thấy lớp UNKNOWN_CLASS',
        value: 'UNKNOWN_CLASS',
      }),
    );
  });

  it('should collect errors for duplicate className+dayOfWeek+periodNumber', async () => {
    const buffer = await createExcelBuffer([
      ['10A1', 2, 1, 'TOAN', 'GV001', 'P101'],
      ['10A1', 2, 1, 'TOAN', 'GV001', 'P101'], // duplicate
    ]);
    const file = {
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 1024,
      buffer,
    } as Express.Multer.File;

    const result = await service.importFromExcel({
      file,
      schoolId: SCHOOL_ID,
      semesterId: SEMESTER_ID,
    });

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        row: 3,
        field: 'Lớp+Thứ+Tiết',
        message: 'Trùng lặp tổ hợp Lớp+Thứ+Tiết trong file',
      }),
    );
  });

  it('should return ALL errors without stopping at first error', async () => {
    const buffer = await createExcelBuffer([
      ['10A1', 1, 1, 'TOAN', 'GV001', 'P101'], // invalid dayOfWeek
      ['UNKNOWN', 2, 1, 'TOAN', 'GV001', 'P101'], // invalid class (lookup error)
      ['10A1', 8, 1, 'TOAN', 'GV001', 'P101'], // invalid dayOfWeek
    ]);
    const file = {
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 1024,
      buffer,
    } as Express.Multer.File;

    const result = await service.importFromExcel({
      file,
      schoolId: SCHOOL_ID,
      semesterId: SEMESTER_ID,
    });

    // Should have errors from all 3 rows, not just the first one
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
    expect(result.errorCount).toBe(3);
    // Errors span multiple rows
    const errorRows = [...new Set(result.errors.map((e) => e.row))];
    expect(errorRows).toContain(2);
    expect(errorRows).toContain(3);
    expect(errorRows).toContain(4);
  });

  it('should include row number, field name, message, and value in every error', async () => {
    const buffer = await createExcelBuffer([
      ['10A1', 0, 1, 'TOAN', 'GV001', 'P101'],
    ]);
    const file = {
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 1024,
      buffer,
    } as Express.Multer.File;

    const result = await service.importFromExcel({
      file,
      schoolId: SCHOOL_ID,
      semesterId: SEMESTER_ID,
    });

    for (const error of result.errors) {
      expect(error).toHaveProperty('row');
      expect(error).toHaveProperty('field');
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('value');
      expect(typeof error.row).toBe('number');
      expect(typeof error.field).toBe('string');
      expect(typeof error.message).toBe('string');
      expect(typeof error.value).toBe('string');
    }
  });
});

describe('TimetableImportService - importFromExcel (integration logic)', () => {
  let service: TimetableImportService;
  let mockVersionRepo: Partial<TimetableVersionRepository>;
  let mockDataSource: Partial<DataSource>;
  let transactionCallback: jest.Mock;

  const SCHOOL_ID = 'school-uuid-001';
  const SEMESTER_ID = 'semester-uuid-001';

  const mockTeachers = [
    {
      id: 'teacher-uuid-1',
      employeeCode: 'GV001',
      schoolId: SCHOOL_ID,
      deletedAt: null,
    },
    {
      id: 'teacher-uuid-2',
      employeeCode: 'GV002',
      schoolId: SCHOOL_ID,
      deletedAt: null,
    },
  ] as TeacherEntity[];
  const mockSubjects = [
    {
      id: 'subject-uuid-1',
      code: 'TOAN',
      schoolId: SCHOOL_ID,
      deletedAt: null,
    },
    { id: 'subject-uuid-2', code: 'LY', schoolId: SCHOOL_ID, deletedAt: null },
  ] as SubjectEntity[];
  const mockClasses = [
    { id: 'class-uuid-1', name: '10A1', schoolId: SCHOOL_ID, deletedAt: null },
    { id: 'class-uuid-2', name: '10A2', schoolId: SCHOOL_ID, deletedAt: null },
  ] as ClassEntity[];
  const mockPeriods = [
    {
      id: 'period-uuid-1',
      periodNumber: 1,
      schoolId: SCHOOL_ID,
      deletedAt: null,
    },
    {
      id: 'period-uuid-2',
      periodNumber: 2,
      schoolId: SCHOOL_ID,
      deletedAt: null,
    },
  ] as PeriodDefinitionEntity[];
  const mockRooms = [
    { id: 'room-uuid-1', code: 'P101', schoolId: SCHOOL_ID, deletedAt: null },
  ] as RoomEntity[];

  beforeEach(async () => {
    mockVersionRepo = {
      getNextVersionNumber: jest.fn().mockResolvedValue(3),
    };
    transactionCallback = jest.fn().mockImplementation(async (cb: any) => {
      const mockManager = {
        create: jest.fn().mockImplementation((_entity: any, data: any) => ({
          id: 'new-version-uuid',
          name: data.name || 'Import TKB - v3',
          ...data,
        })),
        save: jest.fn().mockImplementation(async (_entity: any, data: any) => {
          if (Array.isArray(data)) return data;
          return {
            id: 'new-version-uuid',
            name: data.name || 'Import TKB - v3',
            ...data,
          };
        }),
      };
      return cb(mockManager);
    });
    mockDataSource = { transaction: transactionCallback };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableImportService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: TimetableVersionRepository, useValue: mockVersionRepo },
        {
          provide: getRepositoryToken(TeacherEntity),
          useValue: { find: jest.fn().mockResolvedValue(mockTeachers) },
        },
        {
          provide: getRepositoryToken(SubjectEntity),
          useValue: { find: jest.fn().mockResolvedValue(mockSubjects) },
        },
        {
          provide: getRepositoryToken(ClassEntity),
          useValue: { find: jest.fn().mockResolvedValue(mockClasses) },
        },
        {
          provide: getRepositoryToken(PeriodDefinitionEntity),
          useValue: { find: jest.fn().mockResolvedValue(mockPeriods) },
        },
        {
          provide: getRepositoryToken(RoomEntity),
          useValue: { find: jest.fn().mockResolvedValue(mockRooms) },
        },
      ],
    }).compile();

    service = module.get<TimetableImportService>(TimetableImportService);
  });

  it('should create version when ≥1 valid row exists', async () => {
    const buffer = await createExcelBuffer([
      ['10A1', 2, 1, 'TOAN', 'GV001', 'P101'],
    ]);
    const file = {
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 1024,
      buffer,
    } as Express.Multer.File;

    const result = await service.importFromExcel({
      file,
      schoolId: SCHOOL_ID,
      semesterId: SEMESTER_ID,
    });

    expect(result.versionId).toBe('new-version-uuid');
    expect(result.versionName).toContain('Import TKB');
    expect(transactionCallback).toHaveBeenCalled();
  });

  it('should NOT create version when all rows are invalid', async () => {
    const buffer = await createExcelBuffer([
      ['10A1', 0, 1, 'TOAN', 'GV001', 'P101'], // invalid dayOfWeek
      ['10A1', 8, 1, 'TOAN', 'GV001', 'P101'], // invalid dayOfWeek
    ]);
    const file = {
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 1024,
      buffer,
    } as Express.Multer.File;

    const result = await service.importFromExcel({
      file,
      schoolId: SCHOOL_ID,
      semesterId: SEMESTER_ID,
    });

    expect(result.versionId).toBeNull();
    expect(result.versionName).toBeNull();
    expect(transactionCallback).not.toHaveBeenCalled();
  });

  it('should return correct totalRows/successCount/errorCount', async () => {
    const buffer = await createExcelBuffer([
      ['10A1', 2, 1, 'TOAN', 'GV001', 'P101'], // valid
      ['10A2', 3, 2, 'LY', 'GV002', ''], // valid (no room)
      ['10A1', 0, 1, 'TOAN', 'GV001', 'P101'], // invalid dayOfWeek
      ['UNKNOWN', 4, 1, 'TOAN', 'GV001', 'P101'], // invalid class (lookup)
    ]);
    const file = {
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 1024,
      buffer,
    } as Express.Multer.File;

    const result = await service.importFromExcel({
      file,
      schoolId: SCHOOL_ID,
      semesterId: SEMESTER_ID,
    });

    expect(result.totalRows).toBe(4);
    expect(result.successCount).toBe(2);
    expect(result.errorCount).toBe(2);
    expect(result.totalRows).toBe(result.successCount + result.errorCount);
  });

  it('should return versionId and versionName when import succeeds', async () => {
    const buffer = await createExcelBuffer([
      ['10A1', 2, 1, 'TOAN', 'GV001', 'P101'],
    ]);
    const file = {
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 1024,
      buffer,
    } as Express.Multer.File;

    const result = await service.importFromExcel({
      file,
      schoolId: SCHOOL_ID,
      semesterId: SEMESTER_ID,
    });

    expect(result.versionId).toBeDefined();
    expect(result.versionId).not.toBeNull();
    expect(result.versionName).toBeDefined();
    expect(result.versionName).not.toBeNull();
  });

  it('should return errors array even when some rows succeed', async () => {
    const buffer = await createExcelBuffer([
      ['10A1', 2, 1, 'TOAN', 'GV001', 'P101'], // valid
      ['10A1', 0, 1, 'TOAN', 'GV001', 'P101'], // invalid
    ]);
    const file = {
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 1024,
      buffer,
    } as Express.Multer.File;

    const result = await service.importFromExcel({
      file,
      schoolId: SCHOOL_ID,
      semesterId: SEMESTER_ID,
    });

    expect(result.successCount).toBe(1);
    expect(result.errorCount).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.versionId).not.toBeNull();
  });

  it('should handle mixed validation and lookup errors correctly', async () => {
    const buffer = await createExcelBuffer([
      ['10A1', 2, 1, 'TOAN', 'GV001', 'P101'], // valid
      ['10A1', 1, 1, 'TOAN', 'GV001', 'P101'], // validation error (dayOfWeek)
      ['UNKNOWN', 3, 1, 'TOAN', 'GV001', 'P101'], // lookup error (class not found)
      ['10A2', 4, 2, 'LY', 'GV002', ''], // valid
    ]);
    const file = {
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 1024,
      buffer,
    } as Express.Multer.File;

    const result = await service.importFromExcel({
      file,
      schoolId: SCHOOL_ID,
      semesterId: SEMESTER_ID,
    });

    expect(result.totalRows).toBe(4);
    expect(result.successCount).toBe(2);
    expect(result.errorCount).toBe(2);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    expect(result.versionId).not.toBeNull();
  });
});
