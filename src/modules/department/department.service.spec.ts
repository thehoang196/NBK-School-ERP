import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { DepartmentRepository } from './department.repository';
import { DepartmentEntity } from './entities/department.entity';

describe('DepartmentService', () => {
  let service: DepartmentService;
  let repository: jest.Mocked<DepartmentRepository>;

  const mockDepartment: DepartmentEntity = {
    id: 'dept-uuid',
    schoolId: 'school-uuid',
    name: 'Tổ Toán - Tin',
    headTeacherId: null,
    headTeacher: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
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
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a department', async () => {
      const dto = { schoolId: 'school-uuid', name: 'Tổ Toán - Tin' };
      repository.create.mockResolvedValue(mockDepartment);

      const result = await service.create(dto);
      expect(result).toEqual(mockDepartment);
    });

    it('should create with headTeacherId', async () => {
      const dto = { schoolId: 'school-uuid', name: 'Tổ Văn', headTeacherId: 'teacher-uuid' };
      const dept = { ...mockDepartment, headTeacherId: 'teacher-uuid', name: 'Tổ Văn' };
      repository.create.mockResolvedValue(dept);

      const result = await service.create(dto);
      expect(result.headTeacherId).toBe('teacher-uuid');
    });
  });

  describe('update', () => {
    it('should update a department', async () => {
      const dto = { name: 'Tổ Toán - Lý' };
      const updated = { ...mockDepartment, name: 'Tổ Toán - Lý' };

      repository.findById.mockResolvedValue(mockDepartment);
      repository.update.mockResolvedValue(updated);

      const result = await service.update('dept-uuid', dto);
      expect(result.name).toBe('Tổ Toán - Lý');
    });

    it('should throw NotFoundException if not found', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.update('nonexistent', { name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete a department', async () => {
      repository.findById.mockResolvedValue(mockDepartment);
      repository.softDelete.mockResolvedValue(undefined);

      await service.remove('dept-uuid');
      expect(repository.softDelete).toHaveBeenCalledWith('dept-uuid');
    });

    it('should throw NotFoundException if not found', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
