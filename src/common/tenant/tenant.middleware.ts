import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request, Response, NextFunction } from 'express';
import { validate as isUuid } from 'uuid';

import { TenantContextService } from './tenant-context.service';
import { TenantAuditService } from './tenant-audit.service';
import { TenantRlsService } from './tenant-rls.service';
import { TenantStore } from './tenant.interfaces';
import { UserRole } from '../enums/role.enum';
import { SchoolEntity } from '../../modules/school/entities/school.entity';
import { ContextSessionService } from '../../modules/context/services/context-session.service';
import { ContextService } from '../../modules/context/services/context.service';
import { ContextFeatureFlagService } from '../../modules/context/services/context-feature-flag.service';
import {
  GlobalViewForbiddenException,
  GlobalViewReadonlyException,
  ContextForbiddenException,
} from '../../modules/context/exceptions/context.exceptions';

/**
 * Roles that have access to only a single school (resolved from JWT directly).
 * These roles ALWAYS resolve context from JWT schoolId, ignoring X-School-Id header.
 */
const SINGLE_SCHOOL_ROLES: string[] = [
  UserRole.SCHOOL_ADMIN,
  UserRole.HR,
  UserRole.SCHEDULER,
  UserRole.VIEWER,
];

/**
 * The special header value that activates Global View mode (SUPER_ADMIN only).
 */
const GLOBAL_VIEW_HEADER = 'global';

