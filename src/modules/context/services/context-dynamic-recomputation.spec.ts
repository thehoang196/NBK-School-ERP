import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Mock uuid module to avoid ESM issues with Jest
jest.mock('uuid', () => ({
  validate: (str: string) => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  },
}));

import { ContextService, ContextJwtUser } from './context.service';
import { ContextSessionService } from './context-session.service';
import { SchoolRepository } from '../../school/school.repository';
import { TeacherSchoolAssignmentService } from '../../teacher-school-assignment/teacher-school-assignment.service';
import { AuditLogService } from '../../audit/services/audit-log.service';
import { SchoolEntity } from '../../school/entities/school.entity';
import { UserRole } from '../../../common/enums/role.enum';
import { SchoolStatus } from '../../../common/enums/status.enum';

// ─── Test Factories ────────────────────────────────────────────────────────────

const createMockSchool = (
  overrides: Partial<SchoolEntity> = {},
): SchoolEntity =>
  ({
    id: 'school-uuid-0001-0000-000000000001',
    code: 'TH01',
    name: 'Trường TH Nguyễn Bỉnh Khiêm 1',
    address: null,
    phone: null,
    email: null,
    principalName: null,
    parentSchoolId: null,
    parentSchool: null,
    childSchools: [],
    status: SchoolStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
    ...overrides,
  }) as SchoolEntity;

const createMockUser = (
  overrides: Partial<ContextJwtUser> = {},
): ContextJwtUser => ({
  id: 'user-uuid-0001-0000-000000000001',
  email: 'test@nbk.edu.vn',
  role: UserRole.SCHOOL_ADMIN,
  schoolId: 'school-uuid-0001-0000-000000000001',
  accessibleSchoolIds: [],
  companySchoolId: null,
  ...overrides,
});

// ─── Dynamic Recomputation & Session Validation Tests ──────────────────────────
// Validates: Requirements 3.8, 4.7, 8.5, 8.6
//
// These tests verify that:
// 1. getAccessibleSchools() reflects real-time school status changes (Req 4.7, 8.5)
// 2. computeAccessibleSchoolIds() returns updated results when user role changes (Req 4.7)
// 3. Session invalidation occurs when a school becomes inactive (Req 3.8, 8.6)
// ────────────────────────────────────────────────────────────────────────────────

