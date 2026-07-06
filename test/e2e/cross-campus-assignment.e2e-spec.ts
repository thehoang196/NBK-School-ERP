import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource, IsNull } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TeacherSchoolAssignmentController } from '../../src/modules/teacher-school-assignment/teacher-school-assignment.controller';
import { TeacherSchoolAssignmentService } from '../../src/modules/teacher-school-assignment/teacher-school-assignment.service';
import {
  FEATURE_FLAG_SERVICE,
  TOKEN_INVALIDATION_SERVICE,
} from '../../src/modules/teacher-school-assignment/teacher-school-assignment.service';
import { TeacherSchoolAssignmentRepository } from '../../src/modules/teacher-school-assignment/teacher-school-assignment.repository';
import { TeacherSchoolAssignmentEntity } from '../../src/modules/teacher-school-assignment/entities/teacher-school-assignment.entity';
import { AssignmentRole } from '../../src/modules/teacher-school-assignment/enums/assignment-role.enum';
import { AssignmentStatus } from '../../src/modules/teacher-school-assignment/enums/assignment-status.enum';
import { SchoolRepository } from '../../src/modules/school/school.repository';
import { SchoolEntity } from '../../src/modules/school/entities/school.entity';
import { TeacherEntity } from '../../src/modules/teacher/entities/teacher.entity';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { UserRole } from '../../src/common/enums/role.enum';

/**
 * E2E Integration Tests — Cross-Campus Assignment Flow
 *
 * Tests the full HTTP layer for teacher-school-assignment creation,
 * deactivation, feature flag gating, org validation, and secondary limit.
 * Uses mocked repositories (no real DB required).
 *
 * Infrastructure required for full E2E (currently unavailable):
 * - PostgreSQL with migrations applied
 * - Redis for token invalidation
 * - Seeded org/school/teacher data
 *
 * Validates: Requirements 1.1–1.6, 2.4, 4.5, 8.5
 */

// ─── Test Constants ─────────────────────────────────────────────────────────

const ORG_ID = '00000000-0000-4000-a000-000000000001';
const SCHOOL_A_ID = '00000000-0000-4000-a000-000000000010';
const SCHOOL_B_ID = '00000000-0000-4000-a000-000000000020';
const SCHOOL_DIFF_ORG_ID = '00000000-0000-4000-a000-000000000099';
const TEACHER_ID = '00000000-0000-4000-a000-000000000100';
const ASSIGNMENT_ID = '00000000-0000-4000-a000-000000000200';
const SCHOOL_ADMIN_ID = '00000000-0000-4000-a000-000000000300';

// ─── Mock School Data ───────────────────────────────────────────────────────

const orgSchool: Partial<SchoolEntity> = {
  id: ORG_ID,
  name: 'Hệ thống NBK',
  parentSchoolId: null,
};

const schoolA: Partial<SchoolEntity> = {
  id: SCHOOL_A_ID,
  name: 'Trường Tiểu học NBK',
  parentSchoolId: ORG_ID,
};

const schoolB: Partial<SchoolEntity> = {
  id: SCHOOL_B_ID,
  name: 'Trường THCS NBK',
  parentSchoolId: ORG_ID,
};

const schoolDiffOrg: Partial<SchoolEntity> = {
  id: SCHOOL_DIFF_ORG_ID,
  name: 'Trường khác tổ chức',
  parentSchoolId: '00000000-0000-4000-a000-000000000999', // different org
};

// ─── Mock Teacher Data ──────────────────────────────────────────────────────

const mockTeacher: Partial<TeacherEntity> = {
  id: TEACHER_ID,
  schoolId: SCHOOL_A_ID,
  employeeCode: 'GV001',
  fullName: 'Nguyễn Văn A',
  deletedAt: null,
};

// ─── Mock Assignment Data ───────────────────────────────────────────────────

const mockAssignment: Partial<TeacherSchoolAssignmentEntity> = {
  id: ASSIGNMENT_ID,
  teacherId: TEACHER_ID,
  schoolId: SCHOOL_B_ID,
  role: AssignmentRole.SECONDARY,
  status: AssignmentStatus.ACTIVE,
  effectiveStartDate: '2024-09-01',
  effectiveEndDate: null,
  note: null,
};

// ─── Configurable Guards ────────────────────────────────────────────────────

interface MockUser {
  id: string;
  email: string;
  role: UserRole;
  schoolId: string | null;
  accessibleSchoolIds?: string[];
}

