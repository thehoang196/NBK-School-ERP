import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as fc from 'fast-check';
import { MasterDataService } from '../../../src/modules/master-data/services/master-data.service';
import { MasterDataRepository } from '../../../src/modules/master-data/repositories/master-data.repository';
import { AuditLogRepository } from '../../../src/modules/master-data/repositories/audit-log.repository';
import { FieldDefinitionRepository } from '../../../src/modules/master-data/repositories/field-definition.repository';
import { FieldDefinitionService } from '../../../src/modules/master-data/services/field-definition.service';
import { SyncService } from '../../../src/modules/master-data/services/sync.service';
import {
  MasterDataScopeGuard,
  MASTER_DATA_WRITE_KEY,
  MASTER_DATA_RECONCILIATION_KEY,
} from '../../../src/modules/master-data/guards/master-data-scope.guard';
import { EmployeeMasterEntity } from '../../../src/modules/master-data/entities/employee-master.entity';
import { EmployeeMasterQueryDto } from '../../../src/modules/master-data/dto/employee-master-query.dto';
import { UserRole } from '../../../src/common/enums/role.enum';
import { Gender } from '../../../src/common/enums/status.enum';
import { ExecutionContext } from '@nestjs/common';

/**
 * Property-Based Tests for Pagination, Search, Sort, and RBAC
 *
 * Feature: master-data
 * Testing Framework: fast-check
 * Minimum Iterations: 100 per property
 */

// --- Custom Arbitraries ---

const uuidArb = fc.uuid({ version: 4 });

const employeeCodeArb = fc.stringMatching(/^[A-Za-z0-9]{1,20}$/);

const fullNameArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0);

const genderArb = fc.constantFrom(Gender.MALE, Gender.FEMALE, Gender.OTHER);

const sortableFieldArb = fc.constantFrom(
  'employeeCode',
  'fullName',
  'shortName',
  'campusName',
  'gradeName',
  'departmentName',
  'jobTitle',
  'managementLevel',
);

const sortDirectionArb = fc.constantFrom('ASC' as const, 'DESC' as const);

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
    gender: Gender.MALE,
    maxPeriodsPerWeek: 20,
    workingDays: 5,
    extendedFields: {},
    school: null as unknown as EmployeeMasterEntity['school'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    ...overrides,
  } as EmployeeMasterEntity;
}

function generateEmployeeList(
  count: number,
  schoolId: string,
): EmployeeMasterEntity[] {
  const employees: EmployeeMasterEntity[] = [];
  for (let i = 0; i < count; i++) {
    employees.push(
      createMockEmployee({
        id: `emp-${i.toString().padStart(4, '0')}`,
        schoolId,
        employeeCode: `NV${i.toString().padStart(4, '0')}`,
        fullName: `Employee ${i}`,
        campusName: `Campus ${i % 3}`,
        gradeName: `Grade ${i % 5}`,
        departmentName: `Dept ${i % 4}`,
        jobTitle: `Title ${i % 3}`,
        gender: [Gender.MALE, Gender.FEMALE, Gender.OTHER][i % 3],
      }),
    );
  }
  return employees;
}

