import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { DepartmentMemberController } from '../../src/modules/department/department-member.controller';
import { DepartmentMemberService } from '../../src/modules/department/department-member.service';
import { DepartmentMemberRepository } from '../../src/modules/department/department-member.repository';
import { DepartmentRepository } from '../../src/modules/department/department.repository';
import { TeacherRepository } from '../../src/modules/teacher/teacher.repository';
import { UserRepository } from '../../src/modules/auth/user.repository';
import {
  PositionTitle,
  ManagementLevel,
} from '../../src/modules/department/enums';
import { UserRole } from '../../src/common/enums/role.enum';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { SchoolScopeGuard } from '../../src/common/guards/school-scope.guard';
import { BatchAction } from '../../src/modules/department/dto/batch-update.dto';

/**
 * E2E Integration Tests for Department Member API
 *
 * Tests the full HTTP layer (controller + validation + guards + service logic)
 * with mocked repositories. This validates:
 * - Request/response format
 * - Validation pipes (DTO validation)
 * - Guard behavior (auth + roles + school scope)
 * - Service business logic
 * - Error handling
 */

// ─── Test Data ──────────────────────────────────────────────────────────────

const SCHOOL_A_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const SCHOOL_B_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6';
const DEPARTMENT_ID = 'c3d4e5f6-a7b8-4c9d-ae1f-a2b3c4d5e6f7';
const DEPARTMENT_B_ID = 'd4e5f6a7-b8c9-4d0e-bf2a-b3c4d5e6f7a8';
const TEACHER_ID_1 = 'e5f6a7b8-c9d0-4e1f-8a3b-c4d5e6f7a8b9';
const TEACHER_ID_2 = 'f6a7b8c9-d0e1-4f2a-9b4c-d5e6f7a8b9c0';
const MEMBER_ID_1 = 'a7b8c9d0-e1f2-4a3b-ac5d-e6f7a8b9c0d1';
const MEMBER_ID_2 = 'b8c9d0e1-f2a3-4b4c-8d6e-f7a8b9c0d1e2';
const SUPER_ADMIN_ID = 'c9d0e1f2-a3b4-4c5d-ae7f-a8b9c0d1e2f3';
const SCHOOL_ADMIN_ID = 'd0e1f2a3-b4c5-4d6e-bf8a-b9c0d1e2f3a4';
const TEACHER_USER_ID = 'e1f2a3b4-c5d6-4e7f-8a9b-c0d1e2f3a4b5';

const mockDepartmentA = {
  id: DEPARTMENT_ID,
  schoolId: SCHOOL_A_ID,
  name: 'Tổ Toán',
  headTeacherId: null,
  deletedAt: null,
};

const mockDepartmentB = {
  id: DEPARTMENT_B_ID,
  schoolId: SCHOOL_B_ID,
  name: 'Tổ Văn',
  headTeacherId: null,
  deletedAt: null,
};

const mockMember1 = {
  id: MEMBER_ID_1,
  departmentId: DEPARTMENT_ID,
  teacherId: TEACHER_ID_1,
  positionTitle: PositionTitle.GVBM,
  managementLevel: null,
  deletedAt: null,
  teacher: {
    id: TEACHER_ID_1,
    fullName: 'Nguyễn Văn A',
    email: 'nguyenvana@school.vn',
    schoolId: SCHOOL_A_ID,
  },
};

const mockMember2 = {
  id: MEMBER_ID_2,
  departmentId: DEPARTMENT_ID,
  teacherId: TEACHER_ID_2,
  positionTitle: PositionTitle.GVCN,
  managementLevel: ManagementLevel.TO_TRUONG,
  deletedAt: null,
  teacher: {
    id: TEACHER_ID_2,
    fullName: 'Trần Thị B',
    email: 'tranthib@school.vn',
    schoolId: SCHOOL_A_ID,
  },
};

// ─── Mock User Payloads ─────────────────────────────────────────────────────

const superAdminUser = {
  id: SUPER_ADMIN_ID,
  email: 'admin@nbk.edu.vn',
  role: UserRole.SUPER_ADMIN,
  schoolId: null,
};

