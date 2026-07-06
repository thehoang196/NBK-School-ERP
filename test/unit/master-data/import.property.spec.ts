import * as fc from 'fast-check';
import { Workbook } from 'exceljs';
import { ImportService } from '../../../src/modules/master-data/services/import.service';
import { MasterDataRepository } from '../../../src/modules/master-data/repositories/master-data.repository';
import { FieldDefinitionRepository } from '../../../src/modules/master-data/repositories/field-definition.repository';
import { AuditLogRepository } from '../../../src/modules/master-data/repositories/audit-log.repository';
import { EmployeeMasterEntity } from '../../../src/modules/master-data/entities/employee-master.entity';
import { FieldDefinitionEntity } from '../../../src/modules/master-data/entities/field-definition.entity';
import { FieldDataType } from '../../../src/modules/master-data/enums/master-data.enum';
import { DataSource, EntityManager } from 'typeorm';

/**
 * Property-Based Tests for Import Service
 *
 * Feature: master-data
 * Testing Framework: fast-check
 * Minimum Iterations: 100 per property
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */

// --- Helper: Create Excel Buffer ---

async function createExcelBuffer(
  headers: string[],
  rows: string[][],
): Promise<Buffer> {
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');
  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(row));
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// --- Custom Arbitraries ---

const employeeCodeArb = fc
  .integer({ min: 1, max: 999 })
  .map((n) => `NV${String(n).padStart(3, '0')}`);

const fullNameArb = fc.constantFrom(
  'Nguyen Van A',
  'Tran Thi B',
  'Le Van C',
  'Pham Minh D',
  'Hoang Anh E',
  'Vo Thanh F',
  'Bui Quang G',
  'Dang Huu H',
);

const shortNameArb = fc.constantFrom(
  'An',
  'Binh',
  'Cuong',
  'Dung',
  'Em',
  'Phuc',
);

const campusNameArb = fc.constantFrom('Diamond', 'Emerald', 'Ruby', 'Sapphire');

const gradeNameArb = fc.constantFrom(
  'Khoi 1',
  'Khoi 2',
  'Khoi 3',
  'Khoi 10',
  'Khoi 11',
  'Khoi 12',
);

const departmentNameArb = fc.constantFrom(
  'Toan',
  'Van',
  'Anh',
  'Ly',
  'Hoa',
  'Sinh',
);

const jobTitleArb = fc.constantFrom('Giao vien', 'Tro giang', 'Truong bo mon');

const genderArb = fc.constantFrom('Nam', 'Nữ', 'Khác');

/** Generate a valid extended field name (not in COLUMN_MAPPING) */
const extendedFieldNameArb = fc
  .integer({ min: 1, max: 100 })
  .map((n) => `CustomField${n}`);

const extendedFieldValueArb = fc.constantFrom(
  'Value1',
  'Value2',
  'Value3',
  'ABC',
  'XYZ',
  '100',
  '200',
  'Active',
  'Pending',
);

// --- Helper Functions ---

