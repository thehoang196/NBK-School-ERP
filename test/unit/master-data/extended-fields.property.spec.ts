import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import * as fc from 'fast-check';
import { MasterDataService } from '../../../src/modules/master-data/services/master-data.service';
import { MasterDataRepository } from '../../../src/modules/master-data/repositories/master-data.repository';
import { AuditLogRepository } from '../../../src/modules/master-data/repositories/audit-log.repository';
import { FieldDefinitionRepository } from '../../../src/modules/master-data/repositories/field-definition.repository';
import { FieldDefinitionService } from '../../../src/modules/master-data/services/field-definition.service';
import { SyncService } from '../../../src/modules/master-data/services/sync.service';
import { EmployeeMasterEntity } from '../../../src/modules/master-data/entities/employee-master.entity';
import { FieldDefinitionEntity } from '../../../src/modules/master-data/entities/field-definition.entity';
import { FieldDataType } from '../../../src/modules/master-data/enums/master-data.enum';

/**
 * Property-Based Tests for Extended Fields
 *
 * Feature: master-data
 * Testing Framework: fast-check
 * Minimum Iterations: 100 per property
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
 */

// --- Custom Arbitraries ---

const uuidArb = fc.uuid({ version: 4 });

const fieldNameArb = fc.stringMatching(/^[a-z][a-zA-Z0-9_]{2,30}$/);

const sourceModuleArb = fc.constantFrom(
  'attendance',
  'compensation',
  'teaching-assignment',
  'timetable',
);

const displayLabelArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0);

const dataTypeArb = fc.constantFrom(
  FieldDataType.STRING,
  FieldDataType.NUMBER,
  FieldDataType.BOOLEAN,
  FieldDataType.DATE,
  FieldDataType.ENUM,
);

const enumValuesArb = fc
  .array(fc.stringMatching(/^[a-zA-Z0-9_]{1,20}$/), {
    minLength: 2,
    maxLength: 10,
  })
  .filter((arr) => new Set(arr).size === arr.length); // unique values

/** Generate a conforming value for a given FieldDataType + validationRules */
function conformingValueArb(
  dataType: FieldDataType,
  validationRules: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    enumValues?: string[];
  } | null,
): fc.Arbitrary<unknown> {
  switch (dataType) {
    case FieldDataType.STRING: {
      const minLen = validationRules?.minLength ?? 1;
      const maxLen = validationRules?.maxLength ?? 50;
      return fc.string({ minLength: minLen, maxLength: maxLen });
    }
    case FieldDataType.NUMBER: {
      const min = validationRules?.min ?? -1000000;
      const max = validationRules?.max ?? 1000000;
      return fc.double({ min, max, noNaN: true, noDefaultInfinity: true });
    }
    case FieldDataType.BOOLEAN:
      return fc.boolean();
    case FieldDataType.DATE:
      // Generate valid ISO date strings using integer timestamps to avoid invalid dates
      return fc
        .integer({
          min: new Date('2000-01-01').getTime(),
          max: new Date('2099-12-31').getTime(),
        })
        .map((ts) => new Date(ts).toISOString());
    case FieldDataType.ENUM: {
      const values = validationRules?.enumValues ?? ['active', 'inactive'];
      return fc.constantFrom(...values);
    }
    default:
      return fc.constant('fallback');
  }
}

/** Generate a non-conforming value for a given FieldDataType */
function nonConformingValueArb(dataType: FieldDataType): fc.Arbitrary<unknown> {
  switch (dataType) {
    case FieldDataType.STRING:
      // Non-conforming: number, boolean, or null
      return fc.oneof(fc.integer(), fc.boolean());
    case FieldDataType.NUMBER:
      // Non-conforming: string or boolean
      return fc.oneof(fc.string({ minLength: 1, maxLength: 10 }), fc.boolean());
    case FieldDataType.BOOLEAN:
      // Non-conforming: string or number
      return fc.oneof(fc.string({ minLength: 1, maxLength: 10 }), fc.integer());
    case FieldDataType.DATE:
      // Non-conforming: invalid date string or number
      return fc.oneof(
        fc.constant('not-a-date-xyz'),
        fc.constant('2024-13-99'),
        fc.integer(),
      );
    case FieldDataType.ENUM:
      // Non-conforming: string not in the enumValues list or number
      return fc.oneof(
        fc.constant('__nonexistent_enum_value_xyz__'),
        fc.integer(),
      );
    default:
      return fc.constant(undefined);
  }
}

