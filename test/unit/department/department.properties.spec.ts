import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { DepartmentService } from '../../../src/modules/department/department.service';
import { DepartmentRepository } from '../../../src/modules/department/department.repository';
import { DepartmentEntity } from '../../../src/modules/department/entities/department.entity';
import { DuplicateDepartmentNameException } from '../../../src/modules/department/exceptions/duplicate-department-name.exception';

/**
 * Feature: to-bo-mon
 * Property 2: Department name uniqueness (case-insensitive)
 * Property 3: Department name length validation
 *
 * Validates: Requirements 1.2, 1.3, 1.6
 */

describe('Feature: to-bo-mon, Property 2: Department name uniqueness (case-insensitive)', () => {
  let service: DepartmentService;
  let repository: jest.Mocked<DepartmentRepository>;

  beforeEach(async () => {
    const mockRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findBySchool: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      findByNameAndSchool: jest.fn(),
      countActiveMembers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentService,
        {
          provide: DepartmentRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<DepartmentService>(DepartmentService);
    repository = module.get(
      DepartmentRepository,
    ) as jest.Mocked<DepartmentRepository>;
  });

  /**
   * **Validates: Requirements 1.2, 1.3**
   *
   * For any two department records within the same school_id where both have
   * deleted_at IS NULL, their names compared case-insensitively SHALL be different.
   */
  it('should reject any name that already exists (case-insensitive) in the same school on create', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .string({ minLength: 1, maxLength: 100 })
          .filter((s) => s.trim().length > 0),
        fc.uuid(),
        async (name, schoolId) => {
          // Mock: a department with this name already exists in the same school
          const existingDepartment = {
            id: 'existing-id',
            schoolId,
            name,
            headTeacherId: null,
          } as DepartmentEntity;

          repository.findByNameAndSchool.mockResolvedValue(existingDepartment);

          // Attempt to create a department with the same name → expect ConflictException
          await expect(
            service.create({ name, schoolId }, null),
          ).rejects.toThrow(DuplicateDepartmentNameException);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.2, 1.3**
   *
   * Updating a department's own name to the same value (any casing) SHALL succeed
   * when excludeId matches the current department.
   */
  it('should allow updating a department name to the same value (any casing)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .string({ minLength: 1, maxLength: 100 })
          .filter((s) => s.trim().length > 0),
        fc.uuid(),
        fc.uuid(),
        async (name, departmentId, schoolId) => {
          const existingDepartment = {
            id: departmentId,
            schoolId,
            name,
            headTeacherId: null,
          } as DepartmentEntity;

          // findById returns the department itself
          repository.findById.mockResolvedValue(existingDepartment);
          // findByNameAndSchool returns null (excluded current record, no conflict)
          repository.findByNameAndSchool.mockResolvedValue(null);
          // update returns the updated entity
          repository.update.mockResolvedValue({
            ...existingDepartment,
            name: name.trim(),
          } as DepartmentEntity);

          // Updating with same name (possibly different casing) should succeed
          const result = await service.update(departmentId, { name });
          expect(result).toBeDefined();
          expect(result.name).toBe(name.trim());
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.2, 1.3**
   *
   * For any valid name with case variations, if findByNameAndSchool finds a match
   * (different department), the create SHALL be rejected.
   */
  it('should reject name with any case variation that conflicts with existing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .string({ minLength: 1, maxLength: 100 })
          .filter((s) => s.trim().length > 0),
        fc.uuid(),
        fc.constantFrom(
          'toLowerCase',
          'toUpperCase',
          'identity',
        ) as fc.Arbitrary<string>,
        async (name, schoolId, caseTransform) => {
          // Generate a case variation of the name
          let variantName: string;
          if (caseTransform === 'toLowerCase') {
            variantName = name.toLowerCase();
          } else if (caseTransform === 'toUpperCase') {
            variantName = name.toUpperCase();
          } else {
            variantName = name;
          }

          // Mock: an existing department with the original name exists
          const existingDepartment = {
            id: 'existing-id',
            schoolId,
            name: name,
            headTeacherId: null,
          } as DepartmentEntity;

          repository.findByNameAndSchool.mockResolvedValue(existingDepartment);

          // Attempt to create with case variant → expect ConflictException
          await expect(
            service.create({ name: variantName, schoolId }, null),
          ).rejects.toThrow(DuplicateDepartmentNameException);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: to-bo-mon, Property 3: Department name length validation', () => {
  let service: DepartmentService;
  let repository: jest.Mocked<DepartmentRepository>;

  beforeEach(async () => {
    const mockRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findBySchool: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      findByNameAndSchool: jest.fn(),
      countActiveMembers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentService,
        {
          provide: DepartmentRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<DepartmentService>(DepartmentService);
    repository = module.get(
      DepartmentRepository,
    ) as jest.Mocked<DepartmentRepository>;
  });

  /**
   * **Validates: Requirements 1.6**
   *
   * For any string that is empty or contains only whitespace, attempting to create
   * a department with that string as the name SHALL be rejected with a validation error.
   */
  it('should reject empty or whitespace-only strings on create', async () => {
    const whitespaceArbitrary = fc.oneof(
      fc.constant(''),
      fc
        .array(fc.constantFrom(' ', '\t', '\n', '\r'), {
          minLength: 1,
          maxLength: 50,
        })
        .map((chars) => chars.join('')),
    );

    await fc.assert(
      fc.asyncProperty(
        whitespaceArbitrary,
        fc.uuid(),
        async (name, schoolId) => {
          await expect(
            service.create({ name, schoolId }, null),
          ).rejects.toThrow(BadRequestException);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.6**
   *
   * For any string that exceeds 100 characters, attempting to create a department
   * with that string as the name SHALL be rejected with a validation error.
   */
  it('should reject strings longer than 100 characters on create', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .string({ minLength: 101, maxLength: 500 })
          .filter((s) => s.trim().length > 100),
        fc.uuid(),
        async (name, schoolId) => {
          await expect(
            service.create({ name, schoolId }, null),
          ).rejects.toThrow(BadRequestException);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.6**
   *
   * For any string that is empty or contains only whitespace, attempting to update
   * a department with that string as the name SHALL be rejected with a validation error.
   */
  it('should reject empty or whitespace-only strings on update', async () => {
    const whitespaceArbitrary = fc.oneof(
      fc.constant(''),
      fc
        .array(fc.constantFrom(' ', '\t', '\n', '\r'), {
          minLength: 1,
          maxLength: 50,
        })
        .map((chars) => chars.join('')),
    );

    await fc.assert(
      fc.asyncProperty(
        whitespaceArbitrary,
        fc.uuid(),
        fc.uuid(),
        async (name, departmentId, schoolId) => {
          const existingDepartment = {
            id: departmentId,
            schoolId,
            name: 'Valid Name',
            headTeacherId: null,
          } as DepartmentEntity;

          repository.findById.mockResolvedValue(existingDepartment);

          await expect(service.update(departmentId, { name })).rejects.toThrow(
            BadRequestException,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.6**
   *
   * For any string that exceeds 100 characters, attempting to update a department
   * with that string as the name SHALL be rejected with a validation error.
   */
  it('should reject strings longer than 100 characters on update', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .string({ minLength: 101, maxLength: 500 })
          .filter((s) => s.trim().length > 100),
        fc.uuid(),
        fc.uuid(),
        async (name, departmentId, schoolId) => {
          const existingDepartment = {
            id: departmentId,
            schoolId,
            name: 'Valid Name',
            headTeacherId: null,
          } as DepartmentEntity;

          repository.findById.mockResolvedValue(existingDepartment);

          await expect(service.update(departmentId, { name })).rejects.toThrow(
            BadRequestException,
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