describe('ContextService — Dynamic Recomputation & Session Validation', () => {
  let service: ContextService;
  let schoolRepository: jest.Mocked<SchoolRepository>;
  let schoolEntityRepository: {
    find: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let teacherSchoolAssignmentService: jest.Mocked<TeacherSchoolAssignmentService>;
  let contextSessionService: jest.Mocked<ContextSessionService>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const mockSchoolRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
    };

    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    const mockSchoolEntityRepository = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const mockTeacherSchoolAssignmentService = {
      getAccessibleSchoolIds: jest.fn().mockResolvedValue([]),
    };

    const mockContextSessionService = {
      setActiveContext: jest.fn().mockResolvedValue(undefined),
      getActiveContext: jest.fn().mockResolvedValue(null),
      deleteSession: jest.fn().mockResolvedValue(undefined),
      refreshTtl: jest.fn().mockResolvedValue(undefined),
    };

    const mockAuditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextService,
        { provide: SchoolRepository, useValue: mockSchoolRepository },
        {
          provide: getRepositoryToken(SchoolEntity),
          useValue: mockSchoolEntityRepository,
        },
        {
          provide: TeacherSchoolAssignmentService,
          useValue: mockTeacherSchoolAssignmentService,
        },
        {
          provide: ContextSessionService,
          useValue: mockContextSessionService,
        },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<ContextService>(ContextService);
    schoolRepository = module.get(
      SchoolRepository,
    ) as jest.Mocked<SchoolRepository>;
    schoolEntityRepository = module.get(getRepositoryToken(SchoolEntity));
    teacherSchoolAssignmentService = module.get(
      TeacherSchoolAssignmentService,
    ) as jest.Mocked<TeacherSchoolAssignmentService>;
    contextSessionService = module.get(
      ContextSessionService,
    ) as jest.Mocked<ContextSessionService>;
    auditLogService = module.get(
      AuditLogService,
    ) as jest.Mocked<AuditLogService>;

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test: Accessible schools reflect real-time status changes
  // Requirements 4.7, 8.5
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Accessible schools reflect real-time status changes (Req 4.7, 8.5)', () => {
    it('should exclude a school that changed from ACTIVE to INACTIVE on the next getAccessibleSchools() call', async () => {
      const schoolA = createMockSchool({
        id: 'school-a-uuid',
        name: 'School A',
        status: SchoolStatus.ACTIVE,
      });
      const schoolB = createMockSchool({
        id: 'school-b-uuid',
        name: 'School B',
        status: SchoolStatus.ACTIVE,
      });

      const user = createMockUser({
        role: UserRole.SUPER_ADMIN,
        schoolId: null,
      });

      // First call: both schools are ACTIVE
      schoolEntityRepository.find
        .mockResolvedValueOnce([schoolA, schoolB]) // computeSuperAdminAccess
        .mockResolvedValueOnce([schoolA, schoolB]); // getAccessibleSchools query

      const mockQB = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);

      const result1 = await service.getAccessibleSchools(user);
      expect(result1.schools).toHaveLength(2);
      expect(result1.schools.map((s) => s.id)).toContain('school-a-uuid');
      expect(result1.schools.map((s) => s.id)).toContain('school-b-uuid');

      // Now schoolB becomes INACTIVE — simulate DB state change
      const schoolBInactive = createMockSchool({
        id: 'school-b-uuid',
        name: 'School B',
        status: SchoolStatus.INACTIVE,
      });

      // Second call: only schoolA is returned (schoolB filtered out by status=ACTIVE query)
      schoolEntityRepository.find
        .mockResolvedValueOnce([schoolA]) // computeSuperAdminAccess (only returns ACTIVE)
        .mockResolvedValueOnce([schoolA]); // getAccessibleSchools query

      const result2 = await service.getAccessibleSchools(user);
      expect(result2.schools).toHaveLength(1);
      expect(result2.schools[0].id).toBe('school-a-uuid');
      expect(result2.schools.map((s) => s.id)).not.toContain('school-b-uuid');
    });

    it('should exclude school from computeAccessibleSchoolIds when it becomes INACTIVE for SCHOOL_ADMIN', async () => {
      const user = createMockUser({
        role: UserRole.SCHOOL_ADMIN,
        schoolId: 'my-school-uuid',
      });

      // First call: school is ACTIVE
      const activeSchool = createMockSchool({
        id: 'my-school-uuid',
        status: SchoolStatus.ACTIVE,
      });
      schoolRepository.findById.mockResolvedValueOnce(activeSchool);

      const result1 = await service.computeAccessibleSchoolIds(user);
      expect(result1).toEqual(['my-school-uuid']);

      // School becomes INACTIVE
      const inactiveSchool = createMockSchool({
        id: 'my-school-uuid',
        status: SchoolStatus.INACTIVE,
      });
      schoolRepository.findById.mockResolvedValueOnce(inactiveSchool);

      // Second call: school is no longer accessible
      const result2 = await service.computeAccessibleSchoolIds(user);
      expect(result2).toEqual([]);
    });

    it('should exclude INACTIVE school from TEACHER accessibleSchoolIds on next call', async () => {
      const schoolA = createMockSchool({ id: 'teacher-school-a' });
      const schoolB = createMockSchool({ id: 'teacher-school-b' });

      const user = createMockUser({
        role: UserRole.TEACHER,
        accessibleSchoolIds: ['teacher-school-a', 'teacher-school-b'],
      });

      // First call: both schools active
      const mockQB1 = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([schoolA, schoolB]),
      };
      schoolEntityRepository.createQueryBuilder.mockReturnValueOnce(mockQB1);

      const result1 = await service.computeAccessibleSchoolIds(user);
      expect(result1).toEqual(['teacher-school-a', 'teacher-school-b']);

      // SchoolB becomes INACTIVE — on next call, only schoolA returned
      const mockQB2 = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([schoolA]),
      };
      schoolEntityRepository.createQueryBuilder.mockReturnValueOnce(mockQB2);

      const result2 = await service.computeAccessibleSchoolIds(user);
      expect(result2).toEqual(['teacher-school-a']);
    });

    it('should exclude newly INACTIVE child school from COMPANY_ADMIN on next call', async () => {
      const companySchool = createMockSchool({
        id: 'company-uuid',
        status: SchoolStatus.ACTIVE,
      });
      const childA = createMockSchool({
        id: 'child-a-uuid',
        parentSchoolId: 'company-uuid',
        status: SchoolStatus.ACTIVE,
      });
      const childB = createMockSchool({
        id: 'child-b-uuid',
        parentSchoolId: 'company-uuid',
        status: SchoolStatus.ACTIVE,
      });

      const user = createMockUser({
        role: UserRole.COMPANY_ADMIN,
        companySchoolId: 'company-uuid',
      });

      // First call: company + 2 active children
      schoolRepository.findById.mockResolvedValueOnce(companySchool);
      schoolEntityRepository.find.mockResolvedValueOnce([childA, childB]);

      const result1 = await service.computeAccessibleSchoolIds(user);
      expect(result1).toHaveLength(3);
      expect(result1).toContain('child-b-uuid');

      // childB becomes INACTIVE — on next call, only company + childA
      schoolRepository.findById.mockResolvedValueOnce(companySchool);
      schoolEntityRepository.find.mockResolvedValueOnce([childA]); // DB only returns ACTIVE children

      const result2 = await service.computeAccessibleSchoolIds(user);
      expect(result2).toHaveLength(2);
      expect(result2).toContain('company-uuid');
      expect(result2).toContain('child-a-uuid');
      expect(result2).not.toContain('child-b-uuid');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test: Session invalidation when school becomes inactive
  // Requirements 3.8, 8.6
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Session invalidation when school becomes inactive (Req 3.8, 8.6)', () => {
    it('should return contextRequired=true when session references a now-INACTIVE school', async () => {
      const user = createMockUser({
        role: UserRole.TEACHER,
        schoolId: 'fallback-school-uuid',
        accessibleSchoolIds: ['session-school-uuid', 'fallback-school-uuid'],
      });

      // Session points to a school that is now INACTIVE
      contextSessionService.getActiveContext.mockResolvedValue(
        'session-school-uuid',
      );

      // findById returns the school as INACTIVE
      const inactiveSchool = createMockSchool({
        id: 'session-school-uuid',
        status: SchoolStatus.INACTIVE,
      });
      schoolRepository.findById.mockResolvedValue(inactiveSchool);

      // computeAccessibleSchoolIds — schoolA now INACTIVE, only fallback school returned
      const mockQB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          createMockSchool({ id: 'fallback-school-uuid' }),
        ]),
      };
      schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);

      const result = await service.getCurrentContext(user);

      // The INACTIVE school cannot be shown as active context
      expect(result.activeSchoolId).toBeNull();
      expect(result.contextRequired).toBe(true);
    });

    it('should not include INACTIVE session school in getAccessibleSchools response', async () => {
      const user = createMockUser({
        role: UserRole.SUPER_ADMIN,
        schoolId: null,
      });

      const schoolA = createMockSchool({
        id: 'school-a-uuid',
        name: 'School A',
      });
      // schoolB was in session but is now INACTIVE — the getAccessibleSchools
      // query filters status=ACTIVE, so it won't appear

      // computeSuperAdminAccess returns only active schools
      schoolEntityRepository.find
        .mockResolvedValueOnce([schoolA]) // computeSuperAdminAccess
        .mockResolvedValueOnce([schoolA]); // getAccessibleSchools main query

      const mockQB = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);

      const result = await service.getAccessibleSchools(user);

      // Only active schools returned
      expect(result.schools).toHaveLength(1);
      expect(result.schools[0].id).toBe('school-a-uuid');
    });

    it('should detect stale session via TenantMiddleware pattern: school not in computed accessible list', async () => {
      // This test simulates what happens in TenantMiddleware:
      // 1. User has session with schoolId = 'inactive-school-uuid'
      // 2. computeAccessibleSchoolIds() no longer includes that school (because it's INACTIVE)
      // 3. The session is effectively stale

      const user = createMockUser({
        role: UserRole.TEACHER,
        accessibleSchoolIds: ['inactive-school-uuid', 'active-school-uuid'],
      });

      // Simulate: only 'active-school-uuid' is returned (the other is now INACTIVE)
      const mockQB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          createMockSchool({ id: 'active-school-uuid' }),
        ]),
      };
      schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);

      const accessibleIds = await service.computeAccessibleSchoolIds(user);

      // The session schoolId 'inactive-school-uuid' is NOT in the accessible list
      const sessionSchoolId = 'inactive-school-uuid';
      expect(accessibleIds).not.toContain(sessionSchoolId);

      // TenantMiddleware would delete this session and fall back to JWT
      // (This validates the condition that triggers session invalidation per Req 3.8, 8.6)
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test: Session invalidation when user role changes
  // Requirements 4.7
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Session invalidation when user role changes (Req 4.7)', () => {
    it('should return different accessible schools when user role changes from TEACHER to SCHOOL_ADMIN', async () => {
      const schoolA = createMockSchool({ id: 'school-a-uuid' });
      const schoolB = createMockSchool({ id: 'school-b-uuid' });

      // User as TEACHER with multi-school access
      const teacherUser = createMockUser({
        role: UserRole.TEACHER,
        schoolId: 'school-a-uuid',
        accessibleSchoolIds: ['school-a-uuid', 'school-b-uuid'],
      });

      const mockQBTeacher = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([schoolA, schoolB]),
      };
      schoolEntityRepository.createQueryBuilder.mockReturnValueOnce(
        mockQBTeacher,
      );

      const teacherResult =
        await service.computeAccessibleSchoolIds(teacherUser);
      expect(teacherResult).toEqual(['school-a-uuid', 'school-b-uuid']);

      // User role changes to SCHOOL_ADMIN (single-school)
      const adminUser = createMockUser({
        role: UserRole.SCHOOL_ADMIN,
        schoolId: 'school-a-uuid',
        accessibleSchoolIds: [], // no longer relevant for SCHOOL_ADMIN
      });

      schoolRepository.findById.mockResolvedValueOnce(schoolA);

      const adminResult =
        await service.computeAccessibleSchoolIds(adminUser);
      // SCHOOL_ADMIN only gets their single JWT schoolId
      expect(adminResult).toEqual(['school-a-uuid']);
      expect(adminResult).not.toContain('school-b-uuid');
    });

    it('should return expanded accessible schools when user role changes from SCHOOL_ADMIN to SUPER_ADMIN', async () => {
      const allSchools = [
        createMockSchool({ id: 'school-1' }),
        createMockSchool({ id: 'school-2' }),
        createMockSchool({ id: 'school-3' }),
      ];

      // User as SCHOOL_ADMIN: single school only
      const adminUser = createMockUser({
        role: UserRole.SCHOOL_ADMIN,
        schoolId: 'school-1',
      });

      schoolRepository.findById.mockResolvedValueOnce(allSchools[0]);

      const adminResult =
        await service.computeAccessibleSchoolIds(adminUser);
      expect(adminResult).toEqual(['school-1']);

      // User promoted to SUPER_ADMIN: sees all schools
      const superAdminUser = createMockUser({
        role: UserRole.SUPER_ADMIN,
        schoolId: null,
      });

      schoolEntityRepository.find.mockResolvedValueOnce(allSchools);

      const superResult =
        await service.computeAccessibleSchoolIds(superAdminUser);
      expect(superResult).toHaveLength(3);
      expect(superResult).toContain('school-1');
      expect(superResult).toContain('school-2');
      expect(superResult).toContain('school-3');
    });

    it('should return fewer accessible schools when TEACHER loses a school assignment', async () => {
      const schoolA = createMockSchool({ id: 'school-a-uuid' });
      const schoolB = createMockSchool({ id: 'school-b-uuid' });

      // First: teacher has both schools via TeacherSchoolAssignment
      const user = createMockUser({
        role: UserRole.TEACHER,
        accessibleSchoolIds: [], // empty JWT claim, uses TeacherSchoolAssignment fallback
        schoolId: 'school-a-uuid',
      });

      teacherSchoolAssignmentService.getAccessibleSchoolIds.mockResolvedValueOnce([
        'school-a-uuid',
        'school-b-uuid',
      ]);

      const mockQB1 = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([schoolA, schoolB]),
      };
      schoolEntityRepository.createQueryBuilder.mockReturnValueOnce(mockQB1);

      const result1 = await service.computeAccessibleSchoolIds(user);
      expect(result1).toEqual(['school-a-uuid', 'school-b-uuid']);

      // Assignment to schoolB removed — only schoolA returned on next call
      teacherSchoolAssignmentService.getAccessibleSchoolIds.mockResolvedValueOnce([
        'school-a-uuid',
      ]);

      const mockQB2 = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([schoolA]),
      };
      schoolEntityRepository.createQueryBuilder.mockReturnValueOnce(mockQB2);

      const result2 = await service.computeAccessibleSchoolIds(user);
      expect(result2).toEqual(['school-a-uuid']);
      expect(result2).not.toContain('school-b-uuid');
    });

    it('should invalidate session school when user loses access due to role change', async () => {
      // Scenario: User was TEACHER with access to schools A & B.
      // Session stores schoolB. User role changes to SCHOOL_ADMIN (single school A only).
      // On next call, computeAccessibleSchoolIds returns only [schoolA].
      // The session schoolB is no longer accessible → middleware would invalidate.

      const schoolA = createMockSchool({ id: 'school-a-uuid' });

      // User as SCHOOL_ADMIN (after role change)
      const user = createMockUser({
        role: UserRole.SCHOOL_ADMIN,
        schoolId: 'school-a-uuid',
      });

      schoolRepository.findById.mockResolvedValue(schoolA);

      const accessibleIds = await service.computeAccessibleSchoolIds(user);

      // Session schoolId = 'school-b-uuid' is NOT in the new accessible list
      const sessionSchoolId = 'school-b-uuid';
      expect(accessibleIds).not.toContain(sessionSchoolId);
      expect(accessibleIds).toEqual(['school-a-uuid']);

      // This condition triggers session invalidation in TenantMiddleware (Req 3.8)
      // The middleware deletes the stale session and falls back to JWT schoolId
    });

    it('should return updated COMPANY_ADMIN schools when companySchoolId changes', async () => {
      // COMPANY_ADMIN assigned to company A
      const companyA = createMockSchool({
        id: 'company-a-uuid',
        status: SchoolStatus.ACTIVE,
      });
      const childA1 = createMockSchool({
        id: 'child-a1-uuid',
        parentSchoolId: 'company-a-uuid',
      });

      const userCompanyA = createMockUser({
        role: UserRole.COMPANY_ADMIN,
        companySchoolId: 'company-a-uuid',
      });

      schoolRepository.findById.mockResolvedValueOnce(companyA);
      schoolEntityRepository.find.mockResolvedValueOnce([childA1]);

      const result1 = await service.computeAccessibleSchoolIds(userCompanyA);
      expect(result1).toContain('company-a-uuid');
      expect(result1).toContain('child-a1-uuid');

      // COMPANY_ADMIN reassigned to company B
      const companyB = createMockSchool({
        id: 'company-b-uuid',
        status: SchoolStatus.ACTIVE,
      });
      const childB1 = createMockSchool({
        id: 'child-b1-uuid',
        parentSchoolId: 'company-b-uuid',
      });

      const userCompanyB = createMockUser({
        role: UserRole.COMPANY_ADMIN,
        companySchoolId: 'company-b-uuid',
      });

      schoolRepository.findById.mockResolvedValueOnce(companyB);
      schoolEntityRepository.find.mockResolvedValueOnce([childB1]);

      const result2 = await service.computeAccessibleSchoolIds(userCompanyB);
      expect(result2).not.toContain('company-a-uuid');
      expect(result2).not.toContain('child-a1-uuid');
      expect(result2).toContain('company-b-uuid');
      expect(result2).toContain('child-b1-uuid');
    });
  });
});