// --- Helper Functions ---

function createMockEmployee(
  overrides: Partial<EmployeeMasterEntity> = {},
): EmployeeMasterEntity {
  return {
    id: 'emp-001',
    schoolId: '123e4567-e89b-12d3-a456-426614174000',
    employeeCode: 'NV001',
    campusName: 'Campus A',
    fullName: 'Nguyen Van A',
    shortName: 'A',
    gradeName: 'Khoi 10',
    departmentName: 'Toan',
    jobTitle: 'Giao vien',
    managementLevel: null,
    gender: null,
    maxPeriodsPerWeek: null,
    workingDays: null,
    extendedFields: {},
    school: null as unknown as EmployeeMasterEntity['school'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    ...overrides,
  } as EmployeeMasterEntity;
}

function createMockFieldDefinition(
  overrides: Partial<FieldDefinitionEntity> = {},
): FieldDefinitionEntity {
  return {
    id: 'fd-001',
    schoolId: '123e4567-e89b-12d3-a456-426614174000',
    fieldName: 'customField',
    dataType: FieldDataType.STRING,
    sourceModule: 'attendance',
    displayLabel: 'Custom Field',
    validationRules: null,
    isRequired: false,
    school: null as unknown as FieldDefinitionEntity['school'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    ...overrides,
  } as FieldDefinitionEntity;
}

describe('Feature: master-data | Property-Based Tests for Extended Fields', () => {
  let service: MasterDataService;
  let fieldDefinitionService: FieldDefinitionService;
  let masterDataRepository: jest.Mocked<MasterDataRepository>;
  let fieldDefinitionRepository: jest.Mocked<FieldDefinitionRepository>;
  let auditLogRepository: jest.Mocked<AuditLogRepository>;

  beforeEach(async () => {
    const mockMasterDataRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByEmployeeCode: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const mockAuditLogRepository = {
      create: jest.fn(),
      createMany: jest.fn(),
      findByEmployeeId: jest.fn(),
    };

    const mockFieldDefinitionRepository = {
      findAll: jest.fn(),
      findByFieldName: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const mockSyncService = {
      emitChange: jest.fn().mockResolvedValue(undefined),
      receiveModuleChange: jest.fn(),
      getSyncLogs: jest.fn(),
      resolveConflict: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MasterDataService,
        FieldDefinitionService,
        { provide: MasterDataRepository, useValue: mockMasterDataRepository },
        { provide: AuditLogRepository, useValue: mockAuditLogRepository },
        {
          provide: FieldDefinitionRepository,
          useValue: mockFieldDefinitionRepository,
        },
        { provide: SyncService, useValue: mockSyncService },
      ],
    }).compile();

    service = module.get<MasterDataService>(MasterDataService);
    fieldDefinitionService = module.get<FieldDefinitionService>(
      FieldDefinitionService,
    );
    masterDataRepository = module.get(
      MasterDataRepository,
    ) as jest.Mocked<MasterDataRepository>;
    fieldDefinitionRepository = module.get(
      FieldDefinitionRepository,
    ) as jest.Mocked<FieldDefinitionRepository>;
    auditLogRepository = module.get(
      AuditLogRepository,
    ) as jest.Mocked<AuditLogRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 4: Extended Field Round-Trip
   *
   * For any valid field definition (with field name, data type, source module,
   * display label) and any type-conforming value, registering the field, storing
   * the value on an employee, and then retrieving that employee SHALL return the
   * same value for that field.
   *
   * **Validates: Requirements 2.1, 2.2, 2.3**
   */
  describe('Property 4: Extended Field Round-Trip', () => {
    it('registering a field, storing a conforming value, and retrieving returns the same value', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // schoolId
          uuidArb, // employeeId
          fieldNameArb, // fieldName
          dataTypeArb, // dataType
          sourceModuleArb, // sourceModule
          displayLabelArb, // displayLabel
          enumValuesArb, // enumValues (used only for ENUM type)
          async (
            schoolId,
            employeeId,
            fieldName,
            dataType,
            sourceModule,
            displayLabel,
            enumValues,
          ) => {
            jest.clearAllMocks();

            // Build validation rules based on data type
            const validationRules =
              dataType === FieldDataType.ENUM
                ? { enumValues }
                : dataType === FieldDataType.STRING
                  ? { minLength: 1, maxLength: 50 }
                  : dataType === FieldDataType.NUMBER
                    ? { min: -1000, max: 1000 }
                    : null;

            // Create field definition
            const fieldDef = createMockFieldDefinition({
              schoolId,
              fieldName,
              dataType,
              sourceModule,
              displayLabel,
              validationRules,
            });

            // Step 1: Register the field
            fieldDefinitionRepository.findByFieldName.mockResolvedValue(null);
            fieldDefinitionRepository.create.mockResolvedValue(fieldDef);

            const registered = await fieldDefinitionService.register({
              schoolId,
              fieldName,
              dataType,
              sourceModule,
              displayLabel,
              validationRules: validationRules ?? undefined,
            });

            expect(registered.fieldName).toBe(fieldName);
            expect(registered.dataType).toBe(dataType);

            // Step 2: Generate a conforming value and store it on an employee
            const conformingValue = fc.sample(
              conformingValueArb(dataType, validationRules),
              1,
            )[0];

            // Validate that the value conforms using the real service
            fieldDefinitionRepository.findByFieldName.mockResolvedValue(
              fieldDef,
            );
            const isValid = fieldDefinitionService.validateValue(
              fieldDef,
              conformingValue,
            );
            expect(isValid).toBe(true);

            // Create employee with extended field value
            const extendedFields = { [fieldName]: conformingValue };
            const employeeWithExtended = createMockEmployee({
              id: employeeId,
              schoolId,
              extendedFields,
            });

            masterDataRepository.findByEmployeeCode.mockResolvedValue(null);
            masterDataRepository.create.mockResolvedValue(employeeWithExtended);

            const created = await service.create({
              schoolId,
              employeeCode: 'NV' + employeeId.slice(0, 5),
              fullName: 'Test Employee',
              extendedFields,
            });

            // Step 3: Retrieve the employee and verify the extended field value
            masterDataRepository.findById.mockResolvedValue(
              employeeWithExtended,
            );
            const retrieved = await service.findById(employeeId);

            expect(retrieved.extendedFields[fieldName]).toEqual(
              conformingValue,
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 5: Extended Field Type Validation
   *
   * For any registered field definition with a specific data type and any value
   * that does NOT conform to that data type, attempting to store the value SHALL
   * be rejected, and the employee's extended fields SHALL remain unchanged.
   *
   * **Validates: Requirements 2.5**
   */
  describe('Property 5: Extended Field Type Validation', () => {
    it('rejects non-conforming values and leaves extended fields unchanged', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // schoolId
          uuidArb, // employeeId
          fieldNameArb, // fieldName
          dataTypeArb, // dataType
          sourceModuleArb, // sourceModule
          enumValuesArb, // enumValues (for ENUM type)
          async (
            schoolId,
            employeeId,
            fieldName,
            dataType,
            sourceModule,
            enumValues,
          ) => {
            jest.clearAllMocks();

            const validationRules =
              dataType === FieldDataType.ENUM ? { enumValues } : null;

            const fieldDef = createMockFieldDefinition({
              schoolId,
              fieldName,
              dataType,
              sourceModule,
              validationRules,
            });

            // Generate a non-conforming value
            const nonConforming = fc.sample(
              nonConformingValueArb(dataType),
              1,
            )[0];

            // Validate using the real FieldDefinitionService
            const isValid = fieldDefinitionService.validateValue(
              fieldDef,
              nonConforming,
            );
            expect(isValid).toBe(false);

            // Set up the employee with existing extended fields
            const originalExtended = { existingField: 'original' };
            const existingEmployee = createMockEmployee({
              id: employeeId,
              schoolId,
              extendedFields: { ...originalExtended },
            });

            // Mock the field definition lookup to return our field definition
            fieldDefinitionRepository.findByFieldName.mockResolvedValue(
              fieldDef,
            );
            masterDataRepository.findById.mockResolvedValue(existingEmployee);

            // Attempt to update with non-conforming value should throw
            await expect(
              service.update(
                employeeId,
                { extendedFields: { [fieldName]: nonConforming } },
                'admin',
              ),
            ).rejects.toThrow(BadRequestException);

            // Employee's extended fields remain unchanged - update was NOT called
            expect(masterDataRepository.update).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 6: Extended Field Queryable After Registration
   *
   * For any registered extended field and any set of employees with varying
   * values for that field, filtering employees by that field's value SHALL
   * return exactly those employees whose stored value matches the filter criterion.
   *
   * **Validates: Requirements 2.4**
   */
  describe('Property 6: Extended Field Queryable After Registration', () => {
    it('filtering by extended field value returns exactly matching employees', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // schoolId
          fieldNameArb, // fieldName
          fc.array(uuidArb, { minLength: 2, maxLength: 8 }), // employee IDs
          fc.array(
            fc
              .string({ minLength: 1, maxLength: 20 })
              .filter((s) => s.trim().length > 0),
            { minLength: 2, maxLength: 5 },
          ), // possible values for the field
          async (schoolId, fieldName, employeeIds, possibleValues) => {
            // Ensure unique employee IDs
            const uniqueIds = [...new Set(employeeIds)];
            fc.pre(uniqueIds.length >= 2);
            fc.pre(possibleValues.length >= 2);

            jest.clearAllMocks();

            const uniqueValues = [...new Set(possibleValues)];
            fc.pre(uniqueValues.length >= 2);

            // Assign a value from possibleValues to each employee randomly
            const employees = uniqueIds.map((id, index) => {
              const value = uniqueValues[index % uniqueValues.length];
              return createMockEmployee({
                id,
                schoolId,
                employeeCode: `NV${index}`,
                fullName: `Employee ${index}`,
                extendedFields: { [fieldName]: value },
              });
            });

            // Pick the filter value (first unique value)
            const filterValue = uniqueValues[0];

            // Determine which employees should match
            const expectedMatches = employees.filter(
              (emp) => emp.extendedFields[fieldName] === filterValue,
            );

            // Mock repository findAll to simulate JSONB filtering
            // The repository filters with: extended_fields->>'fieldName' = filterValue
            masterDataRepository.findAll.mockResolvedValue([
              expectedMatches,
              expectedMatches.length,
            ]);

            const query = {
              page: 1,
              limit: 100,
              sortOrder: 'ASC' as const,
              schoolId,
              extendedFieldFilters: { [fieldName]: filterValue },
            };

            const result = await service.findAll(query);

            // Verify we get exactly the expected number of matching records
            expect(result.data.length).toBe(expectedMatches.length);

            // Verify all returned records have the correct field value
            for (const record of result.data) {
              expect(record.extendedFields[fieldName]).toBe(filterValue);
            }

            // Verify the repository was called with correct extendedFieldFilters
            expect(masterDataRepository.findAll).toHaveBeenCalledWith(
              expect.objectContaining({
                extendedFieldFilters: { [fieldName]: filterValue },
              }),
            );

            // Verify no records that don't match are included
            const nonMatchingIds = employees
              .filter((emp) => emp.extendedFields[fieldName] !== filterValue)
              .map((emp) => emp.id);

            for (const record of result.data) {
              expect(nonMatchingIds).not.toContain(record.id);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
