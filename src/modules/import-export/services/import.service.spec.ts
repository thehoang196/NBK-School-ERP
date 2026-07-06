import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { DataSource } from 'typeorm';
import { Workbook } from 'exceljs';
import { ImportService } from './import.service';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import { SubjectEntity } from '../../subject/entities/subject.entity';
import { ClassEntity } from '../../class/entities/class.entity';
import { GradeEntity } from '../../class/entities/grade.entity';
import { DepartmentEntity } from '../../department/entities/department.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { TimetableSlotEntity } from '../../timetable/entities/timetable-slot.entity';
import { PeriodDefinitionEntity } from '../../academic/entities/period-definition.entity';
import { AcademicYearEntity } from '../../academic/entities/academic-year.entity';
import { ImportBatchEntity } from '../entities/import-batch.entity';
import { ImportProcessor } from '../processors/import.processor';

describe('ImportService - buildTeacherTemplate', () => {
  let service: ImportService;

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
    createQueryRunner: jest.fn(),
  };

  const mockImportProcessor = {
    parseExcelFile: jest.fn(),
    getTeacherColumnMappings: jest.fn(),
    parseWorksheet: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportService,
        {
          provide: getRepositoryToken(TeacherEntity),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(SubjectEntity),
          useValue: mockRepository,
        },
        { provide: getRepositoryToken(ClassEntity), useValue: mockRepository },
        { provide: getRepositoryToken(GradeEntity), useValue: mockRepository },
        {
          provide: getRepositoryToken(DepartmentEntity),
          useValue: mockRepository,
        },
        { provide: getRepositoryToken(SchoolEntity), useValue: mockRepository },
        {
          provide: getRepositoryToken(TimetableSlotEntity),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(PeriodDefinitionEntity),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(AcademicYearEntity),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(ImportBatchEntity),
          useValue: mockRepository,
        },
        { provide: getQueueToken('teacher-import'), useValue: mockQueue },
        { provide: DataSource, useValue: mockDataSource },
        { provide: ImportProcessor, useValue: mockImportProcessor },
      ],
    }).compile();

    service = module.get<ImportService>(ImportService);
  });

  describe('generateTemplate("teachers")', () => {
    it('should generate Excel buffer with exactly 9 standard column headers', async () => {
      const buffer = await service.generateTemplate('teachers');

      const workbook = new Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(buffer as any);
      const worksheet = workbook.getWorksheet('Template');

      expect(worksheet).toBeDefined();

      const headerRow = worksheet!.getRow(1);
      const expectedHeaders = [
        'Mã NV',
        'Họ và Tên',
        'Tên gọi',
        'Khối',
        'Tổ bộ môn',
        'Chức danh/chức vụ',
        'Cấp bậc quản lý',
        'Giới tính',
        'Max tiết/tuần',
      ];

      const actualHeaders: string[] = [];
      headerRow.eachCell({ includeEmpty: false }, (cell) => {
        actualHeaders.push(cell.value as string);
      });

      expect(actualHeaders).toHaveLength(9);
      expect(actualHeaders).toEqual(expectedHeaders);
    });

    it('should have a sample row with valid values for all 9 columns', async () => {
      const buffer = await service.generateTemplate('teachers');

      const workbook = new Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(buffer as any);
      const worksheet = workbook.getWorksheet('Template');

      expect(worksheet).toBeDefined();

      const sampleRow = worksheet!.getRow(2);
      const expectedValues = [
        'GV001',
        'Nguyễn Văn A',
        'A',
        'Khối 10',
        'Tổ Toán',
        'Giáo viên chính',
        'Tổ trưởng',
        'Nam',
        20,
      ];

      const actualValues: (string | number | null)[] = [];
      sampleRow.eachCell({ includeEmpty: false }, (cell) => {
        actualValues.push(cell.value as string | number);
      });

      expect(actualValues).toHaveLength(9);
      expect(actualValues).toEqual(expectedValues);
    });

    it('should NOT have a "CCCD" column in the template', async () => {
      const buffer = await service.generateTemplate('teachers');

      const workbook = new Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(buffer as any);
      const worksheet = workbook.getWorksheet('Template');

      expect(worksheet).toBeDefined();

      const headerRow = worksheet!.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell({ includeEmpty: false }, (cell) => {
        headers.push(cell.value as string);
      });

      expect(headers).not.toContain('CCCD');
    });
  });
});

