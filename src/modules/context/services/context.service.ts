import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { validate as isUuid } from 'uuid';
import { randomUUID } from 'crypto';
import { SchoolRepository } from '../../school/school.repository';
import { TeacherSchoolAssignmentService } from '../../teacher-school-assignment/teacher-school-assignment.service';
import { ContextSessionService } from './context-session.service';
import { AuditLogService } from '../../audit/services/audit-log.service';
import { HierarchyService } from '../../school/services/hierarchy.service';
import { UserRole } from '../../../common/enums/role.enum';
import { SchoolStatus } from '../../../common/enums/status.enum';
import { SchoolEntity } from '../../school/entities/school.entity';
import { ContextForbiddenException, SchoolInactiveException } from '../exceptions/context.exceptions';
import { WorkspaceChangedEvent } from '../events/workspace-changed.event';
import { IsNull, In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessibleSchoolDto, CurrentContextResponseDto } from '../interfaces/context.interfaces';

/** Maximum number of schools returned by computeAccessibleSchoolIds */
const MAX_ACCESSIBLE_SCHOOLS = 50;

/** Roles that are limited to a single school from their JWT schoolId */
const SINGLE_SCHOOL_ROLES: string[] = [
  UserRole.SCHOOL_ADMIN,
  UserRole.HR,
  UserRole.SCHEDULER,
  UserRole.VIEWER,
];

/**
 * Extended JwtUser interface for context operations.
 * Mirrors the JWT payload with optional companySchoolId for COMPANY_ADMIN users.
 */
export interface ContextJwtUser {
  id: string;
  email?: string;
  role: string;
  schoolId: string | null;
  accessibleSchoolIds?: string[];
  companySchoolId?: string | null;
}

/**
 * ContextService — Core business logic for workspace context management.
 *
 * Responsible for computing accessible schools based on user role,
 * validating context switches, and retrieving current context.
 */
@Injectable()
export class ContextService {
  private readonly logger = new Logger(ContextService.name);

  constructor(
    private readonly schoolRepository: SchoolRepository,
    @InjectRepository(SchoolEntity)
    private readonly schoolEntityRepository: Repository<SchoolEntity>,
    private readonly teacherSchoolAssignmentService: TeacherSchoolAssignmentService,
    private readonly contextSessionService: ContextSessionService,
    private readonly auditLogService: AuditLogService,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly hierarchyService?: HierarchyService,
  ) {}

  /**
   * Computes accessible school IDs for a user based on their role.
   *
   * **IMPORTANT: No caching applied.**
   * This method queries the database on every call to ensure real-time accuracy.
   * Do NOT add caching without consulting Requirements 4.7 and 8.5 — the system
   * must reflect permission and status changes within 5 seconds of persistence.
   *
   * Role-based logic:
   * - SCHOOL_ADMIN, HR, SCHEDULER, VIEWER → single school from JWT schoolId (if ACTIVE)
   * - TEACHER → schools from accessibleSchoolIds JWT claim, fallback to TeacherSchoolAssignment records (if ACTIVE)
   * - COMPANY_ADMIN → company node + children where parentSchoolId = user.companySchoolId (if ACTIVE)
   * - SUPER_ADMIN → all active schools
   *
   * Results are capped at MAX_ACCESSIBLE_SCHOOLS (50).
   *
   * Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.8, 4.7, 7.2, 7.6, 7.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.7
   */
  async computeAccessibleSchoolIds(user: ContextJwtUser): Promise<string[]> {
    const role = user.role;

    // Single-school roles: SCHOOL_ADMIN, HR, SCHEDULER, VIEWER
    if (SINGLE_SCHOOL_ROLES.includes(role)) {
      return this.computeSingleSchoolAccess(user);
    }

    // TEACHER: accessibleSchoolIds from JWT or TeacherSchoolAssignment records
    if (role === UserRole.TEACHER) {
      return this.computeTeacherAccess(user);
    }

    // COMPANY_ADMIN: company node + children
    if (role === UserRole.COMPANY_ADMIN) {
      return this.computeCompanyAdminAccess(user);
    }

    // SUPER_ADMIN: all active schools
    if (role === UserRole.SUPER_ADMIN) {
      return this.computeSuperAdminAccess();
    }

    // Unknown role: return empty
    this.logger.warn(
      `Unknown role "${role}" for user ${user.id} — returning empty accessible schools`,
    );
    return [];
  }

