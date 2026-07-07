import { TenantContextService } from '../../src/common/tenant/tenant-context.service';
import { TenantSubscriber } from '../../src/common/tenant/tenant.subscriber';
import { TenantAuditService } from '../../src/common/tenant/tenant-audit.service';
import { TenantRlsService } from '../../src/common/tenant/tenant-rls.service';
import { TenantBaseEntity } from '../../src/common/tenant/tenant-base.entity';
import { runWithTenantContext } from '../../src/common/tenant/utils/run-with-tenant-context';
import { TenantContextRequiredError } from '../../src/common/tenant/exceptions/tenant-context-required.error';
import { DataSource, EntityMetadata, SelectQueryBuilder } from 'typeorm';
import { Column, Entity } from 'typeorm';

// ─── Test Constants ─────────────────────────────────────────────────────────

const SCHOOL_A_ID = 'aaaaaaaa-1111-4aaa-aaaa-aaaaaaaaaaaa';
const SCHOOL_B_ID = 'bbbbbbbb-2222-4bbb-bbbb-bbbbbbbbbbbb';
const USER_A_ID = 'user-aaaa-0001-4aaa-aaaa-aaaaaaaaaaaa';
const SUPER_ADMIN_ID = 'admin-001-0001-4aaa-aaaa-aaaaaaaaaaaa';

// ─── Mock Entity ────────────────────────────────────────────────────────────

