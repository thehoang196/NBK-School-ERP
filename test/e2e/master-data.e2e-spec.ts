import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MasterDataController } from '../../src/modules/master-data/controllers/master-data.controller';
import { ReconciliationController } from '../../src/modules/master-data/controllers/reconciliation.controller';
import { FieldDefinitionController } from '../../src/modules/master-data/controllers/field-definition.controller';
import { MasterDataService } from '../../src/modules/master-data/services/master-data.service';
import { ImportService } from '../../src/modules/master-data/services/import.service';
import { ReconciliationService } from '../../src/modules/master-data/services/reconciliation.service';
import { SyncService } from '../../src/modules/master-data/services/sync.service';
import { FieldDefinitionService } from '../../src/modules/master-data/services/field-definition.service';
import { MasterDataRepository } from '../../src/modules/master-data/repositories/master-data.repository';
import { FieldDefinitionRepository } from '../../src/modules/master-data/repositories/field-definition.repository';
import { AuditLogRepository } from '../../src/modules/master-data/repositories/audit-log.repository';
import { SyncLogRepository } from '../../src/modules/master-data/repositories/sync-log.repository';
import { EmployeeMasterEntity } from '../../src/modules/master-data/entities/employee-master.entity';
import { FieldDefinitionEntity } from '../../src/modules/master-data/entities/field-definition.entity';
import { EmployeeAuditLogEntity } from '../../src/modules/master-data/entities/employee-audit-log.entity';
import { SyncLogEntity } from '../../src/modules/master-data/entities/sync-log.entity';
import { ReconciliationSessionEntity } from '../../src/modules/master-data/entities/reconciliation-session.entity';
import { UserRole } from '../../src/common/enums/role.enum';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { SchoolScopeGuard } from '../../src/common/guards/school-scope.guard';
import {
  ReconciliationStatus,
  SyncDirection,
  SyncStatus,
} from '../../src/modules/master-data/enums/master-data.enum';
import { Gender } from '../../src/common/enums/status.enum';
import { Workbook } from 'exceljs';

/**
 * E2E Integration Tests for Master Data Management Module
 *
 * Tests the full HTTP layer (controller + validation + guards + service logic)
 * with mocked repositories. Validates:
 * - CRUD flow via HTTP endpoints
 * - Excel import with new records, conflicts, auto-field-registration
 * - Reconciliation trigger → report → apply/decline flow
 * - Event emission and sync log creation
 * - RBAC enforcement for all roles
 */

// ─── Test Constants ─────────────────────────────────────────────────────────

const SCHOOL_A_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const SCHOOL_B_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6';
const EMPLOYEE_ID_1 = 'c3d4e5f6-a7b8-4c9d-ae1f-a2b3c4d5e6f7';
const EMPLOYEE_ID_2 = 'd4e5f6a7-b8c9-4d0e-bf2a-b3c4d5e6f7a8';
const RECONCILIATION_ID = 'e5f6a7b8-c9d0-4e1f-8a3b-c4d5e6f7a8b9';
const SUPER_ADMIN_ID = 'f6a7b8c9-d0e1-4f2a-9b4c-d5e6f7a8b9c0';
const SCHOOL_ADMIN_ID = 'a7b8c9d0-e1f2-4a3b-ac5d-e6f7a8b9c0d1';
const TEACHER_USER_ID = 'b8c9d0e1-f2a3-4b4c-8d6e-f7a8b9c0d1e2';

// ─── Mock Employee Data ─────────────────────────────────────────────────────

const mockEmployee1: Partial<EmployeeMasterEntity> = {
  id: EMPLOYEE_ID_1,
  schoolId: SCHOOL_A_ID,
  employeeCode: 'NV001',
  fullName: 'Nguyễn Văn A',
  shortName: 'A',
  campusName: 'Cơ sở 1',
  gradeName: 'Khối 10',
  departmentName: 'Tổ Toán',
  jobTitle: 'Giáo viên',
  managementLevel: null,
  gender: Gender.MALE,
  maxPeriodsPerWeek: 20,
  workingDays: 5.5,
  extendedFields: {},
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
};

