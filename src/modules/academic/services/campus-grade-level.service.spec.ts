import { CampusGradeLevelService } from './campus-grade-level.service';
import { CampusGradeLevelRepository } from '../repositories/campus-grade-level.repository';
import { CampusGradeLevelExistsException } from '../exceptions/campus-grade-level-exists.exception';
import { CampusGradeLevelNotFoundException } from '../exceptions/campus-grade-level-not-found.exception';
import { GradeLevel } from '../enums';
import { AssignGradeLevelDto } from '../dto/campus-grade-level/assign-grade-level.dto';

describe('CampusGradeLevelService', () => {
  let service: CampusGradeLevelService;
  let repository: jest.Mocked<CampusGradeLevelRepository>;

  const schoolId = 'school-uuid-1';
  const campusId = 'campus-uuid-1';
  const recordId = 'record-uuid-1';

  const mockRecord = {
    id: recordId,
    campusId,
    schoolId,
    gradeLevel: GradeLevel.PRIMARY,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findByCampus: jest.fn(),
      findByGradeLevel: jest.fn(),
      findByCampusAndGrade: jest.fn(),
      findById: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<CampusGradeLevelRepository>;

    service = new CampusGradeLevelService(repository);
  });

  describe('assign', () => {
    const dto: AssignGradeLevelDto = {
      campusId,
      gradeLevel: GradeLevel.PRIMARY,
    };

    it('should create a new campus-grade-level record', async () => {
      repository.findByCampusAndGrade.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockRecord as any);

      const result = await service.assign(dto, schoolId);

      expect(repository.findByCampusAndGrade).toHaveBeenCalledWith(
        campusId,
        GradeLevel.PRIMARY,
        schoolId,
      );
      expect(repository.create).toHaveBeenCalledWith({
        campusId,
        gradeLevel: GradeLevel.PRIMARY,
        schoolId,
      });
      expect(result).toEqual(mockRecord);
    });

    it('should throw CampusGradeLevelExistsException when duplicate', async () => {
      repository.findByCampusAndGrade.mockResolvedValue(mockRecord as any);

      await expect(service.assign(dto, schoolId)).rejects.toThrow(
        CampusGradeLevelExistsException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft-delete an existing record', async () => {
      repository.findById.mockResolvedValue(mockRecord as any);
      repository.softDelete.mockResolvedValue(undefined);

      await service.remove(recordId, schoolId);

      expect(repository.findById).toHaveBeenCalledWith(recordId, schoolId);
      expect(repository.softDelete).toHaveBeenCalledWith(recordId);
    });

    it('should throw CampusGradeLevelNotFoundException when not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove(recordId, schoolId)).rejects.toThrow(
        CampusGradeLevelNotFoundException,
      );
      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('findByCampus', () => {
    it('should return grade levels for a campus', async () => {
      const records = [mockRecord as any];
      repository.findByCampus.mockResolvedValue(records);

      const result = await service.findByCampus(campusId, schoolId);

      expect(repository.findByCampus).toHaveBeenCalledWith(campusId, schoolId);
      expect(result).toEqual(records);
    });

    it('should return empty array when no records', async () => {
      repository.findByCampus.mockResolvedValue([]);

      const result = await service.findByCampus(campusId, schoolId);

      expect(result).toEqual([]);
    });
  });

  describe('findByGradeLevel', () => {
    it('should return campuses for a grade level', async () => {
      const records = [mockRecord as any];
      repository.findByGradeLevel.mockResolvedValue(records);

      const result = await service.findByGradeLevel(
        GradeLevel.PRIMARY,
        schoolId,
      );

      expect(repository.findByGradeLevel).toHaveBeenCalledWith(
        GradeLevel.PRIMARY,
        schoolId,
      );
      expect(result).toEqual(records);
    });

    it('should return empty array when no records', async () => {
      repository.findByGradeLevel.mockResolvedValue([]);

      const result = await service.findByGradeLevel(
        GradeLevel.HIGH_SCHOOL,
        schoolId,
      );

      expect(result).toEqual([]);
    });
  });

  describe('exists', () => {
    it('should return true when campus-grade-level pair exists', async () => {
      repository.findByCampusAndGrade.mockResolvedValue(mockRecord as any);

      const result = await service.exists(
        campusId,
        GradeLevel.PRIMARY,
        schoolId,
      );

      expect(repository.findByCampusAndGrade).toHaveBeenCalledWith(
        campusId,
        GradeLevel.PRIMARY,
        schoolId,
      );
      expect(result).toBe(true);
    });

    it('should return false when campus-grade-level pair does not exist', async () => {
      repository.findByCampusAndGrade.mockResolvedValue(null);

      const result = await service.exists(
        campusId,
        GradeLevel.MIDDLE_SCHOOL,
        schoolId,
      );

      expect(repository.findByCampusAndGrade).toHaveBeenCalledWith(
        campusId,
        GradeLevel.MIDDLE_SCHOOL,
        schoolId,
      );
      expect(result).toBe(false);
    });
  });
});
