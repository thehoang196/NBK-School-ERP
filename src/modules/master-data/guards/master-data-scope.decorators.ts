import { SetMetadata } from '@nestjs/common';
import {
  MASTER_DATA_WRITE_KEY,
  MASTER_DATA_RECONCILIATION_KEY,
} from './master-data-scope.guard';

/**
 * Decorator to mark an endpoint as a write operation (create, update, delete).
 * When used with MasterDataScopeGuard, only SUPER_ADMIN and SCHOOL_ADMIN
 * can access the endpoint. Teachers will receive 403.
 *
 * @example
 * @MasterDataWrite()
 * @Post()
 * async create(@Body() dto: CreateEmployeeMasterDto) { ... }
 */
export const MasterDataWrite = () => SetMetadata(MASTER_DATA_WRITE_KEY, true);

/**
 * Decorator to mark an endpoint as a reconciliation operation.
 * When used with MasterDataScopeGuard, only SUPER_ADMIN, SCHOOL_ADMIN, and HR
 * can access the endpoint.
 *
 * @example
 * @MasterDataReconciliation()
 * @Post('reconciliation')
 * async triggerReconciliation() { ... }
 */
export const MasterDataReconciliation = () =>
  SetMetadata(MASTER_DATA_RECONCILIATION_KEY, true);
