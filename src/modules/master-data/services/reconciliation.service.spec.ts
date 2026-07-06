import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ReconciliationService,
  SourceDataItem,
} from './reconciliation.service';
import { ReconciliationSessionEntity } from '../entities/reconciliation-session.entity';
import { MasterDataRepository } from '../repositories/master-data.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { FieldDefinitionRepository } from '../repositories/field-definition.repository';
import { EmployeeMasterEntity } from '../entities/employee-master.entity';
import { ReconciliationStatus } from '../enums/master-data.enum';
import { Gender } from '../../../common/enums/status.enum';

describe('ReconciliationService', () => {
  let service: ReconciliationService;
  let reconciliationRepo: jest.Mocked<Repository<ReconciliationSessionEntity>>;
  let masterDataRepository: jest.Mocked<MasterDataRepository>;
  let auditLogRepository: jest.Mocked<AuditLogRepository>;
  let fieldDefinitionRepository: jest.Mocked<FieldDefinitionRepository>;
  let dataSource: jest.Mocked<DataSource>;

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
    extendedFields: { phone: '0123456789' },
    school: null as unknown as EmployeeMasterEntity['school'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
  };

  const mockSession: ReconciliationSessionEntity = {
    id: 'session-uuid-1',
    schoolId: 'school-uuid-1',
    sourceModule: 'teaching-assignment',
    status: ReconciliationStatus.COMPLETED,
    totalRecords: 2,
    matchedRecords: 1,
    conflictRecords: 1,
    newRecords: 1,
    reportData: {
      differences: [
        {
          employeeCode: 'NV001',
          fieldName: 'departmentName',
          masterValue: 'Tổ Toán',
          sourceValue: 'Tổ Lý',
        },
      ],
      newFields: [],
      newRecords: ['NV999'],
    },
    triggeredBy: 'admin-user',
    completedAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        {
          provide: getRepositoryToken(ReconciliationSessionEntity),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: MasterDataRepository,
          useValue: {
            findByEmployeeCode: jest.fn(),
          },
        },
        {
          provide: AuditLogRepository,
          useValue: {
            create: jest.fn(),
            createMany: jest.fn(),
          },
        },
        {
          provide: FieldDefinitionRepository,
          useValue: {
            findAll: jest.fn(),
            findByFieldName: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReconciliationService>(ReconciliationService);
    reconciliationRepo = module.get(
      getRepositoryToken(ReconciliationSessionEntity),
    );
    masterDataRepository = module.get(MasterDataRepository);
    auditLogRepository = module.get(AuditLogRepository);
    fieldDefinitionRepository = module.get(FieldDefinitionRepository);
    dataSource = module.get(DataSource);
  });

  describe('triggerReconciliation', () => {
    it('should produce difference report for matching employees with different values', async () => {
      const sourceData: SourceDataItem[] = [
        {
          employeeCode: 'NV001',
          departmentName: 'Tổ Lý',
          fullName: 'Nguyễn Văn A',
        },
      ];

      masterDataRepository.findByEmployeeCode.mockResolvedValue(mockEmployee);
      fieldDefinitionRepository.findAll.mockResolvedValue([]);
      reconciliationRepo.create.mockReturnValue(mockSession);
      reconciliationRepo.save.mockResolvedValue(mockSession);

      const result = await service.triggerReconciliation(
        'school-uuid-1',
        'teaching-assignment',
        sourceData,
        'admin-user',
      );

      expect(result.status).toBe(ReconciliationStatus.COMPLETED);
      expect(reconciliationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: 'school-uuid-1',
          sourceModule: 'teaching-assignment',
          status: ReconciliationStatus.COMPLETED,
          totalRecords: 1,
          matchedRecords: 1,
          conflictRecords: 1,
          newRecords: 0,
          reportData: expect.objectContaining({
            differences: [
              {
                employeeCode: 'NV001',
                fieldName: 'departmentName',
                masterValue: 'Tổ Toán',
                sourceValue: 'Tổ Lý',
              },
            ],
            newFields: [],
            newRecords: [],
          }),
        }),
      );
    });

    it('should identify new records when employee not found in Master Data', async () => {
      const sourceData: SourceDataItem[] = [
        { employeeCode: 'NV999', fullName: 'New Person' },
      ];

      masterDataRepository.findByEmployeeCode.mockResolvedValue(null);
      fieldDefinitionRepository.findAll.mockResolvedValue([]);
      reconciliationRepo.create.mockReturnValue(mockSession);
      reconciliationRepo.save.mockResolvedValue(mockSession);

      await service.triggerReconciliation(
        'school-uuid-1',
        'teaching-assignment',
        sourceData,
        'admin-user',
      );

      expect(reconciliationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          newRecords: 1,
          matchedRecords: 0,
          reportData: expect.objectContaining({
            newRecords: ['NV999'],
          }),
        }),
      );
    });

    it('should identify new fields not yet registered', async () => {
      const sourceData: SourceDataItem[] = [
        { employeeCode: 'NV001', unknownField: 'value' },
      ];

      masterDataRepository.findByEmployeeCode.mockResolvedValue(mockEmployee);
      fieldDefinitionRepository.findAll.mockResolvedValue([]);
      reconciliationRepo.create.mockReturnValue(mockSession);
      reconciliationRepo.save.mockResolvedValue(mockSession);

      await service.triggerReconciliation(
        'school-uuid-1',
        'teaching-assignment',
        sourceData,
        'admin-user',
      );

      expect(reconciliationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reportData: expect.objectContaining({
            newFields: ['unknownField'],
          }),
        }),
      );
    });

    it('should compare extended fields when registered', async () => {
      const sourceData: SourceDataItem[] = [
        { employeeCode: 'NV001', phone: '0987654321' },
      ];

      masterDataRepository.findByEmployeeCode.mockResolvedValue(mockEmployee);
      fieldDefinitionRepository.findAll.mockResolvedValue([
        {
          id: 'fd-1',
          schoolId: 'school-uuid-1',
          fieldName: 'phone',
          dataType: 'string' as never,
          sourceModule: 'hr',
          displayLabel: 'Phone',
          validationRules: null,
          isRequired: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          school: null as never,
        },
      ]);
      reconciliationRepo.create.mockReturnValue(mockSession);
      reconciliationRepo.save.mockResolvedValue(mockSession);

      await service.triggerReconciliation(
        'school-uuid-1',
        'teaching-assignment',
        sourceData,
        'admin-user',
      );

      expect(reconciliationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reportData: expect.objectContaining({
            differences: [
              {
                employeeCode: 'NV001',
                fieldName: 'phone',
                masterValue: '0123456789',
                sourceValue: '0987654321',
              },
            ],
          }),
        }),
      );
    });

    it('should not report difference when values match', async () => {
      const sourceData: SourceDataItem[] = [
        { employeeCode: 'NV001', fullName: 'Nguyễn Văn A' },
      ];

      masterDataRepository.findByEmployeeCode.mockResolvedValue(mockEmployee);
      fieldDefinitionRepository.findAll.mockResolvedValue([]);
      reconciliationRepo.create.mockReturnValue({
        ...mockSession,
        conflictRecords: 0,
        reportData: { differences: [], newFields: [], newRecords: [] },
      });
      reconciliationRepo.save.mockResolvedValue({
        ...mockSession,
        conflictRecords: 0,
        reportData: { differences: [], newFields: [], newRecords: [] },
      });

      await service.triggerReconciliation(
        'school-uuid-1',
        'teaching-assignment',
        sourceData,
        'admin-user',
      );

      expect(reconciliationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conflictRecords: 0,
          reportData: expect.objectContaining({
            differences: [],
          }),
        }),
      );
    });
  });

  describe('getReport', () => {
    it('should return the reconciliation report when found', async () => {
      reconciliationRepo.findOne.mockResolvedValue(mockSession);

      const result = await service.getReport('session-uuid-1');

      expect(result.id).toBe('session-uuid-1');
      expect(result.reportData).toEqual(mockSession.reportData);
      expect(result.status).toBe(ReconciliationStatus.COMPLETED);
    });

    it('should throw NotFoundException when session not found', async () => {
      reconciliationRepo.findOne.mockResolvedValue(null);

      await expect(service.getReport('nonexistent-id')).rejects.toThrow(
        new NotFoundException('Không tìm thấy phiên đối chiếu'),
      );
    });
  });

  describe('applyChanges', () => {
    it('should update Master Data and create audit logs within transaction', async () => {
      reconciliationRepo.findOne.mockResolvedValue(mockSession);
      masterDataRepository.findByEmployeeCode.mockResolvedValue(mockEmployee);

      const mockManager = {
        createQueryBuilder: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue(undefined),
        }),
        create: jest.fn().mockReturnValue({
          employeeMasterId: mockEmployee.id,
          fieldName: 'departmentName',
          oldValue: 'Tổ Toán',
          newValue: 'Tổ Lý',
          changedBy: 'admin-user',
          changeSource: 'reconciliation',
        }),
        save: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      };
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (cb: unknown) => {
          return (cb as (manager: typeof mockManager) => Promise<void>)(
            mockManager,
          );
        },
      );

      await service.applyChanges(
        'session-uuid-1',
        ['departmentName'],
        'admin-user',
      );

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(mockManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          employeeMasterId: 'emp-uuid-1',
          fieldName: 'departmentName',
          oldValue: 'Tổ Toán',
          newValue: 'Tổ Lý',
          changedBy: 'admin-user',
          changeSource: 'reconciliation',
        }),
      );
      expect(mockManager.update).toHaveBeenCalledWith(
        ReconciliationSessionEntity,
        'session-uuid-1',
        expect.objectContaining({
          status: ReconciliationStatus.APPLIED,
        }),
      );
    });

    it('should only apply fields that are in acceptedFields array', async () => {
      const sessionWithMultipleDiffs: ReconciliationSessionEntity = {
        ...mockSession,
        reportData: {
          differences: [
            {
              employeeCode: 'NV001',
              fieldName: 'departmentName',
              masterValue: 'Tổ Toán',
              sourceValue: 'Tổ Lý',
            },
            {
              employeeCode: 'NV001',
              fieldName: 'jobTitle',
              masterValue: 'Giáo viên',
              sourceValue: 'Trưởng bộ môn',
            },
          ],
          newFields: [],
          newRecords: [],
        },
      };
      reconciliationRepo.findOne.mockResolvedValue(sessionWithMultipleDiffs);
      masterDataRepository.findByEmployeeCode.mockResolvedValue(mockEmployee);

      const mockManager = {
        createQueryBuilder: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue(undefined),
        }),
        create: jest.fn().mockReturnValue({}),
        save: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      };
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (cb: unknown) => {
          return (cb as (manager: typeof mockManager) => Promise<void>)(
            mockManager,
          );
        },
      );

      // Only accept departmentName, not jobTitle
      await service.applyChanges(
        'session-uuid-1',
        ['departmentName'],
        'admin-user',
      );

      // Should create audit log only for departmentName
      expect(mockManager.create).toHaveBeenCalledTimes(1);
      expect(mockManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          fieldName: 'departmentName',
        }),
      );
    });

    it('should throw NotFoundException when session not found', async () => {
      reconciliationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.applyChanges(
          'nonexistent-id',
          ['departmentName'],
          'admin-user',
        ),
      ).rejects.toThrow(
        new NotFoundException('Không tìm thấy phiên đối chiếu'),
      );
    });
  });

  describe('declineChanges', () => {
    it('should update session status to DECLINED', async () => {
      reconciliationRepo.findOne.mockResolvedValue(mockSession);
      reconciliationRepo.update.mockResolvedValue(undefined as never);

      await service.declineChanges('session-uuid-1');

      expect(reconciliationRepo.update).toHaveBeenCalledWith(
        'session-uuid-1',
        expect.objectContaining({
          status: ReconciliationStatus.DECLINED,
        }),
      );
    });

    it('should not modify Master Data', async () => {
      reconciliationRepo.findOne.mockResolvedValue(mockSession);
      reconciliationRepo.update.mockResolvedValue(undefined as never);

      await service.declineChanges('session-uuid-1');

      expect(masterDataRepository.findByEmployeeCode).not.toHaveBeenCalled();
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when session not found', async () => {
      reconciliationRepo.findOne.mockResolvedValue(null);

      await expect(service.declineChanges('nonexistent-id')).rejects.toThrow(
        new NotFoundException('Không tìm thấy phiên đối chiếu'),
      );
    });
  });
});