  /**
   * Retrieves the full accessible schools list with hierarchy information.
   *
   * **Dynamic Recomputation (Requirements 4.7, 8.5):**
   * This method performs a fresh database query on every invocation — NO caching is applied
   * to the accessible schools computation or the result. This guarantees that:
   * - Role/assignment changes are reflected within the DB replication lag (< 5 seconds)
   * - School status changes (ACTIVE → INACTIVE) are excluded on the very next call
   * - Permission changes are picked up immediately without cache invalidation
   *
   * Implementation steps:
   * 1. Compute accessible school IDs via computeAccessibleSchoolIds() — queries DB directly
   * 2. Query SchoolEntity records for those IDs, filtering status = ACTIVE
   * 3. Derive hierarchyLevel for each school based on parentSchoolId and children
   * 4. Sort by name ascending (alphabetical)
   * 5. Compute canSwitch = schools.length >= 2
   * 6. Return { schools, canSwitch }
   *
   * Validates: Requirements 1.1, 1.6, 1.7, 1.8, 1.9, 1.10, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 8.5
   */
  async getAccessibleSchools(
    user: ContextJwtUser,
  ): Promise<{ schools: AccessibleSchoolDto[]; canSwitch: boolean }> {
    // Step 1: Compute accessible school IDs
    const accessibleIds = await this.computeAccessibleSchoolIds(user);

    // Return empty array if no accessible schools
    if (accessibleIds.length === 0) {
      return { schools: [], canSwitch: false };
    }

    // Step 2: Query SchoolEntity records for those IDs
    const schools = await this.schoolEntityRepository.find({
      where: {
        id: In(accessibleIds),
        status: SchoolStatus.ACTIVE,
        deletedAt: IsNull(),
      },
    });

    if (schools.length === 0) {
      return { schools: [], canSwitch: false };
    }

    // Step 3: Derive hierarchyLevel for each school
    // Determine which schools have children by checking if any school's parentSchoolId matches
    const schoolIds = schools.map((s) => s.id);
    const schoolsWithChildren = await this.findSchoolIdsWithChildren(schoolIds);

    const accessibleSchoolDtos: AccessibleSchoolDto[] = schools.map(
      (school) => ({
        id: school.id,
        code: school.code,
        name: school.name,
        hierarchyLevel: this.deriveHierarchyLevel(
          school,
          schoolsWithChildren,
        ),
      }),
    );

    // Step 4: Sort by name ascending (alphabetical)
    accessibleSchoolDtos.sort((a, b) => a.name.localeCompare(b.name));

    // Step 5: Compute canSwitch
    const canSwitch = accessibleSchoolDtos.length >= 2;

    // Step 6: Return result
    return { schools: accessibleSchoolDtos, canSwitch };
  }

