import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PayComponentService } from '../../../src/modules/compensation/services/pay-component.service';
import { PayComponentRepository } from '../../../src/modules/compensation/repositories/pay-component.repository';
import { PayComponentEntity } from '../../../src/modules/compensation/entities/pay-component.entity';
import { CreatePayComponentDto } from '../../../src/modules/compensation/dto/pay-component/create-pay-component.dto';
import { UpdatePayComponentDto } from '../../../src/modules/compensation/dto/pay-component/update-pay-component.dto';
import { PayComponentType } from '../../../src/modules/compensation/enums';
import { EntityStatus } from '../../../src/common/enums/status.enum';

describe('PayComponentService', () => {
  let service: PayComponentService;
  let repository: jest.Mocked<PayComponentRepository>;

  const mockPayComponent: PayComponentEntity = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    schoolId: '550e8400-e29b-41d4-a716-446655440000',
    code: 'BASIC_SALARY',
    name: 'Lương cơ bản',
    type: PayComponentType.EARNING,
    sortOrder: 1,
    isTaxable: true,
    isInsuranceApplicable: true,
    isStatutory: false,
    status: EntityStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const mockRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      findByIds: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayComponentService,
        {
          provide: PayComponentRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PayComponentService>(PayComponentService);
    repository = module.get(PayComponentRepository);
  });

  describe('create', () => {
    it('should create a pay component successfully', async () => {
      const dto: CreatePayComponentDto = {
        schoolId: '550e8400-e29b-41d4-a716-446655440000',
        code: 'BASIC_SALARY',
        name: 'Lương cơ bản',
        type: PayComponentType.EARNING,
      };

      repository.findByCode.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockPayComponent);

      const result = await service.create(dto);

      expect(result).toEqual(mockPayComponent);
      expect(repository.findByCode).toHaveBeenCalledWith('BASIC_SALARY', dto.schoolId);
      expect(repository.create).toHaveBeenCalledWith(dto);
    });

    it('should throw BadRequestException for invalid code format', async () => {
      const dto: CreatePayComponentDto = {
        schoolId: '550e8400-e29b-41d4-a716-446655440000',
        code: 'basic_salary', // lowercase - invalid
        name: 'Lương cơ bản',
        type: PayComponentType.EARNING,
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for code starting with number', async () => {
      const dto: CreatePayComponentDto = {
        schoolId: '550e8400-e29b-41d4-a716-446655440000',
        code: '1BASIC',
        name: 'Lương cơ bản',
        type: PayComponentType.EARNING,
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException for duplicate code in same school', async () => {
      const dto: CreatePayComponentDto = {
        schoolId: '550e8400-e29b-41d4-a716-446655440000',
        code: 'BASIC_SALARY',
        name: 'Lương cơ bản',
        type: PayComponentType.EARNING,
      };

      repository.findByCode.mockResolvedValue(mockPayComponent);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update a pay component successfully', async () => {
      const dto: UpdatePayComponentDto = {
        name: 'Lương cơ bản (cập nhật)',
        sortOrder: 2,
      };

      const updatedEntity = { ...mockPayComponent, ...dto };
      repository.findById.mockResolvedValue(mockPayComponent);
      repository.update.mockResolvedValue(updatedEntity);

      const result = await service.update(mockPayComponent.id, dto);

      expect(result).toEqual(updatedEntity);
      expect(repository.update).toHaveBeenCalledWith(mockPayComponent.id, dto);
    });

    it('should throw NotFoundException when pay component not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('non-existing-id', { name: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject code change when referenced by active formula', async () => {
      const dto: UpdatePayComponentDto = {
        code: 'NEW_CODE',
      };

      repository.findById.mockResolvedValue(mockPayComponent);

      // Mock the method to return true (referenced by formula)
      jest.spyOn(service, 'isReferencedByActiveFormula').mockResolvedValue(true);

      await expect(service.update(mockPayComponent.id, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow name/sortOrder change when referenced by active formula', async () => {
      const dto: UpdatePayComponentDto = {
        name: 'Tên mới',
        sortOrder: 5,
      };

      const updatedEntity = { ...mockPayComponent, ...dto };
      repository.findById.mockResolvedValue(mockPayComponent);
      repository.update.mockResolvedValue(updatedEntity);

      jest.spyOn(service, 'isReferencedByActiveFormula').mockResolvedValue(true);

      const result = await service.update(mockPayComponent.id, dto);

      expect(result).toEqual(updatedEntity);
    });
  });

  describe('deactivate', () => {
    it('should deactivate a pay component successfully', async () => {
      repository.findById.mockResolvedValue(mockPayComponent);
      jest.spyOn(service, 'getReferencingActiveFormulas').mockResolvedValue([]);
      repository.softDelete.mockResolvedValue(undefined);

      await expect(service.deactivate(mockPayComponent.id)).resolves.toBeUndefined();
      expect(repository.softDelete).toHaveBeenCalledWith(mockPayComponent.id);
    });

    it('should reject deactivation when referenced by active formula', async () => {
      repository.findById.mockResolvedValue(mockPayComponent);
      jest.spyOn(service, 'getReferencingActiveFormulas').mockResolvedValue([
        { name: 'Formula Lương GV THPT' },
        { name: 'Formula Phụ cấp' },
      ]);

      await expect(service.deactivate(mockPayComponent.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when pay component not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.deactivate('non-existing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findById', () => {
    it('should return pay component when found', async () => {
      repository.findById.mockResolvedValue(mockPayComponent);

      const result = await service.findById(mockPayComponent.id);

      expect(result).toEqual(mockPayComponent);
    });

    it('should throw NotFoundException when not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const query = { page: 1, limit: 10, sortOrder: 'ASC' as const };
      repository.findAll.mockResolvedValue([[mockPayComponent], 1]);

      const result = await service.findAll(query);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockPayComponent]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });
});
