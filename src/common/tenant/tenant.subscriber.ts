import { Injectable, Logger } from '@nestjs/common';
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
  SoftRemoveEvent,
  SelectQueryBuilder,
  EntityMetadata,
} from 'typeorm';

import { TenantContextService } from './tenant-context.service';
import { TenantAuditService } from './tenant-audit.service';
import { TenantBaseEntity } from './tenant-base.entity';
import { TenantContextRequiredError } from './exceptions/tenant-context-required.error';

/**
 * TypeORM subscriber that enforces multi-tenant isolation at the application level.
 *
 * Responsibilities:
 * - On INSERT: auto-populate `school_id` from TenantContextService if not explicitly set
 * - On UPDATE/DELETE: validate tenant context is active for tenant-aware entities
 * - Provides `applyTenantFilter(qb)` utility for SELECT query filtering
 * - Skips non-tenant entities (those not extending TenantBaseEntity)
 * - Respects bypass mode for Super Admin / system operations
 * - Throws TenantContextRequiredError when no context is active on tenant entities
 */
@Injectable()
@EventSubscriber()
export class TenantSubscriber implements EntitySubscriberInterface {
  private readonly logger = new Logger(TenantSubscriber.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    private readonly tenantAudit: TenantAuditService,
  ) {
    // Register this subscriber with the DataSource
    dataSource.subscribers.push(this);
  }

  /**
   * Determines if an entity metadata corresponds to a tenant-aware entity
   * (i.e., one that extends TenantBaseEntity).
   */
  isTenantEntity(metadata: EntityMetadata): boolean {
    // Check if the entity's target (constructor) prototype chain includes TenantBaseEntity
    const target = metadata.target;
    if (typeof target === 'function') {
      let proto = target.prototype;
      while (proto) {
        if (proto.constructor === TenantBaseEntity) {
          return true;
        }
        proto = Object.getPrototypeOf(proto);
        if (proto === Object.prototype) {
          break;
        }
      }
      // Also check by name for abstract class matching
      return this.hasTenantBaseInChain(target);
    }
    return false;
  }

  /**
   * Walks the prototype chain to check if TenantBaseEntity is an ancestor.
   */
  private hasTenantBaseInChain(target: Function): boolean {
    let current = target;
    while (current && current !== Object) {
      if (current === TenantBaseEntity) {
        return true;
      }
      current = Object.getPrototypeOf(current);
    }
    return false;
  }

  /**
   * Validates tenant context for a given entity metadata.
   * Returns the schoolId if valid, or handles bypass/error cases.
   *
   * @returns schoolId string if filtering should be applied, null if bypass, throws if no context
   */
  private validateTenantContext(entityName: string): string | null {
    // If bypass mode is active, skip tenant filtering
    if (this.tenantContext.isBypass()) {
      return null;
    }

    // If no context is active at all, throw error
    if (!this.tenantContext.isActive()) {
      this.tenantAudit.logTenantContextError(entityName);
      throw new TenantContextRequiredError(entityName);
    }

    const schoolId = this.tenantContext.getSchoolId();

    // If context is active but schoolId is null (not bypass), it's an error state
    if (schoolId === null || schoolId === undefined) {
      this.tenantAudit.logTenantContextError(entityName);
      throw new TenantContextRequiredError(entityName);
    }

    return schoolId;
  }

  /**
   * beforeInsert: Auto-populate school_id for tenant-aware entities
   * if not explicitly set by the caller.
   *
   * Validates: Requirements 2.4, 2.5, 2.6
   */
  beforeInsert(event: InsertEvent<TenantBaseEntity>): void {
    if (!this.isTenantEntity(event.metadata)) {
      return;
    }

    const entityName = event.metadata.name || 'Unknown';
    const schoolId = this.validateTenantContext(entityName);

    // Bypass mode — allow insert without auto-populate
    if (schoolId === null) {
      return;
    }

    // Auto-populate school_id if not explicitly set
    if (!event.entity.schoolId) {
      event.entity.schoolId = schoolId;
    }
  }

  /**
   * beforeUpdate: Validate that tenant context is active for tenant-aware entities.
   * The actual WHERE clause filtering is handled by applyTenantFilter on the QueryBuilder.
   *
   * Validates: Requirements 2.2, 2.5, 2.6
   */
  beforeUpdate(event: UpdateEvent<TenantBaseEntity>): void {
    if (!this.isTenantEntity(event.metadata)) {
      return;
    }

    const entityName = event.metadata.name || 'Unknown';
    this.validateTenantContext(entityName);
  }

  /**
   * beforeRemove: Validate that tenant context is active for tenant-aware entities.
   *
   * Validates: Requirements 2.3, 2.5, 2.6
   */
  beforeRemove(event: RemoveEvent<TenantBaseEntity>): void {
    if (!this.isTenantEntity(event.metadata)) {
      return;
    }

    const entityName = event.metadata.name || 'Unknown';
    this.validateTenantContext(entityName);
  }

  /**
   * beforeSoftRemove: Validate tenant context for soft-delete operations.
   *
   * Validates: Requirements 2.3, 2.5, 2.6
   */
  beforeSoftRemove(event: SoftRemoveEvent<TenantBaseEntity>): void {
    if (!this.isTenantEntity(event.metadata)) {
      return;
    }

    const entityName = event.metadata.name || 'Unknown';
    this.validateTenantContext(entityName);
  }

  /**
   * Applies tenant filtering to a SelectQueryBuilder.
   * This method should be called by repositories/services when building queries
   * on tenant-aware entities.
   *
   * Usage:
   *   const qb = repo.createQueryBuilder('entity');
   *   tenantSubscriber.applyTenantFilter(qb, 'entity');
   *
   * @param qb - The SelectQueryBuilder to add tenant filtering to
   * @param alias - The entity alias used in the query builder
   * @returns The modified QueryBuilder with tenant condition appended
   *
   * Validates: Requirements 2.1, 2.2, 2.3, 2.5, 2.6
   */
  applyTenantFilter<T extends TenantBaseEntity>(
    qb: SelectQueryBuilder<T>,
    alias: string,
  ): SelectQueryBuilder<T> {
    const entityName = qb.expressionMap.mainAlias?.metadata?.name || alias;

    // Check if the entity is tenant-aware
    const metadata = qb.expressionMap.mainAlias?.metadata;
    if (metadata && !this.isTenantEntity(metadata)) {
      return qb;
    }

    const schoolId = this.validateTenantContext(entityName);

    // Bypass mode — no filtering
    if (schoolId === null) {
      return qb;
    }

    // Append WHERE school_id = :tenantSchoolId
    qb.andWhere(`${alias}.school_id = :tenantSchoolId`, {
      tenantSchoolId: schoolId,
    });

    return qb;
  }

  /**
   * Returns the current school_id from context for use in raw queries
   * or manual WHERE clause construction.
   *
   * @param entityName - Name of the entity being queried (for error messages)
   * @returns schoolId or null (bypass mode)
   * @throws TenantContextRequiredError if no context is active
   */
  getTenantSchoolId(entityName: string): string | null {
    return this.validateTenantContext(entityName);
  }
}