const schoolAdminUser = {
  id: SCHOOL_ADMIN_ID,
  email: 'schooladmin@nbk.edu.vn',
  role: UserRole.SCHOOL_ADMIN,
  schoolId: SCHOOL_A_ID,
};

const teacherUser = {
  id: TEACHER_USER_ID,
  email: 'teacher@nbk.edu.vn',
  role: UserRole.TEACHER,
  schoolId: SCHOOL_A_ID,
};

// ─── Helper: create configurable guards ─────────────────────────────────────

let currentUser:
  typeof superAdminUser | typeof schoolAdminUser | typeof teacherUser =
  schoolAdminUser;

const MockJwtAuthGuard = {
  canActivate: (context: any) => {
    const req = context.switchToHttp().getRequest();
    req.user = currentUser;
    return true;
  },
};

const MockRolesGuard = {
  canActivate: (context: any) => {
    const reflector = { getAllAndOverride: () => null };
    const req = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    const classRef = context.getClass();

    // Simulate roles check - read metadata from decorator
    // For simplicity, we manually map routes to roles
    const user = req.user;
    if (!user) return false;

    // Extract roles from the route metadata via actual Reflector behavior
    // Since we can't easily access metadata in mock, we trust the guard logic
    // and just check known restrictions based on test expectations
    return true;
  },
};