  /**
   * Retrieves the user's current active context.
   *
   * Resolution priority:
   *   1. ContextSessionService.getActiveContext(userId) — Redis session
   *   2. user.schoolId from JWT — fallback
   *
   * Returns the full CurrentContextResponseDto with:
   * - activeSchoolId, activeSchoolName, activeSchoolCode (from resolved school)
   * - globalView = false (Global View handled at middleware level)
   * - role = user.role
   * - canSwitch = accessibleSchools.length >= 2
   * - contextRequired = true if no context is available
   *
   * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
   */
  async getCurrentContext(
    user: ContextJwtUser,
  ): Promise<CurrentContextResponseDto> {
    // Step 1: Resolve active context — session takes priority over JWT
    const sessionSchoolId =
      await this.contextSessionService.getActiveContext(user.id);
    const resolvedSchoolId = sessionSchoolId ?? user.schoolId;

    // Step 2: Compute accessible schools to determine canSwitch
    const accessibleIds = await this.computeAccessibleSchoolIds(user);
    const canSwitch = accessibleIds.length >= 2;

    // Step 3: If resolved schoolId exists, fetch school details
    if (resolvedSchoolId) {
      const school =
        await this.schoolRepository.findById(resolvedSchoolId);

      if (school && school.status === SchoolStatus.ACTIVE) {
        return {
          activeSchoolId: school.id,
          activeSchoolName: school.name,
          activeSchoolCode: school.code,
          globalView: false,
          role: user.role as UserRole,
          canSwitch,
          contextRequired: false,
        };
      }
    }

    // Step 4: No resolved schoolId or school not found/inactive
    return {
      activeSchoolId: null,
      activeSchoolName: null,
      activeSchoolCode: null,
      globalView: false,
      role: user.role as UserRole,
      canSwitch,
      contextRequired: true,
    };
  }

  /**
   * Finds which of the given school IDs have child schools.
   * Returns a Set of school IDs that have at least one child.
   */
  private async findSchoolIdsWithChildren(
    schoolIds: string[],
  ): Promise<Set<string>> {
    if (schoolIds.length === 0) {
      return new Set();
    }

    const childRecords = await this.schoolEntityRepository
      .createQueryBuilder('school')
      .select('DISTINCT school.parentSchoolId', 'parentSchoolId')
      .where('school.parentSchoolId IN (:...ids)', { ids: schoolIds })
      .andWhere('school.deletedAt IS NULL')
      .getRawMany();

    return new Set(
      childRecords.map((record) => record.parentSchoolId as string),
    );
  }

  /**
   * Derives the hierarchyLevel for a school based on its parentSchoolId
   * and whether it has child schools.
   *
   * - "holding": parentSchoolId is null AND has children
   * - "company": parentSchoolId is not null AND has children
   * - "school": has no children
   */
  private deriveHierarchyLevel(
    school: SchoolEntity,
    schoolsWithChildren: Set<string>,
  ): 'holding' | 'company' | 'school' {
    const hasChildren = schoolsWithChildren.has(school.id);

    if (!hasChildren) {
      return 'school';
    }

    if (school.parentSchoolId === null) {
      return 'holding';
    }

    return 'company';
  }

  /**
   * Compute accessible schools for single-school roles (SCHOOL_ADMIN, HR, SCHEDULER, VIEWER).
   * Returns the single JWT schoolId if the school is ACTIVE; otherwise empty.
   */
  private async computeSingleSchoolAccess(
    user: ContextJwtUser,
  ): Promise<string[]> {
    if (!user.schoolId) {
      return [];
    }

    const school = await this.schoolRepository.findById(user.schoolId);
    if (!school || school.status !== SchoolStatus.ACTIVE) {
      return [];
    }

    return [school.id];
  }

  /**
   * Compute accessible schools for TEACHER role.
   * First tries accessibleSchoolIds from JWT claim, then falls back to
   * TeacherSchoolAssignment records.
   * Only returns schools that are ACTIVE.
   */
  private async computeTeacherAccess(user: ContextJwtUser): Promise<string[]> {
    let candidateIds: string[] = [];

    // First: try accessibleSchoolIds from JWT claim
    if (user.accessibleSchoolIds && user.accessibleSchoolIds.length > 0) {
      candidateIds = user.accessibleSchoolIds;
    } else {
      // Fallback: TeacherSchoolAssignment records
      const assignmentSchoolIds =
        await this.teacherSchoolAssignmentService.getAccessibleSchoolIds(
          user.id,
        );
      candidateIds = assignmentSchoolIds;
    }

    if (candidateIds.length === 0) {
      // Ultimate fallback: JWT schoolId
      if (user.schoolId) {
        candidateIds = [user.schoolId];
      } else {
        return [];
      }
    }

    // Filter only ACTIVE schools
    const activeSchoolIds = await this.filterActiveSchoolIds(candidateIds);

    // Cap at MAX_ACCESSIBLE_SCHOOLS
    return activeSchoolIds.slice(0, MAX_ACCESSIBLE_SCHOOLS);
  }

