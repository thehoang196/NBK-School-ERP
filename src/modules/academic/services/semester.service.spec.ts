import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SemesterService } from './semester.service';
import { SemesterRepository } from '../repositories/semester.repository';
import { AcademicYearRepository } from '../repositories/academic-year.repository';
import { SemesterEntity } from '../entities/semester.entity';
import { AcademicYearEntity } from '../entities/academic-year.entity';
import { AcademicStatus } from '../../../common/enums/status.enum';
import { SemesterOutOfRangeException } from '../exceptions/semester-out-of-range.exception';

describe('SemesterService', () => {
  let service: SemesterService;
  let semesterRepository: jest.Mocked<SemesterRepository>;
  let academicYearRepository: jest.Mocked<AcademicYearRepository>;

  const schoolId = 'school-uuid';

  const mockAcademicYear: AcademicYearEntity = {
    id: 'ay-uuid-1',
    schoolId,
    name: '2025-2026',
    startDate: '2025-09-01',
    endDate: '2026-06-30',
    isCurrent: true,
    status: AcademicStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    school: undefined as never,
    semesters: [],
  };

  const mockSemester: SemesterEntity = {
    id: 'sem-uuid-1',
    academicYearId: 'ay-uuid-1',
    academicYear: mockAcademicYear,
    weeks: [],
    name: 'Học kỳ 1',
    semesterNumber: 1,
    startDate: '2025-09-01',
    endDate: '2026-01-15',
    status: AcademicStatus.PLANNING,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
  };

  beforeEach(async () => {
    const mockSemesterRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByAcademicYear: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const mockAcademicYearRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findBySchool: jest.fn(),
      findCurrent: jest.fn(),
      findOverlapping: jest.fn(),
      create: jest.fn(),
      createWithTransaction: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SemesterService,
        {
          provide: SemesterRepository,
          useValue: mockSemesterRepo,
        },
        {
          provide: AcademicYearRepository,
          useValue: mockAcademicYearRepo,
        },
      ],
    }).compile();

    service = module.get<SemesterService>(SemesterService);
    semesterRepository = module.get(SemesterRepository);
    academicYearRepository = module.get(AcademicYearRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      academicYearId: 'ay-uuid-1',
      name: 'Học kỳ 1',
      semesterNumber: 1,
      startDate: '2025-09-01',
      endDate: '2026-01-15',
    };

    it('should create semester successfully when dates are within academic year range', async () => {
      academicYearRepository.findById.mockResolvedValue(mockAcademicYear);
      semesterRepository.create.mockResolvedValue(mockSemester);

      const result = await service.create(schoolId, createDto);

      expect(result).toEqual(mockSemester);
      expect(academicYearRepository.findById).toHaveBeenCalledWith(
        'ay-uuid-1',
        schoolId,
      );
      expect(semesterRepository.create).toHaveBeenCalledWith({
        academicYearId: createDto.academicYearId,
        name: createDto.name,
        semesterNumber: createDto.semesterNumber,
        startDate: createDto.startDate,
        endDate: createDto.endDate,
        status: undefined,
      });
    });

    it('should throw NotFoundException when academic year does not exist', async () => {
      academicYearRepository.findById.mockResolvedValue(null);

      await expect(service.create(schoolId, createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw SemesterOutOfRangeException when startDate is before academic year startDate', async () => {
      academicYearRepository.findById.mockResolvedValue(mockAcademicYear);

      const dto = { ...createDto, startDate: '2025-08-01' };

      await expect(service.create(schoolId, dto)).rejects.toThrow(
        SemesterOutOfRangeException,
      );
    });

    it('should throw SemesterOutOfRangeException when endDate is after academic year endDate', async () => {
      academicYearRepository.findById.mockResolvedValue(mockAcademicYear);

      const dto = { ...createDto, endDate: '2026-07-15' };

      await expect(service.create(schoolId, dto)).rejects.toThrow(
        SemesterOutOfRangeException,
      );
    });

    it('should throw BadRequestException when startDate >= endDate', async () => {
      academicYearRepository.findById.mockResolvedValue(mockAcademicYear);

      const dto = {
        ...createDto,
        startDate: '2026-01-15',
        endDate: '2025-09-01',
      };

      await expect(service.create(schoolId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should accept semester dates exactly matching academic year boundaries', async () => {
      academicYearRepository.findById.mockResolvedValue(mockAcademicYear);

      const fullRangeDto = {
        ...createDto,
        startDate: '2025-09-01',
        endDate: '2026-06-30',
      };
      const fullRangeSemester = {
        ...mockSemester,
        startDate: '2025-09-01',
        endDate: '2026-06-30',
      };
      semesterRepository.create.mockResolvedValue(fullRangeSemester);

      const result = await service.create(schoolId, fullRangeDto);

      expect(result).toEqual(fullRangeSemester);
    });
  });

  describe('findAll', () => {
    it('should return paginated semesters', async () => {
      const query = { page: 1, limit: 10, sortOrder: 'ASC' as const };
      semesterRepository.findAll.mockResolvedValue([[mockSemester], 1]);

      const result = await service.findAll(schoolId, query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(mockSemester);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(semesterRepository.findAll).toHaveBeenCalledWith(schoolId, query);
    });

    it('should calculate totalPages correctly', async () => {
      const query = { page: 1, limit: 5, sortOrder: 'ASC' as const };
      semesterRepository.findAll.mockResolvedValue([[mockSemester], 12]);

      const result = await service.findAll(schoolId, query);

      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.total).toBe(12);
    });

    it('should return empty data when no semesters exist', async () => {
      const query = { page: 1, limit: 10, sortOrder: 'ASC' as const };
      semesterRepository.findAll.mockResolvedValue([[], 0]);

      const result = await service.findAll(schoolId, query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });

  describe('findById', () => {
    it('should return a semester by id', async () => {
      semesterRepository.findById.mockResolvedValue(mockSemester);

      const result = await service.findById('sem-uuid-1', schoolId);

      expect(result).toEqual(mockSemester);
      expect(semesterRepository.findById).toHaveBeenCalledWith(
        'sem-uuid-1',
        schoolId,
      );
    });

    it('should throw NotFoundException when semester does not exist', async () => {
      semesterRepository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent', schoolId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByAcademicYear', () => {
    it('should return semesters for a given academic year', async () => {
      const semester2 = {
        ...mockSemester,
        id: 'sem-uuid-2',
        name: 'Học kỳ 2',
        semesterNumber: 2,
      };
      semesterRepository.findByAcademicYear.mockResolvedValue([
        mockSemester,
        semester2,
      ]);

      const result = await service.findByAcademicYear('ay-uuid-1', schoolId);

      expect(result).toHaveLength(2);
      expect(result[0].semesterNumber).toBe(1);
      expect(result[1].semesterNumber).toBe(2);
      expect(semesterRepository.findByAcademicYear).toHaveBeenCalledWith(
        'ay-uuid-1',
        schoolId,
      );
    });

    it('should return empty array when no semesters exist for academic year', async () => {
      semesterRepository.findByAcademicYear.mockResolvedValue([]);

      const result = await service.findByAcademicYear(
        'ay-uuid-no-semesters',
        schoolId,
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('should update semester successfully', async () => {
      const updateDto = { name: 'Học kỳ 1 - Cập nhật' };
      const updatedSemester = { ...mockSemester, name: 'Học kỳ 1 - Cập nhật' };

      semesterRepository.findById.mockResolvedValue(mockSemester);
      semesterRepository.update.mockResolvedValue(updatedSemester);

      const result = await service.update('sem-uuid-1', schoolId, updateDto);

      expect(result.name).toBe('Học kỳ 1 - Cập nhật');
      expect(semesterRepository.update).toHaveBeenCalledWith(
        'sem-uuid-1',
        updateDto,
      );
    });

    it('should validate dates when updating startDate', async () => {
      semesterRepository.findById.mockResolvedValue(mockSemester);
      academicYearRepository.findById.mockResolvedValue(mockAcademicYear);

      const dto = { startDate: '2025-08-01' }; // before academic year start

      await expect(service.update('sem-uuid-1', schoolId, dto)).rejects.toThrow(
        SemesterOutOfRangeException,
      );
    });

    it('should validate dates when updating endDate', async () => {
      semesterRepository.findById.mockResolvedValue(mockSemester);
      academicYearRepository.findById.mockResolvedValue(mockAcademicYear);

      const dto = { endDate: '2026-07-15' }; // after academic year end

      await expect(service.update('sem-uuid-1', schoolId, dto)).rejects.toThrow(
        SemesterOutOfRangeException,
      );
    });

    it('should throw NotFoundException when semester not found during update', async () => {
      semesterRepository.findById.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', schoolId, { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow updating dates within academic year range', async () => {
      const updateDto = { startDate: '2025-10-01', endDate: '2026-02-15' };
      const updatedSemester = { ...mockSemester, ...updateDto };

      semesterRepository.findById.mockResolvedValue(mockSemester);
      academicYearRepository.findById.mockResolvedValue(mockAcademicYear);
      semesterRepository.update.mockResolvedValue(updatedSemester);

      const result = await service.update('sem-uuid-1', schoolId, updateDto);

      expect(result.startDate).toBe('2025-10-01');
      expect(result.endDate).toBe('2026-02-15');
    });
  });

  describe('remove', () => {
    it('should soft delete a semester', async () => {
      semesterRepository.findById.mockResolvedValue(mockSemester);
      semesterRepository.softDelete.mockResolvedValue(undefined);

      await service.remove('sem-uuid-1', schoolId);

      expect(semesterRepository.softDelete).toHaveBeenCalledWith('sem-uuid-1');
    });

    it('should throw NotFoundException when semester not found during delete', async () => {
      semesterRepository.findById.mockResolvedValue(null);

      await expect(service.remove('nonexistent', schoolId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
