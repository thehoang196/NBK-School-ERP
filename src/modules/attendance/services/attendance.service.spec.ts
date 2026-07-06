import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceRecordRepository } from '../repositories/attendance-record.repository';
import { AttendanceStatus, AttendanceMethod, LeaveType } from '../enums';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let recordRepository: jest.Mocked<AttendanceRecordRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockSchoolId = 'school-001';
  const mockUserId = 'user-001';
  const mockTeacherId = 'teacher-001';

  const mockRecord = {
    id: 'record-001',
    schoolId: mockSchoolId,
    teacherId: mockTeacherId,
    workDate: '2026-07-01',
    checkIn: '07:30',
    checkOut: '17:00',
    status: AttendanceStatus.PRESENT,
    method: AttendanceMethod.MANUAL,
    leaveType: null,
    overtimeHours: 0,
    workCoefficient: 1,
    note: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: mockUserId,
    updatedBy: null,
    version: 1,
    teacher: {} as any,
    school: {} as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        {
          provide: AttendanceRecordRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            findByTeacherAndDate: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AttendanceService);
    recordRepository = module.get(AttendanceRecordRepository);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('findAll', () => {
    it('should return paginated attendance records', async () => {
      recordRepository.findAll.mockResolvedValue([[mockRecord as any], 1]);

      const result = await service.findAll(mockSchoolId, {
        page: 1,
        limit: 20,
        sortOrder: 'ASC',
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(recordRepository.findAll).toHaveBeenCalledWith(mockSchoolId, expect.any(Object));
    });
  });

  describe('findById', () => {
    it('should return record when found', async () => {
      recordRepository.findById.mockResolvedValue(mockRecord as any);

      const result = await service.findById('record-001', mockSchoolId);
      expect(result.id).toBe('record-001');
    });

    it('should throw NotFoundException when record not found', async () => {
      recordRepository.findById.mockResolvedValue(null);

      await expect(service.findById('invalid', mockSchoolId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create attendance record successfully', async () => {
      recordRepository.findByTeacherAndDate.mockResolvedValue(null);
      recordRepository.create.mockResolvedValue(mockRecord as any);

      const result = await service.create(
        {
          teacherId: mockTeacherId,
          workDate: '2026-07-01',
          status: AttendanceStatus.PRESENT,
          checkIn: '07:30',
          checkOut: '17:00',
        },
        mockSchoolId,
        mockUserId,
      );

      expect(result.id).toBe('record-001');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'attendance.created',
        expect.objectContaining({ schoolId: mockSchoolId }),
      );
    });

    it('should throw BadRequestException when duplicate teacher+date', async () => {
      recordRepository.findByTeacherAndDate.mockResolvedValue(mockRecord as any);

      await expect(
        service.create(
          {
            teacherId: mockTeacherId,
            workDate: '2026-07-01',
            status: AttendanceStatus.PRESENT,
          },
          mockSchoolId,
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when LEAVE status without leaveType', async () => {
      recordRepository.findByTeacherAndDate.mockResolvedValue(null);

      await expect(
        service.create(
          {
            teacherId: mockTeacherId,
            workDate: '2026-07-01',
            status: AttendanceStatus.LEAVE,
          },
          mockSchoolId,
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set workCoefficient to 0.5 for HALF_DAY', async () => {
      recordRepository.findByTeacherAndDate.mockResolvedValue(null);
      recordRepository.create.mockResolvedValue({
        ...mockRecord,
        status: AttendanceStatus.HALF_DAY,
        workCoefficient: 0.5,
      } as any);

      await service.create(
        {
          teacherId: mockTeacherId,
          workDate: '2026-07-02',
          status: AttendanceStatus.HALF_DAY,
        },
        mockSchoolId,
        mockUserId,
      );

      expect(recordRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ workCoefficient: 0.5 }),
      );
    });
  });

  describe('delete', () => {
    it('should soft delete record', async () => {
      recordRepository.findById.mockResolvedValue(mockRecord as any);
      recordRepository.softDelete.mockResolvedValue(undefined);

      await service.delete('record-001', mockSchoolId);

      expect(recordRepository.softDelete).toHaveBeenCalledWith('record-001');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'attendance.deleted',
        expect.any(Object),
      );
    });

    it('should throw NotFoundException when record not found', async () => {
      recordRepository.findById.mockResolvedValue(null);

      await expect(service.delete('invalid', mockSchoolId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
