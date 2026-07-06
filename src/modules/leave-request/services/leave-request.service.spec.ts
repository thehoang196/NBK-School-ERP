import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LeaveRequestService } from './leave-request.service';
import { LeaveRequestRepository } from '../repositories/leave-request.repository';
import { LeaveRequestStatus, LeaveRequestType } from '../enums';

describe('LeaveRequestService', () => {
  let service: LeaveRequestService;
  let repo: jest.Mocked<LeaveRequestRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockSchoolId = 'school-001';
  const mockTeacherId = 'teacher-001';
  const mockAdminId = 'admin-001';

  const mockRequest = {
    id: 'lr-001',
    schoolId: mockSchoolId,
    teacherId: mockTeacherId,
    leaveType: LeaveRequestType.ANNUAL,
    startDate: '2026-07-10',
    endDate: '2026-07-11',
    totalDays: 2,
    reason: 'Việc gia đình',
    status: LeaveRequestStatus.PENDING,
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    adminNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: mockTeacherId,
    updatedBy: null,
    version: 1,
    teacher: {} as any,
    school: {} as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveRequestService,
        {
          provide: LeaveRequestRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            findByTeacherAndDateRange: jest.fn(),
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

    service = module.get(LeaveRequestService);
    repo = module.get(LeaveRequestRepository);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('create', () => {
    it('should create leave request successfully', async () => {
      repo.findByTeacherAndDateRange.mockResolvedValue([]);
      repo.create.mockResolvedValue(mockRequest as any);

      const result = await service.create(
        {
          leaveType: LeaveRequestType.ANNUAL,
          startDate: '2026-07-10',
          endDate: '2026-07-11',
          totalDays: 2,
          reason: 'Việc gia đình',
        },
        mockSchoolId,
        mockTeacherId,
      );

      expect(result.id).toBe('lr-001');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'leave-request.created',
        expect.objectContaining({ teacherId: mockTeacherId }),
      );
    });

    it('should throw BadRequestException when startDate > endDate', async () => {
      await expect(
        service.create(
          {
            leaveType: LeaveRequestType.ANNUAL,
            startDate: '2026-07-15',
            endDate: '2026-07-10',
            totalDays: 1,
            reason: 'Test',
          },
          mockSchoolId,
          mockTeacherId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when overlapping request exists', async () => {
      repo.findByTeacherAndDateRange.mockResolvedValue([mockRequest as any]);

      await expect(
        service.create(
          {
            leaveType: LeaveRequestType.ANNUAL,
            startDate: '2026-07-10',
            endDate: '2026-07-11',
            totalDays: 2,
            reason: 'Test',
          },
          mockSchoolId,
          mockTeacherId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve', () => {
    it('should approve pending request', async () => {
      repo.findById.mockResolvedValue(mockRequest as any);
      repo.update.mockResolvedValue(undefined);

      const approvedRequest = { ...mockRequest, status: LeaveRequestStatus.APPROVED };
      repo.findById
        .mockResolvedValueOnce(mockRequest as any)
        .mockResolvedValueOnce(approvedRequest as any);

      const result = await service.approve('lr-001', mockSchoolId, mockAdminId, 'OK');

      expect(repo.update).toHaveBeenCalledWith(
        'lr-001',
        expect.objectContaining({ status: LeaveRequestStatus.APPROVED }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'leave-request.approved',
        expect.any(Object),
      );
    });

    it('should throw BadRequestException when request is not PENDING', async () => {
      const approvedRequest = { ...mockRequest, status: LeaveRequestStatus.APPROVED };
      repo.findById.mockResolvedValue(approvedRequest as any);

      await expect(
        service.approve('lr-001', mockSchoolId, mockAdminId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reject', () => {
    it('should reject pending request with reason', async () => {
      repo.findById.mockResolvedValue(mockRequest as any);
      repo.update.mockResolvedValue(undefined);

      const rejectedRequest = { ...mockRequest, status: LeaveRequestStatus.REJECTED };
      repo.findById
        .mockResolvedValueOnce(mockRequest as any)
        .mockResolvedValueOnce(rejectedRequest as any);

      const result = await service.reject('lr-001', mockSchoolId, mockAdminId, 'Không đủ điều kiện');

      expect(repo.update).toHaveBeenCalledWith(
        'lr-001',
        expect.objectContaining({
          status: LeaveRequestStatus.REJECTED,
          rejectionReason: 'Không đủ điều kiện',
        }),
      );
    });
  });

  describe('cancel', () => {
    it('should cancel own pending request', async () => {
      repo.findById.mockResolvedValue(mockRequest as any);
      repo.update.mockResolvedValue(undefined);

      const cancelledRequest = { ...mockRequest, status: LeaveRequestStatus.CANCELLED };
      repo.findById
        .mockResolvedValueOnce(mockRequest as any)
        .mockResolvedValueOnce(cancelledRequest as any);

      await service.cancel('lr-001', mockSchoolId, mockTeacherId);

      expect(repo.update).toHaveBeenCalledWith(
        'lr-001',
        expect.objectContaining({ status: LeaveRequestStatus.CANCELLED }),
      );
    });

    it('should throw BadRequestException when cancelling another teachers request', async () => {
      repo.findById.mockResolvedValue(mockRequest as any);

      await expect(
        service.cancel('lr-001', mockSchoolId, 'other-teacher'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when request is not PENDING', async () => {
      const approvedRequest = { ...mockRequest, status: LeaveRequestStatus.APPROVED };
      repo.findById.mockResolvedValue(approvedRequest as any);

      await expect(
        service.cancel('lr-001', mockSchoolId, mockTeacherId),
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
