import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SemesterService } from './semester.service';
import { SemesterRepository } from '../repositories/semester.repository';
import { AcademicYearRepository } from '../repositories/academic-year.repository';
import { SemesterEntity } from '../entities/semester.entity';
import { AcademicYearEntity } from '../entities/academic-year.entity';
import { AcademicStatus } from '../../../common/enums/status.enum';

describe('SemesterService', () => {
  let service: SemesterService;
  let semesterRepository: jest.Mocked<SemesterRepository>;
  let academicYearRepository: jest.Mocked<AcademicYearRepository>;

  const mockAcademicYear: AcademicYearEntity = {
    id: 'year-uuid',
    schoolId: 'school-uuid',
    name: '2025-2026',
    startDate: '2025-08-15',
    endDate: '2026-06-30',
    isCurrent: true,
    status: AcademicStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    school: undefined as never,
  };

  const mockSemester: SemesterEntity = {
    id: 'semester-uuid',
    academicYearId: 'year-uuid',
    name: 'Học kỳ 1',
    semesterNumber: 1,
    startDate: '2025-09-01',
    endDate: '2026-01-15',
    status: AcademicStatus.PLANNING,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    academicYear: undefined as never,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SemesterService,
        {
          provide: SemesterRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            findByAcademicYear: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        {
          provide: AcademicYearRepository,
          useValue: {
            findById: jest.fn(),
          },
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

  describe('findAll', () => {
    it('should return paginated semesters', async () => {
      const query = { page: 1, limit: 10, sortOrder: 'ASC' as const };
      semesterRepository.findAll.mockResolvedValue([[mockSemester], 1]);

      const result = await service.findAll(query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return semester by id', async () => {
      semesterRepository.findById.mockResolvedValue(mockSemester);
      const result = await service.findById('semester-uuid');
      expect(result).toEqual(mockSemester);
    });

    it('should throw NotFoundException if not found', async () => {
      semesterRepository.findById.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create semester within academic year range', async () => {
      const dto = {
        academicYearId: 'year-uuid',
        name: 'Học kỳ 1',
        semesterNumber: 1,
        startDate: '2025-09-01',
        endDate: '2026-01-15',
      };

      academicYearRepository.findById.mockResolvedValue(mockAcademicYear);
      semesterRepository.create.mockResolvedValue(mockSemester);

      const result = await service.create(dto);
      expect(result).toEqual(mockSemester);
    });

    it('should throw NotFoundException if academic year not found', async () => {
      academicYearRepository.findById.mockResolvedValue(null);

      await expect(
        service.create({
          academicYearId: 'nonexistent',
          name: 'HK1',
          semesterNumber: 1,
          startDate: '2025-09-01',
          endDate: '2026-01-15',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if start date is after end date', async () => {
      academicYearRepository.findById.mockResolvedValue(mockAcademicYear);

      await expect(
        service.create({
          academicYearId: 'year-uuid',
          name: 'HK1',
          semesterNumber: 1,
          startDate: '2026-02-01',
          endDate: '2025-09-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if dates outside academic year range', async () => {
      academicYearRepository.findById.mockResolvedValue(mockAcademicYear);

      await expect(
        service.create({
          academicYearId: 'year-uuid',
          name: 'HK1',
          semesterNumber: 1,
          startDate: '2025-07-01', // before academic year start
          endDate: '2025-12-31',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update semester', async () => {
      const dto = { name: 'Học kỳ 1 (cập nhật)' };
      const updated = { ...mockSemester, name: 'Học kỳ 1 (cập nhật)' };

      semesterRepository.findById.mockResolvedValue(mockSemester);
      semesterRepository.update.mockResolvedValue(updated);

      const result = await service.update('semester-uuid', dto);
      expect(result.name).toBe('Học kỳ 1 (cập nhật)');
    });

    it('should validate dates when updating dates', async () => {
      const dto = { startDate: '2025-07-01' }; // before academic year

      semesterRepository.findById.mockResolvedValue(mockSemester);
      academicYearRepository.findById.mockResolvedValue(mockAcademicYear);

      await expect(service.update('semester-uuid', dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should soft delete semester', async () => {
      semesterRepository.findById.mockResolvedValue(mockSemester);
      semesterRepository.softDelete.mockResolvedValue(undefined);

      await service.remove('semester-uuid');
      expect(semesterRepository.softDelete).toHaveBeenCalledWith('semester-uuid');
    });
  });
});