describe('ImportService - importTeachers maxPeriodsPerWeek handling', () => {
  let service: ImportService;

  const mockTeacherRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  const mockGradeRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  const mockDepartmentRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  const mockBatchRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  const mockGenericRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
    createQueryRunner: jest.fn(),
  };

  const mockImportProcessor = {
    parseExcelFile: jest.fn(),
    getTeacherColumnMappings: jest.fn(),
    parseWorksheet: jest.fn(),
  };

  const mockFile: Partial<Express.Multer.File> = {
    buffer: Buffer.from('fake'),
    mimetype:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 1024,
    originalname: 'teachers.xlsx',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportService,
        {
          provide: getRepositoryToken(TeacherEntity),
          useValue: mockTeacherRepo,
        },
        {
          provide: getRepositoryToken(SubjectEntity),
          useValue: mockGenericRepo,
        },
        { provide: getRepositoryToken(ClassEntity), useValue: mockGenericRepo },
        { provide: getRepositoryToken(GradeEntity), useValue: mockGradeRepo },
        {
          provide: getRepositoryToken(DepartmentEntity),
          useValue: mockDepartmentRepo,
        },
        {
          provide: getRepositoryToken(SchoolEntity),
          useValue: mockGenericRepo,
        },
        {
          provide: getRepositoryToken(TimetableSlotEntity),
          useValue: mockGenericRepo,
        },
        {
          provide: getRepositoryToken(PeriodDefinitionEntity),
          useValue: mockGenericRepo,
        },
        {
          provide: getRepositoryToken(AcademicYearEntity),
          useValue: mockGenericRepo,
        },
        {
          provide: getRepositoryToken(ImportBatchEntity),
          useValue: mockBatchRepo,
        },
        { provide: getQueueToken('teacher-import'), useValue: mockQueue },
        { provide: DataSource, useValue: mockDataSource },
        { provide: ImportProcessor, useValue: mockImportProcessor },
      ],
    }).compile();

    service = module.get<ImportService>(ImportService);
  });

  /**
   * Validates: Requirements 4.1
   * When maxPeriodsPerWeek = "25" in parsed row, teacher is created with maxPeriodsPerWeek = 25
   */
  it('should parse maxPeriodsPerWeek "25" as number 25', async () => {
    const mockWorkbook = { worksheets: [{ name: 'Sheet1' }] };
    mockImportProcessor.parseExcelFile.mockResolvedValue(mockWorkbook);
    mockImportProcessor.getTeacherColumnMappings.mockReturnValue([]);
    mockImportProcessor.parseWorksheet.mockReturnValue([
      {
        rowNumber: 2,
        data: {
          employeeCode: 'GV001',
          fullName: 'Nguyễn Văn A',
          shortName: 'A',
          gradeName: null,
          departmentName: null,
          jobTitle: null,
          managementLevel: null,
          gender: null,
          maxPeriodsPerWeek: '25',
        },
        errors: [],
      },
    ]);

    mockGradeRepo.find.mockResolvedValue([]);
    mockDepartmentRepo.find.mockResolvedValue([]);
    mockTeacherRepo.findOne.mockResolvedValue(null);

    let capturedTeacherData: Record<string, unknown> | undefined;
    mockDataSource.transaction.mockImplementation(
      async (cb: (manager: unknown) => Promise<void>) => {
        const manager = {
          create: (_entity: unknown, data: Record<string, unknown>) => {
            capturedTeacherData = data;
            return data;
          },
          save: jest.fn(),
        };
        await cb(manager);
      },
    );

    mockBatchRepo.create.mockReturnValue({});
    mockBatchRepo.save.mockResolvedValue({});

    const result = await service.importTeachers(
      mockFile as Express.Multer.File,
      'school-123',
    );

    expect(result).toHaveProperty('successCount', 1);
    expect(capturedTeacherData).toBeDefined();
    expect(capturedTeacherData!.maxPeriodsPerWeek).toBe(25);
  });

  /**
   * Validates: Requirements 4.2
   * When maxPeriodsPerWeek is undefined/null, teacher is created with default value 20
   */
  it('should default maxPeriodsPerWeek to 20 when column is empty', async () => {
    const mockWorkbook = { worksheets: [{ name: 'Sheet1' }] };
    mockImportProcessor.parseExcelFile.mockResolvedValue(mockWorkbook);
    mockImportProcessor.getTeacherColumnMappings.mockReturnValue([]);
    mockImportProcessor.parseWorksheet.mockReturnValue([
      {
        rowNumber: 2,
        data: {
          employeeCode: 'GV002',
          fullName: 'Trần Thị B',
          shortName: 'B',
          gradeName: null,
          departmentName: null,
          jobTitle: null,
          managementLevel: null,
          gender: null,
          maxPeriodsPerWeek: undefined,
        },
        errors: [],
      },
    ]);

    mockGradeRepo.find.mockResolvedValue([]);
    mockDepartmentRepo.find.mockResolvedValue([]);
    mockTeacherRepo.findOne.mockResolvedValue(null);

    let capturedTeacherData: Record<string, unknown> | undefined;
    mockDataSource.transaction.mockImplementation(
      async (cb: (manager: unknown) => Promise<void>) => {
        const manager = {
          create: (_entity: unknown, data: Record<string, unknown>) => {
            capturedTeacherData = data;
            return data;
          },
          save: jest.fn(),
        };
        await cb(manager);
      },
    );

    mockBatchRepo.create.mockReturnValue({});
    mockBatchRepo.save.mockResolvedValue({});

    const result = await service.importTeachers(
      mockFile as Express.Multer.File,
      'school-123',
    );

    expect(result).toHaveProperty('successCount', 1);
    expect(capturedTeacherData).toBeDefined();
    expect(capturedTeacherData!.maxPeriodsPerWeek).toBe(20);
  });

  /**
   * Validates: Requirements 4.4
   * When employeeCode is empty string, returns validation error
   */
  it('should return error when employeeCode is empty', async () => {
    const mockWorkbook = { worksheets: [{ name: 'Sheet1' }] };
    mockImportProcessor.parseExcelFile.mockResolvedValue(mockWorkbook);
    mockImportProcessor.getTeacherColumnMappings.mockReturnValue([]);
    mockImportProcessor.parseWorksheet.mockReturnValue([
      {
        rowNumber: 2,
        data: {
          employeeCode: '',
          fullName: 'Lê Văn C',
          shortName: 'C',
          gradeName: null,
          departmentName: null,
          jobTitle: null,
          managementLevel: null,
          gender: null,
          maxPeriodsPerWeek: null,
        },
        errors: [],
      },
    ]);

    mockGradeRepo.find.mockResolvedValue([]);
    mockDepartmentRepo.find.mockResolvedValue([]);

    const result = await service.importTeachers(
      mockFile as Express.Multer.File,
      'school-123',
    );

    expect(result).toHaveProperty('successCount', 0);
    expect(result).toHaveProperty('errorCount');
    expect(
      (result as { errors: Array<{ field: string; message: string }> }).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'employeeCode',
          message: 'Trường "Mã NV" là bắt buộc',
        }),
      ]),
    );
  });
});
