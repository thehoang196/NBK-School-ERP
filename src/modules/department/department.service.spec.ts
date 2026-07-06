import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { DepartmentRepository } from './department.repository';
import { DepartmentEntity } from './entities/department.entity';
import { DuplicateDepartmentNameException } from './exceptions/duplicate-department-name.exception';

describe('DepartmentService', () => {
  let service: DepartmentService;
  let repository: jest.Mocked<DepartmentRepository>;

  const mockDepartment: DepartmentEntity = {
    id: 'dept-uuid',
    schoolId: 'school-uuid',
    name: 'Tổ Toán - Tin',
    headTeacherId: null,
    headTeacher: null,
    teachers: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    school: undefined as never,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentService,
        {
          provide: DepartmentRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            findBySchool: jest.fn(),
            findByNameAndSchool: jest.fn(),
            countActiveMembers: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DepartmentService>(DepartmentService);
    repository = module.get(DepartmentRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated departments', async () => {
      const query = { page: 1, limit: 10, sortOrder: 'ASC' as const };
      repository.findAll.mockResolvedValue([[mockDepartment], 1]);

      const result = await service.findAll(query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return department by id', async () => {
      repository.findById.mockResolvedValue(mockDepartment);
      const result = await service.findById('dept-uuid');
      expect(result).toEqual(mockDepartment);
    });

    it('should throw NotFoundException if not found', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a department', async () => {
      const dto = { schoolId: 'school-uuid', name: 'Tổ Toán - Tin' };
      repository.findByNameAndSchool.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockDepartment);

      const result = await service.create(dto);
      expect(result).toEqual(mockDepartment);
    });

    it('should create with headTeacherId', async () => {
      const dto = {
        schoolId: 'school-uuid',
        name: 'Tổ Văn',
        headTeacherId: 'teacher-uuid',
      };
      const dept = {
        ...mockDepartment,
        headTeacherId: 'teacher-uuid',
        name: 'Tổ Văn',
      };
      repository.findByNameAndSchool.mockResolvedValue(null);
      repository.create.mockResolvedValue(dept);

      const result = await service.create(dto);
      expect(result.headTeacherId).toBe('teacher-uuid');
    });

    it('should throw BadRequestException for empty name', async () => {
      const dto = { schoolId: 'school-uuid', name: '   ' };
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for name exceeding 100 characters', async () => {
      const dto = { schoolId: 'school-uuid', name: 'A'.repeat(101) };
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw DuplicateDepartmentNameException for duplicate name in same school', async () => {
      const dto = { schoolId: 'school-uuid', name: 'Tổ Toán - Tin' };
      repository.findByNameAndSchool.mockResolvedValue(mockDepartment);

      await expect(service.create(dto)).rejects.toThrow(
        DuplicateDepartmentNameException,
      );
    });

    it('should throw DuplicateDepartmentNameException for duplicate name case-insensitive in same school', async () => {
      const dto = { schoolId: 'school-uuid', name: 'tổ toán - tin' };
      repository.findByNameAndSchool.mockResolvedValue(mockDepartment);

      await expect(service.create(dto)).rejects.toThrow(
        DuplicateDepartmentNameException,
      );
    });

    it('should allow same name in different school', async () => {
      const dto = { schoolId: 'other-school-uuid', name: 'Tổ Toán - Tin' };
      repository.findByNameAndSchool.mockResolvedValue(null);
      repository.create.mockResolvedValue({
        ...mockDepartment,
        schoolId: 'other-school-uuid',
      });

      const result = await service.create(dto);
      expect(result.schoolId).toBe('other-school-uuid');
      expect(repository.findByNameAndSchool).toHaveBeenCalledWith(
        'Tổ Toán - Tin',
        'other-school-uuid',
        undefined,
      );
    });

    it('should use schoolScope when provided', async () => {
      const dto = { schoolId: 'other-school', name: 'Tổ Lý' };
      repository.findByNameAndSchool.mockResolvedValue(null);
      repository.create.mockResolvedValue({
        ...mockDepartment,
        schoolId: 'scope-school',
        name: 'Tổ Lý',
      });

      await service.create(dto, 'scope-school');
      expect(repository.findByNameAndSchool).toHaveBeenCalledWith(
        'Tổ Lý',
        'scope-school',
        undefined,
      );
      expect(repository.create).toHaveBeenCalledWith({
        schoolId: 'scope-school',
        name: 'Tổ Lý',
        headTeacherId: null,
      });
    });
  });

  describe('update', () => {
    it('should update a department', async () => {
      const dto = { name: 'Tổ Toán - Lý' };
      const updated = { ...mockDepartment, name: 'Tổ Toán - Lý' };

      repository.findById.mockResolvedValue(mockDepartment);
      repository.findByNameAndSchool.mockResolvedValue(null);
      repository.update.mockResolvedValue(updated);

      const result = await service.update('dept-uuid', dto);
      expect(result.name).toBe('Tổ Toán - Lý');
    });

    it('should throw NotFoundException if not found', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(
        service.update('nonexistent', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for empty name on update', async () => {
      repository.findById.mockResolvedValue(mockDepartment);
      await expect(service.update('dept-uuid', { name: '' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for whitespace-only name on update', async () => {
      repository.findById.mockResolvedValue(mockDepartment);
      await expect(
        service.update('dept-uuid', { name: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for name exceeding 100 characters on update', async () => {
      repository.findById.mockResolvedValue(mockDepartment);
      await expect(
        service.update('dept-uuid', { name: 'A'.repeat(101) }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw DuplicateDepartmentNameException for duplicate name on update', async () => {
      const otherDept = { ...mockDepartment, id: 'other-dept-uuid' };
      repository.findById.mockResolvedValue(mockDepartment);
      repository.findByNameAndSchool.mockResolvedValue(otherDept);

      await expect(
        service.update('dept-uuid', { name: 'Existing Name' }),
      ).rejects.toThrow(DuplicateDepartmentNameException);
    });

    it('should not validate name when name is not being updated', async () => {
      repository.findById.mockResolvedValue(mockDepartment);
      repository.update.mockResolvedValue({
        ...mockDepartment,
        headTeacherId: 'new-teacher',
      });

      const result = await service.update('dept-uuid', {
        headTeacherId: 'new-teacher',
      });
      expect(result.headTeacherId).toBe('new-teacher');
      expect(repository.findByNameAndSchool).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete a department with no active members', async () => {
      repository.findById.mockResolvedValue(mockDepartment);
      repository.countActiveMembers.mockResolvedValue(0);
      repository.softDelete.mockResolvedValue(undefined);

      await service.remove('dept-uuid');
      expect(repository.softDelete).toHaveBeenCalledWith('dept-uuid');
    });

    it('should throw NotFoundException if not found', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if department has active members', async () => {
      repository.findById.mockResolvedValue(mockDepartment);
      repository.countActiveMembers.mockResolvedValue(3);

      await expect(service.remove('dept-uuid')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.remove('dept-uuid')).rejects.toThrow(
        'Không thể xóa tổ bộ môn vì còn thành viên',
      );
    });
  });

  describe('findAll with schoolScope', () => {
    it('should apply schoolScope filter when provided', async () => {
      const query = { page: 1, limit: 10, sortOrder: 'ASC' as const };
      repository.findAll.mockResolvedValue([[mockDepartment], 1]);

      await service.findAll(query, 'school-uuid');

      expect(repository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: 'school-uuid' }),
      );
    });

    it('should not override schoolId when schoolScope is null', async () => {
      const query = {
        page: 1,
        limit: 10,
        sortOrder: 'ASC' as const,
        schoolId: 'original-school',
      };
      repository.findAll.mockResolvedValue([[], 0]);

      await service.findAll(query, null);

      expect(repository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: 'original-school' }),
      );
    });
  });
});