@Entity('mock_teachers')
class MockTeacherEntity extends TenantBaseEntity {
  @Column({ nullable: true })
  fullName: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockDataSource(): jest.Mocked<DataSource> {
  return {
    subscribers: [],
    query: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<DataSource>;
}

function createMockQueryBuilder(
  entityMetadata: Partial<EntityMetadata>,
): jest.Mocked<SelectQueryBuilder<MockTeacherEntity>> {
  const qb = {
    andWhere: jest.fn().mockReturnThis(),
    expressionMap: {
      mainAlias: {
        metadata: entityMetadata as EntityMetadata,
      },
    },
  } as unknown as jest.Mocked<SelectQueryBuilder<MockTeacherEntity>>;
  return qb;
}

function createTenantEntityMetadata(): Partial<EntityMetadata> {
  return {
    name: 'MockTeacherEntity',
    target: MockTeacherEntity,
    columns: [],
    relations: [],
  } as unknown as Partial<EntityMetadata>;
}

/**
 * Integration Tests: Complete Tenant Isolation Flow
 *
 * Tests the interaction between TenantContextService, TenantSubscriber,
 * TenantRlsService, and runWithTenantContext working together to enforce
 * multi-tenant isolation.
 *
 * Validates: Requirements 2.1, 4.2, 5.1, 5.2, 7.3
 */
describe('Tenant Isolation Flow (Integration)', () => {
  let tenantContext: TenantContextService;
  let tenantSubscriber: TenantSubscriber;
  let tenantAudit: TenantAuditService;
  let tenantRlsService: TenantRlsService;
  let mockDataSource: jest.Mocked<DataSource>;

  beforeEach(() => {
    tenantContext = new TenantContextService();
    tenantAudit = new TenantAuditService(tenantContext);
    mockDataSource = createMockDataSource();
    tenantSubscriber = new TenantSubscriber(
      mockDataSource,
      tenantContext,
      tenantAudit,
    );
    tenantRlsService = new TenantRlsService(
      mockDataSource as unknown as DataSource,
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 1: User from school A cannot access school B data
  // Validates: Requirement 2.1
  // ─────────────────────────────────────────────────────────────────────────

  describe('User from school A cannot access school B data', () => {
    it('should filter queries to school A only when context is set to school A', () => {
      const metadata = createTenantEntityMetadata();
      const qb = createMockQueryBuilder(metadata);

      tenantContext.run(
        { schoolId: SCHOOL_A_ID, isBypass: false, userId: USER_A_ID },
        () => {
          tenantSubscriber.applyTenantFilter(qb, 'teacher');

          expect(qb.andWhere).toHaveBeenCalledWith(
            'teacher.school_id = :tenantSchoolId',
            { tenantSchoolId: SCHOOL_A_ID },
          );
        },
      );
    });

    it('should not include school B ID in the filter when user belongs to school A', () => {
      const metadata = createTenantEntityMetadata();
      const qb = createMockQueryBuilder(metadata);

      tenantContext.run(
        { schoolId: SCHOOL_A_ID, isBypass: false, userId: USER_A_ID },
        () => {
          tenantSubscriber.applyTenantFilter(qb, 'teacher');

          // Verify the filter uses school A, not school B
          const callArgs = (qb.andWhere as jest.Mock).mock.calls[0];
          expect(callArgs[1].tenantSchoolId).toBe(SCHOOL_A_ID);
          expect(callArgs[1].tenantSchoolId).not.toBe(SCHOOL_B_ID);
        },
      );
    });

    it('should prevent cross-tenant access by always using current context schoolId', () => {
      const metadata = createTenantEntityMetadata();

      // First query in school A context
      const qbA = createMockQueryBuilder(metadata);
      tenantContext.run(
        { schoolId: SCHOOL_A_ID, isBypass: false, userId: USER_A_ID },
        () => {
          tenantSubscriber.applyTenantFilter(qbA, 'teacher');
        },
      );

      // Second query in school B context
      const qbB = createMockQueryBuilder(metadata);
      tenantContext.run(
        { schoolId: SCHOOL_B_ID, isBypass: false, userId: 'user-b-001' },
        () => {
          tenantSubscriber.applyTenantFilter(qbB, 'teacher');
        },
      );

      const callArgsA = (qbA.andWhere as jest.Mock).mock.calls[0];
      const callArgsB = (qbB.andWhere as jest.Mock).mock.calls[0];
      expect(callArgsA[1].tenantSchoolId).toBe(SCHOOL_A_ID);
      expect(callArgsB[1].tenantSchoolId).toBe(SCHOOL_B_ID);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: Super Admin bypass returns all schools' data
  // Validates: Requirement 5.1
  // ─────────────────────────────────────────────────────────────────────────

  describe('Super Admin bypass returns all schools data', () => {
    it('should NOT append school_id filter when bypass mode is active', () => {
      const metadata = createTenantEntityMetadata();
      const qb = createMockQueryBuilder(metadata);

      tenantContext.run(
        { schoolId: null, isBypass: true, userId: SUPER_ADMIN_ID },
        () => {
          tenantSubscriber.applyTenantFilter(qb, 'teacher');

          // No WHERE clause should be appended in bypass mode
          expect(qb.andWhere).not.toHaveBeenCalled();
        },
      );
    });

    it('should confirm context is in bypass mode for Super Admin without X-School-Id', () => {
      tenantContext.run(
        { schoolId: null, isBypass: true, userId: SUPER_ADMIN_ID },
        () => {
          expect(tenantContext.isBypass()).toBe(true);
          expect(tenantContext.getSchoolId()).toBeNull();
        },
      );
    });

    it('should allow INSERT without auto-populate school_id in bypass mode', () => {
      const metadata = createTenantEntityMetadata();
      const entity = new MockTeacherEntity();
      entity.fullName = 'Test Teacher';
      entity.schoolId = SCHOOL_A_ID; // explicitly set

      tenantContext.run(
        { schoolId: null, isBypass: true, userId: SUPER_ADMIN_ID },
        () => {
          const insertEvent = {
            metadata: metadata as EntityMetadata,
            entity,
          } as any;

          // Should not throw and should not modify schoolId
          tenantSubscriber.beforeInsert(insertEvent);
          expect(entity.schoolId).toBe(SCHOOL_A_ID);
        },
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3: Super Admin impersonation returns single school data
  // Validates: Requirement 5.2
  // ─────────────────────────────────────────────────────────────────────────

  describe('Super Admin impersonation returns single school data', () => {
    it('should filter to target school when Super Admin impersonates via X-School-Id', () => {
      const metadata = createTenantEntityMetadata();
      const qb = createMockQueryBuilder(metadata);

      // Simulate impersonation: isBypass=false, schoolId=target school
      tenantContext.run(
        { schoolId: SCHOOL_B_ID, isBypass: false, userId: SUPER_ADMIN_ID },
        () => {
          tenantSubscriber.applyTenantFilter(qb, 'teacher');

          expect(qb.andWhere).toHaveBeenCalledWith(
            'teacher.school_id = :tenantSchoolId',
            { tenantSchoolId: SCHOOL_B_ID },
          );
        },
      );
    });

    it('should restrict queries to impersonated school only, not all schools', () => {
      const metadata = createTenantEntityMetadata();
      const qb = createMockQueryBuilder(metadata);

      tenantContext.run(
        { schoolId: SCHOOL_B_ID, isBypass: false, userId: SUPER_ADMIN_ID },
        () => {
          tenantSubscriber.applyTenantFilter(qb, 'teacher');

          // Should NOT be in bypass mode
          expect(tenantContext.isBypass()).toBe(false);
          // Should filter to the impersonated school
          expect(tenantContext.getSchoolId()).toBe(SCHOOL_B_ID);
        },
      );
    });

    it('should auto-populate school_id on INSERT with impersonated school context', () => {
      const metadata = createTenantEntityMetadata();
      const entity = new MockTeacherEntity();
      entity.fullName = 'New Teacher';
      // schoolId intentionally NOT set

      tenantContext.run(
        { schoolId: SCHOOL_B_ID, isBypass: false, userId: SUPER_ADMIN_ID },
        () => {
          const insertEvent = {
            metadata: metadata as EntityMetadata,
            entity,
          } as any;

          tenantSubscriber.beforeInsert(insertEvent);
          expect(entity.schoolId).toBe(SCHOOL_B_ID);
        },
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 4: Background job with runWithTenantContext accesses correct data
  // Validates: Requirement 7.3
  // ─────────────────────────────────────────────────────────────────────────

  describe('Background job with runWithTenantContext accesses correct data', () => {
    it('should establish tenant context for background job execution', async () => {
      let capturedSchoolId: string | null | undefined;

      await runWithTenantContext(tenantContext, SCHOOL_A_ID, async () => {
        capturedSchoolId = tenantContext.getSchoolId();
      });

      expect(capturedSchoolId).toBe(SCHOOL_A_ID);
    });

    it('should allow TenantSubscriber to filter correctly within runWithTenantContext', async () => {
      const metadata = createTenantEntityMetadata();
      const qb = createMockQueryBuilder(metadata);

      await runWithTenantContext(tenantContext, SCHOOL_A_ID, async () => {
        tenantSubscriber.applyTenantFilter(qb, 'teacher');
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'teacher.school_id = :tenantSchoolId',
        { tenantSchoolId: SCHOOL_A_ID },
      );
    });

    it('should isolate concurrent background jobs with different schoolIds', async () => {
      const metadata = createTenantEntityMetadata();
      const results: string[] = [];

      await Promise.all([
        runWithTenantContext(tenantContext, SCHOOL_A_ID, async () => {
          // Simulate some async work
          await new Promise((resolve) => setTimeout(resolve, 10));
          results.push(`A:${tenantContext.getSchoolId()}`);
        }),
        runWithTenantContext(tenantContext, SCHOOL_B_ID, async () => {
          // Simulate some async work
          await new Promise((resolve) => setTimeout(resolve, 5));
          results.push(`B:${tenantContext.getSchoolId()}`);
        }),
      ]);

      expect(results).toContain(`A:${SCHOOL_A_ID}`);
      expect(results).toContain(`B:${SCHOOL_B_ID}`);
    });

    it('should not have active context after runWithTenantContext completes', async () => {
      await runWithTenantContext(tenantContext, SCHOOL_A_ID, async () => {
        expect(tenantContext.isActive()).toBe(true);
      });

      expect(tenantContext.isActive()).toBe(false);
      expect(tenantContext.getStore()).toBeUndefined();
    });

    it('should set isBypass to false within runWithTenantContext', async () => {
      await runWithTenantContext(tenantContext, SCHOOL_A_ID, async () => {
        expect(tenantContext.isBypass()).toBe(false);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 5: RLS blocks cross-tenant access at DB level
  // Validates: Requirement 4.2
  // ─────────────────────────────────────────────────────────────────────────

  describe('RLS blocks cross-tenant access at DB level', () => {
    it('should call SET LOCAL with correct schoolId for normal user context', async () => {
      await tenantRlsService.setSessionSchoolId(SCHOOL_A_ID);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        `SET LOCAL app.current_school_id = '${SCHOOL_A_ID}'`,
      );
    });

    it('should call SET LOCAL with BYPASS for Super Admin bypass mode', async () => {
      await tenantRlsService.setSessionSchoolId('BYPASS');

      expect(mockDataSource.query).toHaveBeenCalledWith(
        `SET LOCAL app.current_school_id = 'BYPASS'`,
      );
    });

    it('should issue correct SET LOCAL when context transitions between schools', async () => {
      // First request: school A
      await tenantRlsService.setSessionSchoolId(SCHOOL_A_ID);
      // Second request: school B
      await tenantRlsService.setSessionSchoolId(SCHOOL_B_ID);

      expect(mockDataSource.query).toHaveBeenNthCalledWith(
        1,
        `SET LOCAL app.current_school_id = '${SCHOOL_A_ID}'`,
      );
      expect(mockDataSource.query).toHaveBeenNthCalledWith(
        2,
        `SET LOCAL app.current_school_id = '${SCHOOL_B_ID}'`,
      );
    });

    it('should integrate RLS with tenant context in full request flow', async () => {
      tenantContext.run(
        { schoolId: SCHOOL_A_ID, isBypass: false, userId: USER_A_ID },
        async () => {
          const currentSchoolId = tenantContext.getSchoolId();
          await tenantRlsService.setSessionSchoolId(currentSchoolId!);

          expect(mockDataSource.query).toHaveBeenCalledWith(
            `SET LOCAL app.current_school_id = '${SCHOOL_A_ID}'`,
          );
        },
      );
    });

    it('should clear session variable via clearSessionSchoolId', async () => {
      await tenantRlsService.clearSessionSchoolId();

      expect(mockDataSource.query).toHaveBeenCalledWith(
        'RESET app.current_school_id',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // End-to-end flow: Full request lifecycle simulation
  // ─────────────────────────────────────────────────────────────────────────

  describe('Full request lifecycle simulation', () => {
    it('should enforce complete tenant isolation from middleware through subscriber', async () => {
      const metadata = createTenantEntityMetadata();
      const qb = createMockQueryBuilder(metadata);

      // Simulate full middleware flow:
      // 1. Middleware sets context
      // 2. RLS session variable is set
      // 3. Subscriber filters query
      await new Promise<void>((resolve) => {
        tenantContext.run(
          { schoolId: SCHOOL_A_ID, isBypass: false, userId: USER_A_ID },
          async () => {
            // Step 2: RLS is set
            await tenantRlsService.setSessionSchoolId(SCHOOL_A_ID);

            // Step 3: Subscriber filters
            tenantSubscriber.applyTenantFilter(qb, 'teacher');

            // Verify both layers are aligned
            expect(mockDataSource.query).toHaveBeenCalledWith(
              `SET LOCAL app.current_school_id = '${SCHOOL_A_ID}'`,
            );
            expect(qb.andWhere).toHaveBeenCalledWith(
              'teacher.school_id = :tenantSchoolId',
              { tenantSchoolId: SCHOOL_A_ID },
            );
            resolve();
          },
        );
      });
    });

    it('should throw TenantContextRequiredError when no context is set', () => {
      const metadata = createTenantEntityMetadata();
      const qb = createMockQueryBuilder(metadata);

      // No context set — should throw
      expect(() => {
        tenantSubscriber.applyTenantFilter(qb, 'teacher');
      }).toThrow(TenantContextRequiredError);
    });
  });
});
