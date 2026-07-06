import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  Logger,
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

/**
 * NestJS middleware that initializes the tenant context for each request.
 *
 * Execution order: JwtAuthGuard → TenantMiddleware → RolesGuard → Controller
 *
 * Behavior:
 * - Public endpoints (no req.user): calls next() without tenant context
 * - SUPER_ADMIN without X-School-Id: sets isBypass = true (unfiltered access)
 * - SUPER_ADMIN with X-School-Id: validates school exists, sets schoolId
 * - Non-SUPER_ADMIN: sets schoolId from req.user.schoolId, ignores X-School-Id header
 * - Sets req.schoolScope for backward compatibility with SchoolScopeGuard
 *
 * Validates: Requirements 1.1, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2
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
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const user = (req as any).user;

    // Public endpoint — no user authenticated, proceed without tenant context
    if (!user) {
      next();
      return;
    }

    const store = await this.buildTenantStore(req, user);

    // Set req.schoolScope for backward compatibility (Requirement 6.2)
    (req as any).schoolScope = store.schoolId;

    // Set PostgreSQL session variable for RLS enforcement (Requirements 4.3, 4.4)
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
   * Builds the TenantStore based on the authenticated user and request headers.
   */
  private async buildTenantStore(
    req: Request,
    user: any,
  ): Promise<TenantStore> {
    const userId = user.id || user.userId || null;

    // SUPER_ADMIN handling (Requirements 5.1, 5.2, 5.4, 5.5)
    if (user.role === UserRole.SUPER_ADMIN) {
      return this.buildSuperAdminStore(req, userId);
    }

    // Non-SUPER_ADMIN: use schoolId from JWT, ignore X-School-Id header (Requirement 5.3)
    return {
      schoolId: user.schoolId || null,
      isBypass: false,
      userId,
    };
  }

  /**
   * Builds tenant store for SUPER_ADMIN users.
   * - Without X-School-Id header: bypass mode (unfiltered access)
   * - With X-School-Id header: validates school and sets impersonation context
   */
  private async buildSuperAdminStore(
    req: Request,
    userId: string | null,
  ): Promise<TenantStore> {
    const headerSchoolId = req.headers['x-school-id'] as string | undefined;

    // No X-School-Id header → bypass mode (Requirement 5.1)
    if (!headerSchoolId) {
      return {
        schoolId: null,
        isBypass: true,
        userId,
      };
    }

    // Validate UUID format (Requirement 5.4)
    if (!isUuid(headerSchoolId)) {
      throw new BadRequestException(
        'X-School-Id không hợp lệ. Vui lòng cung cấp UUID đúng định dạng.',
      );
    }

    // Validate school exists (Requirement 5.4)
    const schoolExists = await this.schoolRepository.findOne({
      where: { id: headerSchoolId },
      select: ['id'],
    });

    if (!schoolExists) {
      throw new BadRequestException(
        `Trường học với ID "${headerSchoolId}" không tồn tại.`,
      );
    }

    // Log impersonation event (Requirement 8.3)
    this.tenantAudit.logImpersonation(userId ?? 'unknown', headerSchoolId);

    // Impersonation mode: set schoolId to header value (Requirement 5.2)
    return {
      schoolId: headerSchoolId,
      isBypass: false,
      userId,
    };
  }
}
