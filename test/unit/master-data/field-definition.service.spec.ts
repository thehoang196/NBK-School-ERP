import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { FieldDefinitionService } from '../../../src/modules/master-data/services/field-definition.service';
import { FieldDefinitionRepository } from '../../../src/modules/master-data/repositories/field-definition.repository';
import { FieldDefinitionEntity } from '../../../src/modules/master-data/entities/field-definition.entity';
import { FieldDataType } from '../../../src/modules/master-data/enums/master-data.enum';
import { RegisterFieldDto } from '../../../src/modules/master-data/dto/register-field.dto';

describe('FieldDefinitionService', () => {
  let service: FieldDefinitionService;
  let repository: jest.Mocked<FieldDefinitionRepository>;

  const schoolId = '123e4567-e89b-12d3-a456-426614174000';

  const mockFieldDefinition: FieldDefinitionEntity = {
    id: 'def-001',
    schoolId,
    fieldName: 'certificationLevel',
    dataType: FieldDataType.STRING,
    sourceModule: 'teaching-assignment',
    displayLabel: 'Trình độ chứng chỉ',
    validationRules: null,
    isRequired: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
  } as FieldDefinitionEntity;

  beforeEach(async () => {
    const mockRepository = {
      findAll: jest.fn(),
      findByFieldName: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FieldDefinitionService,
        { provide: FieldDefinitionRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<FieldDefinitionService>(FieldDefinitionService);
    repository = module.get(
      FieldDefinitionRepository,
    ) as jest.Mocked<FieldDefinitionRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterFieldDto = {
      schoolId,
      fieldName: 'certificationLevel',
      dataType: FieldDataType.STRING,
      sourceModule: 'teaching-assignment',
      displayLabel: 'Trình độ chứng chỉ',
    };

    it('should register a new field definition successfully', async () => {
      repository.findByFieldName.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockFieldDefinition);

      const result = await service.register(registerDto);

      expect(result).toEqual(mockFieldDefinition);
      expect(repository.findByFieldName).toHaveBeenCalledWith(
        schoolId,
        'certificationLevel',
      );
      expect(repository.create).toHaveBeenCalledWith({
        schoolId,
        fieldName: 'certificationLevel',
        dataType: FieldDataType.STRING,
        sourceModule: 'teaching-assignment',
        displayLabel: 'Trình độ chứng chỉ',
        validationRules: null,
        isRequired: false,
      });
    });

    it('should throw ConflictException when field_name already exists for the school', async () => {
      repository.findByFieldName.mockResolvedValue(mockFieldDefinition);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        "Trường 'certificationLevel' đã được đăng ký cho trường này",
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should pass validationRules and isRequired when provided', async () => {
      const dtoWithRules: RegisterFieldDto = {
        ...registerDto,
        validationRules: { minLength: 3, maxLength: 50 },
        isRequired: true,
      };

      repository.findByFieldName.mockResolvedValue(null);
      repository.create.mockResolvedValue({
        ...mockFieldDefinition,
        validationRules: { minLength: 3, maxLength: 50 },
        isRequired: true,
      } as FieldDefinitionEntity);

      await service.register(dtoWithRules);

      expect(repository.create).toHaveBeenCalledWith({
        schoolId,
        fieldName: 'certificationLevel',
        dataType: FieldDataType.STRING,
        sourceModule: 'teaching-assignment',
        displayLabel: 'Trình độ chứng chỉ',
        validationRules: { minLength: 3, maxLength: 50 },
        isRequired: true,
      });
    });
  });

  describe('findAll', () => {
    it('should return all field definitions for a school', async () => {
      const definitions = [mockFieldDefinition];
      repository.findAll.mockResolvedValue(definitions);

      const result = await service.findAll(schoolId);

      expect(result).toEqual(definitions);
      expect(repository.findAll).toHaveBeenCalledWith(schoolId);
    });

    it('should return empty array when no definitions exist', async () => {
      repository.findAll.mockResolvedValue([]);

      const result = await service.findAll(schoolId);

      expect(result).toEqual([]);
    });
  });

  describe('validateValue', () => {
    describe('STRING type', () => {
      const stringField = {
        ...mockFieldDefinition,
        dataType: FieldDataType.STRING,
        validationRules: null,
      } as FieldDefinitionEntity;

      it('should return true for valid string', () => {
        expect(service.validateValue(stringField, 'hello')).toBe(true);
      });

      it('should return false for non-string value', () => {
        expect(service.validateValue(stringField, 123)).toBe(false);
        expect(service.validateValue(stringField, true)).toBe(false);
        expect(service.validateValue(stringField, null)).toBe(false);
      });

      it('should validate minLength', () => {
        const fieldWithMin = {
          ...stringField,
          validationRules: { minLength: 3 },
        } as FieldDefinitionEntity;

        expect(service.validateValue(fieldWithMin, 'ab')).toBe(false);
        expect(service.validateValue(fieldWithMin, 'abc')).toBe(true);
        expect(service.validateValue(fieldWithMin, 'abcd')).toBe(true);
      });

      it('should validate maxLength', () => {
        const fieldWithMax = {
          ...stringField,
          validationRules: { maxLength: 5 },
        } as FieldDefinitionEntity;

        expect(service.validateValue(fieldWithMax, 'abcde')).toBe(true);
        expect(service.validateValue(fieldWithMax, 'abcdef')).toBe(false);
      });

      it('should validate pattern', () => {
        const fieldWithPattern = {
          ...stringField,
          validationRules: { pattern: '^[A-Z]{2}\\d{3}$' },
        } as FieldDefinitionEntity;

        expect(service.validateValue(fieldWithPattern, 'AB123')).toBe(true);
        expect(service.validateValue(fieldWithPattern, 'ab123')).toBe(false);
        expect(service.validateValue(fieldWithPattern, 'ABC12')).toBe(false);
      });
    });

    describe('NUMBER type', () => {
      const numberField = {
        ...mockFieldDefinition,
        dataType: FieldDataType.NUMBER,
        validationRules: null,
      } as FieldDefinitionEntity;

      it('should return true for valid number', () => {
        expect(service.validateValue(numberField, 42)).toBe(true);
        expect(service.validateValue(numberField, 3.14)).toBe(true);
        expect(service.validateValue(numberField, 0)).toBe(true);
        expect(service.validateValue(numberField, -10)).toBe(true);
      });

      it('should return false for non-number value', () => {
        expect(service.validateValue(numberField, '42')).toBe(false);
        expect(service.validateValue(numberField, true)).toBe(false);
        expect(service.validateValue(numberField, null)).toBe(false);
      });

      it('should validate min', () => {
        const fieldWithMin = {
          ...numberField,
          validationRules: { min: 0 },
        } as FieldDefinitionEntity;

        expect(service.validateValue(fieldWithMin, -1)).toBe(false);
        expect(service.validateValue(fieldWithMin, 0)).toBe(true);
        expect(service.validateValue(fieldWithMin, 10)).toBe(true);
      });

      it('should validate max', () => {
        const fieldWithMax = {
          ...numberField,
          validationRules: { max: 100 },
        } as FieldDefinitionEntity;

        expect(service.validateValue(fieldWithMax, 100)).toBe(true);
        expect(service.validateValue(fieldWithMax, 101)).toBe(false);
      });
    });

    describe('BOOLEAN type', () => {
      const booleanField = {
        ...mockFieldDefinition,
        dataType: FieldDataType.BOOLEAN,
        validationRules: null,
      } as FieldDefinitionEntity;

      it('should return true for boolean values', () => {
        expect(service.validateValue(booleanField, true)).toBe(true);
        expect(service.validateValue(booleanField, false)).toBe(true);
      });

      it('should return false for non-boolean values', () => {
        expect(service.validateValue(booleanField, 'true')).toBe(false);
        expect(service.validateValue(booleanField, 1)).toBe(false);
        expect(service.validateValue(booleanField, null)).toBe(false);
      });
    });

    describe('DATE type', () => {
      const dateField = {
        ...mockFieldDefinition,
        dataType: FieldDataType.DATE,
        validationRules: null,
      } as FieldDefinitionEntity;

      it('should return true for valid ISO date strings', () => {
        expect(service.validateValue(dateField, '2024-01-15')).toBe(true);
        expect(service.validateValue(dateField, '2024-01-15T10:30:00Z')).toBe(
          true,
        );
      });

      it('should return true for Date instances', () => {
        expect(service.validateValue(dateField, new Date('2024-01-15'))).toBe(
          true,
        );
      });

      it('should return false for invalid date strings', () => {
        expect(service.validateValue(dateField, 'not-a-date')).toBe(false);
      });

      it('should return false for non-date values', () => {
        expect(service.validateValue(dateField, 123)).toBe(false);
        expect(service.validateValue(dateField, true)).toBe(false);
        expect(service.validateValue(dateField, null)).toBe(false);
      });
    });

    describe('ENUM type', () => {
      const enumField = {
        ...mockFieldDefinition,
        dataType: FieldDataType.ENUM,
        validationRules: { enumValues: ['active', 'inactive', 'pending'] },
      } as FieldDefinitionEntity;

      it('should return true for value in enumValues', () => {
        expect(service.validateValue(enumField, 'active')).toBe(true);
        expect(service.validateValue(enumField, 'inactive')).toBe(true);
        expect(service.validateValue(enumField, 'pending')).toBe(true);
      });

      it('should return false for value not in enumValues', () => {
        expect(service.validateValue(enumField, 'unknown')).toBe(false);
      });

      it('should return false for non-string value', () => {
        expect(service.validateValue(enumField, 123)).toBe(false);
        expect(service.validateValue(enumField, true)).toBe(false);
      });

      it('should return false when no enumValues defined', () => {
        const enumFieldNoValues = {
          ...enumField,
          validationRules: null,
        } as FieldDefinitionEntity;

        expect(service.validateValue(enumFieldNoValues, 'active')).toBe(false);
      });
    });
  });
});
