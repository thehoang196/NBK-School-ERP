import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PeriodSwapService } from './period-swap.service';
import { PeriodSwapRepository } from '../repositories/period-swap.repository';
import { PeriodSwapStatus } from '../enums';

describe('PeriodSwapService', () => {
  let service: PeriodSwapService;
  let repo: jest.Mocked<PeriodSwapRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockSchoolId = 'school-001';
  const mockRequesterId = 'teacher-001';
  const mockTargetId = 'teacher-002';
  const mockAdminId = 'admin-001';

  const mockSwap = {
    id: 'swap-001',
    schoolId: mockSchoolId,
    requesterId: mockRequesterId,
    targetId: mockTargetId,
    requesterDate: '2026-07-10',
    requesterPeriod: 3,
    targetDate: '2026-07-11',
    targetPeriod: 2,
    reason: 'Có việc cá nhân',
    status: PeriodSwapStatus.PENDING_TEACHER,
    targetAcceptedAt: null,
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: mockRequesterId,
    updatedBy: null,
    version: 1,
    requester: {} as any,
    target: {} as any,
    school: {} as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeriodSwapService,
        {
          provide: PeriodSwapRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(PeriodSwapService);
    repo = module.get(PeriodSwapRepository);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('create', () => {
    it('should create period swap request successfully', async () => {
      repo.create.mockResolvedValue(mockSwap as any);

      const result = await service.create(
        {
          targetId: mockTargetId,
          requesterDate: '2026-07-10',
          requesterPeriod: 3,
          targetDate: '2026-07-11',
          targetPeriod: 2,
          reason: 'Có việc cá nhân',
        },
        mockSchoolId,
        mockRequesterId,
      );

      expect(result.id).toBe('swap-001');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'period-swap.created',
        expect.objectContaining({ requesterId: mockRequesterId }),
      );
    });

    it('should throw BadRequestException when swapping with self', async () => {
      await expect(
        service.create(
          {
            targetId: mockRequesterId,
            requesterDate: '2026-07-10',
            requesterPeriod: 3,
            targetDate: '2026-07-11',
            targetPeriod: 2,
            reason: 'Test',
          },
          mockSchoolId,
          mockRequesterId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('acceptByTarget', () => {
    it('should accept and move to PENDING_ADMIN', async () => {
      repo.findById.mockResolvedValue(mockSwap as any);
      repo.update.mockResolvedValue(undefined);

      const acceptedSwap = { ...mockSwap, status: PeriodSwapStatus.PENDING_ADMIN };
      repo.findById
        .mockResolvedValueOnce(mockSwap as any)
        .mockResolvedValueOnce(acceptedSwap as any);

      const result = await service.acceptByTarget('swap-001', mockSchoolId, mockTargetId);

      expect(repo.update).toHaveBeenCalledWith(
        'swap-001',
        expect.objectContaining({ status: PeriodSwapStatus.PENDING_ADMIN }),
      );
    });

    it('should throw when non-target teacher tries to accept', async () => {
      repo.findById.mockResolvedValue(mockSwap as any);

      await expect(
        service.acceptByTarget('swap-001', mockSchoolId, 'other-teacher'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when swap is not PENDING_TEACHER', async () => {
      const adminPending = { ...mockSwap, status: PeriodSwapStatus.PENDING_ADMIN };
      repo.findById.mockResolvedValue(adminPending as any);

      await expect(
        service.acceptByTarget('swap-001', mockSchoolId, mockTargetId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approveByAdmin', () => {
    it('should approve swap and emit event', async () => {
      const pendingAdmin = { ...mockSwap, status: PeriodSwapStatus.PENDING_ADMIN };
      repo.findById.mockResolvedValue(pendingAdmin as any);
      repo.update.mockResolvedValue(undefined);

      const approvedSwap = { ...mockSwap, status: PeriodSwapStatus.APPROVED };
      repo.findById
        .mockResolvedValueOnce(pendingAdmin as any)
        .mockResolvedValueOnce(approvedSwap as any);

      const result = await service.approveByAdmin('swap-001', mockSchoolId, mockAdminId);

      expect(repo.update).toHaveBeenCalledWith(
        'swap-001',
        expect.objectContaining({
          status: PeriodSwapStatus.APPROVED,
          approvedBy: mockAdminId,
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'period-swap.approved',
        expect.objectContaining({ swapId: 'swap-001' }),
      );
    });

    it('should throw when swap is not PENDING_ADMIN', async () => {
      repo.findById.mockResolvedValue(mockSwap as any); // PENDING_TEACHER

      await expect(
        service.approveByAdmin('swap-001', mockSchoolId, mockAdminId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should cancel own request', async () => {
      repo.findById.mockResolvedValue(mockSwap as any);
      repo.update.mockResolvedValue(undefined);

      const cancelledSwap = { ...mockSwap, status: PeriodSwapStatus.CANCELLED };
      repo.findById
        .mockResolvedValueOnce(mockSwap as any)
        .mockResolvedValueOnce(cancelledSwap as any);

      await service.cancel('swap-001', mockSchoolId, mockRequesterId);

      expect(repo.update).toHaveBeenCalledWith(
        'swap-001',
        expect.objectContaining({ status: PeriodSwapStatus.CANCELLED }),
      );
    });

    it('should throw when non-requester tries to cancel', async () => {
      repo.findById.mockResolvedValue(mockSwap as any);

      await expect(
        service.cancel('swap-001', mockSchoolId, 'other-teacher'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when already approved', async () => {
      const approved = { ...mockSwap, status: PeriodSwapStatus.APPROVED };
      repo.findById.mockResolvedValue(approved as any);

      await expect(
        service.cancel('swap-001', mockSchoolId, mockRequesterId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException when not found', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.findById('invalid', mockSchoolId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
