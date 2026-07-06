import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { MasterDataService } from './master-data.service';
import { MasterDataRepository } from '../repositories/master-data.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { FieldDefinitionRepository } from '../repositories/field-definition.repository';
import { FieldDefinitionService } from './field-definition.service';
import { SyncService } from './sync.service';
import { EmployeeMasterEntity } from '../entities/employee-master.entity';
import { CreateEmployeeMasterDto } from '../dto/create-employee-master.dto';
import { UpdateEmployeeMasterDto } from '../dto/update-employee-master.dto';
import { EmployeeMasterQueryDto } from '../dto/employee-master-query.dto';
import { Gender } from '../../../common/enums/status.enum';
import { FieldDataType } from '../enums/master-data.enum';

describe('MasterDataService', () => {
  let service: MasterDataService;
  let masterDataRepository: jest.Mocked<MasterDataRepository>;
  let auditLogRepository: jest.Mocked<AuditLogRepository>;
  let fieldDefinitionRepository: jest.Mocked<FieldDefinitionRepository>;
  let fieldDefinitionService: jest.Mocked<FieldDefinitionService>;
  let syncService: jest.Mocked<SyncService>;

  const mockEmployee: EmployeeMasterEntity = {
    id: 'emp-uuid-1',
    schoolId: 'school-uuid-1',
    employeeCode: 'NV001',
    campusName: 'Cơ sở 1',
    fullName: 'Nguyễn Văn A',
    shortName: 'A',
    gradeName: 'Khối 10',
    departmentName: 'Tổ Toán',
    jobTitle: 'Giáo viên',
    managementLevel: null,
    gender: Gender.MALE,
    maxPeriodsPerWeek: 20,
    workingDays: 5.5,
    extendedFields: {},
    school: null as unknown as EmployeeMasterEntity['school'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MasterDataService,
        {
          provide: MasterDataRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            findByEmployeeCode: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        {
          provide: AuditLogRepository,
          useValue: {
            create: jest.fn(),
            createMany: jest.fn(),
            findByEmployeeId: jest.fn(),
          },
        },
        {
          provide: FieldDefinitionRepository,
          useValue: {
            findByFieldName: jest.fn(),
            findAll: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: FieldDefinitionService,
          useValue: {
            validateValue: jest.fn(),
            register: jest.fn(),
            findAll: jest.fn(),
          },
        },
        {
          provide: SyncService,
          useValue: {
            emitChange: jest.fn().mockResolvedValue(undefined),
            receiveModuleChange: jest.fn(),
            getSyncLogs: jest.fn(),
            resolveConflict: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MasterDataService>(MasterDataService);
    masterDataRepository = module.get(MasterDataRepository);
    auditLogRepository = module.get(AuditLogRepository);
    fieldDefinitionRepository = module.get(FieldDefinitionRepository);
    fieldDefinitionService = module.get(FieldDefinitionService);
    syncService = module.get(SyncService);
  });

  describe('findAll', () => {
    it('should return paginated response with correct meta', async () => {
      const query: EmployeeMasterQueryDto = {
        page: 1,
        limit: 10,
        sortOrder: 'ASC',
      };
      const employees = [mockEmployee];
      masterDataRepository.findAll.mockResolvedValue([employees, 1]);

      const result = await service.findAll(query);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(employees);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });

    it('should calculate totalPages correctly', async () => {
      const query: EmployeeMasterQueryDto = {
        page: 1,
        limit: 10,
        sortOrder: 'ASC',
      };
      masterDataRepository.findAll.mockResolvedValue([[], 25]);

      const result = await service.findAll(query);

      expect(result.meta.totalPages).toBe(3);
    });

    it('should delegate query to repository', async () => {
      const query: EmployeeMasterQueryDto = {
        page: 2,
        limit: 5,
        search: 'NV001',
        schoolId: 'school-uuid-1',
        sortOrder: 'ASC',
      };
      masterDataRepository.findAll.mockResolvedValue([[], 0]);

      await service.findAll(query);

      expect(masterDataRepository.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findById', () => {
    it('should return the employee when found', async () => {
      masterDataRepository.findById.mockResolvedValue(mockEmployee);

      const result = await service.findById('emp-uuid-1');

      expect(result).toEqual(mockEmployee);
    });

    it('should throw NotFoundException when employee not found', async () => {
      masterDataRepository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent-id')).rejects.toThrow(
        new NotFoundException('Không tìm thấy nhân sự với ID nonexistent-id'),
      );
    });
  });

  describe('findByEmployeeCode', () => {
    it('should delegate to repository and return result', async () => {
      masterDataRepository.findByEmployeeCode.mockResolvedValue(mockEmployee);

      const result = await service.findByEmployeeCode('school-uuid-1', 'NV001');

      expect(result).toEqual(mockEmployee);
      expect(masterDataRepository.findByEmployeeCode).toHaveBeenCalledWith(
        'school-uuid-1',
        'NV001',
      );
    });

    it('should return null when not found', async () => {
      masterDataRepository.findByEmployeeCode.mockResolvedValue(null);

      const result = await service.findByEmployeeCode('school-uuid-1', 'NV999');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create employee when employee_code is unique within school', async () => {
      const dto: CreateEmployeeMasterDto = {
        schoolId: 'school-uuid-1',
        employeeCode: 'NV002',
        fullName: 'Trần Thị B',
      };
      masterDataRepository.findByEmployeeCode.mockResolvedValue(null);
      masterDataRepository.create.mockResolvedValue({
        ...mockEmployee,
        id: 'emp-uuid-2',
        employeeCode: 'NV002',
        fullName: 'Trần Thị B',
      });

      const result = await service.create(dto);

      expect(result.employeeCode).toBe('NV002');
      expect(masterDataRepository.create).toHaveBeenCalledWith(dto);
    });

    it('should throw ConflictException when employee_code already exists in school', async () => {
      const dto: CreateEmployeeMasterDto = {
        schoolId: 'school-uuid-1',
        employeeCode: 'NV001',
        fullName: 'Duplicate',
      };
      masterDataRepository.findByEmployeeCode.mockResolvedValue(mockEmployee);

      await expect(service.create(dto)).rejects.toThrow(
        new ConflictException('Mã NV NV001 đã tồn tại trong trường này'),
      );
      expect(masterDataRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update employee and create audit logs for changed fields', async () => {
      const dto: UpdateEmployeeMasterDto = {
        fullName: 'Nguyễn Văn B',
        departmentName: 'Tổ Lý',
      };
      masterDataRepository.findById.mockResolvedValue(mockEmployee);
      masterDataRepository.update.mockResolvedValue({
        ...mockEmployee,
        fullName: 'Nguyễn Văn B',
        departmentName: 'Tổ Lý',
      });
      auditLogRepository.createMany.mockResolvedValue([]);

      const result = await service.update('emp-uuid-1', dto, 'admin-user');

      expect(result.fullName).toBe('Nguyễn Văn B');
      expect(auditLogRepository.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            employeeMasterId: 'emp-uuid-1',
            fieldName: 'fullName',
            oldValue: 'Nguyễn Văn A',
            newValue: 'Nguyễn Văn B',
            changedBy: 'admin-user',
            changeSource: 'manual',
          }),
          expect.objectContaining({
            employeeMasterId: 'emp-uuid-1',
            fieldName: 'departmentName',
            oldValue: 'Tổ Toán',
            newValue: 'Tổ Lý',
            changedBy: 'admin-user',
            changeSource: 'manual',
          }),
        ]),
      );
    });

    it('should not create audit log entries when no fields changed', async () => {
      const dto: UpdateEmployeeMasterDto = {
        fullName: 'Nguyễn Văn A', // same as existing
      };
      masterDataRepository.findById.mockResolvedValue(mockEmployee);
      masterDataRepository.update.mockResolvedValue(mockEmployee);

      await service.update('emp-uuid-1', dto, 'admin-user');

      expect(auditLogRepository.createMany).not.toHaveBeenCalled();
    });

    it('should create audit logs for extended fields changes', async () => {
      const existingWithExtended = {
        ...mockEmployee,
        extendedFields: { phone: '0123456789', email: 'a@b.com' },
      };
      const dto: UpdateEmployeeMasterDto = {
        extendedFields: { phone: '0987654321', email: 'a@b.com' },
      };
      masterDataRepository.findById.mockResolvedValue(existingWithExtended);
      masterDataRepository.update.mockResolvedValue({
        ...existingWithExtended,
        extendedFields: { phone: '0987654321', email: 'a@b.com' },
      });
      auditLogRepository.createMany.mockResolvedValue([]);

      await service.update('emp-uuid-1', dto, 'admin-user');

      expect(auditLogRepository.createMany).toHaveBeenCalledWith([
        expect.objectContaining({
          fieldName: 'extendedFields.phone',
          oldValue: '0123456789',
          newValue: '0987654321',
        }),
      ]);
    });

    it('should throw NotFoundException when employee not found', async () => {
      masterDataRepository.findById.mockResolvedValue(null);

      await expect(
        service.update('nonexistent-id', { fullName: 'Test' }, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('should soft delete an existing employee', async () => {
      masterDataRepository.findById.mockResolvedValue(mockEmployee);

      await service.softDelete('emp-uuid-1');

      expect(masterDataRepository.softDelete).toHaveBeenCalledWith(
        'emp-uuid-1',
      );
    });

    it('should throw NotFoundException when employee not found', async () => {
      masterDataRepository.findById.mockResolvedValue(null);

      await expect(service.softDelete('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(masterDataRepository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('validateExtendedFields', () => {
    it('should allow create when extended fields pass validation', async () => {
      const dto: CreateEmployeeMasterDto = {
        schoolId: 'school-uuid-1',
        employeeCode: 'NV003',
        fullName: 'Lê Văn C',
        extendedFields: { phone: '0123456789' },
      };
      masterDataRepository.findByEmployeeCode.mockResolvedValue(null);
      fieldDefinitionRepository.findByFieldName.mockResolvedValue({
        id: 'fd-1',
        schoolId: 'school-uuid-1',
        fieldName: 'phone',
        dataType: FieldDataType.STRING,
        sourceModule: 'hr',
        displayLabel: 'Số điện thoại',
        validationRules: null,
        isRequired: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        school: null as unknown as EmployeeMasterEntity['school'],
      });
      fieldDefinitionService.validateValue.mockReturnValue(true);
      masterDataRepository.create.mockResolvedValue({
        ...mockEmployee,
        employeeCode: 'NV003',
        fullName: 'Lê Văn C',
        extendedFields: { phone: '0123456789' },
      });

      const result = await service.create(dto);

      expect(result.employeeCode).toBe('NV003');
      expect(fieldDefinitionService.validateValue).toHaveBeenCalled();
    });

    it('should throw BadRequestException when extended field value is invalid', async () => {
      const dto: CreateEmployeeMasterDto = {
        schoolId: 'school-uuid-1',
        employeeCode: 'NV004',
        fullName: 'Phạm Văn D',
        extendedFields: { age: 'not-a-number' },
      };
      masterDataRepository.findByEmployeeCode.mockResolvedValue(null);
      fieldDefinitionRepository.findByFieldName.mockResolvedValue({
        id: 'fd-2',
        schoolId: 'school-uuid-1',
        fieldName: 'age',
        dataType: FieldDataType.NUMBER,
        sourceModule: 'hr',
        displayLabel: 'Tuổi',
        validationRules: null,
        isRequired: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        school: null as unknown as EmployeeMasterEntity['school'],
      });
      fieldDefinitionService.validateValue.mockReturnValue(false);

      await expect(service.create(dto)).rejects.toThrow(
        new BadRequestException(
          'Giá trị của trường age không đúng kiểu dữ liệu number',
        ),
      );
      expect(masterDataRepository.create).not.toHaveBeenCalled();
    });

    it('should allow unregistered extended fields to pass through', async () => {
      const dto: CreateEmployeeMasterDto = {
        schoolId: 'school-uuid-1',
        employeeCode: 'NV005',
        fullName: 'Hoàng Văn E',
        extendedFields: { unknownField: 'some value' },
      };
      masterDataRepository.findByEmployeeCode.mockResolvedValue(null);
      fieldDefinitionRepository.findByFieldName.mockResolvedValue(null);
      masterDataRepository.create.mockResolvedValue({
        ...mockEmployee,
        employeeCode: 'NV005',
        fullName: 'Hoàng Văn E',
        extendedFields: { unknownField: 'some value' },
      });

      const result = await service.create(dto);

      expect(result.employeeCode).toBe('NV005');
      expect(fieldDefinitionService.validateValue).not.toHaveBeenCalled();
    });

    it('should validate extended fields on update before saving', async () => {
      const dto: UpdateEmployeeMasterDto = {
        extendedFields: { salary: 'invalid' },
      };
      masterDataRepository.findById.mockResolvedValue(mockEmployee);
      fieldDefinitionRepository.findByFieldName.mockResolvedValue({
        id: 'fd-3',
        schoolId: 'school-uuid-1',
        fieldName: 'salary',
        dataType: FieldDataType.NUMBER,
        sourceModule: 'payroll',
        displayLabel: 'Lương',
        validationRules: null,
        isRequired: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        school: null as unknown as EmployeeMasterEntity['school'],
      });
      fieldDefinitionService.validateValue.mockReturnValue(false);

      await expect(
        service.update('emp-uuid-1', dto, 'admin-user'),
      ).rejects.toThrow(
        new BadRequestException(
          'Giá trị của trường salary không đúng kiểu dữ liệu number',
        ),
      );
      expect(masterDataRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('exportToExcel', () => {
    it('should generate an Excel buffer with correct core field headers', async () => {
      masterDataRepository.findAll.mockResolvedValue([[mockEmployee], 1]);
      fieldDefinitionRepository.findAll.mockResolvedValue([]);

      const query: EmployeeMasterQueryDto = {
        page: 1,
        limit: 10,
        sortOrder: 'ASC',
      };
      const buffer = await service.exportToExcel('school-uuid-1', query);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should format gender values to Vietnamese labels', async () => {
      const { Workbook } = await import('exceljs');
      masterDataRepository.findAll.mockResolvedValue([[mockEmployee], 1]);
      fieldDefinitionRepository.findAll.mockResolvedValue([]);

      const query: EmployeeMasterQueryDto = {
        page: 1,
        limit: 10,
        sortOrder: 'ASC',
      };
      const buffer = await service.exportToExcel('school-uuid-1', query);

      // Parse the generated Excel to verify content
      const workbook = new Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(buffer as any);
      const worksheet = workbook.getWorksheet('Danh sách nhân sự');

      expect(worksheet).toBeDefined();
      // Row 1 is headers, row 2 is data
      const dataRow = worksheet!.getRow(2);
      // Gender is column 9 (index-based in the CORE_COLUMN_DEFINITIONS)
      const genderCell = dataRow.getCell(9);
      expect(genderCell.value).toBe('Nam');
    });

    it('should include extended fields as columns', async () => {
      const { Workbook } = await import('exceljs');
      const employeeWithExt: EmployeeMasterEntity = {
        ...mockEmployee,
        extendedFields: { phone: '0123456789' },
      };
      masterDataRepository.findAll.mockResolvedValue([[employeeWithExt], 1]);
      fieldDefinitionRepository.findAll.mockResolvedValue([
        {
          id: 'fd-1',
          schoolId: 'school-uuid-1',
          fieldName: 'phone',
          dataType: FieldDataType.STRING,
          sourceModule: 'hr',
          displayLabel: 'Số điện thoại',
          validationRules: null,
          isRequired: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          school: null as unknown as EmployeeMasterEntity['school'],
        },
      ]);

      const query: EmployeeMasterQueryDto = {
        page: 1,
        limit: 10,
        sortOrder: 'ASC',
      };
      const buffer = await service.exportToExcel('school-uuid-1', query);

      const workbook = new Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(buffer as any);
      const worksheet = workbook.getWorksheet('Danh sách nhân sự');

      // Column 12 should be the extended field (11 core + 1 extended)
      const headerRow = worksheet!.getRow(1);
      expect(headerRow.getCell(12).value).toBe('Số điện thoại');

      const dataRow = worksheet!.getRow(2);
      expect(dataRow.getCell(12).value).toBe('0123456789');
    });

    it('should paginate through all records when total exceeds limit', async () => {
      const employees = Array.from({ length: 150 }, (_, i) => ({
        ...mockEmployee,
        id: `emp-uuid-${i}`,
        employeeCode: `NV${String(i).padStart(3, '0')}`,
      }));

      // First call returns 100 records, second call returns 50
      masterDataRepository.findAll
        .mockResolvedValueOnce([employees.slice(0, 100), 150])
        .mockResolvedValueOnce([employees.slice(100), 150]);
      fieldDefinitionRepository.findAll.mockResolvedValue([]);

      const query: EmployeeMasterQueryDto = {
        page: 1,
        limit: 10,
        sortOrder: 'ASC',
      };
      const buffer = await service.exportToExcel('school-uuid-1', query);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(masterDataRepository.findAll).toHaveBeenCalledTimes(2);
    });

    it('should handle female and other gender values', async () => {
      const { Workbook } = await import('exceljs');
      const femaleEmployee: EmployeeMasterEntity = {
        ...mockEmployee,
        id: 'emp-2',
        gender: Gender.FEMALE,
      };
      const otherEmployee: EmployeeMasterEntity = {
        ...mockEmployee,
        id: 'emp-3',
        gender: Gender.OTHER,
      };
      masterDataRepository.findAll.mockResolvedValue([
        [femaleEmployee, otherEmployee],
        2,
      ]);
      fieldDefinitionRepository.findAll.mockResolvedValue([]);

      const query: EmployeeMasterQueryDto = {
        page: 1,
        limit: 10,
        sortOrder: 'ASC',
      };
      const buffer = await service.exportToExcel('school-uuid-1', query);

      const workbook = new Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(buffer as any);
      const worksheet = workbook.getWorksheet('Danh sách nhân sự');

      expect(worksheet!.getRow(2).getCell(9).value).toBe('Nữ');
      expect(worksheet!.getRow(3).getCell(9).value).toBe('Khác');
    });

    it('should handle null gender as empty string', async () => {
      const { Workbook } = await import('exceljs');
      const noGenderEmployee: EmployeeMasterEntity = {
        ...mockEmployee,
        gender: null,
      };
      masterDataRepository.findAll.mockResolvedValue([[noGenderEmployee], 1]);
      fieldDefinitionRepository.findAll.mockResolvedValue([]);

      const query: EmployeeMasterQueryDto = {
        page: 1,
        limit: 10,
        sortOrder: 'ASC',
      };
      const buffer = await service.exportToExcel('school-uuid-1', query);

      const workbook = new Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(buffer as any);
      const worksheet = workbook.getWorksheet('Danh sách nhân sự');

      expect(worksheet!.getRow(2).getCell(9).value).toBe('');
    });
  });
});
