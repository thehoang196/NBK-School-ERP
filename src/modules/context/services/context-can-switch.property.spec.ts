import * as fc from 'fast-check';
import { ContextService, ContextJwtUser } from './context.service';
import { UserRole } from '../../../common/enums/role.enum';
import { SchoolStatus } from '../../../common/enums/status.enum';
import { SchoolEntity } from '../../school/entities/school.entity';

// Mock uuid module to avoid ESM issues with Jest
jest.mock('uuid', () => ({
  validate: jest.fn((str: string) => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }),
}));

/**
 * Feature: workspace-context-switcher, Property 12: canSwitch computation
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 6.3, 6.4**
 *
 * For any user, the `canSwitch` field SHALL equal `true` if and only if
 * the user's computed accessible schools list contains 2 or more schools;
 * otherwise it SHALL equal `false`.
 */
describe('Feature: workspace-context-switcher, Property 12: canSwitch computation', () => {
  let service: ContextService;
  let schoolRepository: {
    findById: jest.Mock;
  };
  let schoolEntityRepository: {
    find: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let teacherSchoolAssignmentService: {
    getAccessibleSchoolIds: jest.Mock;
  };
  let contextSessionService: {
    setActiveContext: jest.Mock;
    getActiveContext: jest.Mock;
    deleteSession: jest.Mock;
    refreshTtl: jest.Mock;
  };
  let auditLogService: {
    log: jest.Mock;
  };

  /**
   * Arbitrary: generates a valid UUID v4 string.
   */
  const arbUuid = fc.uuid().map((u) => u.toLowerCase());

  /**
   * Arbitrary: generates a school name (non-empty alphanumeric string).
   */
  const arbSchoolName = fc
    .string({ minLength: 1, maxLength: 50 })
    .filter((s) => s.trim().length > 0);

  /**
   * Arbitrary: generates a mock SchoolEntity with ACTIVE status.
   */
  const arbActiveSchool = fc.record({
    id: arbUuid,
    code: fc.string({ minLength: 2, maxLength: 10 }).filter((s) => s.trim().length > 0),
    name: arbSchoolName,
    parentSchoolId: fc.option(arbUuid, { nil: null }),
    status: fc.constant(SchoolStatus.ACTIVE),
    deletedAt: fc.constant(null),
  });

  /**
   * Creates a mock SchoolEntity from generated data.
   */
  function toSchoolEntity(data: {
    id: string;
    code: string;
    name: string;
    parentSchoolId: string | null;
    status: SchoolStatus;
    deletedAt: null;
  }): SchoolEntity {
    return {
      ...data,
      address: null,
      phone: null,
      email: null,
      principalName: null,
      parentSchool: null,
      childSchools: [],
    } as unknown as SchoolEntity;
  }

  beforeEach(() => {
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
      getMany: jest.fn().mockResolvedValue([]),
    };

    schoolEntityRepository = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    schoolRepository = {
      findById: jest.fn().mockResolvedValue(null),
    };

    teacherSchoolAssignmentService = {
      getAccessibleSchoolIds: jest.fn().mockResolvedValue([]),
    };

    contextSessionService = {
      setActiveContext: jest.fn(),
      getActiveContext: jest.fn().mockResolvedValue(null),
      deleteSession: jest.fn(),
      refreshTtl: jest.fn(),
    };

    auditLogService = {
      log: jest.fn(),
    };

    // Instantiate ContextService with mocks
    service = new ContextService(
      schoolRepository as any,
      schoolEntityRepository as any,
      teacherSchoolAssignmentService as any,
      contextSessionService as any,
      auditLogService as any,
      { emit: jest.fn() } as any,
    );
  });

  it('canSwitch is false when accessible schools list has 0 entries', async () => {
    await fc.assert(
      fc.asyncProperty(arbUuid, async (userId) => {
        // Setup: SCHOOL_ADMIN with no valid school (findById returns null)
        schoolRepository.findById.mockResolvedValue(null);

        const user: ContextJwtUser = {
          id: userId,
          role: UserRole.SCHOOL_ADMIN,
          schoolId: null,
        };

        const result = await service.getAccessibleSchools(user);

        expect(result.canSwitch).toBe(false);
        expect(result.schools.length).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  it('canSwitch is false when accessible schools list has exactly 1 entry', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbActiveSchool,
        async (schoolData) => {
          const school = toSchoolEntity(schoolData);

          // Setup: single-school user (SCHOOL_ADMIN) with one ACTIVE school
          schoolRepository.findById.mockResolvedValue(school);
          schoolEntityRepository.find.mockResolvedValue([school]);
          schoolEntityRepository.createQueryBuilder.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getRawMany: jest.fn().mockResolvedValue([]),
          });

          const user: ContextJwtUser = {
            id: 'user-' + schoolData.id,
            role: UserRole.SCHOOL_ADMIN,
            schoolId: school.id,
          };

          const result = await service.getAccessibleSchools(user);

          expect(result.canSwitch).toBe(false);
          expect(result.schools.length).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('canSwitch is true when accessible schools list has 2 or more entries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbActiveSchool, { minLength: 2, maxLength: 50 }).map(
          // Ensure unique IDs
          (schools) => {
            const seen = new Set<string>();
            return schools.filter((s) => {
              if (seen.has(s.id)) return false;
              seen.add(s.id);
              return true;
            });
          },
        ).filter((schools) => schools.length >= 2),
        async (schoolsData) => {
          const schools = schoolsData.map(toSchoolEntity);
          const schoolIds = schools.map((s) => s.id);

          // Setup: SUPER_ADMIN with multiple ACTIVE schools
          schoolEntityRepository.find.mockResolvedValue(schools);
          schoolEntityRepository.createQueryBuilder.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getRawMany: jest.fn().mockResolvedValue([]),
          });

          const user: ContextJwtUser = {
            id: 'super-admin-user',
            role: UserRole.SUPER_ADMIN,
            schoolId: null,
          };

          const result = await service.getAccessibleSchools(user);

          expect(result.canSwitch).toBe(true);
          expect(result.schools.length).toBeGreaterThanOrEqual(2);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('canSwitch equals (accessibleSchools.length >= 2) for TEACHER with varying number of schools', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbActiveSchool, { minLength: 0, maxLength: 10 }).map(
          // Ensure unique IDs
          (schools) => {
            const seen = new Set<string>();
            return schools.filter((s) => {
              if (seen.has(s.id)) return false;
              seen.add(s.id);
              return true;
            });
          },
        ),
        arbUuid,
        async (schoolsData, userId) => {
          const schools = schoolsData.map(toSchoolEntity);
          const schoolIds = schools.map((s) => s.id);

          // Setup: TEACHER with varying accessible schools from JWT claim
          // Mock filterActiveSchoolIds by configuring the query builder getMany
          const mockQueryBuilder = {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getRawMany: jest.fn().mockResolvedValue([]),
            getMany: jest.fn().mockResolvedValue(schools),
          };

          schoolEntityRepository.find.mockResolvedValue(schools);
          schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

          const user: ContextJwtUser = {
            id: userId,
            role: UserRole.TEACHER,
            schoolId: schoolIds[0] ?? null,
            accessibleSchoolIds: schoolIds,
          };

          const result = await service.getAccessibleSchools(user);

          // Property: canSwitch is true iff schools.length >= 2
          const expectedCanSwitch = result.schools.length >= 2;
          expect(result.canSwitch).toBe(expectedCanSwitch);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('canSwitch in getCurrentContext equals (accessibleSchools.length >= 2) for any user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbActiveSchool, { minLength: 0, maxLength: 10 }).map(
          (schools) => {
            const seen = new Set<string>();
            return schools.filter((s) => {
              if (seen.has(s.id)) return false;
              seen.add(s.id);
              return true;
            });
          },
        ),
        arbUuid,
        async (schoolsData, userId) => {
          const schools = schoolsData.map(toSchoolEntity);
          const schoolIds = schools.map((s) => s.id);

          // Mock the computeAccessibleSchoolIds to return the school IDs
          // by setting up SUPER_ADMIN (returns all active schools)
          schoolEntityRepository.find.mockResolvedValue(schools);
          schoolEntityRepository.createQueryBuilder.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getRawMany: jest.fn().mockResolvedValue([]),
            getMany: jest.fn().mockResolvedValue(schools),
          });

          // Also set up schoolRepository.findById for getCurrentContext school resolution
          if (schools.length > 0) {
            schoolRepository.findById.mockResolvedValue(schools[0]);
          } else {
            schoolRepository.findById.mockResolvedValue(null);
          }

          // Use SUPER_ADMIN role for simplicity — all active schools are accessible
          const user: ContextJwtUser = {
            id: userId,
            role: UserRole.SUPER_ADMIN,
            schoolId: schoolIds[0] ?? null,
          };

          const result = await service.getCurrentContext(user);

          // Property: canSwitch equals true iff accessible schools >= 2
          const expectedCanSwitch = schools.length >= 2;
          expect(result.canSwitch).toBe(expectedCanSwitch);
        },
      ),
      { numRuns: 100 },
    );
  });
});
