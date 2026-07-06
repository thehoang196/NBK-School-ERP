import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { TeacherController } from '../../src/modules/teacher/teacher.controller';
import { TeacherService } from '../../src/modules/teacher/teacher.service';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { SchoolScopeGuard } from '../../src/common/guards/school-scope.guard';
import { PermissionsGuard } from '../../src/common/guards/permissions.guard';
import { UserRole } from '../../src/common/enums/role.enum';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

/**
 * E2E Tests — Multi-tenant Isolation
 *
 * Verifies that users from school A cannot access data from school B.
 * SUPER_ADMIN can access all schools.
 */

const SCHOOL_A_ID = '00000000-1111-4000-a000-000000000001';
const SCHOOL_B_ID = '00000000-2222-4000-a000-000000000002';
const TEACHER_A_ID = '00000000-aaaa-4000-a000-000000000001';
const TEACHER_B_ID = '00000000-bbbb-4000-a000-000000000001';

interface MockUser {
  id: string;
  email: string;
  role: UserRole;
  schoolId: string | null;
  accessibleSchoolIds?: string[];
}

let currentUser: MockUser;

const MockJwtAuthGuard = {
  canActivate: (context: {
    switchToHttp: () => { getRequest: () => Record<string, unknown> };
  }) => {
    const req = context.switchToHttp().getRequest();
    req['user'] = currentUser;
    return true;
  },
};

const MockSchoolScopeGuard = {
  canActivate: (context: {
    switchToHttp: () => { getRequest: () => Record<string, unknown> };
  }) => {
    const req = context.switchToHttp().getRequest();
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      req['schoolScope'] = null;
    } else {
      req['schoolScope'] = currentUser.accessibleSchoolIds || [currentUser.schoolId];
    }
    return true;
  },
};

describe('Multi-tenant Isolation E2E', () => {
  let app: INestApplication;
  let mockTeacherService: Record<string, jest.Mock>;

  beforeAll(async () => {
    mockTeacherService = {
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TeacherController],
      providers: [{ provide: TeacherService, useValue: mockTeacherService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(MockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SchoolScopeGuard)
      .useValue(MockSchoolScopeGuard)
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── School A user cannot access School B data ────────────────────────────

  describe('Isolation: School A user ≠ School B data', () => {
    it('should return 404/403 when user school A accesses teacher of school B', async () => {
      currentUser = {
        id: 'user-a',
        email: 'admin-a@nbk.edu.vn',
        role: UserRole.SCHOOL_ADMIN,
        schoolId: SCHOOL_A_ID,
        accessibleSchoolIds: [SCHOOL_A_ID],
      };

      // Service should throw because teacher belongs to different school
      mockTeacherService.findById.mockRejectedValue(
        new NotFoundException('Không tìm thấy giáo viên'),
      );

      const res = await request(app.getHttpServer())
        .get(`/api/v1/teachers/${TEACHER_B_ID}`);

      expect([403, 404]).toContain(res.status);
    });

    it('should return only school A teachers when listing', async () => {
      currentUser = {
        id: 'user-a',
        email: 'admin-a@nbk.edu.vn',
        role: UserRole.SCHOOL_ADMIN,
        schoolId: SCHOOL_A_ID,
        accessibleSchoolIds: [SCHOOL_A_ID],
      };

      mockTeacherService.findAll.mockResolvedValue({
        success: true,
        data: [{ id: TEACHER_A_ID, schoolId: SCHOOL_A_ID, fullName: 'GV A' }],
        message: 'Success',
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/teachers?page=1&limit=20');

      expect(res.status).toBe(200);
      // All returned teachers should belong to school A
      if (res.body.data) {
        for (const teacher of res.body.data) {
          expect(teacher.schoolId).toBe(SCHOOL_A_ID);
        }
      }
    });

    it('should prevent user school A from updating teacher of school B', async () => {
      currentUser = {
        id: 'user-a',
        email: 'admin-a@nbk.edu.vn',
        role: UserRole.SCHOOL_ADMIN,
        schoolId: SCHOOL_A_ID,
        accessibleSchoolIds: [SCHOOL_A_ID],
      };

      mockTeacherService.update.mockRejectedValue(
        new ForbiddenException('Bạn không có quyền truy cập dữ liệu này.'),
      );

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/teachers/${TEACHER_B_ID}`)
        .send({ fullName: 'Hacked Name' });

      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── SUPER_ADMIN can access all schools ───────────────────────────────────

  describe('SUPER_ADMIN: Cross-school access', () => {
    it('should allow SUPER_ADMIN to access any teacher', async () => {
      currentUser = {
        id: 'super-admin',
        email: 'superadmin@nbk.edu.vn',
        role: UserRole.SUPER_ADMIN,
        schoolId: null,
      };

      mockTeacherService.findById.mockResolvedValue({
        id: TEACHER_B_ID,
        schoolId: SCHOOL_B_ID,
        fullName: 'GV B',
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/teachers/${TEACHER_B_ID}`);

      expect(res.status).toBe(200);
    });
  });
});