  /**
   * Compute accessible schools for COMPANY_ADMIN role.
   * Returns the company node itself + all active descendants via HierarchyService.
   * Falls back to direct parentSchoolId query if HierarchyService is unavailable.
   * Only returns schools that are ACTIVE.
   *
   * If companySchoolId is null/invalid, returns empty array and logs a warning.
   */
  private async computeCompanyAdminAccess(
    user: ContextJwtUser,
  ): Promise<string[]> {
    const companySchoolId = user.companySchoolId;

    if (!companySchoolId) {
      this.logger.warn(
        `COMPANY_ADMIN user ${user.id} has null/missing companySchoolId — returning empty accessible schools`,
      );
      return [];
    }

    // Validate the company school exists and is ACTIVE
    const companySchool =
      await this.schoolRepository.findById(companySchoolId);
    if (!companySchool) {
      this.logger.warn(
        `COMPANY_ADMIN user ${user.id} has invalid companySchoolId "${companySchoolId}" — school not found`,
      );
      return [];
    }

    // Get all descendants using HierarchyService (supports multi-level hierarchy)
    // Falls back to direct parentSchoolId query if HierarchyService is not available
    let descendants: SchoolEntity[];
    if (this.hierarchyService) {
      descendants = await this.hierarchyService.getDescendants(companySchoolId);
    } else {
      // Fallback: direct children only (backward compatibility)
      descendants = await this.schoolEntityRepository.find({
        where: {
          parentSchoolId: companySchoolId,
          deletedAt: IsNull(),
        },
      });
    }

    const result: string[] = [];

    // Include the company node itself if it's ACTIVE
    if (companySchool.status === SchoolStatus.ACTIVE) {
      result.push(companySchool.id);
    }

    // Include only ACTIVE descendants
    for (const descendant of descendants) {
      if (descendant.status === SchoolStatus.ACTIVE) {
        result.push(descendant.id);
      }
    }

    // Cap at MAX_ACCESSIBLE_SCHOOLS
    return result.slice(0, MAX_ACCESSIBLE_SCHOOLS);
  }

  /**
   * Compute accessible schools for SUPER_ADMIN role.
   * Returns all active schools in the system, capped at MAX_ACCESSIBLE_SCHOOLS.
   */
  private async computeSuperAdminAccess(): Promise<string[]> {
    const activeSchools = await this.schoolEntityRepository.find({
      where: {
        status: SchoolStatus.ACTIVE,
        deletedAt: IsNull(),
      },
      take: MAX_ACCESSIBLE_SCHOOLS,
    });

    return activeSchools.map((school) => school.id);
  }

  /**
   * Filter a list of school IDs to return only those with ACTIVE status.
   */
  private async filterActiveSchoolIds(schoolIds: string[]): Promise<string[]> {
    if (schoolIds.length === 0) {
      return [];
    }

    const schools = await this.schoolEntityRepository
      .createQueryBuilder('school')
      .where('school.id IN (:...ids)', { ids: schoolIds })
      .andWhere('school.status = :status', { status: SchoolStatus.ACTIVE })
      .andWhere('school.deletedAt IS NULL')
      .getMany();

    return schools.map((school) => school.id);
  }

