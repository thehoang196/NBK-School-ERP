import * as fc from 'fast-check';
import {
  ReconciliationService,
  SourceDataItem,
} from '../../../src/modules/master-data/services/reconciliation.service';
import { MasterDataRepository } from '../../../src/modules/master-data/repositories/master-data.repository';
import { AuditLogRepository } from '../../../src/modules/master-data/repositories/audit-log.repository';
import { FieldDefinitionRepository } from '../../../src/modules/master-data/repositories/field-definition.repository';
import { EmployeeMasterEntity } from '../../../src/modules/master-data/entities/employee-master.entity';
import { ReconciliationSessionEntity } from '../../../src/modules/master-data/entities/reconciliation-session.entity';
import { EmployeeAuditLogEntity } from '../../../src/modules/master-data/entities/employee-audit-log.entity';
import { FieldDefinitionEntity } from '../../../src/modules/master-data/entities/field-definition.entity';
import {
  FieldDataType,
  ReconciliationStatus,
} from '../../../src/modules/master-data/enums/master-data.enum';
import { DataSource, Repository } from 'typeorm';

/**
 * Property-Based Tests for Reconciliation Service
 *
 * Feature: master-data
 * Testing Framework: fast-check
 * Minimum Iterations: 100 per property
 *
 * **Validates: Requirements 4.1, 4.2, 4.4, 4.5**
 */

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
);

const campusNameArb = fc.constantFrom('Diamond', 'Emerald', 'Ruby', 'Sapphire');

const departmentNameArb = fc.constantFrom(
  'Toan',
  'Van',
  'Anh',
  'Ly',
  'Hoa',
  'Sinh',
);

const jobTitleArb = fc.constantFrom(
  'Giao vien',
  'Tro giang',
  'Truong bo mon',
  'Pho truong bo mon',
);

const gradeNameArb = fc.constantFrom(
  'Khoi 1',
  'Khoi 2',
  'Khoi 3',
  'Khoi 10',
  'Khoi 11',
  'Khoi 12',
);