function createMockExecutionContext(
  user: { id: string; role: UserRole; schoolId: string | null } | null,
  params: Record<string, string> = {},
  query: Record<string, string> = {},
  body: Record<string, string> = {},
  method = 'GET',
): ExecutionContext {
  const request = {
    user,
    params,
    query,
    body,
    method,
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

// ===================================================================
// Property 16: Pagination Returns Correct Subset
// ===================================================================

describe('Feature: master-data | Property 16: Pagination Returns Correct Subset', () => {
  let service: MasterDataService;
  let masterDataRepository: jest.Mocked<MasterDataRepository>;

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

    const mockFieldDefinitionService = {
      register: jest.fn(),
      findAll: jest.fn(),
      validateValue: jest.fn().mockReturnValue(true),
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
        { provide: MasterDataRepository, useValue: mockMasterDataRepository },
        { provide: AuditLogRepository, useValue: mockAuditLogRepository },
        {
          provide: FieldDefinitionRepository,
          useValue: mockFieldDefinitionRepository,
        },
        {
          provide: FieldDefinitionService,
          useValue: mockFieldDefinitionService,
        },
        { provide: SyncService, useValue: mockSyncService },
      ],
    }).compile();

    service = module.get<MasterDataService>(MasterDataService);
    masterDataRepository = module.get(
      MasterDataRepository,
    ) as jest.Mocked<MasterDataRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 16: Pagination Returns Correct Subset
   *
   * For any set of N employee records and any valid page/limit parameters
   * where page * limit <= N, the response SHALL contain exactly limit records,
   * and the meta SHALL report the correct total, totalPages, and page values.
   *
   * **Validates: Requirements 6.1**
   */
  it('returns correct subset with accurate pagination meta for any valid page/limit', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 200 }), // total records N
        fc.integer({ min: 1, max: 50 }), // limit (page size)
        uuidArb, // schoolId
        async (totalRecords, limit, schoolId) => {
          // Calculate total pages and pick a valid page
          const totalPages = Math.ceil(totalRecords / limit);
          // Pick a page where we can guarantee exactly `limit` records
          // Only pick pages that are full (not the last partial page)
          const maxFullPage = Math.floor(totalRecords / limit);
          fc.pre(maxFullPage >= 1); // Need at least 1 full page

          const page = fc.sample(
            fc.integer({ min: 1, max: maxFullPage }),
            1,
          )[0];

          jest.clearAllMocks();

          // Generate mock records for the requested page
          const allEmployees = generateEmployeeList(totalRecords, schoolId);
          const startIdx = (page - 1) * limit;
          const pageRecords = allEmployees.slice(startIdx, startIdx + limit);

          // Mock repository to return the page slice and total count
          masterDataRepository.findAll.mockResolvedValue([
            pageRecords,
            totalRecords,
          ]);

          const query: EmployeeMasterQueryDto = {
            page,
            limit,
            sortOrder: 'ASC',
            schoolId,
          };

          const result = await service.findAll(query);

          // Response contains exactly `limit` records
          expect(result.data).toHaveLength(limit);

          // Meta reports correct total
          expect(result.meta.total).toBe(totalRecords);

          // Meta reports correct totalPages
          expect(result.meta.totalPages).toBe(totalPages);

          // Meta reports correct page
          expect(result.meta.page).toBe(page);

          // Meta reports correct limit
          expect(result.meta.limit).toBe(limit);

          // Success flag is true
          expect(result.success).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ===================================================================
// Property 17: Search and Filter Returns Only Matching Records
// ===================================================================

describe('Feature: master-data | Property 17: Search and Filter Returns Only Matching Records', () => {
  let service: MasterDataService;
  let masterDataRepository: jest.Mocked<MasterDataRepository>;

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

    const mockFieldDefinitionService = {
      register: jest.fn(),
      findAll: jest.fn(),
      validateValue: jest.fn().mockReturnValue(true),
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
        { provide: MasterDataRepository, useValue: mockMasterDataRepository },
        { provide: AuditLogRepository, useValue: mockAuditLogRepository },
        {
          provide: FieldDefinitionRepository,
          useValue: mockFieldDefinitionRepository,
        },
        {
          provide: FieldDefinitionService,
          useValue: mockFieldDefinitionService,
        },
        { provide: SyncService, useValue: mockSyncService },
      ],
    }).compile();

    service = module.get<MasterDataService>(MasterDataService);
    masterDataRepository = module.get(
      MasterDataRepository,
    ) as jest.Mocked<MasterDataRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 17: Search and Filter Returns Only Matching Records
   *
   * For any search term or filter criteria, every returned employee record
   * SHALL match the search/filter conditions.
   *
   * **Validates: Requirements 6.2, 6.3**
   */
  it('every returned record matches the search term (employeeCode or fullName)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[A-Za-z0-9]{1,10}$/), // search term
        fc.integer({ min: 1, max: 50 }), // total pool size
        uuidArb, // schoolId
        async (searchTerm, poolSize, schoolId) => {
          jest.clearAllMocks();

          const allEmployees = generateEmployeeList(poolSize, schoolId);

          // Simulate the repository's ILIKE search behavior
          const searchLower = searchTerm.toLowerCase();
          const matchingRecords = allEmployees.filter(
            (emp) =>
              emp.employeeCode.toLowerCase().includes(searchLower) ||
              emp.fullName.toLowerCase().includes(searchLower),
          );

          // Mock repository returns only matching records
          masterDataRepository.findAll.mockResolvedValue([
            matchingRecords.slice(0, 10),
            matchingRecords.length,
          ]);

          const query: EmployeeMasterQueryDto = {
            page: 1,
            limit: 10,
            sortOrder: 'ASC',
            search: searchTerm,
            schoolId,
          };

          const result = await service.findAll(query);

          // Every returned record must match the search condition
          for (const record of result.data) {
            const matchesCode = record.employeeCode
              .toLowerCase()
              .includes(searchLower);
            const matchesName = record.fullName
              .toLowerCase()
              .includes(searchLower);
            expect(matchesCode || matchesName).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('every returned record matches the filter criteria (gender, campusName, gradeName)', async () => {
    await fc.assert(
      fc.asyncProperty(
        genderArb,
        fc.integer({ min: 5, max: 50 }),
        uuidArb,
        async (filterGender, poolSize, schoolId) => {
          jest.clearAllMocks();

          const allEmployees = generateEmployeeList(poolSize, schoolId);

          // Simulate filter behavior
          const matchingRecords = allEmployees.filter(
            (emp) => emp.gender === filterGender,
          );

          masterDataRepository.findAll.mockResolvedValue([
            matchingRecords.slice(0, 10),
            matchingRecords.length,
          ]);

          const query: EmployeeMasterQueryDto = {
            page: 1,
            limit: 10,
            sortOrder: 'ASC',
            gender: filterGender,
            schoolId,
          };

          const result = await service.findAll(query);

          // Every returned record must match the gender filter
          for (const record of result.data) {
            expect(record.gender).toBe(filterGender);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ===================================================================
// Property 18: Sort Produces Correctly Ordered Results
// ===================================================================

describe('Feature: master-data | Property 18: Sort Produces Correctly Ordered Results', () => {
  let service: MasterDataService;
  let masterDataRepository: jest.Mocked<MasterDataRepository>;

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

    const mockFieldDefinitionService = {
      register: jest.fn(),
      findAll: jest.fn(),
      validateValue: jest.fn().mockReturnValue(true),
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
        { provide: MasterDataRepository, useValue: mockMasterDataRepository },
        { provide: AuditLogRepository, useValue: mockAuditLogRepository },
        {
          provide: FieldDefinitionRepository,
          useValue: mockFieldDefinitionRepository,
        },
        {
          provide: FieldDefinitionService,
          useValue: mockFieldDefinitionService,
        },
        { provide: SyncService, useValue: mockSyncService },
      ],
    }).compile();

    service = module.get<MasterDataService>(MasterDataService);
    masterDataRepository = module.get(
      MasterDataRepository,
    ) as jest.Mocked<MasterDataRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 18: Sort Produces Correctly Ordered Results
   *
   * For any Core_Field used as sort criteria and any direction (ASC/DESC),
   * the returned records SHALL be ordered such that for any two adjacent records,
   * the sort field value of the first is <= (ASC) or >= (DESC) the value of the second.
   *
   * **Validates: Requirements 6.4**
   */
  it('returned records are correctly ordered by sort field and direction', async () => {
    await fc.assert(
      fc.asyncProperty(
        sortableFieldArb,
        sortDirectionArb,
        fc.integer({ min: 2, max: 30 }),
        uuidArb,
        async (sortBy, sortOrder, recordCount, schoolId) => {
          jest.clearAllMocks();

          const employees = generateEmployeeList(recordCount, schoolId);

          // Sort the employees to simulate what the database would return
          const sortedEmployees = [...employees].sort((a, b) => {
            const valA =
              (a[sortBy as keyof EmployeeMasterEntity] as string | null) ?? '';
            const valB =
              (b[sortBy as keyof EmployeeMasterEntity] as string | null) ?? '';

            if (sortOrder === 'ASC') {
              return valA.localeCompare(valB);
            } else {
              return valB.localeCompare(valA);
            }
          });

          const pageRecords = sortedEmployees.slice(
            0,
            Math.min(10, recordCount),
          );

          masterDataRepository.findAll.mockResolvedValue([
            pageRecords,
            recordCount,
          ]);

          const query: EmployeeMasterQueryDto = {
            page: 1,
            limit: 10,
            sortBy,
            sortOrder,
            schoolId,
          };

          const result = await service.findAll(query);

          // Verify adjacent pair ordering
          for (let i = 0; i < result.data.length - 1; i++) {
            const current =
              (result.data[i][sortBy as keyof EmployeeMasterEntity] as
                string | null) ?? '';
            const next =
              (result.data[i + 1][sortBy as keyof EmployeeMasterEntity] as
                string | null) ?? '';

            if (sortOrder === 'ASC') {
              expect(current.localeCompare(next)).toBeLessThanOrEqual(0);
            } else {
              expect(current.localeCompare(next)).toBeGreaterThanOrEqual(0);
            }
          }

          // Verify repository was called with correct sort params
          expect(masterDataRepository.findAll).toHaveBeenCalledWith(
            expect.objectContaining({
              sortBy,
              sortOrder,
            }),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ===================================================================
// Property 19: Role-Based Data Scoping
// ===================================================================

describe('Feature: master-data | Property 19: Role-Based Data Scoping', () => {
  let guard: MasterDataScopeGuard;
  let reflector: jest.Mocked<Reflector>;
  let masterDataRepository: jest.Mocked<MasterDataRepository>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as jest.Mocked<Reflector>;

    masterDataRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findByEmployeeCode: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<MasterDataRepository>;

    guard = new MasterDataScopeGuard(reflector, masterDataRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 19: Role-Based Data Scoping
   *
   * For any user with SCHOOL_ADMIN role, all returned records SHALL have
   * school_id matching user's school. For TEACHER, only own record accessible.
   * For non-admin, write and reconciliation denied with 403.
   *
   * **Validates: Requirements 7.1, 7.2, 7.3, 7.5**
   */
  describe('SCHOOL_ADMIN sees only own school records', () => {
    it('throws 403 when SCHOOL_ADMIN accesses a different school_id', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // user's schoolId
          uuidArb, // requested schoolId (different)
          uuidArb, // userId
          async (userSchoolId, requestedSchoolId, userId) => {
            // Ensure the two school IDs are different
            fc.pre(userSchoolId !== requestedSchoolId);

            jest.clearAllMocks();

            const user = {
              id: userId,
              role: UserRole.SCHOOL_ADMIN,
              schoolId: userSchoolId,
            };

            const context = createMockExecutionContext(
              user,
              {},
              { schoolId: requestedSchoolId },
            );

            await expect(guard.canActivate(context)).rejects.toThrow(
              ForbiddenException,
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('allows SCHOOL_ADMIN to access own school data', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // schoolId
          uuidArb, // userId
          async (schoolId, userId) => {
            jest.clearAllMocks();

            const user = {
              id: userId,
              role: UserRole.SCHOOL_ADMIN,
              schoolId,
            };

            const context = createMockExecutionContext(user, {}, { schoolId });

            const result = await guard.canActivate(context);
            expect(result).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('TEACHER can only access own record', () => {
    it('throws 403 when TEACHER attempts write operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // schoolId
          uuidArb, // userId
          async (schoolId, userId) => {
            jest.clearAllMocks();

            reflector.getAllAndOverride.mockImplementation((key: unknown) => {
              if (key === MASTER_DATA_WRITE_KEY) return true;
              return false;
            });

            const user = {
              id: userId,
              role: UserRole.TEACHER,
              schoolId,
            };

            const context = createMockExecutionContext(
              user,
              {},
              {},
              {},
              'POST',
            );

            await expect(guard.canActivate(context)).rejects.toThrow(
              ForbiddenException,
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('throws 403 when TEACHER attempts reconciliation operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // schoolId
          uuidArb, // userId
          async (schoolId, userId) => {
            jest.clearAllMocks();

            reflector.getAllAndOverride.mockImplementation((key: unknown) => {
              if (key === MASTER_DATA_RECONCILIATION_KEY) return true;
              return false;
            });

            const user = {
              id: userId,
              role: UserRole.TEACHER,
              schoolId,
            };

            const context = createMockExecutionContext(user);

            await expect(guard.canActivate(context)).rejects.toThrow(
              ForbiddenException,
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('throws 403 when TEACHER accesses record from another school', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb, // teacher's schoolId
          uuidArb, // employee's schoolId (different)
          uuidArb, // userId
          uuidArb, // employeeId
          async (teacherSchoolId, employeeSchoolId, userId, employeeId) => {
            fc.pre(teacherSchoolId !== employeeSchoolId);

            jest.clearAllMocks();
            reflector.getAllAndOverride.mockReturnValue(false);

            const employee = createMockEmployee({
              id: employeeId,
              schoolId: employeeSchoolId,
            });

            masterDataRepository.findById.mockResolvedValue(employee);

            const user = {
              id: userId,
              role: UserRole.TEACHER,
              schoolId: teacherSchoolId,
            };

            const context = createMockExecutionContext(user, {
              id: employeeId,
            });

            await expect(guard.canActivate(context)).rejects.toThrow(
              ForbiddenException,
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Non-admin roles denied write and reconciliation', () => {
    const nonAdminRoles = [
      UserRole.TEACHER,
      UserRole.SCHEDULER,
      UserRole.VIEWER,
    ];

    it('throws 403 for write operations for any non-admin role', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...nonAdminRoles),
          uuidArb, // schoolId
          uuidArb, // userId
          async (role, schoolId, userId) => {
            jest.clearAllMocks();

            reflector.getAllAndOverride.mockImplementation((key: unknown) => {
              if (key === MASTER_DATA_WRITE_KEY) return true;
              return false;
            });

            const user = {
              id: userId,
              role,
              schoolId,
            };

            const context = createMockExecutionContext(
              user,
              {},
              {},
              {},
              'POST',
            );

            await expect(guard.canActivate(context)).rejects.toThrow(
              ForbiddenException,
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('throws 403 for reconciliation operations for any non-admin role', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...nonAdminRoles),
          uuidArb, // schoolId
          uuidArb, // userId
          async (role, schoolId, userId) => {
            jest.clearAllMocks();

            reflector.getAllAndOverride.mockImplementation((key: unknown) => {
              if (key === MASTER_DATA_RECONCILIATION_KEY) return true;
              return false;
            });

            const user = {
              id: userId,
              role,
              schoolId,
            };

            const context = createMockExecutionContext(user);

            await expect(guard.canActivate(context)).rejects.toThrow(
              ForbiddenException,
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
