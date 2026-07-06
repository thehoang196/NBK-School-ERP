import { TenantContextService } from '../tenant-context.service';

/**
 * Executes an async callback within a tenant context scope.
 * Useful for BullMQ job processors and other background operations
 * that need to establish a tenant context for their execution scope.
 *
 * @param tenantContext - The TenantContextService instance
 * @param schoolId - The school_id to set as the active tenant
 * @param callback - The async function to execute within the tenant context
 * @returns The result of the callback execution
 */
export async function runWithTenantContext<T>(
  tenantContext: TenantContextService,
  schoolId: string,
  callback: () => Promise<T>,
): Promise<T> {
  return tenantContext.run(
    { schoolId, isBypass: false, userId: null },
    callback,
  );
}
