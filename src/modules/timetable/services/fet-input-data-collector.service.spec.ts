import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FetInputDataCollectorService } from './fet-input-data-collector.service';
import {
  TeacherEntity,
  UnavailableSlot,
} from '../../teacher/entities/teacher.entity';
import { ClassEntity } from '../../class/entities/class.entity';
import { SubjectEntity } from '../../subject/entities/subject.entity';
import { RoomEntity } from '../../room/entities/room.entity';
import { PeriodDefinitionEntity } from '../../academic/entities/period-definition.entity';
import { SchoolEntity } from '../../school/entities/school.entity';
import { TeachingAssignmentEntity } from '../../teaching-assignment/entities/teaching-assignment.entity';
import { RoomType } from '../../../common/enums/status.enum';

describe('FetInputDataCollectorService', () => {
  let service: FetInputDataCollectorService;

  const schoolId = 'school-001';
  const semesterId = 'semester-001';

  const mockSchool: Partial<SchoolEntity> = {
    id: schoolId,
    name: 'Trường THCS Nguyễn Bỉnh Khiêm',
    deletedAt: null,
  };

  const mockTeachers: Partial<TeacherEntity>[] = [
    {
      id: 'teacher-001',
      schoolId,
      fullName: 'Nguyễn Văn A',
      shortName: 'A',
      maxPeriodsPerDay: 5,
      unavailableSlots: [
        { dayOfWeek: 2, periodId: 'period-001' },
      ] as UnavailableSlot[],
      deletedAt: null,
    },
    {
      id: 'teacher-002',
      schoolId,
      fullName: 'Trần Thị B',
      shortName: null,
      maxPeriodsPerDay: 6,
      unavailableSlots: null,
      deletedAt: null,
    },
  ];

  const mockClasses: Partial<ClassEntity>[] = [
    {
      id: 'class-001',
      schoolId,
      name: '6A1',
      gradeId: 'grade-001',
      deletedAt: null,
    },
    {
      id: 'class-002',
      schoolId,
      name: '6A2',
      gradeId: 'grade-001',
      deletedAt: null,
    },
  ];

  const mockSubjects: Partial<SubjectEntity>[] = [
    {
      id: 'subject-001',
      schoolId,
      name: 'Toán',
      requiresRoomType: RoomType.STANDARD,
      deletedAt: null,
    },
    {
      id: 'subject-002',
      schoolId,
      name: 'Tin học',
      requiresRoomType: RoomType.LAB,
      deletedAt: null,
    },
  ];

  const mockRooms: Partial<RoomEntity>[] = [
    {
      id: 'room-001',
      schoolId,
      name: 'Phòng 101',
      capacity: 40,
      roomType: RoomType.STANDARD,
      deletedAt: null,
    },
    {
      id: 'room-002',
      schoolId,
      name: 'Phòng máy',
      capacity: 30,
      roomType: RoomType.LAB,
      deletedAt: null,
    },
  ];

  const mockPeriodDefinitions: Partial<PeriodDefinitionEntity>[] = [
    {
      id: 'period-001',
      schoolId,
      periodNumber: 1,
      sessionId: 'session-001',
      deletedAt: null,
    },
    {
      id: 'period-002',
      schoolId,
      periodNumber: 2,
      sessionId: 'session-001',
      deletedAt: null,
    },
  ];

  const mockTeachingAssignments: Partial<TeachingAssignmentEntity>[] = [
    {
      id: 'ta-001',
      semesterId,
      teacherId: 'teacher-001',
      classId: 'class-001',
      subjectId: 'subject-001',
      periodsPerWeek: 4,
      deletedAt: null,
    },
    {
      id: 'ta-002',
      semesterId,
      teacherId: 'teacher-002',
      classId: 'class-002',
      subjectId: 'subject-002',
      periodsPerWeek: 2,
      deletedAt: null,
    },
  ];

  // Mock query builder for TeachingAssignment
  const mockQueryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(mockTeachingAssignments),
  };

  const mockTeacherRepo = {
    find: jest.fn().mockResolvedValue(mockTeachers),
  };

  const mockClassRepo = {
    find: jest.fn().mockResolvedValue(mockClasses),
  };

  const mockSubjectRepo = {
    find: jest.fn().mockResolvedValue(mockSubjects),
  };

  const mockRoomRepo = {
    find: jest.fn().mockResolvedValue(mockRooms),
  };

  const mockPeriodDefinitionRepo = {
    find: jest.fn().mockResolvedValue(mockPeriodDefinitions),
  };

  const mockSchoolRepo = {
    findOne: jest.fn().mockResolvedValue(mockSchool),
  };

  const mockTeachingAssignmentRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FetInputDataCollectorService,
        {
          provide: getRepositoryToken(TeacherEntity),
          useValue: mockTeacherRepo,
        },
        {
          provide: getRepositoryToken(ClassEntity),
          useValue: mockClassRepo,
        },
        {
          provide: getRepositoryToken(SubjectEntity),
          useValue: mockSubjectRepo,
        },
        {
          provide: getRepositoryToken(RoomEntity),
          useValue: mockRoomRepo,
        },
        {
          provide: getRepositoryToken(PeriodDefinitionEntity),
          useValue: mockPeriodDefinitionRepo,
        },
        {
          provide: getRepositoryToken(SchoolEntity),
          useValue: mockSchoolRepo,
        },
        {
          provide: getRepositoryToken(TeachingAssignmentEntity),
          useValue: mockTeachingAssignmentRepo,
        },
      ],
    }).compile();

    service = module.get<FetInputDataCollectorService>(
      FetInputDataCollectorService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('collectForGeneration', () => {
    it('should collect and assemble FetInputData correctly', async () => {
      const result = await service.collectForGeneration(semesterId, schoolId);

      expect(result.institution).toBe('Trường THCS Nguyễn Bỉnh Khiêm');
      expect(result.schoolId).toBe(schoolId);
      expect(result.semesterId).toBe(semesterId);
      expect(result.days).toEqual([
        'Thứ 2',
        'Thứ 3',
        'Thứ 4',
        'Thứ 5',
        'Thứ 6',
        'Thứ 7',
      ]);
    });

    it('should map teachers correctly using shortName when available', async () => {
      const result = await service.collectForGeneration(semesterId, schoolId);

      expect(result.teachers).toHaveLength(2);
      expect(result.teachers[0]).toEqual({
        id: 'teacher-001',
        name: 'A', // shortName used
        maxPeriodsPerDay: 5,
      });
      expect(result.teachers[1]).toEqual({
        id: 'teacher-002',
        name: 'Trần Thị B', // fullName fallback
        maxPeriodsPerDay: 6,
      });
    });

    it('should extract teacher availability from unavailableSlots', async () => {
      const result = await service.collectForGeneration(semesterId, schoolId);

      expect(result.teacherAvailability).toHaveLength(1);
      expect(result.teacherAvailability[0]).toEqual({
        teacherId: 'teacher-001',
        unavailableSlots: [{ dayOfWeek: 2, periodId: 'period-001' }],
      });
    });

    it('should map classes correctly', async () => {
      const result = await service.collectForGeneration(semesterId, schoolId);

      expect(result.classes).toHaveLength(2);
      expect(result.classes[0]).toEqual({
        id: 'class-001',
        name: '6A1',
        gradeId: 'grade-001',
      });
    });

    it('should map subjects correctly', async () => {
      const result = await service.collectForGeneration(semesterId, schoolId);

      expect(result.subjects).toHaveLength(2);
      expect(result.subjects[0]).toEqual({
        id: 'subject-001',
        name: 'Toán',
      });
    });

    it('should map rooms correctly', async () => {
      const result = await service.collectForGeneration(semesterId, schoolId);

      expect(result.rooms).toHaveLength(2);
      expect(result.rooms[0]).toEqual({
        id: 'room-001',
        name: 'Phòng 101',
        capacity: 40,
      });
    });

    it('should map period definitions correctly', async () => {
      const result = await service.collectForGeneration(semesterId, schoolId);

      expect(result.periodDefinitions).toHaveLength(2);
      expect(result.periodDefinitions[0]).toEqual({
        id: 'period-001',
        periodNumber: 1,
        name: 'Tiết 1',
        sessionId: 'session-001',
      });
    });

    it('should map teaching assignments correctly', async () => {
      const result = await service.collectForGeneration(semesterId, schoolId);

      expect(result.teachingAssignments).toHaveLength(2);
      expect(result.teachingAssignments[0]).toEqual({
        id: 'ta-001',
        teacherId: 'teacher-001',
        classId: 'class-001',
        subjectId: 'subject-001',
        periodsPerWeek: 4,
      });
    });

    it('should derive room constraints from subject requiresRoomType', async () => {
      const result = await service.collectForGeneration(semesterId, schoolId);

      // subject-001 requires STANDARD → matches room-001 (STANDARD)
      // subject-002 requires COMPUTER_LAB → matches room-002 (COMPUTER_LAB)
      expect(result.roomConstraints).toContainEqual({
        subjectId: 'subject-001',
        roomId: 'room-001',
        weight: 100,
      });
      expect(result.roomConstraints).toContainEqual({
        subjectId: 'subject-002',
        roomId: 'room-002',
        weight: 100,
      });
    });

    it('should filter all queries by schoolId for multi-tenant isolation', async () => {
      await service.collectForGeneration(semesterId, schoolId);

      // Verify teacher query filters by schoolId
      expect(mockTeacherRepo.find).toHaveBeenCalledWith({
        where: { schoolId, deletedAt: expect.anything() },
      });

      // Verify class query filters by schoolId
      expect(mockClassRepo.find).toHaveBeenCalledWith({
        where: { schoolId, deletedAt: expect.anything() },
      });

      // Verify subject query filters by schoolId
      expect(mockSubjectRepo.find).toHaveBeenCalledWith({
        where: { schoolId, deletedAt: expect.anything() },
      });

      // Verify room query filters by schoolId
      expect(mockRoomRepo.find).toHaveBeenCalledWith({
        where: { schoolId, deletedAt: expect.anything() },
      });

      // Verify period definition query filters by schoolId
      expect(mockPeriodDefinitionRepo.find).toHaveBeenCalledWith({
        where: { schoolId, deletedAt: expect.anything() },
        order: { periodNumber: 'ASC' },
      });

      // Verify school query filters by id
      expect(mockSchoolRepo.findOne).toHaveBeenCalledWith({
        where: { id: schoolId, deletedAt: expect.anything() },
      });

      // Verify teaching assignment query filters by schoolId via teacher join
      expect(
        mockTeachingAssignmentRepo.createQueryBuilder,
      ).toHaveBeenCalledWith('ta');
      expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith(
        'ta.teacher',
        'teacher',
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'teacher.schoolId = :schoolId',
        { schoolId },
      );
    });

    it('should handle empty data gracefully', async () => {
      mockTeacherRepo.find.mockResolvedValueOnce([]);
      mockClassRepo.find.mockResolvedValueOnce([]);
      mockSubjectRepo.find.mockResolvedValueOnce([]);
      mockRoomRepo.find.mockResolvedValueOnce([]);
      mockPeriodDefinitionRepo.find.mockResolvedValueOnce([]);
      mockQueryBuilder.getMany.mockResolvedValueOnce([]);

      const result = await service.collectForGeneration(semesterId, schoolId);

      expect(result.teachers).toEqual([]);
      expect(result.classes).toEqual([]);
      expect(result.subjects).toEqual([]);
      expect(result.rooms).toEqual([]);
      expect(result.periodDefinitions).toEqual([]);
      expect(result.teachingAssignments).toEqual([]);
      expect(result.teacherAvailability).toEqual([]);
      expect(result.roomConstraints).toEqual([]);
    });

    it('should return empty institution name when school not found', async () => {
      mockSchoolRepo.findOne.mockResolvedValueOnce(null);

      const result = await service.collectForGeneration(semesterId, schoolId);

      expect(result.institution).toBe('');
    });

    it('should skip teachers with no unavailable slots for availability', async () => {
      mockTeacherRepo.find.mockResolvedValueOnce([
        {
          id: 'teacher-003',
          schoolId,
          fullName: 'Lê Văn C',
          shortName: null,
          maxPeriodsPerDay: 4,
          unavailableSlots: [],
          deletedAt: null,
        },
      ]);

      const result = await service.collectForGeneration(semesterId, schoolId);

      expect(result.teacherAvailability).toEqual([]);
    });
  });
});
