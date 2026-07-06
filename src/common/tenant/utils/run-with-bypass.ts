import { TenantContextService } from '../tenant-context.service';

/**
 * Executes an async callback within a bypass tenant context scope.
 * Useful for system operations (migrations, seeds, cross-tenant batch jobs)
 * that need to bypass tenant filtering entirely.
 *
 * @param tenantContext - The TenantContextService instance
 * @param callback - The async function to execute with tenant bypass enabled
 * @returns The result of the callback execution
 */
export async function runWithBypass<T>(
  tenantContext: TenantContextService,
  callback: () => Promise<T>,
): Promise<T> {
  return tenantContext.run(
    { schoolId: null, isBypass: true, userId: null },
    callback,
  );
}
