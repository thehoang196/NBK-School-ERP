import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { SchoolService } from '../../../src/modules/school/school.service';
import { SchoolRepository } from '../../../src/modules/school/school.repository';
import { SchoolEntity } from '../../../src/modules/school/entities/school.entity';
import { SchoolStatus } from '../../../src/common/enums/status.enum';
import { SchoolQueryDto } from '../../../src/modules/school/dto/school-query.dto';

describe('SchoolService', () => {
  let service: SchoolService;
  let schoolRepository: jest.Mocked<SchoolRepository>;

  const mockSchool: SchoolEntity = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    code: 'TH01',
    name: 'Trường THPT Nguyễn Huệ',
    address: '123 Đường ABC, Quận 1, TP.HCM',
    phone: '0901234567',
    email: 'contact@nguyenhue.edu.vn',
    principalName: 'Nguyễn Văn A',
    parentSchoolId: null,
    parentSchool: null,
    childSchools: [],
    status: SchoolStatus.ACTIVE,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
  };

  beforeEach(async () => {
    const mockSchoolRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchoolService,
        { provide: SchoolRepository, useValue: mockSchoolRepository },
      ],
    }).compile();

    service = module.get<SchoolService>(SchoolService);
    schoolRepository = module.get(SchoolRepository) as jest.Mocked<SchoolRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated results with meta', async () => {
      const query: SchoolQueryDto = { page: 1, limit: 10, sortOrder: 'ASC' };
      const schools = [mockSchool];
      schoolRepository.findAll.mockResolvedValue([schools, 1]);

      const result = await service.findAll(query);

      expect(result).toEqual({
        success: true,
        data: schools,
        message: 'Lấy danh sách trường thành công',
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      });
      expect(schoolRepository.findAll).toHaveBeenCalledWith(query);
    });

    it('should calculate totalPages correctly', async () => {
      const query: SchoolQueryDto = { page: 1, limit: 5, sortOrder: 'ASC' };
      schoolRepository.findAll.mockResolvedValue([[mockSchool], 12]);

      const result = await service.findAll(query);

      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.total).toBe(12);
    });
  });

  describe('findById', () => {
    it('should return a school when found', async () => {
      schoolRepository.findById.mockResolvedValue(mockSchool);

      const result = await service.findById(mockSchool.id);

      expect(result).toEqual(mockSchool);
      expect(schoolRepository.findById).toHaveBeenCalledWith(mockSchool.id);
    });

    it('should throw NotFoundException when school not found', async () => {
      schoolRepository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
      await expect(service.findById('non-existent-id')).rejects.toThrow('Không tìm thấy trường');
    });
  });

  describe('create', () => {
    const createDto = {
      code: 'TH02',
      name: 'Trường Mới',
      address: '456 Đường XYZ',
      phone: '0909999999',
      email: 'new@school.vn',
      principalName: 'Trần Văn B',
      parentSchoolId: undefined,
      status: SchoolStatus.ACTIVE,
    };

    it('should create a school successfully', async () => {
      schoolRepository.findByCode.mockResolvedValue(null);
      const createdSchool = { ...mockSchool, code: 'TH02', name: 'Trường Mới' };
      schoolRepository.create.mockResolvedValue(createdSchool);

      const result = await service.create(createDto);

      expect(result).toEqual(createdSchool);
      expect(schoolRepository.findByCode).toHaveBeenCalledWith('TH02');
      expect(schoolRepository.create).toHaveBeenCalledWith({
        code: createDto.code,
        name: createDto.name,
        address: createDto.address,
        phone: createDto.phone,
        email: createDto.email,
        principalName: createDto.principalName,
        parentSchoolId: null,
        status: createDto.status,
      });
    });

    it('should throw ConflictException when code already exists', async () => {
      schoolRepository.findByCode.mockResolvedValue(mockSchool);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      await expect(service.create(createDto)).rejects.toThrow('Mã trường đã tồn tại');
    });
  });

  describe('update', () => {
    const updateDto = { name: 'Trường Cập Nhật' };

    it('should update a school successfully', async () => {
      const updatedSchool = { ...mockSchool, name: 'Trường Cập Nhật' };
      schoolRepository.findById.mockResolvedValue(mockSchool);
      schoolRepository.update.mockResolvedValue(updatedSchool);

      const result = await service.update(mockSchool.id, updateDto);

      expect(result).toEqual(updatedSchool);
      expect(schoolRepository.findById).toHaveBeenCalledWith(mockSchool.id);
      expect(schoolRepository.update).toHaveBeenCalledWith(mockSchool.id, updateDto);
    });

    it('should throw NotFoundException when school not found', async () => {
      schoolRepository.findById.mockResolvedValue(null);

      await expect(service.update('non-existent-id', updateDto)).rejects.toThrow(NotFoundException);
      await expect(service.update('non-existent-id', updateDto)).rejects.toThrow('Không tìm thấy trường');
    });

    it('should throw ConflictException when updating to duplicate code', async () => {
      const updateWithCode = { code: 'TH99' };
      const existingSchool = { ...mockSchool, id: 'other-id', code: 'TH99' };
      schoolRepository.findById.mockResolvedValue(mockSchool);
      schoolRepository.findByCode.mockResolvedValue(existingSchool);

      await expect(service.update(mockSchool.id, updateWithCode)).rejects.toThrow(ConflictException);
      await expect(service.update(mockSchool.id, updateWithCode)).rejects.toThrow('Mã trường đã tồn tại');
    });

    it('should not check code conflict when code is unchanged', async () => {
      const updateWithSameCode = { code: 'TH01', name: 'New Name' };
      const updatedSchool = { ...mockSchool, name: 'New Name' };
      schoolRepository.findById.mockResolvedValue(mockSchool);
      schoolRepository.update.mockResolvedValue(updatedSchool);

      const result = await service.update(mockSchool.id, updateWithSameCode);

      expect(result).toEqual(updatedSchool);
      expect(schoolRepository.findByCode).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove a school successfully', async () => {
      schoolRepository.findById.mockResolvedValue(mockSchool);
      schoolRepository.softDelete.mockResolvedValue(undefined);

      await service.remove(mockSchool.id);

      expect(schoolRepository.findById).toHaveBeenCalledWith(mockSchool.id);
      expect(schoolRepository.softDelete).toHaveBeenCalledWith(mockSchool.id);
    });

    it('should throw NotFoundException when school not found', async () => {
      schoolRepository.findById.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
      await expect(service.remove('non-existent-id')).rejects.toThrow('Không tìm thấy trường');
    });
  });
});
