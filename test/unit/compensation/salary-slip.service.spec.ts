import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SalarySlipService } from '../../../src/modules/compensation/services/salary-slip.service';
import { SalarySlipRepository } from '../../../src/modules/compensation/repositories/salary-slip.repository';
import { SalarySlipStatus } from '../../../src/modules/compensation/enums';

describe('SalarySlipService', () => {
  let service: SalarySlipService;
  let repository: jest.Mocked<SalarySlipRepository>;

  const mockSlip = {
    id: 'slip-1',
    teacherId: 'teacher-1',
    schoolId: 'school-1',
    payPeriodId: 'pp-1',
    earnings: [{ payComponentId: 'pc-1', payComponentCode: 'BASIC', payComponentName: 'Lương cơ bản', formula: 'RATE * HOURS', amount: 12000000 }],
    deductions: [{ payComponentId: 'pc-2', payComponentCode: 'TAX', payComponentName: 'Thuế', formula: 'BASIC * 0.1', amount: 1200000 }],
    grossAmount: 12000000,
    totalDeductions: 1200000,
    netAmount: 10800000,
    snapshot: { variables: {}, ruleResults: [] },
    status: SalarySlipStatus.DRAFT,
    errors: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalarySlipService,
        {
          provide: SalarySlipRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            findConfirmedByTeacherAndPeriod: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SalarySlipService>(SalarySlipService);
    repository = module.get(SalarySlipRepository);
  });

  describe('findById', () => {
    it('should return salary slip when found', async () => {
      repository.findById.mockResolvedValue(mockSlip as never);

      const result = await service.findById('slip-1');

      expect(result).toEqual(mockSlip);
    });

    it('should throw NotFoundException when not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('confirm', () => {
    it('should confirm a DRAFT salary slip', async () => {
      const confirmedSlip = { ...mockSlip, status: SalarySlipStatus.CONFIRMED };
      repository.findById.mockResolvedValue(mockSlip as never);
      repository.update.mockResolvedValue(confirmedSlip as never);

      const result = await service.confirm('slip-1');

      expect(result.status).toBe(SalarySlipStatus.CONFIRMED);
      expect(repository.update).toHaveBeenCalledWith('slip-1', {
        status: SalarySlipStatus.CONFIRMED,
      });
    });

    it('should reject confirming a non-DRAFT slip', async () => {
      const confirmedSlip = { ...mockSlip, status: SalarySlipStatus.CONFIRMED };
      repository.findById.mockResolvedValue(confirmedSlip as never);

      await expect(service.confirm('slip-1')).rejects.toThrow(BadRequestException);
    });

    it('should reject confirming a slip with errors', async () => {
      const errorSlip = {
        ...mockSlip,
        errors: [{ payComponentCode: 'TAX', error: 'Division by zero', step: 'evaluation' }],
      };
      repository.findById.mockResolvedValue(errorSlip as never);

      await expect(service.confirm('slip-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('hasConfirmedSlip', () => {
    it('should return true when confirmed slip exists', async () => {
      repository.findConfirmedByTeacherAndPeriod.mockResolvedValue(mockSlip as never);

      const result = await service.hasConfirmedSlip('teacher-1', 'pp-1');

      expect(result).toBe(true);
    });

    it('should return false when no confirmed slip', async () => {
      repository.findConfirmedByTeacherAndPeriod.mockResolvedValue(null);

      const result = await service.hasConfirmedSlip('teacher-1', 'pp-1');

      expect(result).toBe(false);
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      repository.findAll.mockResolvedValue([[mockSlip], 1] as never);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        sortOrder: 'DESC',
        schoolId: 'school-1',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });
});
