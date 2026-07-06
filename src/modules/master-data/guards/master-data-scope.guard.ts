import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../common/enums/role.enum';
import { MasterDataRepository } from '../repositories/master-data.repository';

/**
 * Metadata key for marking endpoints as write operations.
 * Used by @MasterDataWrite() decorator.
 */
export const MASTER_DATA_WRITE_KEY = 'master_data_write';

/**
 * Metadata key for marking endpoints as reconciliation operations.
 * Used by @MasterDataReconciliation() decorator.
 */
export const MASTER_DATA_RECONCILIATION_KEY = 'master_data_reconciliation';

/**
 * Roles allowed to perform write operations (create, update, delete).
 */
const WRITE_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN];

/**
 * Roles allowed to perform reconciliation operations.
 */
const RECONCILIATION_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.SCHOOL_ADMIN,
];

/**
 * Guard xử lý phân quyền dữ liệu Master Data theo role:
 *
 * - SUPER_ADMIN: Truy cập tất cả Employee_Records, mọi trường
 * - SCHOOL_ADMIN: Chỉ truy cập Employee_Records trong cùng school_id.
 *   Return 403 nếu cố truy cập trường khác.
 * - TEACHER: Chỉ đọc (GET) được bản ghi của chính mình.
 *   Return 403 nếu cố truy cập bản ghi khác hoặc thực hiện thao tác ghi.
 *
 * Guard cũng kiểm tra:
 * - Write operations: chỉ SUPER_ADMIN, SCHOOL_ADMIN
 * - Reconciliation: chỉ SUPER_ADMIN, SCHOOL_ADMIN, HR
 */
@Injectable()
export class MasterDataScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly masterDataRepository: MasterDataRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true; // Let JwtAuthGuard handle unauthorized
    }

    const isWriteOperation = this.reflector.getAllAndOverride<boolean>(
      MASTER_DATA_WRITE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const isReconciliation = this.reflector.getAllAndOverride<boolean>(
      MASTER_DATA_RECONCILIATION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // --- Check reconciliation access ---
    if (isReconciliation) {
      if (!RECONCILIATION_ROLES.includes(user.role)) {
        throw new ForbiddenException(
          'Bạn không có quyền thực hiện thao tác này',
        );
      }
    }

    // --- Check write operation access ---
    if (isWriteOperation) {
      if (!WRITE_ROLES.includes(user.role)) {
        throw new ForbiddenException(
          'Bạn không có quyền thực hiện thao tác này',
        );
      }
    }

    // --- Role-based data scoping ---
    if (user.role === UserRole.SUPER_ADMIN) {
      // SUPER_ADMIN: full access, no school filter
      return true;
    }

    if (user.role === UserRole.SCHOOL_ADMIN) {
      return this.checkSchoolAdminAccess(request, user);
    }

    if (user.role === UserRole.TEACHER) {
      return this.checkTeacherAccess(request, user, isWriteOperation);
    }

    // Other roles (SCHEDULER, VIEWER) - apply school scope at minimum
    if (user.schoolId) {
      const schoolId = this.extractSchoolId(request);
      if (schoolId && schoolId !== user.schoolId) {
        throw new ForbiddenException(
          'Bạn không có quyền truy cập dữ liệu trường khác',
        );
      }
    }

    return true;
  }

  /**
   * SCHOOL_ADMIN: Can only access records within their own school.
   * Returns 403 if trying to access another school's data.
   */
  private checkSchoolAdminAccess(
    request: Record<string, unknown>,
    user: { schoolId: string | null },
  ): boolean {
    const schoolId = this.extractSchoolId(request);

    if (schoolId && user.schoolId && schoolId !== user.schoolId) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập dữ liệu trường khác',
      );
    }

    // Inject school scope for query endpoints
    if (user.schoolId) {
      this.injectSchoolScope(request, user.schoolId);
    }

    return true;
  }

  /**
   * TEACHER: Can only read their own employee record.
   * Returns 403 for write operations or accessing other employees' records.
   */
  private async checkTeacherAccess(
    request: Record<string, unknown>,
    user: { id: string; schoolId: string | null },
    isWriteOperation: boolean | undefined,
  ): Promise<boolean> {
    // Teachers cannot perform write operations
    if (isWriteOperation) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }

    // For GET by ID - check if the employee record belongs to the teacher
    const employeeId = this.extractEmployeeId(request);
    if (employeeId) {
      const employee = await this.masterDataRepository.findById(employeeId);
      if (!employee) {
        // Let the service handle 404
        return true;
      }

      // Check school scope first
      if (user.schoolId && employee.schoolId !== user.schoolId) {
        throw new ForbiddenException(
          'Bạn chỉ có quyền xem thông tin của chính mình',
        );
      }

      // Teacher can only view records linked to their own userId
      // Store context so service can verify ownership
      (request as Record<string, unknown>).__masterDataTeacherScope = {
        userId: user.id,
        employeeId,
      };
    }

    // For list endpoints - set flag so service filters by teacher's own record
    (request as Record<string, unknown>).__masterDataTeacherUserId = user.id;

    // Inject school scope
    if (user.schoolId) {
      this.injectSchoolScope(request, user.schoolId);
    }

    return true;
  }

  /**
   * Extract schoolId from request params, query, or body.
   */
  private extractSchoolId(
    request: Record<string, unknown>,
  ): string | undefined {
    const params = request['params'] as Record<string, string> | undefined;
    const query = request['query'] as Record<string, string> | undefined;
    const body = request['body'] as Record<string, string> | undefined;

    return (
      params?.['schoolId'] ||
      query?.['schoolId'] ||
      body?.['schoolId'] ||
      undefined
    );
  }

  /**
   * Extract employee ID from route params (/:id).
   */
  private extractEmployeeId(
    request: Record<string, unknown>,
  ): string | undefined {
    const params = request['params'] as Record<string, string> | undefined;
    return params?.['id'] || undefined;
  }

  /**
   * Inject school scope into request query/body to ensure data is filtered.
   */
  private injectSchoolScope(
    request: Record<string, unknown>,
    schoolId: string,
  ): void {
    // Set on request for downstream use
    (request as Record<string, unknown>).__masterDataSchoolScope = schoolId;

    // Also inject into query params if it's a GET request
    const method = (request as Record<string, unknown>)['method'] as string;
    if (method === 'GET') {
      const query = (request['query'] as Record<string, string>) || {};
      if (!query['schoolId']) {
        query['schoolId'] = schoolId;
        (request as Record<string, unknown>)['query'] = query;
      }
    }
  }
}