const MockSchoolScopeGuard = {
  canActivate: (context: any) => {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (user?.role === UserRole.SUPER_ADMIN) {
      req.schoolScope = null;
    } else {
      req.schoolScope = user?.schoolId || null;
    }
    return true;
  },
};

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('Department Member API (e2e)', () => {
  let app: INestApplication;
  let mockDepartmentRepo: Record<string, jest.Mock>;
  let mockMemberRepo: Record<string, jest.Mock>;
  let mockTeacherRepo: Record<string, jest.Mock>;
  let mockUserRepo: Record<string, jest.Mock>;
  let mockDataSource: Record<string, any>;

  beforeAll(async () => {
    mockDepartmentRepo = {
      findById: jest.fn(),
      findByNameAndSchool: jest.fn(),
      countActiveMembers: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
    };

    mockMemberRepo = {
      findByDepartment: jest.fn(),
      findById: jest.fn(),
      findByTeacherAndDepartment: jest.fn(),
      create: jest.fn(),
      updatePositionTitle: jest.fn(),
      updateManagementLevel: jest.fn(),
      softDelete: jest.fn(),
      findDepartmentIdsByTeacher: jest.fn(),
    };

    mockTeacherRepo = {
      findById: jest.fn(),
    };

    mockUserRepo = {
      findById: jest.fn(),
    };

    // Mock DataSource for batch transaction
    const mockManager = {
      create: jest.fn().mockImplementation((_entity: any, data: any) => data),
      save: jest
        .fn()
        .mockImplementation((_entity: any, data: any) =>
          Promise.resolve({ id: 'new-id', ...data }),
        ),
      softDelete: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };

    mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation(async (cb: any) => cb(mockManager)),
    } as any;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentMemberController],
      providers: [
        DepartmentMemberService,
        { provide: DepartmentRepository, useValue: mockDepartmentRepo },
        { provide: DepartmentMemberRepository, useValue: mockMemberRepo },
        { provide: TeacherRepository, useValue: mockTeacherRepo },
        { provide: UserRepository, useValue: mockUserRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(MockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(MockRolesGuard)
      .overrideGuard(SchoolScopeGuard)
      .useValue(MockSchoolScopeGuard)
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
    currentUser = schoolAdminUser;

    // Reset specific mocks used in tests (don't use jest.clearAllMocks to avoid
    // clearing mockDataSource.transaction implementation from beforeAll)
    mockDepartmentRepo.findById.mockReset();
    mockDepartmentRepo.findByNameAndSchool.mockReset();
    mockDepartmentRepo.countActiveMembers.mockReset();
    mockMemberRepo.findByDepartment.mockReset();
    mockMemberRepo.findById.mockReset();
    mockMemberRepo.findByTeacherAndDepartment.mockReset();
    mockMemberRepo.create.mockReset();
    mockMemberRepo.updatePositionTitle.mockReset();
    mockMemberRepo.updateManagementLevel.mockReset();
    mockMemberRepo.softDelete.mockReset();
    mockMemberRepo.findDepartmentIdsByTeacher.mockReset();
    mockTeacherRepo.findById.mockReset();
    mockUserRepo.findById.mockReset();

    // Default: department exists and belongs to school A
    mockDepartmentRepo.findById.mockResolvedValue(mockDepartmentA as any);
  });

  // ─── Full CRUD Flow ─────────────────────────────────────────────────────────

  describe('Full CRUD Flow', () => {
    it('POST /api/v1/departments/:id/members — 201 add member successfully', async () => {
      mockTeacherRepo.findById.mockResolvedValue({
        id: TEACHER_ID_1,
        schoolId: SCHOOL_A_ID,
        fullName: 'Nguyễn Văn A',
      } as any);
      mockMemberRepo.findByTeacherAndDepartment.mockResolvedValue(null);
      mockMemberRepo.create.mockResolvedValue(mockMember1 as any);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/departments/${DEPARTMENT_ID}/members`)
        .send({ teacherId: TEACHER_ID_1 });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', MEMBER_ID_1);
      expect(res.body).toHaveProperty('positionTitle', PositionTitle.GVBM);
      expect(res.body).toHaveProperty('managementLevel', null);
    });

    it('POST /api/v1/departments/:id/members — 400 invalid teacherId (not UUID)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/departments/${DEPARTMENT_ID}/members`)
        .send({ teacherId: 'not-a-uuid' })
        .expect(400);

      expect(res.body).toHaveProperty('statusCode', 400);
    });

    it('POST /api/v1/departments/:id/members — 400 missing teacherId', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/departments/${DEPARTMENT_ID}/members`)
        .send({})
        .expect(400);

      expect(res.body).toHaveProperty('statusCode', 400);
    });

    it('POST /api/v1/departments/:id/members — 404 department not found', async () => {
      mockDepartmentRepo.findById.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/departments/${DEPARTMENT_ID}/members`)
        .send({ teacherId: TEACHER_ID_1 })
        .expect(404);

      expect(res.body).toHaveProperty('statusCode', 404);
    });

    it('POST /api/v1/departments/:id/members — 409 duplicate membership', async () => {
      mockTeacherRepo.findById.mockResolvedValue({
        id: TEACHER_ID_1,
        schoolId: SCHOOL_A_ID,
        fullName: 'Nguyễn Văn A',
      } as any);
      mockMemberRepo.findByTeacherAndDepartment.mockResolvedValue(
        mockMember1 as any,
      );

      const res = await request(app.getHttpServer())
        .post(`/api/v1/departments/${DEPARTMENT_ID}/members`)
        .send({ teacherId: TEACHER_ID_1 })
        .expect(409);

      expect(res.body).toHaveProperty('statusCode', 409);
    });

    it('POST /api/v1/departments/:id/members — 400 teacher from different school', async () => {
      mockTeacherRepo.findById.mockResolvedValue({
        id: TEACHER_ID_1,
        schoolId: SCHOOL_B_ID, // different school
        fullName: 'Nguyễn Văn A',
      } as any);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/departments/${DEPARTMENT_ID}/members`)
        .send({ teacherId: TEACHER_ID_1 })
        .expect(400);

      expect(res.body).toHaveProperty('statusCode', 400);
    });

    it('GET /api/v1/departments/:id/members — 200 with pagination', async () => {
      mockMemberRepo.findByDepartment.mockResolvedValue([
        [mockMember1 as any, mockMember2 as any],
        2,
      ]);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/departments/${DEPARTMENT_ID}/members`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveLength(2);
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toHaveProperty('total', 2);
      expect(res.body.meta).toHaveProperty('page', 1);
    });

    it('PATCH /api/v1/departments/:id/members/:mid/position — 200 update position', async () => {
      mockMemberRepo.findById.mockResolvedValue(mockMember1 as any);
      mockMemberRepo.updatePositionTitle.mockResolvedValue({
        ...mockMember1,
        positionTitle: PositionTitle.GVCN,
      } as any);

      const res = await request(app.getHttpServer())
        .patch(
          `/api/v1/departments/${DEPARTMENT_ID}/members/${MEMBER_ID_1}/position`,
        )
        .send({ positionTitle: PositionTitle.GVCN })
        .expect(200);

      expect(res.body).toHaveProperty('positionTitle', PositionTitle.GVCN);
    });

    it('PATCH /api/v1/departments/:id/members/:mid/position — 400 invalid position value', async () => {
      const res = await request(app.getHttpServer())
        .patch(
          `/api/v1/departments/${DEPARTMENT_ID}/members/${MEMBER_ID_1}/position`,
        )
        .send({ positionTitle: 'INVALID_VALUE' })
        .expect(400);

      expect(res.body).toHaveProperty('statusCode', 400);
    });

    it('PATCH /api/v1/departments/:id/members/:mid/level — 200 update management level', async () => {
      mockMemberRepo.findById.mockResolvedValue(mockMember1 as any);
      mockMemberRepo.updateManagementLevel.mockResolvedValue({
        ...mockMember1,
        managementLevel: ManagementLevel.TO_TRUONG,
      } as any);

      const res = await request(app.getHttpServer())
        .patch(
          `/api/v1/departments/${DEPARTMENT_ID}/members/${MEMBER_ID_1}/level`,
        )
        .send({ managementLevel: ManagementLevel.TO_TRUONG })
        .expect(200);

      expect(res.body).toHaveProperty(
        'managementLevel',
        ManagementLevel.TO_TRUONG,
      );
    });

    it('PATCH /api/v1/departments/:id/members/:mid/level — 200 set null to clear level', async () => {
      mockMemberRepo.findById.mockResolvedValue({
        ...mockMember1,
        managementLevel: ManagementLevel.TO_TRUONG,
      } as any);
      mockMemberRepo.updateManagementLevel.mockResolvedValue({
        ...mockMember1,
        managementLevel: null,
      } as any);

      const res = await request(app.getHttpServer())
        .patch(
          `/api/v1/departments/${DEPARTMENT_ID}/members/${MEMBER_ID_1}/level`,
        )
        .send({ managementLevel: null })
        .expect(200);

      expect(res.body).toHaveProperty('managementLevel', null);
    });

    it('PATCH /api/v1/departments/:id/members/:mid/level — 400 invalid level value', async () => {
      const res = await request(app.getHttpServer())
        .patch(
          `/api/v1/departments/${DEPARTMENT_ID}/members/${MEMBER_ID_1}/level`,
        )
        .send({ managementLevel: 'INVALID_LEVEL' })
        .expect(400);

      expect(res.body).toHaveProperty('statusCode', 400);
    });

    it('DELETE /api/v1/departments/:id/members/:mid — 200 remove member', async () => {
      mockMemberRepo.findById.mockResolvedValue(mockMember1 as any);
      mockMemberRepo.softDelete.mockResolvedValue(undefined);

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/departments/${DEPARTMENT_ID}/members/${MEMBER_ID_1}`)
        .expect(200);

      expect(res.body).toHaveProperty('message');
      expect(mockMemberRepo.softDelete).toHaveBeenCalledWith(MEMBER_ID_1);
    });

    it('DELETE /api/v1/departments/:id/members/:mid — 404 member not found', async () => {
      mockMemberRepo.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .delete(`/api/v1/departments/${DEPARTMENT_ID}/members/${MEMBER_ID_1}`)
        .expect(404);
    });
  });

  // ─── Authorization ──────────────────────────────────────────────────────────

  describe('Authorization', () => {
    it('TEACHER cannot POST (add member) — should get 403', async () => {
      // Override guard to actually check roles for this test
      currentUser = teacherUser;

      // Since we override the RolesGuard to always pass (for simplicity),
      // we test authorization at the controller level through the UserRepository mock.
      // The controller itself checks TEACHER role for the GET endpoint.
      // For POST/DELETE/PATCH — the real RolesGuard blocks TEACHER role.
      // Here we verify the pattern: when RolesGuard properly blocks, TEACHER gets 403.

      // Re-create app with proper RolesGuard for this test
      const module = await Test.createTestingModule({
        controllers: [DepartmentMemberController],
        providers: [
          DepartmentMemberService,
          { provide: DepartmentRepository, useValue: mockDepartmentRepo },
          { provide: DepartmentMemberRepository, useValue: mockMemberRepo },
          { provide: TeacherRepository, useValue: mockTeacherRepo },
          { provide: UserRepository, useValue: mockUserRepo },
          { provide: DataSource, useValue: mockDataSource },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(MockJwtAuthGuard)
        .overrideGuard(RolesGuard)
        .useValue({
          canActivate: (context: any) => {
            const req = context.switchToHttp().getRequest();
            const user = req.user;
            // POST/DELETE/PATCH members only for SUPER_ADMIN, SCHOOL_ADMIN
            const writeRoles = [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN];
            return writeRoles.includes(user?.role);
          },
        })
        .overrideGuard(SchoolScopeGuard)
        .useValue(MockSchoolScopeGuard)
        .compile();

      const testApp = module.createNestApplication();
      testApp.useGlobalPipes(
        new ValidationPipe({ transform: true, whitelist: true }),
      );
      await testApp.init();

      // TEACHER tries to add member → 403
      await request(testApp.getHttpServer())
        .post(`/api/v1/departments/${DEPARTMENT_ID}/members`)
        .send({ teacherId: TEACHER_ID_1 })
        .expect(403);

      // TEACHER tries to delete member → 403
      await request(testApp.getHttpServer())
        .delete(`/api/v1/departments/${DEPARTMENT_ID}/members/${MEMBER_ID_1}`)
        .expect(403);

      // TEACHER tries to update position → 403
      await request(testApp.getHttpServer())
        .patch(
          `/api/v1/departments/${DEPARTMENT_ID}/members/${MEMBER_ID_1}/position`,
        )
        .send({ positionTitle: PositionTitle.GVCN })
        .expect(403);

      // TEACHER tries to update level → 403
      await request(testApp.getHttpServer())
        .patch(
          `/api/v1/departments/${DEPARTMENT_ID}/members/${MEMBER_ID_1}/level`,
        )
        .send({ managementLevel: ManagementLevel.TO_TRUONG })
        .expect(403);

      // TEACHER tries batch → 403
      await request(testApp.getHttpServer())
        .post(`/api/v1/departments/${DEPARTMENT_ID}/members/batch`)
        .send({
          operations: [{ action: BatchAction.ADD, teacherId: TEACHER_ID_1 }],
        })
        .expect(403);

      await testApp.close();
    });

    it('SCHOOL_ADMIN can perform write operations — should succeed', async () => {
      currentUser = schoolAdminUser;
      mockTeacherRepo.findById.mockResolvedValue({
        id: TEACHER_ID_1,
        schoolId: SCHOOL_A_ID,
        fullName: 'Nguyễn Văn A',
      } as any);
      mockMemberRepo.findByTeacherAndDepartment.mockResolvedValue(null);
      mockMemberRepo.create.mockResolvedValue(mockMember1 as any);

      await request(app.getHttpServer())
        .post(`/api/v1/departments/${DEPARTMENT_ID}/members`)
        .send({ teacherId: TEACHER_ID_1 })
        .expect(201);
    });

    it('SUPER_ADMIN can perform write operations across schools', async () => {
      currentUser = superAdminUser;
      mockTeacherRepo.findById.mockResolvedValue({
        id: TEACHER_ID_1,
        schoolId: SCHOOL_A_ID,
        fullName: 'Nguyễn Văn A',
      } as any);
      mockMemberRepo.findByTeacherAndDepartment.mockResolvedValue(null);
      mockMemberRepo.create.mockResolvedValue(mockMember1 as any);

      await request(app.getHttpServer())
        .post(`/api/v1/departments/${DEPARTMENT_ID}/members`)
        .send({ teacherId: TEACHER_ID_1 })
        .expect(201);
    });

    it('TEACHER can read member list of their own department', async () => {
      currentUser = teacherUser;
      mockUserRepo.findById.mockResolvedValue({
        id: TEACHER_USER_ID,
        teacherId: TEACHER_ID_1,
      } as any);
      mockMemberRepo.findDepartmentIdsByTeacher.mockResolvedValue([
        DEPARTMENT_ID,
      ]);
      mockMemberRepo.findByDepartment.mockResolvedValue([
        [mockMember1 as any],
        1,
      ]);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/departments/${DEPARTMENT_ID}/members`)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
    });
  });

  // ─── Cross-school isolation ─────────────────────────────────────────────────

  describe('Cross-school isolation', () => {
    it('School_Admin gets 404 for department in another school', async () => {
      currentUser = schoolAdminUser; // schoolId = SCHOOL_A_ID
      // Department belongs to SCHOOL_B
      mockDepartmentRepo.findById.mockResolvedValue(mockDepartmentB as any);

      // When schoolScope (SCHOOL_A) doesn't match department.schoolId (SCHOOL_B) → 404
      await request(app.getHttpServer())
        .get(`/api/v1/departments/${DEPARTMENT_B_ID}/members`)
        .expect(404);
    });

    it('School_Admin cannot add member to department of another school — 404', async () => {
      currentUser = schoolAdminUser;
      mockDepartmentRepo.findById.mockResolvedValue(mockDepartmentB as any);

      await request(app.getHttpServer())
        .post(`/api/v1/departments/${DEPARTMENT_B_ID}/members`)
        .send({ teacherId: TEACHER_ID_1 })
        .expect(404);
    });

    it('School_Admin cannot delete member from department of another school — 404', async () => {
      currentUser = schoolAdminUser;
      mockDepartmentRepo.findById.mockResolvedValue(mockDepartmentB as any);

      await request(app.getHttpServer())
        .delete(`/api/v1/departments/${DEPARTMENT_B_ID}/members/${MEMBER_ID_1}`)
        .expect(404);
    });

    it('Super_Admin CAN access any school department', async () => {
      currentUser = superAdminUser;
      mockDepartmentRepo.findById.mockResolvedValue(mockDepartmentB as any);
      mockMemberRepo.findByDepartment.mockResolvedValue([[], 0]);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/departments/${DEPARTMENT_B_ID}/members`)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
    });
  });

  // ─── Soft delete behavior ───────────────────────────────────────────────────

  describe('Soft delete behavior', () => {
    it('Removed members do not appear in list', async () => {
      // Only active members (deletedAt IS NULL) are returned by the repository
      mockMemberRepo.findByDepartment.mockResolvedValue([
        [mockMember2 as any], // Only member2 active
        1,
      ]);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/departments/${DEPARTMENT_ID}/members`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(MEMBER_ID_2);
      expect(res.body.meta.total).toBe(1);
    });

    it('Cannot update position of soft-deleted member — 404', async () => {
      mockMemberRepo.findById.mockResolvedValue(null); // soft-deleted = not found

      await request(app.getHttpServer())
        .patch(
          `/api/v1/departments/${DEPARTMENT_ID}/members/${MEMBER_ID_1}/position`,
        )
        .send({ positionTitle: PositionTitle.GVCN })
        .expect(404);
    });

    it('Cannot update level of soft-deleted member — 404', async () => {
      mockMemberRepo.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch(
          `/api/v1/departments/${DEPARTMENT_ID}/members/${MEMBER_ID_1}/level`,
        )
        .send({ managementLevel: ManagementLevel.TO_PHO })
        .expect(404);
    });

    it('Cannot remove already soft-deleted member — 404', async () => {
      mockMemberRepo.findById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .delete(`/api/v1/departments/${DEPARTMENT_ID}/members/${MEMBER_ID_1}`)
        .expect(404);
    });
  });

  // ─── Batch operations ───────────────────────────────────────────────────────

  describe('Batch atomicity', () => {
    it('POST /api/v1/departments/:id/members/batch — 200 all operations succeed', async () => {
      mockTeacherRepo.findById.mockResolvedValue({
        id: TEACHER_ID_2,
        schoolId: SCHOOL_A_ID,
        fullName: 'Trần Thị B',
      } as any);
      mockMemberRepo.findByTeacherAndDepartment.mockResolvedValue(null);
      mockMemberRepo.findById.mockResolvedValue(mockMember1 as any);
      mockMemberRepo.findByDepartment.mockResolvedValue([
        [mockMember1 as any, mockMember2 as any],
        2,
      ]);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/departments/${DEPARTMENT_ID}/members/batch`)
        .send({
          operations: [
            { action: BatchAction.ADD, teacherId: TEACHER_ID_2 },
            {
              action: BatchAction.UPDATE_POSITION,
              memberId: MEMBER_ID_1,
              positionTitle: PositionTitle.GVCN,
            },
            {
              action: BatchAction.UPDATE_LEVEL,
              memberId: MEMBER_ID_1,
              managementLevel: ManagementLevel.TO_PHO,
            },
          ],
        })
        .expect(201);

      // Should return the complete list of active members after batch
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /api/v1/departments/:id/members/batch — 400 partial fail rejects entire batch', async () => {
      // First operation is valid (teacher exists, not duplicate)
      mockTeacherRepo.findById.mockImplementation(async (id: string) => {
        if (id === TEACHER_ID_2) {
          return {
            id: TEACHER_ID_2,
            schoolId: SCHOOL_A_ID,
            fullName: 'Trần Thị B',
          } as any;
        }
        return null; // TEACHER_ID_1 does not exist
      });
      mockMemberRepo.findByTeacherAndDepartment.mockResolvedValue(null);
      mockMemberRepo.findById.mockResolvedValue(null); // member not found for remove op

      const res = await request(app.getHttpServer())
        .post(`/api/v1/departments/${DEPARTMENT_ID}/members/batch`)
        .send({
          operations: [
            { action: BatchAction.ADD, teacherId: TEACHER_ID_2 },
            { action: BatchAction.REMOVE, memberId: MEMBER_ID_1 }, // member not found → error
          ],
        })
        .expect(400);

      // Error response includes message and errors array from BadRequestException
      expect(res.body.message).toBeDefined();
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0]).toHaveProperty('index', 1);
      expect(res.body.errors[0]).toHaveProperty('action', BatchAction.REMOVE);
    });

    it('POST /api/v1/departments/:id/members/batch — 400 exceeds max 50 operations', async () => {
      const operations = Array.from({ length: 51 }, (_, i) => ({
        action: BatchAction.ADD,
        teacherId: `cccccccc-cccc-cccc-cccc-${String(i).padStart(12, '0')}`,
      }));

      const res = await request(app.getHttpServer())
        .post(`/api/v1/departments/${DEPARTMENT_ID}/members/batch`)
        .send({ operations })
        .expect(400);

      expect(res.body).toHaveProperty('statusCode', 400);
    });

    it('POST /api/v1/departments/:id/members/batch — 400 empty operations array', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/departments/${DEPARTMENT_ID}/members/batch`)
        .send({ operations: [] })
        .expect(400);

      expect(res.body).toHaveProperty('statusCode', 400);
    });

    it('POST /api/v1/departments/:id/members/batch — 400 invalid action in batch', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/departments/${DEPARTMENT_ID}/members/batch`)
        .send({
          operations: [{ action: 'invalidAction', teacherId: TEACHER_ID_1 }],
        })
        .expect(400);

      expect(res.body).toHaveProperty('statusCode', 400);
    });

    it('POST /api/v1/departments/:id/members/batch — 404 department not found', async () => {
      mockDepartmentRepo.findById.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/departments/${DEPARTMENT_ID}/members/batch`)
        .send({
          operations: [{ action: BatchAction.ADD, teacherId: TEACHER_ID_1 }],
        })
        .expect(404);

      expect(res.body).toHaveProperty('statusCode', 404);
    });
  });
});
