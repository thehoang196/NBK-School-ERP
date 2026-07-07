import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PayrollRunService } from './payroll-run.service';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { PayrollApprovalRepository } from '../repositories/payroll-approval.repository';
import { PayrollRunStatus, ApprovalAction } from '../enums';

describe('PayrollRunService', () => {
  let service: PayrollRunService;
  let runRepo: jest.Mocked<PayrollRunRepository>;
  let approvalRepo: jest.Mocked<PayrollApprovalRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockRun = {
    id: 'run-1',
    schoolId: 'school-1',
    payPeriodId: 'period-1',
    name: 'Lương T7/2026',
    status: PayrollRunStatus.DRAFT,
    totalTeachers: 0,
    successCount: 0,
    errorCount: 0,
    totalGross: 0,
    totalNet: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollRunService,
        {
          provide: PayrollRunRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: PayrollApprovalRepository,
          useValue: {
            create: jest.fn(),
            findByPayrollRun: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<PayrollRunService>(PayrollRunService);
    runRepo = module.get(PayrollRunRepository);
    approvalRepo = module.get(PayrollApprovalRepository);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('create', () => {
    it('should create a new payroll run in DRAFT status', async () => {
      runRepo.create.mockResolvedValue(mockRun as any);

      const result = await service.create(
        'school-1',
        { payPeriodId: 'period-1', name: 'Lương T7/2026' },
        'user-1',
      );

      expect(result.status).toBe(PayrollRunStatus.DRAFT);
      expect(runRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: 'school-1',
          status: PayrollRunStatus.DRAFT,
        }),
      );
    });
  });

  describe('submitForReview', () => {
    it('should transition DRAFT → REVIEWED', async () => {
      const draftRun = { ...mockRun, status: PayrollRunStatus.DRAFT };
      runRepo.findById.mockResolvedValue(draftRun as any);
      runRepo.update.mockResolvedValue(undefined);
      approvalRepo.create.mockResolvedValue({} as any);

      const reviewedRun = { ...draftRun, status: PayrollRunStatus.REVIEWED };
      runRepo.findById
        .mockResolvedValueOnce(draftRun as any)
        .mockResolvedValueOnce(reviewedRun as any);

      const result = await service.submitForReview('run-1', 'school-1', 'user-1');

      expect(result.status).toBe(PayrollRunStatus.REVIEWED);
      expect(approvalRepo.create).toHaveBeenCalled();
    });

    it('should reject invalid transition PAID → REVIEWED', async () => {
      const paidRun = { ...mockRun, status: PayrollRunStatus.PAID };
      runRepo.findById.mockResolvedValue(paidRun as any);

      await expect(
        service.submitForReview('run-1', 'school-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve', () => {
    it('should transition REVIEWED → APPROVED', async () => {
      const reviewedRun = { ...mockRun, status: PayrollRunStatus.REVIEWED };
      const approvedRun = { ...mockRun, status: PayrollRunStatus.APPROVED };
      runRepo.findById
        .mockResolvedValueOnce(reviewedRun as any)
        .mockResolvedValueOnce(approvedRun as any);
      runRepo.update.mockResolvedValue(undefined);
      approvalRepo.create.mockResolvedValue({} as any);

      const result = await service.approve('run-1', 'school-1', 'user-1');

      expect(result.status).toBe(PayrollRunStatus.APPROVED);
    });
  });

  describe('reject', () => {
    it('should transition to REJECTED with reason', async () => {
      const draftRun = { ...mockRun, status: PayrollRunStatus.DRAFT };
      const rejectedRun = { ...mockRun, status: PayrollRunStatus.REJECTED, rejectionReason: 'Sai số liệu' };
      runRepo.findById
        .mockResolvedValueOnce(draftRun as any)
        .mockResolvedValueOnce(rejectedRun as any);
      runRepo.update.mockResolvedValue(undefined);
      approvalRepo.create.mockResolvedValue({} as any);

      const result = await service.reject('run-1', 'school-1', 'user-1', 'Sai số liệu');

      expect(result.status).toBe(PayrollRunStatus.REJECTED);
    });

    it('should reject transition from APPROVED', async () => {
      const approvedRun = { ...mockRun, status: PayrollRunStatus.APPROVED };
      runRepo.findById.mockResolvedValue(approvedRun as any);

      await expect(
        service.reject('run-1', 'school-1', 'user-1', 'reason'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('markPaid', () => {
    it('should transition APPROVED → PAID', async () => {
      const approvedRun = { ...mockRun, status: PayrollRunStatus.APPROVED };
      const paidRun = { ...mockRun, status: PayrollRunStatus.PAID };
      runRepo.findById
        .mockResolvedValueOnce(approvedRun as any)
        .mockResolvedValueOnce(paidRun as any);
      runRepo.update.mockResolvedValue(undefined);
      approvalRepo.create.mockResolvedValue({} as any);

      const result = await service.markPaid('run-1', 'school-1', 'user-1');

      expect(result.status).toBe(PayrollRunStatus.PAID);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'payroll-run.paid',
        expect.any(Object),
      );
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException when not found', async () => {
      runRepo.findById.mockResolvedValue(null);

      await expect(
        service.findById('non-existent', 'school-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
