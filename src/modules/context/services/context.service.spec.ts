import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Mock uuid module to avoid ESM issues with Jest
jest.mock('uuid', () => ({
  validate: (str: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  },
}));

import { ContextService, ContextJwtUser } from './context.service';
import { ContextSessionService } from './context-session.service';
import { SchoolRepository } from '../../school/school.repository';
import { TeacherSchoolAssignmentService } from '../../teacher-school-assignment/teacher-school-assignment.service';
import { AuditLogService } from '../../audit/services/audit-log.service';
import { HierarchyService } from '../../school/services/hierarchy.service';
import { SchoolEntity } from '../../school/entities/school.entity';
import { UserRole } from '../../../common/enums/role.enum';
import { SchoolStatus } from '../../../common/enums/status.enum';
import { ContextForbiddenException, SchoolInactiveException } from '../exceptions/context.exceptions';

// ─── Test Factories ────────────────────────────────────────────────────────────

const createMockSchool = (overrides: Partial<SchoolEntity> = {}): SchoolEntity => ({
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
} as SchoolEntity);

const createMockUser = (overrides: Partial<ContextJwtUser> = {}): ContextJwtUser => ({
  id: 'user-uuid-0001-0000-000000000001',
  email: 'test@nbk.edu.vn',
  role: UserRole.SCHOOL_ADMIN,
  schoolId: 'school-uuid-0001-0000-000000000001',
  accessibleSchoolIds: [],
  companySchoolId: null,
  ...overrides,
});

// ─── Test Setup ────────────────────────────────────────────────────────────────