/**
 * NestJS middleware that initializes the tenant context for each request.
 *
 * Execution order: JwtAuthGuard → TenantMiddleware → RolesGuard → Controller
 *
 * Enhanced behavior with 3-tier priority context resolution:
 * 1. X-School-Id header (highest priority) — for multi-school users only
 * 2. Redis Context_Session — server-side stored context
 * 3. JWT schoolId (lowest priority) — fallback
 *
 * Special cases:
 * - Public endpoints (no req.user): calls next() without tenant context
 * - Single-school users (SCHOOL_ADMIN, HR, SCHEDULER, VIEWER, TEACHER with 1 school):
 *   always resolve from JWT, ignore X-School-Id header
 * - X-School-Id = "global" + SUPER_ADMIN: activates Global View (isBypass=true, globalView=true)
 * - X-School-Id = "global" + non-SUPER_ADMIN: HTTP 403
 * - Redis failure (>500ms timeout): silently fall back to JWT
 * - Stale session (schoolId no longer accessible): delete session, fall back to JWT
 *
 * Backward compatibility:
 * - SUPER_ADMIN without header and without session: bypass mode (existing behavior)
 * - SchoolScopeGuard continues to read from request.schoolScope
 * - If ContextModule is unavailable: falls back to existing JWT-only logic
 *
 * Validates: Requirements 3.2, 3.3, 3.4, 3.8, 5.1, 5.4, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6,
 *            9.7, 9.8, 9.9, 9.10, 12.1, 12.2, 12.7
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantAudit: TenantAuditService,
    private readonly tenantRlsService: TenantRlsService,
    @InjectRepository(SchoolEntity)
    private readonly schoolRepository: Repository<SchoolEntity>,
    @Optional()
    private readonly contextSessionService?: ContextSessionService,
    @Optional()
    private readonly contextService?: ContextService,
    @Optional()
    private readonly featureFlagService?: ContextFeatureFlagService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const user = (req as any).user;

    // Public endpoint — no user authenticated, proceed without tenant context
    if (!user) {
      next();
      return;
    }

    const store = await this.buildTenantStore(req, user);

    // Enforce Global View GET-only restriction (Requirements 5.2, 5.3)
    if (store.globalView && req.method !== 'GET') {
      throw new GlobalViewReadonlyException();
    }

    // Set req.schoolScope for backward compatibility (Requirement 12.2, 12.4)
    this.setSchoolScope(req, store, user);

    // Set PostgreSQL session variable for RLS enforcement (Requirement 9.7)
    if (store.isBypass) {
      await this.tenantRlsService.setSessionSchoolId('BYPASS');
    } else if (store.schoolId) {
      await this.tenantRlsService.setSessionSchoolId(store.schoolId);
    }

    // Wrap the remainder of the request in tenant context
    this.tenantContext.run(store, () => {
      next();
    });
  }

  /**
   * Builds the TenantStore using 3-tier priority context resolution.
   *
   * Priority order (Requirement 9.1):
   * 1. X-School-Id header → if present and user is multi-school
   * 2. Redis Context_Session → if exists and schoolId is still accessible
   * 3. JWT schoolId → fallback
   *
   * Single-school users always resolve from JWT (Requirement 9.10).
   *
   * When feature flag is disabled (Requirement 18.1, 18.3):
   * - Skip context session resolution entirely
   * - Use JWT-only resolution (same as pre-context-switcher behavior)
   * - SUPER_ADMIN X-School-Id impersonation still works (backward compat)
   */
  private async buildTenantStore(
    req: Request,
    user: any,
  ): Promise<TenantStore> {
    const userId = user.id || user.userId || null;
    const headerSchoolId = req.headers['x-school-id'] as string | undefined;

    // Handle Global View mode: X-School-Id = "global"
    if (headerSchoolId === GLOBAL_VIEW_HEADER) {
      // Global View only works when feature flag is enabled
      if (!this.isFeatureEnabled()) {
        return this.resolveJwtFallback(user, userId);
      }
      return this.handleGlobalView(user, userId);
    }

    // Feature flag check (Requirements 18.1, 18.3):
    // When disabled, skip context session resolution, use JWT-only resolution.
    // SUPER_ADMIN header impersonation is preserved for backward compatibility.
    if (!this.isFeatureEnabled()) {
      return this.resolveWithFeatureDisabled(req, user, userId, headerSchoolId);
    }

    // Determine if user is single-school (Requirement 9.10)
    const isSingleSchool = await this.isSingleSchoolUser(user);

    if (isSingleSchool) {
      // Single-school users: always resolve from JWT, ignore X-School-Id header
      return this.resolveSingleSchoolFallback(user, userId);
    }

    // Multi-school user path: apply 3-tier priority

    // Priority 1: X-School-Id header (Requirement 9.1, 9.2)
    if (headerSchoolId) {
      return this.resolveFromHeader(headerSchoolId, user, userId);
    }

    // Priority 2: Redis Context_Session (Requirement 9.5)
    if (this.contextSessionService) {
      const sessionSchoolId = await this.resolveFromSession(user, userId);
      if (sessionSchoolId) {
        return sessionSchoolId;
      }
    }

    // Priority 3: JWT fallback (Requirement 3.4, 12.2)
    return this.resolveJwtFallback(user, userId);
  }

  /**
   * Checks if the context switcher feature is globally enabled.
   * Returns true if the feature flag service is unavailable (safe default).
   */
  private isFeatureEnabled(): boolean {
    if (!this.featureFlagService) {
      // If feature flag service is not available, default to enabled
      // to preserve existing context switcher behavior
      return true;
    }
    return this.featureFlagService.isContextSwitcherEnabled();
  }

  /**
   * Resolution logic when the context switcher feature flag is disabled.
   * Skips context session resolution entirely and uses JWT-only logic.
   * SUPER_ADMIN impersonation via X-School-Id header is still supported
   * for backward compatibility.
   *
   * Requirements 18.1, 18.3
   */
  private async resolveWithFeatureDisabled(
    req: Request,
    user: any,
    userId: string | null,
    headerSchoolId: string | undefined,
  ): Promise<TenantStore> {
    // SUPER_ADMIN can still impersonate via X-School-Id header (backward compat)
    if (headerSchoolId && user.role === UserRole.SUPER_ADMIN) {
      if (!isUuid(headerSchoolId)) {
        throw new BadRequestException({
          success: false,
          data: null,
          message: 'X-School-Id không hợp lệ. Vui lòng cung cấp UUID đúng định dạng.',
          errorCode: 'INVALID_FORMAT',
        });
      }

      const schoolExists = await this.schoolRepository.findOne({
        where: { id: headerSchoolId },
        select: ['id'],
      });

      if (!schoolExists) {
        throw new BadRequestException(
          `Trường học với ID "${headerSchoolId}" không tồn tại.`,
        );
      }

      this.tenantAudit.logImpersonation(userId ?? 'unknown', headerSchoolId);

      return {
        schoolId: headerSchoolId,
        isBypass: false,
        userId,
      };
    }

    // All other cases: use JWT fallback (pre-context-switcher behavior)
    return this.resolveJwtFallback(user, userId);
  }

  /**
   * Handles X-School-Id: "global" header.
   * Only SUPER_ADMIN can activate Global View (Requirement 5.1, 5.4).
   */
  private handleGlobalView(
    user: any,
    userId: string | null,
  ): TenantStore {
    if (user.role !== UserRole.SUPER_ADMIN) {
      throw new GlobalViewForbiddenException();
    }

    // SUPER_ADMIN Global View mode (Requirement 5.1, 5.5, 9.9)
    return {
      schoolId: null,
      isBypass: true,
      userId,
      globalView: true,
    };
  }

  /**
   * Determines if the user has single-school access.
   * Single-school roles: SCHOOL_ADMIN, HR, SCHEDULER, VIEWER.
   * TEACHER with exactly 1 accessible school is also single-school.
   *
   * Requirement 9.10.
   */
  private async isSingleSchoolUser(user: any): Promise<boolean> {
    // SCHOOL_ADMIN, HR, SCHEDULER, VIEWER are always single-school
    if (SINGLE_SCHOOL_ROLES.includes(user.role)) {
      return true;
    }

    // TEACHER: check accessible schools count
    if (user.role === UserRole.TEACHER) {
      // Use accessibleSchoolIds from JWT if available
      if (user.accessibleSchoolIds && user.accessibleSchoolIds.length <= 1) {
        return true;
      }
      // If accessibleSchoolIds has more than 1, teacher is multi-school
      if (user.accessibleSchoolIds && user.accessibleSchoolIds.length > 1) {
        return false;
      }
      // Fallback: no accessibleSchoolIds in JWT means single-school
      return true;
    }

    // SUPER_ADMIN, COMPANY_ADMIN, HOLDING_ADMIN are always multi-school
    return false;
  }

  /**
   * Resolves context for single-school users directly from JWT.
   * Ignores X-School-Id header completely (Requirement 9.10).
   */
  private resolveSingleSchoolFallback(
    user: any,
    userId: string | null,
  ): TenantStore {
    return {
      schoolId: user.schoolId || null,
      isBypass: false,
      userId,
    };
  }

  /**
   * Resolves context from X-School-Id header for multi-school users.
   * Validates UUID format and checks the school is in user's accessible list.
   *
   * For SUPER_ADMIN: validates school exists in DB (backward compat with existing behavior).
   * For other multi-school users: validates school is in their computed accessible list.
   *
   * Requirements 9.2, 9.3, 9.4, 12.1
   */
  private async resolveFromHeader(
    headerSchoolId: string,
    user: any,
    userId: string | null,
  ): Promise<TenantStore> {
    // Validate UUID format (Requirement 9.4)
    if (!isUuid(headerSchoolId)) {
      throw new BadRequestException({
        success: false,
        data: null,
        message: 'X-School-Id không hợp lệ. Vui lòng cung cấp UUID đúng định dạng.',
        errorCode: 'INVALID_FORMAT',
      });
    }

    // SUPER_ADMIN: validate school exists (Requirement 12.1 — preserve impersonation behavior)
    if (user.role === UserRole.SUPER_ADMIN) {
      return this.resolveSuperAdminHeader(headerSchoolId, userId);
    }

    // Non-SUPER_ADMIN multi-school: validate against accessible schools (Requirement 9.2)
    const accessible = await this.computeAccessibleForUser(user);

    if (!accessible.includes(headerSchoolId)) {
      // Return 403 without revealing whether the school exists (Requirement 9.3, 10.4)
      throw new ContextForbiddenException();
    }

    return {
      schoolId: headerSchoolId,
      isBypass: false,
      userId,
    };
  }

  /**
   * Resolves header for SUPER_ADMIN.
   * SUPER_ADMIN has access to all schools — just validate the school exists.
   * Preserves existing impersonation behavior (Requirement 12.1).
   */
  private async resolveSuperAdminHeader(
    headerSchoolId: string,
    userId: string | null,
  ): Promise<TenantStore> {
    // If ContextService is available, validate against computed accessible schools
    if (this.contextService) {
      const accessible = await this.computeAccessibleForUser({
        id: userId,
        role: UserRole.SUPER_ADMIN,
        schoolId: null,
      });

      if (accessible.length > 0 && !accessible.includes(headerSchoolId)) {
        throw new ContextForbiddenException();
      }
    }

    // Fallback / backward compat: validate school exists in DB
    const schoolExists = await this.schoolRepository.findOne({
      where: { id: headerSchoolId },
      select: ['id'],
    });

    if (!schoolExists) {
      throw new BadRequestException(
        `Trường học với ID "${headerSchoolId}" không tồn tại.`,
      );
    }

    // Log impersonation event (existing behavior, Requirement 12.1)
    this.tenantAudit.logImpersonation(userId ?? 'unknown', headerSchoolId);

    return {
      schoolId: headerSchoolId,
      isBypass: false,
      userId,
    };
  }

  /**
   * Resolves context from Redis Context_Session.
   * Returns a TenantStore if the session is valid, or null to fall through to JWT.
   *
   * Validates that the stored schoolId is still accessible (Requirement 3.8).
   * On Redis failure (>500ms timeout): silently returns null (Requirement 9.6).
   *
   * Requirements 9.5, 3.8
   */
  private async resolveFromSession(
    user: any,
    userId: string | null,
  ): Promise<TenantStore | null> {
    if (!this.contextSessionService) {
      return null;
    }

    // getActiveContext already has 500ms timeout; returns null on failure
    const sessionSchoolId = await this.contextSessionService.getActiveContext(
      user.id || user.userId,
    );

    if (!sessionSchoolId) {
      return null;
    }

    // Handle stored "global" session for SUPER_ADMIN (Requirement 9.9)
    if (sessionSchoolId === GLOBAL_VIEW_HEADER) {
      if (user.role === UserRole.SUPER_ADMIN) {
        return {
          schoolId: null,
          isBypass: true,
          userId,
          globalView: true,
        };
      }
      // Non-SUPER_ADMIN with stale "global" session — delete and fall through
      await this.contextSessionService.deleteSession(user.id || user.userId);
      return null;
    }

    // Validate stored schoolId is still accessible (Requirement 3.8)
    const accessible = await this.computeAccessibleForUser(user);

    if (!accessible.includes(sessionSchoolId)) {
      // Stale session — delete and fall back to JWT (Requirement 3.8)
      this.logger.warn(
        `Stale context session detected for user ${user.id || user.userId}: ` +
        `schoolId=${sessionSchoolId} is no longer accessible. Deleting session.`,
      );
      await this.contextSessionService.deleteSession(user.id || user.userId);
      return null;
    }

    // Session is valid — refresh TTL (Requirement 3.5)
    await this.contextSessionService.refreshTtl(user.id || user.userId);

    return {
      schoolId: sessionSchoolId,
      isBypass: false,
      userId,
    };
  }

  /**
   * Fallback context resolution from JWT claims.
   * Preserves existing behavior:
   * - SUPER_ADMIN without context: bypass mode (schoolId=null, isBypass=true)
   * - Others: use JWT schoolId
   *
   * Requirements 3.4, 12.2
   */
  private resolveJwtFallback(
    user: any,
    userId: string | null,
  ): TenantStore {
    // SUPER_ADMIN fallback: bypass mode (existing behavior, Requirement 12.2)
    if (user.role === UserRole.SUPER_ADMIN) {
      return {
        schoolId: null,
        isBypass: true,
        userId,
      };
    }

    // Non-SUPER_ADMIN: use JWT schoolId
    return {
      schoolId: user.schoolId || null,
      isBypass: false,
      userId,
    };
  }

  /**
   * Computes accessible school IDs for a user.
   * Uses ContextService if available; otherwise falls back to
   * simpler logic based on JWT claims (Requirement 12.7).
   */
  private async computeAccessibleForUser(user: any): Promise<string[]> {
    // If ContextService is available, use its full computation logic
    if (this.contextService) {
      try {
        return await this.contextService.computeAccessibleSchoolIds({
          id: user.id || user.userId,
          email: user.email,
          role: user.role,
          schoolId: user.schoolId || null,
          accessibleSchoolIds: user.accessibleSchoolIds,
          companySchoolId: user.companySchoolId,
        });
      } catch (error) {
        this.logger.error(
          `ContextService.computeAccessibleSchoolIds failed for user ${user.id || user.userId}, ` +
          `falling back to JWT claims`,
          error instanceof Error ? error.stack : String(error),
        );
        // Fall through to JWT-based fallback
      }
    }

    // Fallback: compute from JWT claims (Requirement 12.7)
    return this.computeAccessibleFromJwt(user);
  }

  /**
   * Fallback computation of accessible schools from JWT claims only.
   * Used when ContextService is unavailable or fails.
   */
  private computeAccessibleFromJwt(user: any): string[] {
    // SUPER_ADMIN: all schools (we can't compute without DB, return empty to force fallback)
    if (user.role === UserRole.SUPER_ADMIN) {
      // For SUPER_ADMIN, an empty accessible list means "all schools" in header validation
      // Since SUPER_ADMIN already has bypass, we'll return a special behavior
      // In practice SUPER_ADMIN with a header will already be validated via ContextService
      return [];
    }

    // Use accessibleSchoolIds from JWT if present
    if (user.accessibleSchoolIds && user.accessibleSchoolIds.length > 0) {
      return user.accessibleSchoolIds;
    }

    // Single school from JWT
    if (user.schoolId) {
      return [user.schoolId];
    }

    return [];
  }

  /**
   * Sets req.schoolScope for backward compatibility with SchoolScopeGuard.
   *
   * - bypass (SUPER_ADMIN): schoolScope = null
   * - multi-school users: schoolScope = accessible school IDs array or resolved schoolId
   * - single-school users: schoolScope = [schoolId] or resolved schoolId
   *
   * Requirement 12.4
   */
  private setSchoolScope(
    req: Request,
    store: TenantStore,
    user: any,
  ): void {
    if (store.isBypass) {
      (req as any).schoolScope = null;
    } else {
      (req as any).schoolScope = store.schoolId;
    }
  }
}