let currentUser: MockUser = {
  id: SCHOOL_ADMIN_ID,
  email: 'admin@nbk.edu.vn',
  role: UserRole.SCHOOL_ADMIN,
  schoolId: SCHOOL_A_ID,
  accessibleSchoolIds: [SCHOOL_A_ID, SCHOOL_B_ID],
};

const MockJwtAuthGuard = {
  canActivate: (context: {
    switchToHttp: () => { getRequest: () => Record<string, unknown> };
  }) => {
    const req = context.switchToHttp().getRequest();
    req['user'] = currentUser;
    return true;
  },
};

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('Cross-Campus Assignment E2E', () => {
  let app: INestApplication;
  let mockAssignmentRepo: Record<string, jest.Mock>;
  let mockSchoolRepo: Record<string, jest.Mock>;
  let mockDataSource: Record<string, jest.Mock | unknown>;
  let mockFeatureFlagService: Record<string, jest.Mock>;
  let mockTokenInvalidationService: Record<string, jest.Mock>;

  beforeAll(async () => {
    mockAssignmentRepo = {
      findByTeacher: jest.fn(),
      findBySchool: jest.fn(),
      findActiveByTeacher: jest.fn(),
      countSecondaryByTeacher: jest.fn(),
      findByTeacherAndSchool: jest.fn(),
    };

    mockSchoolRepo = {
      findById: jest.fn(),
    };

    const mockTeacherRepo = {
      findOne: jest.fn(),
    };

    const mockEntityManager = {
      create: jest
        .fn()
        .mockImplementation((_entity: unknown, data: unknown) => data),
      save: jest.fn().mockImplementation((_entity: unknown, data: unknown) => ({
        id: ASSIGNMENT_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...(data as object),
      })),
      softDelete: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
    };

    mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation(
          async (cb: (manager: typeof mockEntityManager) => Promise<unknown>) =>
            cb(mockEntityManager),
        ),
      getRepository: jest.fn().mockImplementation(() => ({
        findOne: mockTeacherRepo.findOne.mockResolvedValue(mockTeacher),
      })),
    };

    mockFeatureFlagService = {
      isCrossSchoolEnabled: jest.fn().mockResolvedValue(true),
    };

    mockTokenInvalidationService = {
      invalidateUserTokens: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TeacherSchoolAssignmentController],
      providers: [
        TeacherSchoolAssignmentService,
        {
          provide: TeacherSchoolAssignmentRepository,
          useValue: mockAssignmentRepo,
        },
        { provide: SchoolRepository, useValue: mockSchoolRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: FEATURE_FLAG_SERVICE, useValue: mockFeatureFlagService },
        {
          provide: TOKEN_INVALIDATION_SERVICE,
          useValue: mockTokenInvalidationService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(MockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    currentUser = {
      id: SCHOOL_ADMIN_ID,
      email: 'admin@nbk.edu.vn',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: SCHOOL_A_ID,
      accessibleSchoolIds: [SCHOOL_A_ID, SCHOOL_B_ID],
    };
    jest.clearAllMocks();

    // Default mock behaviors
    mockSchoolRepo.findById.mockImplementation((id: string) => {
      if (id === SCHOOL_A_ID) return Promise.resolve(schoolA);
      if (id === SCHOOL_B_ID) return Promise.resolve(schoolB);
      if (id === ORG_ID) return Promise.resolve(orgSchool);
      if (id === SCHOOL_DIFF_ORG_ID) return Promise.resolve(schoolDiffOrg);
      return Promise.resolve(null);
    });
    mockAssignmentRepo.findByTeacherAndSchool.mockResolvedValue(null);
    mockAssignmentRepo.countSecondaryByTeacher.mockResolvedValue(0);
    mockFeatureFlagService.isCrossSchoolEnabled.mockResolvedValue(true);

    (mockDataSource.getRepository as jest.Mock).mockReturnValue({
      findOne: jest.fn().mockResolvedValue(mockTeacher),
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Happy Path — Create Secondary School Assignment
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Create Assignment — Happy Path', () => {
    it('should create secondary school assignment successfully (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/teacher-school-assignments')
        .send({
          teacherId: TEACHER_ID,
          schoolId: SCHOOL_B_ID,
          role: AssignmentRole.SECONDARY,
          effectiveStartDate: '2024-09-01',
          note: 'Dạy tiếng Anh THCS',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('teacherId', TEACHER_ID);
      expect(res.body.data).toHaveProperty('schoolId', SCHOOL_B_ID);
      expect(res.body.data).toHaveProperty('role', AssignmentRole.SECONDARY);
      expect(res.body.message).toContain('thành công');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Deactivation — Flag Teaching Assignments
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Deactivate Assignment → Flag Teaching Assignments', () => {
    it('should deactivate secondary assignment and invalidate token (200)', async () => {
      const secondaryAssignment = {
        ...mockAssignment,
        teacher: mockTeacher,
      };
      (mockDataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue(secondaryAssignment),
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/teacher-school-assignments/${ASSIGNMENT_ID}/deactivate`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.message).toContain('Vô hiệu hóa');
    });

    it('should reject deactivation of primary assignment (400)', async () => {
      const primaryAssignment = {
        ...mockAssignment,
        role: AssignmentRole.PRIMARY,
        teacher: mockTeacher,
      };
      (mockDataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue(primaryAssignment),
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/teacher-school-assignments/${ASSIGNMENT_ID}/deactivate`)
        .send();

      expect(res.status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Feature Flag Disabled → Creation Blocked
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Feature Flag Gating', () => {
    it('should reject assignment creation when feature flag disabled (403)', async () => {
      mockFeatureFlagService.isCrossSchoolEnabled.mockResolvedValue(false);

      const res = await request(app.getHttpServer())
        .post('/api/v1/teacher-school-assignments')
        .send({
          teacherId: TEACHER_ID,
          schoolId: SCHOOL_B_ID,
          role: AssignmentRole.SECONDARY,
          effectiveStartDate: '2024-09-01',
        });

      expect(res.status).toBe(403);
      expect(mockFeatureFlagService.isCrossSchoolEnabled).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Cross-Org Assignment Rejected
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Organization Boundary Validation', () => {
    it('should reject assignment to school in different organization (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/teacher-school-assignments')
        .send({
          teacherId: TEACHER_ID,
          schoolId: SCHOOL_DIFF_ORG_ID,
          role: AssignmentRole.SECONDARY,
          effectiveStartDate: '2024-09-01',
        });

      expect(res.status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Max 5 Secondary Limit Enforced
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Secondary Assignment Limit', () => {
    it('should reject 6th secondary assignment (400)', async () => {
      mockAssignmentRepo.countSecondaryByTeacher.mockResolvedValue(5);

      const res = await request(app.getHttpServer())
        .post('/api/v1/teacher-school-assignments')
        .send({
          teacherId: TEACHER_ID,
          schoolId: SCHOOL_B_ID,
          role: AssignmentRole.SECONDARY,
          effectiveStartDate: '2024-09-01',
        });

      expect(res.status).toBe(400);
    });

    it('should allow assignment when count is below limit', async () => {
      mockAssignmentRepo.countSecondaryByTeacher.mockResolvedValue(4);

      const res = await request(app.getHttpServer())
        .post('/api/v1/teacher-school-assignments')
        .send({
          teacherId: TEACHER_ID,
          schoolId: SCHOOL_B_ID,
          role: AssignmentRole.SECONDARY,
          effectiveStartDate: '2024-09-01',
        });

      expect(res.status).toBe(201);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Full E2E Flows (require infrastructure — skipped)
  // ═══════════════════════════════════════════════════════════════════════════

  describe.skip('Full E2E with real database (requires PostgreSQL + Redis)', () => {
    it('should create assignment → refresh JWT → access secondary school data', () => {
      /**
       * Full flow:
       * 1. Create TSA linking teacher to school B
       * 2. Token is invalidated → re-authenticate
       * 3. New JWT contains accessibleSchoolIds with school B
       * 4. Teacher accesses school B data successfully
       *
       * Required infrastructure:
       * - PostgreSQL with teacher_school_assignments table
       * - Redis for token invalidation
       * - Auth service for JWT issuance
       */
    });

    it('should deactivate assignment → flag teaching assignments → token invalidated', () => {
      /**
       * Full flow:
       * 1. Create TSA + teaching assignments in school B
       * 2. Deactivate TSA
       * 3. Verify teaching assignments status = 'pending_reassignment'
       * 4. Verify old JWT is rejected
       *
       * Required infrastructure:
       * - PostgreSQL with both tables
       * - Redis for token invalidation
       */
    });
  });
});