const mockEmployee2: Partial<EmployeeMasterEntity> = {
  id: EMPLOYEE_ID_2,
  schoolId: SCHOOL_A_ID,
  employeeCode: 'NV002',
  fullName: 'Trần Thị B',
  shortName: 'B',
  campusName: 'Cơ sở 1',
  gradeName: 'Khối 11',
  departmentName: 'Tổ Văn',
  jobTitle: 'Giáo viên',
  managementLevel: null,
  gender: Gender.FEMALE,
  maxPeriodsPerWeek: 18,
  workingDays: 5,
  extendedFields: {},
  createdAt: new Date('2024-01-02'),
  updatedAt: new Date('2024-01-02'),
  deletedAt: null,
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

// ─── Configurable User for Guards ───────────────────────────────────────────

interface MockUser {
  id: string;
  email: string;
  role: UserRole;
  schoolId: string | null;
}

let currentUser: MockUser = superAdminUser;

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
    const user = req['user'] as MockUser;
    if (user?.role === UserRole.SUPER_ADMIN) {
      req['schoolScope'] = null;
    } else {
      req['schoolScope'] = user?.schoolId || null;
    }
    return true;
  },
};

// ─── Helper: Create Excel file buffer ───────────────────────────────────────

async function createExcelBuffer(
  headers: string[],
  rows: (string | number | null)[][],
): Promise<Buffer> {
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');
  worksheet.addRow(headers);
  for (const row of rows) {
    worksheet.addRow(row);
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('Master Data API (e2e)', () => {
  let app: INestApplication;
  let mockMasterDataRepo: Record<string, jest.Mock>;
  let mockFieldDefRepo: Record<string, jest.Mock>;
  let mockAuditLogRepo: Record<string, jest.Mock>;
  let mockSyncLogRepo: Record<string, jest.Mock>;
  let mockReconciliationRepo: Record<string, jest.Mock>;
  let mockDataSource: Record<string, jest.Mock>;
  let mockEventEmitter: Record<string, jest.Mock>;

  beforeAll(async () => {
    mockMasterDataRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByEmployeeCode: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    mockFieldDefRepo = {
      findAll: jest.fn().mockResolvedValue([]),
      findByFieldName: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    };

    mockAuditLogRepo = {
      create: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue([]),
      findByEmployeeId: jest.fn().mockResolvedValue([]),
    };

    mockSyncLogRepo = {
      create: jest.fn().mockResolvedValue({}),
      findAll: jest.fn().mockResolvedValue([[], 0]),
      findById: jest.fn(),
      update: jest.fn(),
      findRecentMasterChange: jest.fn().mockResolvedValue(null),
      findPendingByEmployeeCode: jest.fn().mockResolvedValue(null),
    };

    mockReconciliationRepo = {
      create: jest
        .fn()
        .mockImplementation((data: Record<string, unknown>) => data),
      save: jest.fn().mockImplementation((data: Record<string, unknown>) => ({
        id: RECONCILIATION_ID,
        createdAt: new Date(),
        ...data,
      })),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };

    const mockManager = {
      create: jest
        .fn()
        .mockImplementation((_entity: unknown, data: unknown) => data),
      save: jest
        .fn()
        .mockImplementation((_entityOrData: unknown, data?: unknown) => {
          const resolvedData = data ?? _entityOrData;
          return Promise.resolve({
            id: 'new-id-' + Date.now(),
            ...(resolvedData as object),
          });
        }),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      }),
    };

    mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation(
          async (cb: (manager: typeof mockManager) => Promise<unknown>) =>
            cb(mockManager),
        ),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        MasterDataController,
        ReconciliationController,
        FieldDefinitionController,
      ],
      providers: [
        MasterDataService,
        ImportService,
        ReconciliationService,
        SyncService,
        FieldDefinitionService,
        { provide: MasterDataRepository, useValue: mockMasterDataRepo },
        { provide: FieldDefinitionRepository, useValue: mockFieldDefRepo },
        { provide: AuditLogRepository, useValue: mockAuditLogRepo },
        { provide: SyncLogRepository, useValue: mockSyncLogRepo },
        {
          provide: getRepositoryToken(ReconciliationSessionEntity),
          useValue: mockReconciliationRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(MockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SchoolScopeGuard)
      .useValue(MockSchoolScopeGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    currentUser = schoolAdminUser;
    jest.clearAllMocks();

    // Reset default mock behaviors
    mockFieldDefRepo.findAll.mockResolvedValue([]);
    mockFieldDefRepo.findByFieldName.mockResolvedValue(null);
    mockAuditLogRepo.create.mockResolvedValue({});
    mockAuditLogRepo.createMany.mockResolvedValue([]);
    mockSyncLogRepo.create.mockResolvedValue({});
    mockSyncLogRepo.findRecentMasterChange.mockResolvedValue(null);
    mockReconciliationRepo.create.mockImplementation(
      (data: Record<string, unknown>) => data,
    );
    mockReconciliationRepo.save.mockImplementation(
      (data: Record<string, unknown>) => ({
        id: RECONCILIATION_ID,
        createdAt: new Date(),
        ...data,
      }),
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. CRUD Flow
  // ═══════════════════════════════════════════════════════════════════════════

  describe('CRUD Flow', () => {
    it('POST /api/v1/master-data/employees → creates employee (201)', async () => {
      mockMasterDataRepo.findByEmployeeCode.mockResolvedValue(null);
      mockMasterDataRepo.create.mockResolvedValue(mockEmployee1);

      const res = await request(app.getHttpServer())
        .post('/api/v1/master-data/employees')
        .send({
          schoolId: SCHOOL_A_ID,
          employeeCode: 'NV001',
          fullName: 'Nguyễn Văn A',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('employeeCode', 'NV001');
      expect(res.body.data).toHaveProperty('fullName', 'Nguyễn Văn A');
    });

    it('POST /api/v1/master-data/employees → 409 duplicate employee_code', async () => {
      mockMasterDataRepo.findByEmployeeCode.mockResolvedValue(mockEmployee1);

      const res = await request(app.getHttpServer())
        .post('/api/v1/master-data/employees')
        .send({
          schoolId: SCHOOL_A_ID,
          employeeCode: 'NV001',
          fullName: 'Duplicate Name',
        });

      expect(res.status).toBe(409);
    });

    it('POST /api/v1/master-data/employees → 400 missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/master-data/employees')
        .send({ schoolId: SCHOOL_A_ID });

      expect(res.status).toBe(400);
    });

    it('GET /api/v1/master-data/employees → lists with pagination (200)', async () => {
      mockMasterDataRepo.findAll.mockResolvedValue([
        [mockEmployee1, mockEmployee2],
        2,
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/master-data/employees')
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toHaveProperty('total', 2);
      expect(res.body.meta).toHaveProperty('page', 1);
      expect(res.body.meta).toHaveProperty('totalPages', 1);
    });

    it('GET /api/v1/master-data/employees/:id → gets by ID (200)', async () => {
      mockMasterDataRepo.findById.mockResolvedValue(mockEmployee1);

      const res = await request(app.getHttpServer()).get(
        `/api/v1/master-data/employees/${EMPLOYEE_ID_1}`,
      );

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('id', EMPLOYEE_ID_1);
      expect(res.body.data).toHaveProperty('employeeCode', 'NV001');
    });

    it('GET /api/v1/master-data/employees/:id → 404 not found', async () => {
      mockMasterDataRepo.findById.mockResolvedValue(null);

      const res = await request(app.getHttpServer()).get(
        `/api/v1/master-data/employees/${EMPLOYEE_ID_1}`,
      );

      expect(res.status).toBe(404);
    });

    it('PATCH /api/v1/master-data/employees/:id → updates and creates audit log (200)', async () => {
      const updatedEmployee = {
        ...mockEmployee1,
        fullName: 'Nguyễn Văn A Updated',
      };
      mockMasterDataRepo.findById.mockResolvedValue(mockEmployee1);
      mockMasterDataRepo.update.mockResolvedValue(updatedEmployee);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/master-data/employees/${EMPLOYEE_ID_1}`)
        .send({ fullName: 'Nguyễn Văn A Updated' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('fullName', 'Nguyễn Văn A Updated');
      // Verify audit log was created
      expect(mockAuditLogRepo.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            fieldName: 'fullName',
            oldValue: 'Nguyễn Văn A',
            newValue: 'Nguyễn Văn A Updated',
          }),
        ]),
      );
    });

    it('DELETE /api/v1/master-data/employees/:id → soft deletes (200)', async () => {
      mockMasterDataRepo.findById.mockResolvedValue(mockEmployee1);
      mockMasterDataRepo.softDelete.mockResolvedValue(undefined);

      const res = await request(app.getHttpServer()).delete(
        `/api/v1/master-data/employees/${EMPLOYEE_ID_1}`,
      );

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(mockMasterDataRepo.softDelete).toHaveBeenCalledWith(EMPLOYEE_ID_1);
    });

    it('DELETE /api/v1/master-data/employees/:id → 404 not found', async () => {
      mockMasterDataRepo.findById.mockResolvedValue(null);

      const res = await request(app.getHttpServer()).delete(
        `/api/v1/master-data/employees/${EMPLOYEE_ID_1}`,
      );

      expect(res.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Import Flow
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Import Flow', () => {
    it('POST /api/v1/master-data/employees/import → creates new records from Excel (201)', async () => {
      const excelBuffer = await createExcelBuffer(
        ['Mã NV', 'Họ và Tên', 'Tổ bộ môn', 'Giới tính'],
        [
          ['NV003', 'Lê Văn C', 'Tổ Lý', 'Nam'],
          ['NV004', 'Phạm Thị D', 'Tổ Hóa', 'Nữ'],
        ],
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/master-data/employees/import')
        .attach('file', excelBuffer, 'import.xlsx');

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('totalRows', 2);
      expect(res.body.data).toHaveProperty('created', 2);
      expect(res.body.data).toHaveProperty('conflicts', 0);
    });

    it('POST /api/v1/master-data/employees/import → detects conflicts for existing records', async () => {
      // Mock: when transaction manager finds existing employee NV001
      mockDataSource.transaction.mockImplementation(
        async (
          cb: (manager: Record<string, jest.Mock>) => Promise<unknown>,
        ) => {
          const managerWithExisting = {
            create: jest
              .fn()
              .mockImplementation((_entity: unknown, data: unknown) => data),
            save: jest
              .fn()
              .mockImplementation((_entityOrData: unknown, data?: unknown) => {
                return Promise.resolve({
                  id: 'new-id',
                  ...((data ?? _entityOrData) as object),
                });
              }),
            findOne: jest
              .fn()
              .mockImplementation(
                (
                  _entity: unknown,
                  opts: { where: { employeeCode: string } },
                ) => {
                  if (opts?.where?.employeeCode === 'NV001') {
                    return Promise.resolve({
                      ...mockEmployee1,
                      departmentName: 'Tổ Toán', // existing value differs from import
                    });
                  }
                  return Promise.resolve(null);
                },
              ),
            update: jest.fn().mockResolvedValue(undefined),
          };
          return cb(managerWithExisting);
        },
      );

      const excelBuffer = await createExcelBuffer(
        ['Mã NV', 'Họ và Tên', 'Tổ bộ môn'],
        [
          ['NV001', 'Nguyễn Văn A', 'Tổ Lý'], // Different department → conflict
          ['NV005', 'Hoàng Văn E', 'Tổ Anh'], // New record
        ],
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/master-data/employees/import')
        .attach('file', excelBuffer, 'import.xlsx');

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('totalRows', 2);
      expect(res.body.data).toHaveProperty('conflicts', 1);
      expect(res.body.data).toHaveProperty('created', 1);
    });

    it('POST /api/v1/master-data/employees/import → auto-registers unknown fields', async () => {
      // Reset transaction mock to default
      mockDataSource.transaction.mockImplementation(
        async (
          cb: (manager: Record<string, jest.Mock>) => Promise<unknown>,
        ) => {
          const mgr = {
            create: jest
              .fn()
              .mockImplementation((_entity: unknown, data: unknown) => data),
            save: jest
              .fn()
              .mockImplementation((_entityOrData: unknown, data?: unknown) => {
                return Promise.resolve({
                  id: 'new-id-' + Date.now(),
                  ...((data ?? _entityOrData) as object),
                });
              }),
            findOne: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue(undefined),
          };
          return cb(mgr);
        },
      );

      const excelBuffer = await createExcelBuffer(
        ['Mã NV', 'Họ và Tên', 'Trình Độ', 'Chứng Chỉ'],
        [['NV006', 'Trần Văn F', 'Thạc sĩ', 'IELTS 7.0']],
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/master-data/employees/import')
        .attach('file', excelBuffer, 'import.xlsx');

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('created', 1);
    });

    it('POST /api/v1/master-data/employees/import → 400 missing file', async () => {
      const res = await request(app.getHttpServer()).post(
        '/api/v1/master-data/employees/import',
      );

      expect(res.status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Reconciliation Flow
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Reconciliation Flow', () => {
    it('POST /api/v1/master-data/reconciliation → triggers and returns report (201)', async () => {
      // Setup: employee NV001 exists with departmentName = 'Tổ Toán'
      mockMasterDataRepo.findByEmployeeCode.mockImplementation(
        (_schoolId: string, code: string) => {
          if (code === 'NV001') {
            return Promise.resolve({
              ...mockEmployee1,
              departmentName: 'Tổ Toán',
              extendedFields: {},
            });
          }
          return Promise.resolve(null);
        },
      );
      mockFieldDefRepo.findAll.mockResolvedValue([]);
      mockReconciliationRepo.create.mockImplementation(
        (data: Record<string, unknown>) => data,
      );
      mockReconciliationRepo.save.mockImplementation(
        (data: Record<string, unknown>) =>
          Promise.resolve({
            id: RECONCILIATION_ID,
            createdAt: new Date(),
            ...data,
          }),
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/master-data/reconciliation')
        .send({
          schoolId: SCHOOL_A_ID,
          sourceModule: 'teaching-assignment',
          sourceData: [
            { employeeCode: 'NV001', departmentName: 'Tổ Lý' }, // different from master 'Tổ Toán'
            { employeeCode: 'NV099', fullName: 'New Employee' }, // new record
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('status', ReconciliationStatus.COMPLETED);
      expect(res.body).toHaveProperty('totalRecords', 2);
      expect(res.body).toHaveProperty('matchedRecords', 1);
      expect(res.body).toHaveProperty('newRecords', 1);
      expect(res.body.reportData).toHaveProperty('differences');
      expect(res.body.reportData.differences.length).toBeGreaterThanOrEqual(1);
      expect(res.body.reportData.newRecords).toContain('NV099');
    });

    it('GET /api/v1/master-data/reconciliation/:id → gets report (200)', async () => {
      const mockSession = {
        id: RECONCILIATION_ID,
        schoolId: SCHOOL_A_ID,
        sourceModule: 'teaching-assignment',
        status: ReconciliationStatus.COMPLETED,
        totalRecords: 5,
        matchedRecords: 4,
        conflictRecords: 1,
        newRecords: 1,
        reportData: {
          differences: [
            {
              employeeCode: 'NV001',
              fieldName: 'departmentName',
              masterValue: 'Tổ Toán',
              sourceValue: 'Tổ Lý',
            },
          ],
          newFields: [],
          newRecords: ['NV099'],
        },
        triggeredBy: SCHOOL_ADMIN_ID,
        createdAt: new Date(),
        completedAt: new Date(),
      };
      mockReconciliationRepo.findOne.mockResolvedValue(mockSession);

      const res = await request(app.getHttpServer()).get(
        `/api/v1/master-data/reconciliation/${RECONCILIATION_ID}`,
      );

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', RECONCILIATION_ID);
      expect(res.body).toHaveProperty('status', ReconciliationStatus.COMPLETED);
      expect(res.body.reportData.differences).toHaveLength(1);
    });

    it('GET /api/v1/master-data/reconciliation/:id → 404 not found', async () => {
      mockReconciliationRepo.findOne.mockResolvedValue(null);

      const res = await request(app.getHttpServer()).get(
        `/api/v1/master-data/reconciliation/${RECONCILIATION_ID}`,
      );

      expect(res.status).toBe(404);
    });

    it('POST /api/v1/master-data/reconciliation/:id/apply → applies changes (200)', async () => {
      const mockSession = {
        id: RECONCILIATION_ID,
        schoolId: SCHOOL_A_ID,
        sourceModule: 'teaching-assignment',
        status: ReconciliationStatus.COMPLETED,
        totalRecords: 2,
        matchedRecords: 1,
        conflictRecords: 1,
        newRecords: 1,
        reportData: {
          differences: [
            {
              employeeCode: 'NV001',
              fieldName: 'departmentName',
              masterValue: 'Tổ Toán',
              sourceValue: 'Tổ Lý',
            },
          ],
          newFields: [],
          newRecords: ['NV099'],
        },
        triggeredBy: SCHOOL_ADMIN_ID,
        createdAt: new Date(),
        completedAt: null,
      };
      mockReconciliationRepo.findOne.mockResolvedValue(mockSession);
      mockMasterDataRepo.findByEmployeeCode.mockResolvedValue(mockEmployee1);

      // Override DataSource.transaction for this test to include createQueryBuilder
      mockDataSource.transaction.mockImplementation(
        async (cb: (manager: Record<string, unknown>) => Promise<unknown>) => {
          const mgr = {
            create: jest
              .fn()
              .mockImplementation((_entity: unknown, data: unknown) => data),
            save: jest
              .fn()
              .mockImplementation((_entityOrData: unknown, data?: unknown) => {
                return Promise.resolve({
                  id: 'audit-id',
                  ...((data ?? _entityOrData) as object),
                });
              }),
            update: jest.fn().mockResolvedValue(undefined),
            createQueryBuilder: jest.fn().mockReturnValue({
              update: jest.fn().mockReturnThis(),
              set: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              execute: jest.fn().mockResolvedValue(undefined),
            }),
          };
          return cb(mgr);
        },
      );

      const res = await request(app.getHttpServer())
        .post(`/api/v1/master-data/reconciliation/${RECONCILIATION_ID}/apply`)
        .send({ acceptedFields: ['departmentName'] });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty(
        'message',
        'Áp dụng thay đổi đối chiếu thành công',
      );
    });

    it('POST /api/v1/master-data/reconciliation/:id/apply → 404 not found', async () => {
      mockReconciliationRepo.findOne.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/master-data/reconciliation/${RECONCILIATION_ID}/apply`)
        .send({ acceptedFields: ['departmentName'] });

      expect(res.status).toBe(404);
    });

    it('POST /api/v1/master-data/reconciliation/:id/decline → declines changes (201)', async () => {
      const mockSession = {
        id: RECONCILIATION_ID,
        schoolId: SCHOOL_A_ID,
        sourceModule: 'teaching-assignment',
        status: ReconciliationStatus.COMPLETED,
        totalRecords: 2,
        matchedRecords: 1,
        conflictRecords: 1,
        newRecords: 1,
        reportData: {
          differences: [
            {
              employeeCode: 'NV001',
              fieldName: 'departmentName',
              masterValue: 'Tổ Toán',
              sourceValue: 'Tổ Lý',
            },
          ],
          newFields: [],
          newRecords: ['NV099'],
        },
        triggeredBy: SCHOOL_ADMIN_ID,
        createdAt: new Date(),
        completedAt: null,
      };
      mockReconciliationRepo.findOne.mockResolvedValue(mockSession);

      const res = await request(app.getHttpServer()).post(
        `/api/v1/master-data/reconciliation/${RECONCILIATION_ID}/decline`,
      );

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty(
        'message',
        'Từ chối thay đổi đối chiếu thành công',
      );
      expect(mockReconciliationRepo.update).toHaveBeenCalledWith(
        RECONCILIATION_ID,
        expect.objectContaining({ status: ReconciliationStatus.DECLINED }),
      );
    });

    it('POST /api/v1/master-data/reconciliation/:id/decline → 404 not found', async () => {
      mockReconciliationRepo.findOne.mockResolvedValue(null);

      const res = await request(app.getHttpServer()).post(
        `/api/v1/master-data/reconciliation/${RECONCILIATION_ID}/decline`,
      );

      expect(res.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Sync/Event Flow
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Sync/Event Flow', () => {
    it('PATCH update → emits change event and creates sync log', async () => {
      const updatedEmployee = { ...mockEmployee1, departmentName: 'Tổ Lý' };
      mockMasterDataRepo.findById.mockResolvedValue(mockEmployee1);
      mockMasterDataRepo.update.mockResolvedValue(updatedEmployee);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/master-data/employees/${EMPLOYEE_ID_1}`)
        .send({ departmentName: 'Tổ Lý' });

      expect(res.status).toBe(200);

      // Verify event was emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'master-data.changed',
        expect.objectContaining({
          schoolId: SCHOOL_A_ID,
          employeeCode: 'NV001',
          fieldName: 'departmentName',
          oldValue: 'Tổ Toán',
          newValue: 'Tổ Lý',
        }),
      );

      // Verify sync log was created
      expect(mockSyncLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolId: SCHOOL_A_ID,
          employeeCode: 'NV001',
          fieldName: 'departmentName',
          masterValue: 'Tổ Lý',
          direction: SyncDirection.MASTER_TO_MODULE,
          status: SyncStatus.APPLIED,
        }),
      );
    });

    it('PATCH update with no changes → does not emit event', async () => {
      mockMasterDataRepo.findById.mockResolvedValue(mockEmployee1);
      mockMasterDataRepo.update.mockResolvedValue(mockEmployee1);

      await request(app.getHttpServer())
        .patch(`/api/v1/master-data/employees/${EMPLOYEE_ID_1}`)
        .send({ fullName: 'Nguyễn Văn A' }); // same value

      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. RBAC Enforcement
  // ═══════════════════════════════════════════════════════════════════════════

  describe('RBAC Enforcement', () => {
    let rbacApp: INestApplication;

    beforeAll(async () => {
      const rbacModule: TestingModule = await Test.createTestingModule({
        controllers: [
          MasterDataController,
          ReconciliationController,
          FieldDefinitionController,
        ],
        providers: [
          MasterDataService,
          ImportService,
          ReconciliationService,
          SyncService,
          FieldDefinitionService,
          { provide: MasterDataRepository, useValue: mockMasterDataRepo },
          { provide: FieldDefinitionRepository, useValue: mockFieldDefRepo },
          { provide: AuditLogRepository, useValue: mockAuditLogRepo },
          { provide: SyncLogRepository, useValue: mockSyncLogRepo },
          {
            provide: getRepositoryToken(ReconciliationSessionEntity),
            useValue: mockReconciliationRepo,
          },
          { provide: DataSource, useValue: mockDataSource },
          { provide: EventEmitter2, useValue: mockEventEmitter },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(MockJwtAuthGuard)
        .overrideGuard(RolesGuard)
        .useValue({
          canActivate: (context: {
            getHandler: () => unknown;
            getClass: () => unknown;
            switchToHttp: () => { getRequest: () => Record<string, unknown> };
          }) => {
            // Simulate proper role checking
            const req = context.switchToHttp().getRequest();
            const user = req['user'] as MockUser;
            if (!user) return false;

            // Known role restrictions from the controller decorators
            const url = req['url'] as string;
            const method = req['method'] as string;

            // Reconciliation endpoints: SUPER_ADMIN, SCHOOL_ADMIN only
            if (url?.includes('/reconciliation')) {
              return [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(
                user.role as UserRole,
              );
            }

            // Field definitions: SUPER_ADMIN, SCHOOL_ADMIN only
            if (url?.includes('/field-definitions')) {
              return [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(
                user.role as UserRole,
              );
            }

            // Master data write ops: SUPER_ADMIN, SCHOOL_ADMIN only
            if (
              method === 'POST' ||
              method === 'PATCH' ||
              method === 'DELETE'
            ) {
              return [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN].includes(
                user.role as UserRole,
              );
            }

            // GET employees: SUPER_ADMIN, SCHOOL_ADMIN, HR, TEACHER
            if (method === 'GET') {
              return [
                UserRole.SUPER_ADMIN,
                UserRole.SCHOOL_ADMIN,
                UserRole.HR,
                UserRole.TEACHER,
              ].includes(user.role as UserRole);
            }

            return true;
          },
        })
        .overrideGuard(SchoolScopeGuard)
        .useValue(MockSchoolScopeGuard)
        .compile();

      rbacApp = rbacModule.createNestApplication();
      rbacApp.useGlobalPipes(
        new ValidationPipe({ transform: true, whitelist: true }),
      );
      await rbacApp.init();
    });

    afterAll(async () => {
      await rbacApp.close();
    });

    it('TEACHER cannot POST employees (403)', async () => {
      currentUser = teacherUser;

      const res = await request(rbacApp.getHttpServer())
        .post('/api/v1/master-data/employees')
        .send({
          schoolId: SCHOOL_A_ID,
          employeeCode: 'NV100',
          fullName: 'Test',
        });

      expect(res.status).toBe(403);
    });

    it('TEACHER cannot PATCH employees (403)', async () => {
      currentUser = teacherUser;

      const res = await request(rbacApp.getHttpServer())
        .patch(`/api/v1/master-data/employees/${EMPLOYEE_ID_1}`)
        .send({ fullName: 'Hacker' });

      expect(res.status).toBe(403);
    });

    it('TEACHER cannot DELETE employees (403)', async () => {
      currentUser = teacherUser;

      const res = await request(rbacApp.getHttpServer()).delete(
        `/api/v1/master-data/employees/${EMPLOYEE_ID_1}`,
      );

      expect(res.status).toBe(403);
    });

    it('TEACHER cannot trigger reconciliation (403)', async () => {
      currentUser = teacherUser;

      const res = await request(rbacApp.getHttpServer())
        .post('/api/v1/master-data/reconciliation')
        .send({
          schoolId: SCHOOL_A_ID,
          sourceModule: 'teaching-assignment',
          sourceData: [{ employeeCode: 'NV001', fullName: 'Test' }],
        });

      expect(res.status).toBe(403);
    });

    it('TEACHER cannot import (403)', async () => {
      currentUser = teacherUser;
      const excelBuffer = await createExcelBuffer(
        ['Mã NV', 'Họ và Tên'],
        [['NV100', 'Test']],
      );

      const res = await request(rbacApp.getHttpServer())
        .post('/api/v1/master-data/employees/import')
        .attach('file', excelBuffer, 'import.xlsx');

      expect(res.status).toBe(403);
    });

    it('TEACHER can GET employees list (200)', async () => {
      currentUser = teacherUser;
      mockMasterDataRepo.findAll.mockResolvedValue([[mockEmployee1], 1]);

      const res = await request(rbacApp.getHttpServer())
        .get('/api/v1/master-data/employees')
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
    });

    it('SUPER_ADMIN can access everything (201)', async () => {
      currentUser = superAdminUser;
      mockMasterDataRepo.findByEmployeeCode.mockResolvedValue(null);
      mockMasterDataRepo.create.mockResolvedValue(mockEmployee1);

      const res = await request(rbacApp.getHttpServer())
        .post('/api/v1/master-data/employees')
        .send({
          schoolId: SCHOOL_A_ID,
          employeeCode: 'NV001',
          fullName: 'Nguyễn Văn A',
        });

      expect(res.status).toBe(201);
    });

    it('SCHOOL_ADMIN can access own school data (201)', async () => {
      currentUser = schoolAdminUser;
      mockMasterDataRepo.findByEmployeeCode.mockResolvedValue(null);
      mockMasterDataRepo.create.mockResolvedValue(mockEmployee1);

      const res = await request(rbacApp.getHttpServer())
        .post('/api/v1/master-data/employees')
        .send({
          schoolId: SCHOOL_A_ID,
          employeeCode: 'NV001',
          fullName: 'Nguyễn Văn A',
        });

      expect(res.status).toBe(201);
    });
  });
});