function createMockEmployee(
  overrides: Partial<EmployeeMasterEntity> = {},
): EmployeeMasterEntity {
  return {
    id: 'emp-001',
    schoolId: '123e4567-e89b-12d3-a456-426614174000',
    employeeCode: 'NV001',
    campusName: 'Diamond',
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
    sourceModule: 'import',
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

// --- Test Suite ---

describe('Feature: master-data | Property-Based Tests for Import', () => {
  let importService: ImportService;
  let mockMasterDataRepository: jest.Mocked<MasterDataRepository>;
  let mockFieldDefinitionRepository: jest.Mocked<FieldDefinitionRepository>;
  let mockAuditLogRepository: jest.Mocked<AuditLogRepository>;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockEntityManager: jest.Mocked<EntityManager>;

  // Increase timeout for PBT with Excel buffer generation
  jest.setTimeout(60000);

  beforeEach(() => {
    mockMasterDataRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByEmployeeCode: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<MasterDataRepository>;

    mockFieldDefinitionRepository = {
      findAll: jest.fn(),
      findByFieldName: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<FieldDefinitionRepository>;

    mockAuditLogRepository = {
      create: jest.fn(),
      createMany: jest.fn(),
      findByEmployeeId: jest.fn(),
    } as unknown as jest.Mocked<AuditLogRepository>;

    // Mock EntityManager that the transaction callback receives
    mockEntityManager = {
      create: jest
        .fn()
        .mockImplementation((_entityClass: unknown, data: unknown) => data),
      save: jest.fn().mockImplementation(async (entity: unknown) => entity),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>;

    // Mock DataSource.transaction to call the callback directly with our mock EntityManager
    mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation(
          async (cb: (manager: EntityManager) => Promise<unknown>) => {
            return cb(mockEntityManager);
          },
        ),
    } as unknown as jest.Mocked<DataSource>;

    // Instantiate ImportService directly (no need for NestJS TestingModule for this)
    importService = new ImportService(
      mockMasterDataRepository,
      mockFieldDefinitionRepository,
      mockAuditLogRepository,
      mockDataSource,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 7: Import Creates New Records by Employee Code
   *
   * For any import dataset containing employee codes not present in Master Data,
   * the import SHALL create new employee records, and subsequent lookup by those
   * employee codes SHALL return records with all the imported field values.
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  describe('Property 7: Import Creates New Records by Employee Code', () => {
    it('creates new employee records for codes not found in Master Data with correct field values', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(employeeCodeArb, { minLength: 1, maxLength: 5 }),
          fullNameArb,
          campusNameArb,
          departmentNameArb,
          async (employeeCodes, fullName, campusName, departmentName) => {
            jest.clearAllMocks();

            const schoolId = '123e4567-e89b-12d3-a456-426614174000';
            const changedBy = 'admin-user';

            // Build Excel data: headers + one row per employee code
            const headers = ['Mã NV', 'Họ và Tên', 'Cơ sở', 'Tổ bộ môn'];
            const rows = employeeCodes.map((code) => [
              code,
              fullName,
              campusName,
              departmentName,
            ]);

            const excelBuffer = await createExcelBuffer(headers, rows);

            // Track created employees
            const createdEmployees: Partial<EmployeeMasterEntity>[] = [];

            // Mock: no existing employees found (all codes are new)
            mockEntityManager.findOne.mockResolvedValue(null);

            // Mock: EntityManager.create returns a representation of the entity
            (mockEntityManager.create as jest.Mock).mockImplementation(
              (_entityClass: unknown, data: unknown) => data,
            );

            // Mock: EntityManager.save captures created records
            (mockEntityManager.save as jest.Mock).mockImplementation(
              async (entity: unknown) => {
                const emp = entity as Partial<EmployeeMasterEntity>;
                if (emp.employeeCode) {
                  createdEmployees.push(emp);
                }
                return { ...emp, id: `new-${emp.employeeCode}` };
              },
            );

            // Mock: no unknown field definitions (no extended fields in this test)
            mockFieldDefinitionRepository.findByFieldName.mockResolvedValue(
              createMockFieldDefinition(),
            );

            // Execute import
            const result = await importService.importFromExcel(
              schoolId,
              excelBuffer,
              changedBy,
            );

            // Verify: result.created equals number of unique employee codes
            expect(result.created).toBe(employeeCodes.length);
            expect(result.conflicts).toBe(0);

            // Verify: each employee code was created with correct field values
            for (const code of employeeCodes) {
              const created = createdEmployees.find(
                (emp) => emp.employeeCode === code,
              );
              expect(created).toBeDefined();
              expect(created!.schoolId).toBe(schoolId);
              expect(created!.fullName).toBe(fullName);
              expect(created!.campusName).toBe(campusName);
              expect(created!.departmentName).toBe(departmentName);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 8: Import Conflict Detection
   *
   * For any existing employee in Master Data and any import data with the same
   * employee code but different values for one or more fields, the import process
   * SHALL flag exactly those differing fields as conflicts.
   *
   * **Validates: Requirements 3.3**
   */
  describe('Property 8: Import Conflict Detection', () => {
    it('flags conflicts when import data differs from existing employee data', async () => {
      await fc.assert(
        fc.asyncProperty(
          employeeCodeArb,
          fullNameArb,
          fullNameArb,
          campusNameArb,
          campusNameArb,
          async (
            employeeCode,
            existingFullName,
            importFullName,
            existingCampus,
            importCampus,
          ) => {
            // Ensure at least one field differs so a conflict is generated
            fc.pre(
              existingFullName !== importFullName ||
                existingCampus !== importCampus,
            );

            jest.clearAllMocks();

            const schoolId = '123e4567-e89b-12d3-a456-426614174000';
            const changedBy = 'admin-user';

            // Build Excel data with import values
            const headers = ['Mã NV', 'Họ và Tên', 'Cơ sở'];
            const rows = [[employeeCode, importFullName, importCampus]];

            const excelBuffer = await createExcelBuffer(headers, rows);

            // Mock: employee already exists with DIFFERENT values
            const existingEmployee = createMockEmployee({
              id: `existing-${employeeCode}`,
              schoolId,
              employeeCode,
              fullName: existingFullName,
              campusName: existingCampus,
            });

            mockEntityManager.findOne.mockResolvedValue(existingEmployee);

            // Mock: no unknown extended fields
            mockFieldDefinitionRepository.findByFieldName.mockResolvedValue(
              createMockFieldDefinition(),
            );

            // Execute import
            const result = await importService.importFromExcel(
              schoolId,
              excelBuffer,
              changedBy,
            );

            // Verify: a conflict is detected (at least one field differs)
            expect(result.conflicts).toBe(1);
            expect(result.created).toBe(0);

            // Verify: no records were created (since the employee exists)
            expect(mockEntityManager.create).not.toHaveBeenCalledWith(
              EmployeeMasterEntity,
              expect.objectContaining({ employeeCode }),
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('does NOT flag conflicts when import data matches existing employee data', async () => {
      await fc.assert(
        fc.asyncProperty(
          employeeCodeArb,
          fullNameArb,
          campusNameArb,
          departmentNameArb,
          async (employeeCode, fullName, campusName, departmentName) => {
            jest.clearAllMocks();

            const schoolId = '123e4567-e89b-12d3-a456-426614174000';
            const changedBy = 'admin-user';

            // Build Excel data with SAME values as existing
            const headers = ['Mã NV', 'Họ và Tên', 'Cơ sở', 'Tổ bộ môn'];
            const rows = [[employeeCode, fullName, campusName, departmentName]];

            const excelBuffer = await createExcelBuffer(headers, rows);

            // Mock: employee already exists with SAME values
            const existingEmployee = createMockEmployee({
              id: `existing-${employeeCode}`,
              schoolId,
              employeeCode,
              fullName,
              campusName,
              departmentName,
            });

            mockEntityManager.findOne.mockResolvedValue(existingEmployee);

            // Mock: no unknown extended fields
            mockFieldDefinitionRepository.findByFieldName.mockResolvedValue(
              createMockFieldDefinition(),
            );

            // Execute import
            const result = await importService.importFromExcel(
              schoolId,
              excelBuffer,
              changedBy,
            );

            // Verify: no conflict since values match
            expect(result.conflicts).toBe(0);
            expect(result.created).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 9: Import Auto-Registers Unknown Fields
   *
   * For any import data containing a field name not yet defined in the system's
   * field definitions, the import SHALL register a new field definition for that
   * field and store the imported value in the employee's extended fields.
   *
   * **Validates: Requirements 3.4**
   */
  describe('Property 9: Import Auto-Registers Unknown Fields', () => {
    it('registers unknown field definitions and stores values in extendedFields', async () => {
      await fc.assert(
        fc.asyncProperty(
          employeeCodeArb,
          fullNameArb,
          fc.uniqueArray(extendedFieldNameArb, { minLength: 1, maxLength: 3 }),
          fc.array(extendedFieldValueArb, { minLength: 1, maxLength: 3 }),
          async (employeeCode, fullName, extFieldNames, extFieldValues) => {
            // Ensure we have as many values as field names
            const fieldCount = Math.min(
              extFieldNames.length,
              extFieldValues.length,
            );
            fc.pre(fieldCount >= 1);

            const usedFieldNames = extFieldNames.slice(0, fieldCount);
            const usedFieldValues = extFieldValues.slice(0, fieldCount);

            jest.clearAllMocks();

            const schoolId = '123e4567-e89b-12d3-a456-426614174000';
            const changedBy = 'admin-user';

            // Build Excel: core headers + extended field headers
            const headers = ['Mã NV', 'Họ và Tên', ...usedFieldNames];
            const rows = [[employeeCode, fullName, ...usedFieldValues]];

            const excelBuffer = await createExcelBuffer(headers, rows);

            // Track field registrations
            const registeredFields: string[] = [];

            // Mock: extended fields are NOT yet defined (returns null)
            mockFieldDefinitionRepository.findByFieldName.mockResolvedValue(
              null,
            );

            // Mock: EntityManager.create captures field definitions and employees
            (mockEntityManager.create as jest.Mock).mockImplementation(
              (_entityClass: unknown, data: unknown) => {
                const d = data as Record<string, unknown>;
                if (d.fieldName && d.sourceModule === 'import') {
                  registeredFields.push(d.fieldName as string);
                }
                return data;
              },
            );

            // Track created employee data
            let createdEmployeeData: Record<string, unknown> | null = null;

            // Mock: EntityManager.save
            (mockEntityManager.save as jest.Mock).mockImplementation(
              async (entity: unknown) => {
                const e = entity as Record<string, unknown>;
                if (e.employeeCode) {
                  createdEmployeeData = e;
                }
                return { ...e, id: `new-${e.employeeCode || 'field'}` };
              },
            );

            // Mock: no existing employee (new record)
            mockEntityManager.findOne.mockResolvedValue(null);

            // Execute import
            const result = await importService.importFromExcel(
              schoolId,
              excelBuffer,
              changedBy,
            );

            // Verify: all unknown fields were registered
            for (const fieldName of usedFieldNames) {
              expect(registeredFields).toContain(fieldName);
            }

            // Verify: new employee was created
            expect(result.created).toBe(1);

            // Verify: extended field values are stored in the employee's extendedFields
            expect(createdEmployeeData).not.toBeNull();
            const extendedFields = createdEmployeeData!
              .extendedFields as Record<string, unknown>;
            for (let i = 0; i < fieldCount; i++) {
              expect(extendedFields[usedFieldNames[i]]).toBe(
                usedFieldValues[i],
              );
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