  /**
   * Validates and executes a workspace context switch.
   *
   * Validation order (per security requirements):
   * 1. schoolId format (UUID) → 400 BadRequestException
   * 2. Compute accessible schools for user
   * 3. Check target is in accessible list → if NOT → 403 (no information leakage)
   * 4. Fetch school from DB → if not found (safety) → 404
   * 5. Check school status ACTIVE → if not → 422 SchoolInactiveException
   * 6. Store new context, log audit, return school details
   *
   * SECURITY: Steps 2+3 ensure that if the school doesn't exist OR the user
   * can't access it, always return 403 to prevent information leakage (Req 10.4).
   *
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 10.1, 10.2, 10.3, 10.4
   */
  async switchContext(
    user: ContextJwtUser,
    targetSchoolId: string,
    ip: string,
    correlationId?: string,
  ): Promise<{ id: string; code: string; name: string }> {
    // Step 1: Validate UUID format
    if (!isUuid(targetSchoolId)) {
      throw new BadRequestException({
        success: false,
        data: null,
        message: 'Định dạng schoolId không hợp lệ. Vui lòng cung cấp UUID đúng',
        errorCode: 'INVALID_FORMAT',
      });
    }

    // Step 2: Compute accessible school IDs for the user
    const accessibleIds = await this.computeAccessibleSchoolIds(user);

    // Step 3: Check if target is in user's accessible list
    // If NOT → 403 regardless of whether school exists (prevent info leakage)
    if (!accessibleIds.includes(targetSchoolId)) {
      // Log security warning for unauthorized attempt (include correlationId for tracing)
      this.logger.warn({
        message: 'Unauthorized context switch attempt',
        userId: user.id,
        targetSchoolId,
        ipAddress: ip,
        correlationId: correlationId ?? null,
      });

      throw new ContextForbiddenException();
    }

    // Step 4: Fetch school from DB (should exist since it's in accessible list, but safety check)
    const school = await this.schoolRepository.findById(targetSchoolId);
    if (!school) {
      throw new NotFoundException({
        success: false,
        data: null,
        message: 'Trường học không tồn tại',
        errorCode: 'SCHOOL_NOT_FOUND',
      });
    }

    // Step 5: Validate school status is ACTIVE
    if (school.status !== SchoolStatus.ACTIVE) {
      throw new SchoolInactiveException();
    }

    // Step 6: Get previous context before switching
    const previousSchoolId = await this.contextSessionService.getActiveContext(user.id);

    // Step 7: Store new context in Redis
    await this.contextSessionService.setActiveContext(user.id, targetSchoolId);

    // Resolve correlationId once for use in both event and audit (Requirement 16.2, 16.3)
    const resolvedCorrelationId = correlationId || randomUUID();

    // Step 7.1: Publish WorkspaceChangedEvent (fire-and-forget, non-blocking)
    // Per Requirement 14.4: event emission failure must NOT rollback the context switch
    try {
      const event = new WorkspaceChangedEvent(
        user.id,
        previousSchoolId ?? null,
        targetSchoolId,
        new Date(),
        resolvedCorrelationId,
      );
      this.eventEmitter.emit(WorkspaceChangedEvent.eventName, event);
    } catch (error) {
      // Fire-and-forget: log but do NOT throw or rollback context switch
      this.logger.warn({
        message: 'Failed to emit WorkspaceChangedEvent',
        userId: user.id,
        correlationId: resolvedCorrelationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Step 8: Log audit entry (async, non-blocking)
    // Audit: action=CONTEXT_SWITCH, entityType=context_session, entityId=userId
    // changes records the previousSchoolId → newSchoolId transition
    // correlationId included in metadata for end-to-end tracing (Requirement 16.2)
    this.auditLogService.log({
      userId: user.id,
      schoolId: targetSchoolId,
      action: 'CONTEXT_SWITCH',
      entityType: 'context_session',
      entityId: user.id,
      changes: {
        previousSchoolId: { old: previousSchoolId ?? null, new: targetSchoolId },
        newSchoolId: { old: previousSchoolId ?? null, new: targetSchoolId },
      },
      ipAddress: ip,
      metadata: { correlationId: resolvedCorrelationId },
    });

    // Step 9: Return new active school details
    return {
      id: school.id,
      code: school.code,
      name: school.name,
    };
  }
}
