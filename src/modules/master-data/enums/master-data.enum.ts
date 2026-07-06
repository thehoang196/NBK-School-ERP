export enum FieldDataType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  ENUM = 'enum',
}

export enum SyncDirection {
  MASTER_TO_MODULE = 'master_to_module',
  MODULE_TO_MASTER = 'module_to_master',
}

export enum SyncStatus {
  PENDING = 'pending',
  APPLIED = 'applied',
  CONFLICT = 'conflict',
  RESOLVED = 'resolved',
}

export enum ReconciliationStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  APPLIED = 'applied',
  DECLINED = 'declined',
}
