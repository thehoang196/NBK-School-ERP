import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

import { TenantStore } from './tenant.interfaces';

/**
 * Service that manages tenant context using Node.js AsyncLocalStorage.
 * Provides request-scoped tenant state accessible from any layer
 * without explicit parameter passing.
 */
@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantStore>();

  /**
   * Executes the given callback within an async context that holds
   * the provided TenantStore. All code executed within the callback
   * (including nested async operations) will have access to the store.
   */
  run<T>(store: TenantStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  /**
   * Returns the current TenantStore, or undefined if called outside
   * an active tenant context (e.g., outside a request lifecycle).
   */
  getStore(): TenantStore | undefined {
    return this.storage.getStore();
  }

  /**
   * Returns the current school_id from the active tenant context.
   * Returns undefined if no tenant context is active.
   * Returns null if the context is in bypass mode (Super Admin without impersonation).
   */
  getSchoolId(): string | null | undefined {
    const store = this.getStore();
    if (!store) {
      return undefined;
    }
    return store.schoolId;
  }

  /**
   * Returns true if the current context has bypass mode enabled.
   * Bypass mode is used by Super Admin without X-School-Id header
   * and by system operations (migrations, background jobs).
   * Returns false if no context is active or bypass is not set.
   */
  isBypass(): boolean {
    const store = this.getStore();
    if (!store) {
      return false;
    }
    return store.isBypass;
  }

  /**
   * Returns true if there is an active tenant context
   * (i.e., code is executing within a `run()` scope).
   */
  isActive(): boolean {
    return this.getStore() !== undefined;
  }
}