const sourceModuleArb = fc.constantFrom(
  'teacher',
  'attendance',
  'compensation',
  'assignment',
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

function createMockSession(
  overrides: Partial<ReconciliationSessionEntity> = {},
): ReconciliationSessionEntity {
  return {
    id: 'session-001',
    schoolId: '123e4567-e89b-12d3-a456-426614174000',
    sourceModule: 'teacher',
    status: ReconciliationStatus.COMPLETED,
    totalRecords: 0,
    matchedRecords: 0,
    conflictRecords: 0,
    newRecords: 0,
    reportData: null,
    triggeredBy: 'admin',
    completedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    ...overrides,
  } as ReconciliationSessionEntity;
}

// --- Test Suite ---

describe('Feature: master-data | Property-Based Tests for Reconciliation', () => {
  let reconciliationService: ReconciliationService;
  let mockMasterDataRepository: jest.Mocked<MasterDataRepository>;
  let mockAuditLogRepository: jest.Mocked<AuditLogRepository>;
  let mockFieldDefinitionRepository: jest.Mocked<FieldDefinitionRepository>;
  let mockReconciliationRepo: jest.Mocked<
    Repository<ReconciliationSessionEntity>
  >;
  let mockDataSource: jest.Mocked<DataSource>;

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

    mockAuditLogRepository = {
      create: jest.fn(),
      createMany: jest.fn(),
      findByEmployeeId: jest.fn(),
    } as unknown as jest.Mocked<AuditLogRepository>;

    mockFieldDefinitionRepository = {
      findAll: jest.fn(),
      findByFieldName: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<FieldDefinitionRepository>;

    mockReconciliationRepo = {
      create: jest.fn().mockImplementation((data: unknown) => data),
      save: jest.fn().mockImplementation(async (entity: unknown) => ({
        ...(entity as Record<string, unknown>),
        id: 'session-generated-id',
        createdAt: new Date('2024-01-01'),
      })),
      findOne: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<ReconciliationSessionEntity>>;

    mockDataSource = {
      transaction: jest.fn(),
    } as unknown as jest.Mocked<DataSource>;

    reconciliationService = new ReconciliationService(
      mockReconciliationRepo as unknown as Repository<ReconciliationSessionEntity>,
      mockMasterDataRepository,
      mockAuditLogRepository,
      mockFieldDefinitionRepository,
      mockDataSource,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 10: Reconciliation Produces Correct Difference Report
   *
   * For any set of source module data and Master Data with overlapping employee codes,
   * reconciliation SHALL produce a report listing exactly those (employee_code, field_name)
   * pairs where the source value differs from the master value, with correct values for both sides.
   *
   * **Validates: Requirements 4.1, 4.2**
   */
  describe('Property 10: Reconciliation Produces Correct Difference Report', () => {
    it('produces report with exactly the differing (employee_code, field_name) pairs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(employeeCodeArb, { minLength: 1, maxLength: 5 }),
          fc.array(
            fc.record({
              fullName: fullNameArb,
              campusName: campusNameArb,
              departmentName: departmentNameArb,
              jobTitle: jobTitleArb,
            }),
            { minLength: 1, maxLength: 5 },
          ),
          fc.array(
            fc.record({
              fullName: fullNameArb,
              campusName: campusNameArb,
              departmentName: departmentNameArb,
              jobTitle: jobTitleArb,
            }),
            { minLength: 1, maxLength: 5 },
          ),
          async (employeeCodes, masterFieldSets, sourceFieldSets) => {
            // Ensure arrays align
            const count = Math.min(
              employeeCodes.length,
              masterFieldSets.length,
              sourceFieldSets.length,
            );
            fc.pre(count >= 1);

            jest.clearAllMocks();

            const schoolId = '123e4567-e89b-12d3-a456-426614174000';
            const triggeredBy = 'admin-user';
            const sourceModule = 'teacher';

            // Build master data employees
            const masterEmployees: Map<string, EmployeeMasterEntity> =
              new Map();
            for (let i = 0; i < count; i++) {
              const fields = masterFieldSets[i];
              const emp = createMockEmployee({
                id: `emp-${i}`,
                schoolId,
                employeeCode: employeeCodes[i],
                fullName: fields.fullName,
                campusName: fields.campusName,
                departmentName: fields.departmentName,
                jobTitle: fields.jobTitle,
              });
              masterEmployees.set(employeeCodes[i], emp);
            }

            // Build source data
            const sourceData: SourceDataItem[] = [];
            for (let i = 0; i < count; i++) {
              const fields = sourceFieldSets[i];
              sourceData.push({
                employeeCode: employeeCodes[i],
                fullName: fields.fullName,
                campusName: fields.campusName,
                departmentName: fields.departmentName,
                jobTitle: fields.jobTitle,
              });
            }

            // Mock: repository finds employees
            mockMasterDataRepository.findByEmployeeCode.mockImplementation(
              async (_schoolId: string, code: string) =>
                masterEmployees.get(code) || null,
            );

            // Mock: all fields are registered as core fields (no extended fields needed)
            mockFieldDefinitionRepository.findAll.mockResolvedValue([]);

            // Execute reconciliation
            const result = await reconciliationService.triggerReconciliation(
              schoolId,
              sourceModule,
              sourceData,
              triggeredBy,
            );

            // Calculate expected differences
            const expectedDifferences: Array<{
              employeeCode: string;
              fieldName: string;
              masterValue: string | null;
              sourceValue: string | null;
            }> = [];
            const coreFieldsToCompare = [
              'fullName',
              'campusName',
              'departmentName',
              'jobTitle',
            ] as const;

            for (let i = 0; i < count; i++) {
              const masterFields = masterFieldSets[i];
              const sourceFields = sourceFieldSets[i];
              const code = employeeCodes[i];

              for (const field of coreFieldsToCompare) {
                const masterVal = masterFields[field];
                const sourceVal = sourceFields[field];
                if (String(masterVal) !== String(sourceVal)) {
                  expectedDifferences.push({
                    employeeCode: code,
                    fieldName: field,
                    masterValue: String(masterVal),
                    sourceValue: String(sourceVal),
                  });
                }
              }
            }

            // Verify: report contains exactly the expected differences
            const reportDifferences = result.reportData?.differences || [];

            expect(reportDifferences.length).toBe(expectedDifferences.length);

            // Verify each expected difference is present in the report
            for (const expected of expectedDifferences) {
              const found = reportDifferences.find(
                (d) =>
                  d.employeeCode === expected.employeeCode &&
                  d.fieldName === expected.fieldName,
              );
              expect(found).toBeDefined();
              expect(found!.masterValue).toBe(expected.masterValue);
              expect(found!.sourceValue).toBe(expected.sourceValue);
            }

            // Verify: no extra differences beyond what we expected
            for (const reported of reportDifferences) {
              const found = expectedDifferences.find(
                (e) =>
                  e.employeeCode === reported.employeeCode &&
                  e.fieldName === reported.fieldName,
              );
              expect(found).toBeDefined();
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('does not report differences for fields with matching values', async () => {
      await fc.assert(
        fc.asyncProperty(
          employeeCodeArb,
          fullNameArb,
          campusNameArb,
          departmentNameArb,
          async (employeeCode, fullName, campusName, departmentName) => {
            jest.clearAllMocks();

            const schoolId = '123e4567-e89b-12d3-a456-426614174000';

            // Master and source have SAME values
            const masterEmp = createMockEmployee({
              id: `emp-same`,
              schoolId,
              employeeCode,
              fullName,
              campusName,
              departmentName,
            });

            const sourceData: SourceDataItem[] = [
              {
                employeeCode,
                fullName,
                campusName,
                departmentName,
              },
            ];

            mockMasterDataRepository.findByEmployeeCode.mockResolvedValue(
              masterEmp,
            );
            mockFieldDefinitionRepository.findAll.mockResolvedValue([]);

            const result = await reconciliationService.triggerReconciliation(
              schoolId,
              'teacher',
              sourceData,
              'admin',
            );

            // No differences should be reported when values match
            expect(result.reportData?.differences || []).toHaveLength(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 11: Applying Reconciliation Updates Master Data
   *
   * For any completed reconciliation session with detected differences, applying the
   * changes SHALL result in the Master Data values for the accepted fields matching
   * the source module values.
   *
   * **Validates: Requirements 4.4**
   */
  describe('Property 11: Applying Reconciliation Updates Master Data', () => {
    it('updates Master Data fields to match source values for accepted fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          employeeCodeArb,
          fullNameArb,
          fullNameArb,
          campusNameArb,
          campusNameArb,
          departmentNameArb,
          departmentNameArb,
          fc.subarray(['fullName', 'campusName', 'departmentName'], {
            minLength: 1,
          }),
          async (
            employeeCode,
            masterFullName,
            sourceFullName,
            masterCampus,
            sourceCampus,
            masterDept,
            sourceDept,
            acceptedFields,
          ) => {
            // Ensure at least one field actually differs
            const hasDiff =
              (acceptedFields.includes('fullName') &&
                masterFullName !== sourceFullName) ||
              (acceptedFields.includes('campusName') &&
                masterCampus !== sourceCampus) ||
              (acceptedFields.includes('departmentName') &&
                masterDept !== sourceDept);
            fc.pre(hasDiff);

            jest.clearAllMocks();

            const schoolId = '123e4567-e89b-12d3-a456-426614174000';
            const sessionId = 'session-apply-test';
            const changedBy = 'admin-user';

            // Build differences based on what actually differs
            const differences: Array<{
              employeeCode: string;
              fieldName: string;
              masterValue: string;
              sourceValue: string;
            }> = [];
            if (masterFullName !== sourceFullName) {
              differences.push({
                employeeCode,
                fieldName: 'fullName',
                masterValue: masterFullName,
                sourceValue: sourceFullName,
              });
            }
            if (masterCampus !== sourceCampus) {
              differences.push({
                employeeCode,
                fieldName: 'campusName',
                masterValue: masterCampus,
                sourceValue: sourceCampus,
              });
            }
            if (masterDept !== sourceDept) {
              differences.push({
                employeeCode,
                fieldName: 'departmentName',
                masterValue: masterDept,
                sourceValue: sourceDept,
              });
            }

            // Create session with report data
            const session = createMockSession({
              id: sessionId,
              schoolId,
              status: ReconciliationStatus.COMPLETED,
              reportData: {
                differences,
                newFields: [],
                newRecords: [],
              },
            });

            mockReconciliationRepo.findOne.mockResolvedValue(session);

            // Track updates applied to employees
            const appliedUpdates: Array<{
              id: string;
              field: string;
              value: unknown;
            }> = [];

            // Mock the employee lookup within transaction
            const masterEmployee = createMockEmployee({
              id: 'emp-apply',
              schoolId,
              employeeCode,
              fullName: masterFullName,
              campusName: masterCampus,
              departmentName: masterDept,
            });

            // Mock: findByEmployeeCode returns the employee
            mockMasterDataRepository.findByEmployeeCode.mockResolvedValue(
              masterEmployee,
            );

            // Mock DataSource.transaction
            mockDataSource.transaction.mockImplementation(
              async (cb: unknown) => {
                const mockManager = {
                  createQueryBuilder: jest.fn().mockReturnValue({
                    update: jest.fn().mockReturnThis(),
                    set: jest.fn().mockImplementation(function (
                      this: unknown,
                      data: Record<string, unknown>,
                    ) {
                      for (const [key, value] of Object.entries(data)) {
                        appliedUpdates.push({
                          id: masterEmployee.id,
                          field: key,
                          value,
                        });
                      }
                      return this;
                    }),
                    where: jest.fn().mockReturnThis(),
                    execute: jest.fn().mockResolvedValue({ affected: 1 }),
                  }),
                  create: jest
                    .fn()
                    .mockImplementation((_cls: unknown, data: unknown) => data),
                  save: jest.fn().mockResolvedValue({}),
                  update: jest.fn().mockResolvedValue({ affected: 1 }),
                };
                return (
                  cb as (manager: typeof mockManager) => Promise<unknown>
                )(mockManager);
              },
            );

            // Execute applyChanges
            await reconciliationService.applyChanges(
              sessionId,
              acceptedFields,
              changedBy,
            );

            // Verify: each accepted field that had a difference was updated to source value
            for (const field of acceptedFields) {
              const diff = differences.find((d) => d.fieldName === field);
              if (diff) {
                const update = appliedUpdates.find((u) => u.field === field);
                expect(update).toBeDefined();
                // The service calls parseValue which converts string to number if possible
                // Our test values are strings so they should remain as strings
                expect(String(update!.value)).toBe(diff.sourceValue);
              }
            }

            // Verify: fields NOT in acceptedFields were NOT updated
            for (const diff of differences) {
              if (!acceptedFields.includes(diff.fieldName)) {
                const update = appliedUpdates.find(
                  (u) => u.field === diff.fieldName,
                );
                expect(update).toBeUndefined();
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 12: Declining Reconciliation Preserves Master Data
   *
   * For any completed reconciliation session, declining the changes SHALL leave all
   * Master Data values identical to their state before the reconciliation was triggered.
   *
   * **Validates: Requirements 4.5**
   */
  describe('Property 12: Declining Reconciliation Preserves Master Data', () => {
    it('does not modify any Master Data when reconciliation is declined', async () => {
      await fc.assert(
        fc.asyncProperty(
          employeeCodeArb,
          fullNameArb,
          fullNameArb,
          campusNameArb,
          campusNameArb,
          sourceModuleArb,
          async (
            employeeCode,
            masterFullName,
            sourceFullName,
            masterCampus,
            sourceCampus,
            sourceModule,
          ) => {
            // Ensure there are actual differences in the session
            fc.pre(
              masterFullName !== sourceFullName ||
                masterCampus !== sourceCampus,
            );

            jest.clearAllMocks();

            const schoolId = '123e4567-e89b-12d3-a456-426614174000';
            const sessionId = 'session-decline-test';

            // Build differences
            const differences: Array<{
              employeeCode: string;
              fieldName: string;
              masterValue: string;
              sourceValue: string;
            }> = [];
            if (masterFullName !== sourceFullName) {
              differences.push({
                employeeCode,
                fieldName: 'fullName',
                masterValue: masterFullName,
                sourceValue: sourceFullName,
              });
            }
            if (masterCampus !== sourceCampus) {
              differences.push({
                employeeCode,
                fieldName: 'campusName',
                masterValue: masterCampus,
                sourceValue: sourceCampus,
              });
            }

            // Create session with report data containing differences
            const session = createMockSession({
              id: sessionId,
              schoolId,
              sourceModule,
              status: ReconciliationStatus.COMPLETED,
              reportData: {
                differences,
                newFields: [],
                newRecords: [],
              },
            });

            mockReconciliationRepo.findOne.mockResolvedValue(session);
            mockReconciliationRepo.update.mockResolvedValue({
              affected: 1,
            } as never);

            // Execute decline
            await reconciliationService.declineChanges(sessionId);

            // Verify: MasterDataRepository was NEVER called for any update
            expect(mockMasterDataRepository.update).not.toHaveBeenCalled();

            // Verify: DataSource.transaction was NOT called (no writes to employee data)
            expect(mockDataSource.transaction).not.toHaveBeenCalled();

            // Verify: session status was updated to DECLINED
            expect(mockReconciliationRepo.update).toHaveBeenCalledWith(
              sessionId,
              expect.objectContaining({
                status: ReconciliationStatus.DECLINED,
              }),
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('preserves extended field values when reconciliation is declined', async () => {
      await fc.assert(
        fc.asyncProperty(
          employeeCodeArb,
          fc.constantFrom('customScore', 'teamSize', 'level'),
          fc.constantFrom(
            'ValueA',
            'ValueB',
            '100',
            '200',
            'NewValueX',
            'NewValueY',
            '999',
            '500',
          ),
          fc.constantFrom(
            'ValueA',
            'ValueB',
            '100',
            '200',
            'NewValueX',
            'NewValueY',
            '999',
            '500',
          ),
          async (
            employeeCode,
            extFieldName,
            masterExtValue,
            sourceExtValue,
          ) => {
            fc.pre(masterExtValue !== sourceExtValue);

            jest.clearAllMocks();

            const schoolId = '123e4567-e89b-12d3-a456-426614174000';
            const sessionId = 'session-decline-ext-test';

            const differences = [
              {
                employeeCode,
                fieldName: extFieldName,
                masterValue: masterExtValue,
                sourceValue: sourceExtValue,
              },
            ];

            const session = createMockSession({
              id: sessionId,
              schoolId,
              status: ReconciliationStatus.COMPLETED,
              reportData: {
                differences,
                newFields: [],
                newRecords: [],
              },
            });

            mockReconciliationRepo.findOne.mockResolvedValue(session);
            mockReconciliationRepo.update.mockResolvedValue({
              affected: 1,
            } as never);

            // Execute decline
            await reconciliationService.declineChanges(sessionId);

            // Verify: no employee data was modified
            expect(mockMasterDataRepository.update).not.toHaveBeenCalled();
            expect(mockDataSource.transaction).not.toHaveBeenCalled();

            // Session was marked as declined
            expect(mockReconciliationRepo.update).toHaveBeenCalledWith(
              sessionId,
              expect.objectContaining({
                status: ReconciliationStatus.DECLINED,
              }),
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
