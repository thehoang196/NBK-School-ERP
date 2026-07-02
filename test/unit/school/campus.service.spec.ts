import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CampusService } from '../../../src/modules/school/campus.service';
import { CampusRepository } from '../../../src/modules/school/campus.repository';
import { SchoolRepository } from '../../../src/modules/school/school.repository';
import { CampusEntity } from '../../../src/modules/school/entities/campus.entity';
import { SchoolEntity } from '../../../src/modules/school/entities/school.entity';
import { CampusStatus, SchoolStatus } from '../../../src/common/enums/status.enum';
import { CampusQueryDto } from '../../../src/modules/school/dto/campus-query.dto';

describe('CampusService', () => {
  let service: CampusService;
  let campusRepository: jest.Mocked<CampusRepository>;
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

  const mockCampus: CampusEntity = {
    id: 'aaa11111-e89b-12d3-a456-426614174000',
    code: 'CS01',
    name: 'Cơ sở 1 - Quận 1',
    address: '123 Đường ABC, Quận 1, TP.HCM',
    schoolId: mockSchool.id,
    school: mockSchool,
    status: CampusStatus.ACTIVE,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
  };

  beforeEach(async () => {
    const mockCampusRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

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
        CampusService,
        { provide: CampusRepository, useValue: mockCampusRepository },
        { provide: SchoolRepository, useValue: mockSchoolRepository },
      ],
    }).compile();

    service = module.get<CampusService>(CampusService);
    campusRepository = module.get(CampusRepository) as jest.Mocked<CampusRepository>;
    schoolRepository = module.get(SchoolRepository) as jest.Mocked<SchoolRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated results with meta', async () => {
      const query: CampusQueryDto = { page: 1, limit: 10, sortOrder: 'ASC' };
      const campuses = [mockCampus];
      campusRepository.findAll.mockResolvedValue([campuses, 1]);

      const result = await service.findAll(query);

      expect(result).toEqual({
        success: true,
        data: campuses,
        message: 'Lấy danh sách cơ sở thành công',
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      });
      expect(campusRepository.findAll).toHaveBeenCalledWith(query, undefined);
    });

    it('should calculate totalPages correctly', async () => {
      const query: CampusQueryDto = { page: 1, limit: 5, sortOrder: 'ASC' };
      campusRepository.findAll.mockResolvedValue([[mockCampus], 12]);

      const result = await service.findAll(query);

      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.total).toBe(12);
    });

    it('should filter by schoolId when provided', async () => {
      const query: CampusQueryDto = { page: 1, limit: 10, sortOrder: 'ASC', schoolId: mockSchool.id };
      campusRepository.findAll.mockResolvedValue([[mockCampus], 1]);

      await service.findAll(query);

      expect(campusRepository.findAll).toHaveBeenCalledWith(query, mockSchool.id);
    });
  });

  describe('findById', () => {
    it('should return a campus when found', async () => {
      campusRepository.findById.mockResolvedValue(mockCampus);

      const result = await service.findById(mockCampus.id);

      expect(result).toEqual(mockCampus);
      expect(campusRepository.findById).toHaveBeenCalledWith(mockCampus.id);
    });

    it('should throw NotFoundException when campus not found', async () => {
      campusRepository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
      await expect(service.findById('non-existent-id')).rejects.toThrow('Không tìm thấy cơ sở');
    });
  });

  describe('create', () => {
    const createDto = {
      code: 'CS02',
      name: 'Cơ sở 2 - Quận 7',
      address: '456 Đường XYZ, Quận 7, TP.HCM',
      schoolId: mockSchool.id,
      status: CampusStatus.ACTIVE,
    };

    it('should create a campus successfully', async () => {
      schoolRepository.findById.mockResolvedValue(mockSchool);
      campusRepository.findByCode.mockResolvedValue(null);
      const createdCampus = { ...mockCampus, code: 'CS02', name: 'Cơ sở 2 - Quận 7' };
      campusRepository.create.mockResolvedValue(createdCampus);

      const result = await service.create(createDto);

      expect(result).toEqual(createdCampus);
      expect(schoolRepository.findById).toHaveBeenCalledWith(mockSchool.id);
      expect(campusRepository.findByCode).toHaveBeenCalledWith('CS02', mockSchool.id);
      expect(campusRepository.create).toHaveBeenCalledWith({
        code: createDto.code,
        name: createDto.name,
        address: createDto.address,
        schoolId: createDto.schoolId,
        status: createDto.status,
      });
    });

    it('should throw ConflictException when campus code already exists in same school', async () => {
      schoolRepository.findById.mockResolvedValue(mockSchool);
      campusRepository.findByCode.mockResolvedValue(mockCampus);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      await expect(service.create(createDto)).rejects.toThrow('Mã cơ sở đã tồn tại trong trường này');
    });

    it('should throw NotFoundException when school does not exist', async () => {
      schoolRepository.findById.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
      await expect(service.create(createDto)).rejects.toThrow('Không tìm thấy trường');
    });
  });

  describe('update', () => {
    const updateDto = { name: 'Cơ sở Cập Nhật' };

    it('should update a campus successfully', async () => {
      const updatedCampus = { ...mockCampus, name: 'Cơ sở Cập Nhật' };
      campusRepository.findById.mockResolvedValue(mockCampus);
      campusRepository.update.mockResolvedValue(updatedCampus);

      const result = await service.update(mockCampus.id, updateDto);

      expect(result).toEqual(updatedCampus);
      expect(campusRepository.findById).toHaveBeenCalledWith(mockCampus.id);
      expect(campusRepository.update).toHaveBeenCalledWith(mockCampus.id, updateDto);
    });

    it('should throw NotFoundException when campus not found', async () => {
      campusRepository.findById.mockResolvedValue(null);

      await expect(service.update('non-existent-id', updateDto)).rejects.toThrow(NotFoundException);
      await expect(service.update('non-existent-id', updateDto)).rejects.toThrow('Không tìm thấy cơ sở');
    });

    it('should throw ConflictException when updating to duplicate code within same school', async () => {
      const updateWithCode = { code: 'CS99' };
      const existingCampus = { ...mockCampus, id: 'other-id', code: 'CS99' };
      campusRepository.findById.mockResolvedValue(mockCampus);
      campusRepository.findByCode.mockResolvedValue(existingCampus);

      await expect(service.update(mockCampus.id, updateWithCode)).rejects.toThrow(ConflictException);
      await expect(service.update(mockCampus.id, updateWithCode)).rejects.toThrow('Mã cơ sở đã tồn tại trong trường này');
    });

    it('should not check code conflict when code is unchanged', async () => {
      const updateWithSameCode = { code: 'CS01', name: 'New Name' };
      const updatedCampus = { ...mockCampus, name: 'New Name' };
      campusRepository.findById.mockResolvedValue(mockCampus);
      campusRepository.update.mockResolvedValue(updatedCampus);

      const result = await service.update(mockCampus.id, updateWithSameCode);

      expect(result).toEqual(updatedCampus);
      expect(campusRepository.findByCode).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when changing to non-existent school', async () => {
      const updateWithSchool = { schoolId: 'non-existent-school-id' };
      campusRepository.findById.mockResolvedValue(mockCampus);
      schoolRepository.findById.mockResolvedValue(null);

      await expect(service.update(mockCampus.id, updateWithSchool)).rejects.toThrow(NotFoundException);
      await expect(service.update(mockCampus.id, updateWithSchool)).rejects.toThrow('Không tìm thấy trường');
    });
  });

  describe('remove', () => {
    it('should remove a campus successfully', async () => {
      campusRepository.findById.mockResolvedValue(mockCampus);
      campusRepository.softDelete.mockResolvedValue(undefined);

      await service.remove(mockCampus.id);

      expect(campusRepository.findById).toHaveBeenCalledWith(mockCampus.id);
      expect(campusRepository.softDelete).toHaveBeenCalledWith(mockCampus.id);
    });

    it('should throw NotFoundException when campus not found', async () => {
      campusRepository.findById.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
      await expect(service.remove('non-existent-id')).rejects.toThrow('Không tìm thấy cơ sở');
    });
  });
});
