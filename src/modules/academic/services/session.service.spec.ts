import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionRepository } from '../repositories/session.repository';
import { CampusGradeLevelRepository } from '../repositories/campus-grade-level.repository';
import { SessionEntity } from '../entities/session.entity';
import { GradeLevel } from '../enums';

describe('SessionService', () => {
  let service: SessionService;
  let sessionRepository: jest.Mocked<SessionRepository>;
  let campusGradeLevelRepository: jest.Mocked<CampusGradeLevelRepository>;

  const schoolId = 'school-uuid';
  const campusId = 'campus-uuid';

  const mockSession: SessionEntity = {
    id: 'session-uuid-1',
    schoolId,
    campusId,
    gradeLevel: GradeLevel.HIGH_SCHOOL,
    name: 'Sáng',
    startTime: '07:00',
    endTime: '11:30',
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    school: undefined as never,
    campus: undefined as never,
    periodDefinitions: [],
  };

  beforeEach(async () => {
    const mockSessionRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findBySchool: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const mockCampusGradeLevelRepository = {
      findByCampusAndGrade: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: SessionRepository,
          useValue: mockSessionRepository,
        },
        {
          provide: CampusGradeLevelRepository,
          useValue: mockCampusGradeLevelRepository,
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    sessionRepository = module.get(SessionRepository);
    campusGradeLevelRepository = module.get(CampusGradeLevelRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      campusId,
      gradeLevel: GradeLevel.HIGH_SCHOOL,
      name: 'Sáng',
      startTime: '07:00',
      endTime: '11:30',
      sortOrder: 1,
    };

    it('should create a session successfully', async () => {
      campusGradeLevelRepository.findByCampusAndGrade.mockResolvedValue({
        id: 'cgl-uuid',
        schoolId,
        campusId,
        gradeLevel: GradeLevel.HIGH_SCHOOL,
      } as never);
      sessionRepository.create.mockResolvedValue(mockSession);

      const result = await service.create(createDto, schoolId);

      expect(result).toEqual(mockSession);
      expect(
        campusGradeLevelRepository.findByCampusAndGrade,
      ).toHaveBeenCalledWith(campusId, GradeLevel.HIGH_SCHOOL, schoolId);
      expect(sessionRepository.create).toHaveBeenCalledWith({
        schoolId,
        campusId,
        gradeLevel: GradeLevel.HIGH_SCHOOL,
        name: 'Sáng',
        startTime: '07:00',
        endTime: '11:30',
        sortOrder: 1,
      });
    });

    it('should throw BadRequestException when startTime >= endTime', async () => {
      const invalidDto = {
        ...createDto,
        startTime: '14:00',
        endTime: '11:30',
      };

      await expect(service.create(invalidDto, schoolId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(invalidDto, schoolId)).rejects.toThrow(
        'Giờ bắt đầu phải trước giờ kết thúc',
      );
    });

    it('should throw BadRequestException when startTime equals endTime', async () => {
      const invalidDto = {
        ...createDto,
        startTime: '08:00',
        endTime: '08:00',
      };

      await expect(service.create(invalidDto, schoolId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw CampusGradeLevelNotFoundException when campus-grade config not found', async () => {
      campusGradeLevelRepository.findByCampusAndGrade.mockResolvedValue(null);

      await expect(service.create(createDto, schoolId)).rejects.toThrow(
        'Cơ sở - cấp học chưa được thiết lập',
      );
    });

    it('should default sortOrder to 0 when not provided', async () => {
      const dtoWithoutSortOrder = {
        campusId,
        gradeLevel: GradeLevel.HIGH_SCHOOL,
        name: 'Chiều',
        startTime: '13:00',
        endTime: '17:00',
      };

      campusGradeLevelRepository.findByCampusAndGrade.mockResolvedValue({
        id: 'cgl-uuid',
        schoolId,
        campusId,
        gradeLevel: GradeLevel.HIGH_SCHOOL,
      } as never);
      sessionRepository.create.mockResolvedValue({
        ...mockSession,
        name: 'Chiều',
        sortOrder: 0,
      });

      await service.create(dtoWithoutSortOrder, schoolId);

      expect(sessionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ sortOrder: 0 }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated sessions sorted by sortOrder', async () => {
      const query = { page: 1, limit: 10, sortOrder: 'ASC' as const };
      const sessions = [
        { ...mockSession, sortOrder: 1 },
        { ...mockSession, id: 'session-uuid-2', name: 'Chiều', sortOrder: 2 },
      ];
      sessionRepository.findAll.mockResolvedValue([sessions, 2]);

      const result = await service.findAll(query as never, schoolId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.totalPages).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(sessionRepository.findAll).toHaveBeenCalledWith(query, schoolId);
    });

    it('should calculate totalPages correctly', async () => {
      const query = { page: 1, limit: 2, sortOrder: 'ASC' as const };
      sessionRepository.findAll.mockResolvedValue([[mockSession], 5]);

      const result = await service.findAll(query as never, schoolId);

      expect(result.meta.totalPages).toBe(3);
    });

    it('should return empty data when no sessions found', async () => {
      const query = { page: 1, limit: 10, sortOrder: 'ASC' as const };
      sessionRepository.findAll.mockResolvedValue([[], 0]);

      const result = await service.findAll(query as never, schoolId);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });

  describe('findById', () => {
    it('should return a session by id', async () => {
      sessionRepository.findById.mockResolvedValue(mockSession);

      const result = await service.findById('session-uuid-1', schoolId);

      expect(result).toEqual(mockSession);
      expect(sessionRepository.findById).toHaveBeenCalledWith(
        'session-uuid-1',
        schoolId,
      );
    });

    it('should throw NotFoundException when session not found', async () => {
      sessionRepository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent', schoolId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById('nonexistent', schoolId)).rejects.toThrow(
        'Không tìm thấy ca học',
      );
    });
  });

  describe('findBySchool', () => {
    it('should return all sessions for a school', async () => {
      const sessions = [
        mockSession,
        { ...mockSession, id: 'session-uuid-2', name: 'Chiều' },
      ];
      sessionRepository.findBySchool.mockResolvedValue(sessions);

      const result = await service.findBySchool(schoolId);

      expect(result).toEqual(sessions);
      expect(sessionRepository.findBySchool).toHaveBeenCalledWith(schoolId);
    });
  });

  describe('update', () => {
    it('should update a session successfully', async () => {
      const updateDto = { name: 'Sáng sớm' };
      const updatedSession = { ...mockSession, name: 'Sáng sớm' };

      sessionRepository.findById.mockResolvedValue(mockSession);
      sessionRepository.update.mockResolvedValue(updatedSession);

      const result = await service.update(
        'session-uuid-1',
        updateDto,
        schoolId,
      );

      expect(result.name).toBe('Sáng sớm');
      expect(sessionRepository.update).toHaveBeenCalledWith(
        'session-uuid-1',
        updateDto,
      );
    });

    it('should throw BadRequestException when both startTime and endTime invalid', async () => {
      const updateDto = { startTime: '14:00', endTime: '11:30' };
      sessionRepository.findById.mockResolvedValue(mockSession);

      await expect(
        service.update('session-uuid-1', updateDto, schoolId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when only startTime provided and >= existing endTime', async () => {
      const updateDto = { startTime: '12:00' };
      sessionRepository.findById.mockResolvedValue(mockSession); // endTime is '11:30'

      await expect(
        service.update('session-uuid-1', updateDto, schoolId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when only endTime provided and existing startTime >= endTime', async () => {
      const updateDto = { endTime: '06:00' };
      sessionRepository.findById.mockResolvedValue(mockSession); // startTime is '07:00'

      await expect(
        service.update('session-uuid-1', updateDto, schoolId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when session not found', async () => {
      sessionRepository.findById.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Test' }, schoolId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when update returns null', async () => {
      sessionRepository.findById.mockResolvedValue(mockSession);
      sessionRepository.update.mockResolvedValue(null);

      await expect(
        service.update('session-uuid-1', { name: 'Test' }, schoolId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete a session', async () => {
      sessionRepository.findById.mockResolvedValue(mockSession);
      sessionRepository.softDelete.mockResolvedValue(undefined);

      await service.remove('session-uuid-1', schoolId);

      expect(sessionRepository.softDelete).toHaveBeenCalledWith(
        'session-uuid-1',
      );
    });

    it('should throw NotFoundException when session not found during remove', async () => {
      sessionRepository.findById.mockResolvedValue(null);

      await expect(service.remove('nonexistent', schoolId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