describe('ContextService', () => {
  let service: ContextService;
  let schoolRepository: jest.Mocked<SchoolRepository>;
  let schoolEntityRepository: {
    find: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let teacherSchoolAssignmentService: jest.Mocked<TeacherSchoolAssignmentService>;
  let contextSessionService: jest.Mocked<ContextSessionService>;
  let auditLogService: jest.Mocked<AuditLogService>;
  let hierarchyService: { getDescendants: jest.Mock; getAncestors: jest.Mock; resolveHierarchy: jest.Mock };

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

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const mockHierarchyService = {
      getDescendants: jest.fn().mockResolvedValue([]),
      getAncestors: jest.fn().mockResolvedValue([]),
      resolveHierarchy: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextService,
        { provide: SchoolRepository, useValue: mockSchoolRepository },
        { provide: getRepositoryToken(SchoolEntity), useValue: mockSchoolEntityRepository },
        { provide: TeacherSchoolAssignmentService, useValue: mockTeacherSchoolAssignmentService },
        { provide: ContextSessionService, useValue: mockContextSessionService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: HierarchyService, useValue: mockHierarchyService },
      ],
    }).compile();

    service = module.get<ContextService>(ContextService);
    schoolRepository = module.get(SchoolRepository) as jest.Mocked<SchoolRepository>;
    schoolEntityRepository = module.get(getRepositoryToken(SchoolEntity));
    teacherSchoolAssignmentService = module.get(TeacherSchoolAssignmentService) as jest.Mocked<TeacherSchoolAssignmentService>;
    contextSessionService = module.get(ContextSessionService) as jest.Mocked<ContextSessionService>;
    auditLogService = module.get(AuditLogService) as jest.Mocked<AuditLogService>;
    hierarchyService = module.get(HierarchyService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── computeAccessibleSchoolIds ──────────────────────────────────────────────

  describe('computeAccessibleSchoolIds', () => {
    describe('SCHOOL_ADMIN role (single-school)', () => {
      it('should return single school when school is ACTIVE', async () => {
        const school = createMockSchool({ status: SchoolStatus.ACTIVE });
        const user = createMockUser({ role: UserRole.SCHOOL_ADMIN, schoolId: school.id });
        schoolRepository.findById.mockResolvedValue(school);

        const result = await service.computeAccessibleSchoolIds(user);

        expect(result).toEqual([school.id]);
        expect(schoolRepository.findById).toHaveBeenCalledWith(school.id);
      });

      it('should return empty array when school is INACTIVE', async () => {
        const school = createMockSchool({ status: SchoolStatus.INACTIVE });
        const user = createMockUser({ role: UserRole.SCHOOL_ADMIN, schoolId: school.id });
        schoolRepository.findById.mockResolvedValue(school);

        const result = await service.computeAccessibleSchoolIds(user);

        expect(result).toEqual([]);
      });

      it('should return empty array when schoolId is null', async () => {
        const user = createMockUser({ role: UserRole.SCHOOL_ADMIN, schoolId: null });

        const result = await service.computeAccessibleSchoolIds(user);

        expect(result).toEqual([]);
      });
    });

    describe('HR role (single-school)', () => {
      it('should return single school when school is ACTIVE', async () => {
        const school = createMockSchool({ id: 'hr-school-uuid' });
        const user = createMockUser({ role: UserRole.HR, schoolId: school.id });
        schoolRepository.findById.mockResolvedValue(school);

        const result = await service.computeAccessibleSchoolIds(user);

        expect(result).toEqual([school.id]);
      });
    });

    describe('SCHEDULER role (single-school)', () => {
      it('should return single school when school is ACTIVE', async () => {
        const school = createMockSchool({ id: 'scheduler-school-uuid' });
        const user = createMockUser({ role: UserRole.SCHEDULER, schoolId: school.id });
        schoolRepository.findById.mockResolvedValue(school);

        const result = await service.computeAccessibleSchoolIds(user);

        expect(result).toEqual([school.id]);
      });
    });

    describe('VIEWER role (single-school)', () => {
      it('should return single school when school is ACTIVE', async () => {
        const school = createMockSchool({ id: 'viewer-school-uuid' });
        const user = createMockUser({ role: UserRole.VIEWER, schoolId: school.id });
        schoolRepository.findById.mockResolvedValue(school);

        const result = await service.computeAccessibleSchoolIds(user);

        expect(result).toEqual([school.id]);
      });

      it('should return empty when school not found in DB', async () => {
        const user = createMockUser({ role: UserRole.VIEWER, schoolId: 'non-existent-uuid' });
        schoolRepository.findById.mockResolvedValue(null);

        const result = await service.computeAccessibleSchoolIds(user);

        expect(result).toEqual([]);
      });
    });

    describe('TEACHER role', () => {
      it('should return schools from accessibleSchoolIds JWT claim if ACTIVE', async () => {
        const schoolA = createMockSchool({ id: 'school-a-uuid' });
        const schoolB = createMockSchool({ id: 'school-b-uuid' });
        const user = createMockUser({
          role: UserRole.TEACHER,
          accessibleSchoolIds: [schoolA.id, schoolB.id],
        });

        // filterActiveSchoolIds uses createQueryBuilder
        const mockQB = {
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([schoolA, schoolB]),
        };
        schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);

        const result = await service.computeAccessibleSchoolIds(user);

        expect(result).toEqual([schoolA.id, schoolB.id]);
      });

      it('should exclude INACTIVE schools from accessibleSchoolIds', async () => {
        const schoolA = createMockSchool({ id: 'school-a-uuid' });
        const user = createMockUser({
          role: UserRole.TEACHER,
          accessibleSchoolIds: ['school-a-uuid', 'school-inactive-uuid'],
        });

        const mockQB = {
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([schoolA]), // only schoolA is active
        };
        schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);

        const result = await service.computeAccessibleSchoolIds(user);

        expect(result).toEqual([schoolA.id]);
      });

      it('should fallback to TeacherSchoolAssignment when accessibleSchoolIds is empty', async () => {
        const schoolA = createMockSchool({ id: 'assignment-school-uuid' });
        const user = createMockUser({
          role: UserRole.TEACHER,
          accessibleSchoolIds: [],
          schoolId: 'primary-school-uuid',
        });

        teacherSchoolAssignmentService.getAccessibleSchoolIds.mockResolvedValue([schoolA.id]);

        const mockQB = {
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([schoolA]),
        };
        schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);

        const result = await service.computeAccessibleSchoolIds(user);

        expect(result).toEqual([schoolA.id]);
        expect(teacherSchoolAssignmentService.getAccessibleSchoolIds).toHaveBeenCalledWith(user.id);
      });

      it('should fallback to JWT schoolId when no assignments exist', async () => {
        const primarySchool = createMockSchool({ id: 'primary-school-uuid' });
        const user = createMockUser({
          role: UserRole.TEACHER,
          accessibleSchoolIds: [],
          schoolId: primarySchool.id,
        });

        teacherSchoolAssignmentService.getAccessibleSchoolIds.mockResolvedValue([]);

        const mockQB = {
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([primarySchool]),
        };
        schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);

        const result = await service.computeAccessibleSchoolIds(user);

        expect(result).toEqual([primarySchool.id]);
      });

      it('should return empty when no assignments and schoolId is null', async () => {
        const user = createMockUser({
          role: UserRole.TEACHER,
          accessibleSchoolIds: [],
          schoolId: null,
        });

        teacherSchoolAssignmentService.getAccessibleSchoolIds.mockResolvedValue([]);

        const result = await service.computeAccessibleSchoolIds(user);

        expect(result).toEqual([]);
      });
    });

    describe('COMPANY_ADMIN role', () => {
      it('should return company node + active children', async () => {
        const companySchool = createMockSchool({
          id: 'company-uuid',
          parentSchoolId: null,
          status: SchoolStatus.ACTIVE,
        });
        const childA = createMockSchool({ id: 'child-a-uuid', parentSchoolId: 'company-uuid' });
        const childB = createMockSchool({ id: 'child-b-uuid', parentSchoolId: 'company-uuid' });

        const user = createMockUser({
          role: UserRole.COMPANY_ADMIN,
          companySchoolId: companySchool.id,
        });

        schoolRepository.findById.mockResolvedValue(companySchool);
        hierarchyService.getDescendants.mockResolvedValue([childA, childB]);

        const result = await service.computeAccessibleSchoolIds(user);

        expect(result).toContain(companySchool.id);
        expect(result).toContain(childA.id);
        expect(result).toContain(childB.id);
        expect(result).toHaveLength(3);
      });

      it('should return empty array when companySchoolId is null', async () => {
        const user = createMockUser({
          role: UserRole.COMPANY_ADMIN,
          companySchoolId: null,
        });

        const result = await service.computeAccessibleSchoolIds(user);

        expect(result).toEqual([]);
        expect(Logger.prototype.warn).toHaveBeenCalledWith(
          expect.stringContaining('null/missing companySchoolId'),
        );
      });

      it('should return empty array when companySchoolId references non-existent school', async () => {
        const user = createMockUser({
          role: UserRole.COMPANY_ADMIN,
          companySchoolId: 'non-existent-company-uuid',
        });

        schoolRepository.findById.mockResolvedValue(null);

        const result = await service.computeAccessibleSchoolIds(user);

        expect(result).toEqual([]);
        expect(Logger.prototype.warn).toHaveBeenCalledWith(
          expect.stringContaining('invalid companySchoolId'),
        );
      });

      it('should exclude INACTIVE company node but include active children', async () => {
        const companySchool = createMockSchool({
          id: 'company-inactive-uuid',
          status: SchoolStatus.INACTIVE,
        });
        const childA = createMockSchool({ id: 'child-a-uuid', parentSchoolId: companySchool.id });

        const user = createMockUser({
          role: UserRole.COMPANY_ADMIN,
          companySchoolId: companySchool.id,
        });

        schoolRepository.findById.mockResolvedValue(companySchool);
        hierarchyService.getDescendants.mockResolvedValue([childA]);

        const result = await service.computeAccessibleSchoolIds(user);

        expect(result).not.toContain(companySchool.id);
        expect(result).toContain(childA.id);
      });
    });

    describe('SUPER_ADMIN role', () => {
      it('should return all active schools', async () => {
        const schools = Array.from({ length: 5 }, (_, i) =>
          createMockSchool({ id: `super-school-${i}`, name: `School ${i}` }),
        );
        const user = createMockUser({ role: UserRole.SUPER_ADMIN });

        schoolEntityRepository.find.mockResolvedValue(schools);

        const result = await service.computeAccessibleSchoolIds(user);

        expect(result).toHaveLength(5);
        expect(result).toEqual(schools.map((s) => s.id));
      });

      it('should only return active schools (not inactive)', async () => {
        const activeSchools = [createMockSchool({ id: 'active-1' })];
        const user = createMockUser({ role: UserRole.SUPER_ADMIN });

        schoolEntityRepository.find.mockResolvedValue(activeSchools);

        const result = await service.computeAccessibleSchoolIds(user);

        expect(result).toEqual(['active-1']);
        // The query itself filters by status = ACTIVE
        expect(schoolEntityRepository.find).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ status: SchoolStatus.ACTIVE }),
          }),
        );
      });
    });

    describe('50-school cap enforcement', () => {
      it('should cap TEACHER accessible schools at 50', async () => {
        const schoolIds = Array.from({ length: 60 }, (_, i) => `school-${i}`);
        const schools = schoolIds.map((id) => createMockSchool({ id }));
        const user = createMockUser({
          role: UserRole.TEACHER,
          accessibleSchoolIds: schoolIds,
        });

        const mockQB = {
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue(schools),
        };
        schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);

        const result = await service.computeAccessibleSchoolIds(user);

        expect(result.length).toBeLessThanOrEqual(50);
      });

      it('should cap COMPANY_ADMIN accessible schools at 50', async () => {
        const companySchool = createMockSchool({ id: 'company-cap-uuid', status: SchoolStatus.ACTIVE });
        const children = Array.from({ length: 55 }, (_, i) =>
          createMockSchool({ id: `child-cap-${i}`, parentSchoolId: companySchool.id }),
        );
        const user = createMockUser({
          role: UserRole.COMPANY_ADMIN,
          companySchoolId: companySchool.id,
        });

        schoolRepository.findById.mockResolvedValue(companySchool);
        hierarchyService.getDescendants.mockResolvedValue(children);

        const result = await service.computeAccessibleSchoolIds(user);

        expect(result.length).toBeLessThanOrEqual(50);
      });

      it('should cap SUPER_ADMIN accessible schools at 50', async () => {
        const user = createMockUser({ role: UserRole.SUPER_ADMIN });

        schoolEntityRepository.find.mockResolvedValue(
          Array.from({ length: 50 }, (_, i) => createMockSchool({ id: `admin-school-${i}` })),
        );

        const result = await service.computeAccessibleSchoolIds(user);

        expect(result.length).toBeLessThanOrEqual(50);
        // SUPER_ADMIN uses `take: 50` in the query
        expect(schoolEntityRepository.find).toHaveBeenCalledWith(
          expect.objectContaining({ take: 50 }),
        );
      });
    });

    describe('unknown role', () => {
      it('should return empty array and log warning', async () => {
        const user = createMockUser({ role: 'unknown_role' as UserRole });

        const result = await service.computeAccessibleSchoolIds(user);

        expect(result).toEqual([]);
        expect(Logger.prototype.warn).toHaveBeenCalledWith(
          expect.stringContaining('Unknown role'),
        );
      });
    });
  });

  // ─── getAccessibleSchools ─────────────────────────────────────────────────────

  describe('getAccessibleSchools', () => {
    it('should return schools sorted alphabetically by name', async () => {
      const schoolC = createMockSchool({ id: 'c-uuid', name: 'Trường C' });
      const schoolA = createMockSchool({ id: 'a-uuid', name: 'Trường A' });
      const schoolB = createMockSchool({ id: 'b-uuid', name: 'Trường B' });
      const user = createMockUser({ role: UserRole.SUPER_ADMIN });

      // computeAccessibleSchoolIds returns IDs
      schoolEntityRepository.find
        .mockResolvedValueOnce([schoolC, schoolA, schoolB]) // computeSuperAdminAccess
        .mockResolvedValueOnce([schoolC, schoolA, schoolB]); // getAccessibleSchools query

      // findSchoolIdsWithChildren query builder
      const mockQB = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);

      const result = await service.getAccessibleSchools(user);

      expect(result.schools[0].name).toBe('Trường A');
      expect(result.schools[1].name).toBe('Trường B');
      expect(result.schools[2].name).toBe('Trường C');
    });

    it('should return canSwitch true when 2+ schools accessible', async () => {
      const schools = [
        createMockSchool({ id: 'school-1', name: 'School 1' }),
        createMockSchool({ id: 'school-2', name: 'School 2' }),
      ];
      const user = createMockUser({ role: UserRole.SUPER_ADMIN });

      schoolEntityRepository.find
        .mockResolvedValueOnce(schools)
        .mockResolvedValueOnce(schools);

      const mockQB = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);

      const result = await service.getAccessibleSchools(user);

      expect(result.canSwitch).toBe(true);
    });

    it('should return canSwitch false when only 1 school accessible', async () => {
      const school = createMockSchool({ id: 'single-school-uuid' });
      const user = createMockUser({ role: UserRole.SCHOOL_ADMIN, schoolId: school.id });

      schoolRepository.findById.mockResolvedValue(school);
      schoolEntityRepository.find.mockResolvedValue([school]);

      const mockQB = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);

      const result = await service.getAccessibleSchools(user);

      expect(result.canSwitch).toBe(false);
      expect(result.schools).toHaveLength(1);
    });

    it('should return empty array and canSwitch false when no accessible schools', async () => {
      const user = createMockUser({ role: UserRole.SCHOOL_ADMIN, schoolId: null });

      const result = await service.getAccessibleSchools(user);

      expect(result.schools).toEqual([]);
      expect(result.canSwitch).toBe(false);
    });

    it('should derive hierarchyLevel correctly for each school', async () => {
      const holdingSchool = createMockSchool({ id: 'holding-uuid', name: 'Holding', parentSchoolId: null });
      const companySchool = createMockSchool({ id: 'company-uuid', name: 'Company', parentSchoolId: 'holding-uuid' });
      const leafSchool = createMockSchool({ id: 'leaf-uuid', name: 'Leaf', parentSchoolId: 'company-uuid' });
      const user = createMockUser({ role: UserRole.SUPER_ADMIN });

      schoolEntityRepository.find
        .mockResolvedValueOnce([holdingSchool, companySchool, leafSchool])
        .mockResolvedValueOnce([holdingSchool, companySchool, leafSchool]);

      // holdingSchool and companySchool have children
      const mockQB = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { parentSchoolId: 'holding-uuid' },
          { parentSchoolId: 'company-uuid' },
        ]),
      };
      schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);

      const result = await service.getAccessibleSchools(user);

      const holding = result.schools.find((s) => s.id === 'holding-uuid');
      const company = result.schools.find((s) => s.id === 'company-uuid');
      const leaf = result.schools.find((s) => s.id === 'leaf-uuid');

      expect(holding?.hierarchyLevel).toBe('holding');
      expect(company?.hierarchyLevel).toBe('company');
      expect(leaf?.hierarchyLevel).toBe('school');
    });
  });

  // ─── switchContext ───────────────────────────────────────────────────────────

  describe('switchContext', () => {
    const validSchoolId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const ip = '192.168.1.1';

    describe('happy path', () => {
      it('should switch context and return new school details', async () => {
        const school = createMockSchool({ id: validSchoolId, code: 'TH01', name: 'Trường TH1' });
        const user = createMockUser({ role: UserRole.TEACHER, accessibleSchoolIds: [validSchoolId] });

        // computeAccessibleSchoolIds — teacher path
        const mockQB = {
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([school]),
        };
        schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);
        schoolRepository.findById.mockResolvedValue(school);

        const result = await service.switchContext(user, validSchoolId, ip);

        expect(result).toEqual({ id: school.id, code: 'TH01', name: 'Trường TH1' });
        expect(contextSessionService.setActiveContext).toHaveBeenCalledWith(user.id, validSchoolId);
        expect(auditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'CONTEXT_SWITCH',
            entityType: 'context_session',
            userId: user.id,
            schoolId: validSchoolId,
            ipAddress: ip,
          }),
        );
      });
    });

    describe('validation errors', () => {
      it('should throw BadRequestException for invalid UUID format', async () => {
        const user = createMockUser();

        await expect(
          service.switchContext(user, 'not-a-valid-uuid', ip),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for empty string', async () => {
        const user = createMockUser();

        await expect(
          service.switchContext(user, '', ip),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw ContextForbiddenException when school not in accessible list', async () => {
        const user = createMockUser({
          role: UserRole.SCHOOL_ADMIN,
          schoolId: 'my-school-uuid',
        });
        const mySchool = createMockSchool({ id: 'my-school-uuid' });
        schoolRepository.findById.mockResolvedValue(mySchool);

        await expect(
          service.switchContext(user, validSchoolId, ip),
        ).rejects.toThrow(ContextForbiddenException);
      });

      it('should throw NotFoundException when school not found in DB (safety check)', async () => {
        const user = createMockUser({
          role: UserRole.TEACHER,
          accessibleSchoolIds: [validSchoolId],
        });

        // filterActiveSchoolIds returns the ID (so it's accessible)
        const mockQB = {
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([createMockSchool({ id: validSchoolId })]),
        };
        schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);

        // But findById returns null (edge case — deleted between check)
        schoolRepository.findById.mockResolvedValue(null);

        await expect(
          service.switchContext(user, validSchoolId, ip),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw SchoolInactiveException when school is INACTIVE', async () => {
        const inactiveSchool = createMockSchool({ id: validSchoolId, status: SchoolStatus.INACTIVE });
        const user = createMockUser({
          role: UserRole.TEACHER,
          accessibleSchoolIds: [validSchoolId],
        });

        // filterActiveSchoolIds — returns the school (mocked for accessible list check)
        const mockQB = {
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([createMockSchool({ id: validSchoolId })]),
        };
        schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);

        // findById returns inactive school
        schoolRepository.findById.mockResolvedValue(inactiveSchool);

        await expect(
          service.switchContext(user, validSchoolId, ip),
        ).rejects.toThrow(SchoolInactiveException);
      });
    });

    describe('security', () => {
      it('should log security warning on unauthorized switch attempt', async () => {
        const user = createMockUser({
          role: UserRole.SCHOOL_ADMIN,
          schoolId: 'my-school-uuid',
        });
        const mySchool = createMockSchool({ id: 'my-school-uuid' });
        schoolRepository.findById.mockResolvedValue(mySchool);

        try {
          await service.switchContext(user, validSchoolId, ip);
        } catch {
          // Expected to throw
        }

        expect(Logger.prototype.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Unauthorized context switch attempt',
            userId: user.id,
            targetSchoolId: validSchoolId,
            ipAddress: ip,
          }),
        );
      });

      it('should not reveal school existence when user has no access (returns 403, not 404)', async () => {
        const user = createMockUser({
          role: UserRole.SCHOOL_ADMIN,
          schoolId: 'my-school-uuid',
        });
        const mySchool = createMockSchool({ id: 'my-school-uuid' });
        schoolRepository.findById.mockResolvedValue(mySchool);

        // Target school does exist in DB but user can't access it
        // The service should throw 403 (ContextForbidden), NOT 404
        await expect(
          service.switchContext(user, validSchoolId, ip),
        ).rejects.toThrow(ContextForbiddenException);
      });
    });

    describe('audit logging', () => {
      it('should write audit entry with all required fields on successful switch', async () => {
        const school = createMockSchool({ id: validSchoolId });
        const user = createMockUser({
          role: UserRole.TEACHER,
          accessibleSchoolIds: [validSchoolId],
        });

        const previousSchoolId = 'previous-school-uuid';
        contextSessionService.getActiveContext.mockResolvedValue(previousSchoolId);

        const mockQB = {
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([school]),
        };
        schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);
        schoolRepository.findById.mockResolvedValue(school);

        await service.switchContext(user, validSchoolId, ip);

        expect(auditLogService.log).toHaveBeenCalledWith({
          userId: user.id,
          schoolId: validSchoolId,
          action: 'CONTEXT_SWITCH',
          entityType: 'context_session',
          entityId: user.id,
          changes: {
            previousSchoolId: { old: previousSchoolId, new: validSchoolId },
            newSchoolId: { old: previousSchoolId, new: validSchoolId },
          },
          ipAddress: ip,
          metadata: { correlationId: expect.any(String) },
        });
      });

      it('should record null previousSchoolId when no prior context exists', async () => {
        const school = createMockSchool({ id: validSchoolId });
        const user = createMockUser({
          role: UserRole.TEACHER,
          accessibleSchoolIds: [validSchoolId],
        });

        // No previous context in Redis
        contextSessionService.getActiveContext.mockResolvedValue(null);

        const mockQB = {
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([school]),
        };
        schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);
        schoolRepository.findById.mockResolvedValue(school);

        await service.switchContext(user, validSchoolId, ip);

        expect(auditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'CONTEXT_SWITCH',
            entityType: 'context_session',
            entityId: user.id,
            changes: {
              previousSchoolId: { old: null, new: validSchoolId },
              newSchoolId: { old: null, new: validSchoolId },
            },
            ipAddress: ip,
          }),
        );
      });

      it('should include specific correlationId in audit metadata when provided', async () => {
        const school = createMockSchool({ id: validSchoolId });
        const user = createMockUser({
          role: UserRole.TEACHER,
          accessibleSchoolIds: [validSchoolId],
        });
        const specificCorrelationId = 'specific-corr-id-for-audit-test';

        contextSessionService.getActiveContext.mockResolvedValue(null);

        const mockQB = {
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([school]),
        };
        schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);
        schoolRepository.findById.mockResolvedValue(school);

        await service.switchContext(user, validSchoolId, ip, specificCorrelationId);

        expect(auditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'CONTEXT_SWITCH',
            metadata: { correlationId: specificCorrelationId },
          }),
        );
      });

      it('should generate correlationId for audit metadata when not provided', async () => {
        const school = createMockSchool({ id: validSchoolId });
        const user = createMockUser({
          role: UserRole.TEACHER,
          accessibleSchoolIds: [validSchoolId],
        });

        contextSessionService.getActiveContext.mockResolvedValue(null);

        const mockQB = {
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([school]),
        };
        schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);
        schoolRepository.findById.mockResolvedValue(school);

        await service.switchContext(user, validSchoolId, ip);

        expect(auditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: {
              correlationId: expect.stringMatching(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
              ),
            },
          }),
        );
      });

      it('should use same correlationId in both audit entry and emitted event', async () => {
        const school = createMockSchool({ id: validSchoolId });
        const user = createMockUser({
          role: UserRole.TEACHER,
          accessibleSchoolIds: [validSchoolId],
        });
        const sharedCorrelationId = 'shared-corr-id-audit-and-event';

        contextSessionService.getActiveContext.mockResolvedValue(null);

        const mockQB = {
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([school]),
        };
        schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);
        schoolRepository.findById.mockResolvedValue(school);

        const eventEmitter = (service as unknown as { eventEmitter: { emit: jest.Mock } }).eventEmitter;

        await service.switchContext(user, validSchoolId, ip, sharedCorrelationId);

        // Verify audit entry has the correlationId
        expect(auditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: { correlationId: sharedCorrelationId },
          }),
        );

        // Verify event also has same correlationId
        expect(eventEmitter.emit).toHaveBeenCalledWith(
          'workspace.changed',
          expect.objectContaining({
            correlationId: sharedCorrelationId,
          }),
        );
      });

      it('should not call audit log when switch fails due to forbidden access', async () => {
        const user = createMockUser({
          role: UserRole.SCHOOL_ADMIN,
          schoolId: 'my-school-uuid',
        });
        const mySchool = createMockSchool({ id: 'my-school-uuid' });
        schoolRepository.findById.mockResolvedValue(mySchool);

        try {
          await service.switchContext(user, validSchoolId, ip);
        } catch {
          // Expected to throw ContextForbiddenException
        }

        expect(auditLogService.log).not.toHaveBeenCalled();
      });
    });
  });

  // ─── getCurrentContext ───────────────────────────────────────────────────────

  describe('getCurrentContext', () => {
    it('should return active context from session when session exists', async () => {
      const school = createMockSchool({ id: 'session-school-uuid', code: 'TH02', name: 'Trường TH2' });
      const user = createMockUser({
        role: UserRole.TEACHER,
        schoolId: 'jwt-school-uuid',
        accessibleSchoolIds: ['session-school-uuid', 'another-school-uuid'],
      });

      contextSessionService.getActiveContext.mockResolvedValue('session-school-uuid');
      schoolRepository.findById.mockResolvedValue(school);

      // computeAccessibleSchoolIds for canSwitch
      const mockQB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          createMockSchool({ id: 'session-school-uuid' }),
          createMockSchool({ id: 'another-school-uuid' }),
        ]),
      };
      schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);

      const result = await service.getCurrentContext(user);

      expect(result.activeSchoolId).toBe('session-school-uuid');
      expect(result.activeSchoolName).toBe('Trường TH2');
      expect(result.activeSchoolCode).toBe('TH02');
      expect(result.globalView).toBe(false);
      expect(result.role).toBe(UserRole.TEACHER);
      expect(result.canSwitch).toBe(true);
      expect(result.contextRequired).toBe(false);
    });

    it('should fallback to JWT schoolId when no session exists', async () => {
      const school = createMockSchool({ id: 'jwt-school-uuid', code: 'TH03', name: 'Trường TH3' });
      const user = createMockUser({
        role: UserRole.SCHOOL_ADMIN,
        schoolId: 'jwt-school-uuid',
      });

      contextSessionService.getActiveContext.mockResolvedValue(null);
      schoolRepository.findById.mockResolvedValue(school);

      const result = await service.getCurrentContext(user);

      expect(result.activeSchoolId).toBe('jwt-school-uuid');
      expect(result.activeSchoolName).toBe('Trường TH3');
      expect(result.contextRequired).toBe(false);
    });

    it('should return contextRequired=true when no context available', async () => {
      const user = createMockUser({
        role: UserRole.SUPER_ADMIN,
        schoolId: null,
      });

      contextSessionService.getActiveContext.mockResolvedValue(null);
      schoolEntityRepository.find.mockResolvedValue([
        createMockSchool({ id: 's1' }),
        createMockSchool({ id: 's2' }),
      ]);

      const result = await service.getCurrentContext(user);

      expect(result.activeSchoolId).toBeNull();
      expect(result.activeSchoolName).toBeNull();
      expect(result.activeSchoolCode).toBeNull();
      expect(result.contextRequired).toBe(true);
    });

    it('should return contextRequired=true when resolved school is INACTIVE', async () => {
      const inactiveSchool = createMockSchool({ id: 'inactive-uuid', status: SchoolStatus.INACTIVE });
      const user = createMockUser({
        role: UserRole.SCHOOL_ADMIN,
        schoolId: 'inactive-uuid',
      });

      contextSessionService.getActiveContext.mockResolvedValue(null);
      schoolRepository.findById.mockResolvedValue(inactiveSchool);

      const result = await service.getCurrentContext(user);

      expect(result.activeSchoolId).toBeNull();
      expect(result.contextRequired).toBe(true);
    });

    it('should set canSwitch=false for single-school user', async () => {
      const school = createMockSchool({ id: 'single-uuid' });
      const user = createMockUser({
        role: UserRole.SCHOOL_ADMIN,
        schoolId: 'single-uuid',
      });

      contextSessionService.getActiveContext.mockResolvedValue(null);
      schoolRepository.findById.mockResolvedValue(school);

      const result = await service.getCurrentContext(user);

      expect(result.canSwitch).toBe(false);
    });

    it('should set canSwitch=true for multi-school user', async () => {
      const school = createMockSchool({ id: 'school-1' });
      const user = createMockUser({
        role: UserRole.TEACHER,
        schoolId: 'school-1',
        accessibleSchoolIds: ['school-1', 'school-2'],
      });

      contextSessionService.getActiveContext.mockResolvedValue(null);
      schoolRepository.findById.mockResolvedValue(school);

      const mockQB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          createMockSchool({ id: 'school-1' }),
          createMockSchool({ id: 'school-2' }),
        ]),
      };
      schoolEntityRepository.createQueryBuilder.mockReturnValue(mockQB);

      const result = await service.getCurrentContext(user);

      expect(result.canSwitch).toBe(true);
    });

    it('should return globalView=false (Global View handled at middleware level)', async () => {
      const school = createMockSchool({ id: 'any-school' });
      const user = createMockUser({ role: UserRole.SUPER_ADMIN, schoolId: 'any-school' });

      contextSessionService.getActiveContext.mockResolvedValue(null);
      schoolRepository.findById.mockResolvedValue(school);
      schoolEntityRepository.find.mockResolvedValue([school]);

      const result = await service.getCurrentContext(user);

      expect(result.globalView).toBe(false);
    });
  });
});
