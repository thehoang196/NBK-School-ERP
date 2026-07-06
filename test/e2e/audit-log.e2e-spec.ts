import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AuditLogController } from '../../src/modules/audit/controllers/audit-log.controller';
import { AuditLogService } from '../../src/modules/audit/services/audit-log.service';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { SchoolScopeGuard } from '../../src/common/guards/school-scope.guard';
import { PermissionsGuard } from '../../src/common/guards/permissions.guard';
import { UserRole } from '../../src/common/enums/role.enum';

/**
 * E2E Tests — Audit Log
 *
 * Tests audit log listing and access control.
 */

const SCHOOL_ID = '00000000-1111-4000-a000-000000000001';

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
    req['schoolScope'] = currentUser.accessibleSchoolIds || null;
    return true;
  },
};

describe('Audit Log E2E', () => {
  let app: INestApplication;
  let mockAuditService: Record<string, jest.Mock>;

  const mockAuditLog = {
    id: 'audit-uuid-1',
    userId: 'user-uuid-1',
    schoolId: SCHOOL_ID,
    action: 'create',
    entityType: 'teacher',
    entityId: 'teacher-uuid-1',
    changes: { fullName: { old: null, new: 'Nguyễn Văn A' } },
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    createdAt: new Date().toISOString(),
  };

  beforeAll(async () => {
    mockAuditService = {
      findAll: jest.fn(),
      findById: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [{ provide: AuditLogService, useValue: mockAuditService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(MockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SchoolScopeGuard)
      .useValue({ canActivate: () => true })
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

  describe('GET /api/v1/audit-logs', () => {
    it('should list audit logs for SCHOOL_ADMIN (200)', async () => {
      currentUser = {
        id: 'admin-1',
        email: 'admin@nbk.edu.vn',
        role: UserRole.SCHOOL_ADMIN,
        schoolId: SCHOOL_ID,
        accessibleSchoolIds: [SCHOOL_ID],
      };

      mockAuditService.findAll.mockResolvedValue({
        success: true,
        data: [mockAuditLog],
        message: 'Lấy danh sách audit log thành công',
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/audit-logs?page=1&limit=20');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toHaveProperty('action', 'create');
    });

    it('should filter by action type', async () => {
      currentUser = {
        id: 'super-admin',
        email: 'superadmin@nbk.edu.vn',
        role: UserRole.SUPER_ADMIN,
        schoolId: null,
      };

      mockAuditService.findAll.mockResolvedValue({
        success: true,
        data: [],
        message: 'Lấy danh sách audit log thành công',
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/audit-logs?action=delete');

      expect(res.status).toBe(200);
      expect(mockAuditService.findAll).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/audit-logs/:id', () => {
    it('should return audit log detail (200)', async () => {
      currentUser = {
        id: 'admin-1',
        email: 'admin@nbk.edu.vn',
        role: UserRole.SCHOOL_ADMIN,
        schoolId: SCHOOL_ID,
        accessibleSchoolIds: [SCHOOL_ID],
      };

      mockAuditService.findById.mockResolvedValue(mockAuditLog);

      const res = await request(app.getHttpServer())
        .get('/api/v1/audit-logs/audit-uuid-1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('entityType', 'teacher');
    });

    it('should return 404 when not found', async () => {
      currentUser = {
        id: 'admin-1',
        email: 'admin@nbk.edu.vn',
        role: UserRole.SCHOOL_ADMIN,
        schoolId: SCHOOL_ID,
        accessibleSchoolIds: [SCHOOL_ID],
      };

      mockAuditService.findById.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get('/api/v1/audit-logs/non-existent');

      expect(res.status).toBe(404);
    });
  });
});
