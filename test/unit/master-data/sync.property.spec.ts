import * as fc from 'fast-check';
import { SyncService } from '../../../src/modules/master-data/services/sync.service';
import { MasterDataService } from '../../../src/modules/master-data/services/master-data.service';
import { SyncLogRepository } from '../../../src/modules/master-data/repositories/sync-log.repository';
import { MasterDataRepository } from '../../../src/modules/master-data/repositories/master-data.repository';
import { AuditLogRepository } from '../../../src/modules/master-data/repositories/audit-log.repository';
import { FieldDefinitionRepository } from '../../../src/modules/master-data/repositories/field-definition.repository';
import { FieldDefinitionService } from '../../../src/modules/master-data/services/field-definition.service';
import { EmployeeMasterEntity } from '../../../src/modules/master-data/entities/employee-master.entity';
import { SyncLogEntity } from '../../../src/modules/master-data/entities/sync-log.entity';
import {
  SyncDirection,
  SyncStatus,
} from '../../../src/modules/master-data/enums/master-data.enum';
import { MasterDataChangedEventPayload } from '../../../src/modules/master-data/events/master-data-changed.event';
import { ModuleDataChangedEventPayload } from '../../../src/modules/master-data/events/module-data-changed.event';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Property-Based Tests for Sync Service
 *
 * Feature: master-data
 * Testing Framework: fast-check
 * Minimum Iterations: 100 per property
 *
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
 */

// --- Custom Arbitraries ---

const employeeCodeArb = fc
  .integer({ min: 1, max: 999 })
  .map((n) => `NV${String(n).padStart(3, '0')}`);

const schoolIdArb = fc.constantFrom(
  '123e4567-e89b-12d3-a456-426614174000',
  '223e4567-e89b-12d3-a456-426614174001',
  '323e4567-e89b-12d3-a456-426614174002',
);

const coreFieldNameArb = fc.constantFrom(
  'fullName',
  'campusName',
  'shortName',
  'gradeName',
  'departmentName',
  'jobTitle',
  'managementLevel',
);

const fieldValueArb = fc.constantFrom(
  'Nguyen Van A',
  'Tran Thi B',
  'Diamond',
  'Emerald',
  'Toan',
  'Van',
  'Anh',
  'Giao vien',
  'Truong bo mon',
  'Khoi 10',
  'Khoi 11',
  null,
);

const sourceModuleArb = fc.constantFrom(
  'teacher',
  'attendance',
  'compensation',
  'assignment',
);

const changedByArb = fc.constantFrom(
  'admin-user',
  'hr-user',
  'school-admin-01',
);

// --- Helper Functions ---

function createMockEmployee(
  overrides: Partial<EmployeeMasterEntity> = {},
): EmployeeMasterEntity {
  return {
    id: 'emp-001',
    schoolId: '123e4567-e89b-12d3-a456-426614174000',
    employeeCode: 'NV001',
    campusName: 'Diamond',
    fullName: 'Nguyen Van A',
    shortName: 'A',
    gradeName: 'Khoi 10',
    departmentName: 'Toan',
    jobTitle: 'Giao vien',
    managementLevel: null,
    gender: null,
    maxPeriodsPerWeek: null,
    workingDays: null,
    extendedFields: {},
    school: null as unknown as EmployeeMasterEntity['school'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    ...overrides,
  } as EmployeeMasterEntity;
}

function createMockSyncLog(
  overrides: Partial<SyncLogEntity> = {},
): SyncLogEntity {
  return {
    id: 'sync-log-001',
    schoolId: '123e4567-e89b-12d3-a456-426614174000',
    employeeCode: 'NV001',
    fieldName: 'fullName',
    masterValue: 'Nguyen Van A',
    moduleValue: null,
    sourceModule: 'master-data',
    direction: SyncDirection.MASTER_TO_MODULE,
    status: SyncStatus.APPLIED,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    ...overrides,
  } as SyncLogEntity;
}

// --- Test Suite ---

describe('Feature: master-data | Property-Based Tests for Sync', () => {
  let syncService: SyncService;
  let masterDataService: MasterDataService;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;
  let mockSyncLogRepository: jest.Mocked<SyncLogRepository>;
  let mockMasterDataRepository: jest.Mocked<MasterDataRepository>;
  let mockAuditLogRepository: jest.Mocked<AuditLogRepository>;
  let mockFieldDefinitionRepository: jest.Mocked<FieldDefinitionRepository>;
  let mockFieldDefinitionService: jest.Mocked<FieldDefinitionService>;

  jest.setTimeout(60000);

  beforeEach(() => {
    mockEventEmitter = {
      emit: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn(),
    } as unknown as jest.Mocked<EventEmitter2>;

    mockSyncLogRepository = {
      create: jest
        .fn()
        .mockImplementation(async (data: Partial<SyncLogEntity>) => ({
          id: `sync-log-${Date.now()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        })),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      findPendingByEmployeeCode: jest.fn(),
      findRecentMasterChange: jest.fn(),
    } as unknown as jest.Mocked<SyncLogRepository>;

    mockMasterDataRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByEmployeeCode: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<MasterDataRepository>;

    mockAuditLogRepository = {
      create: jest.fn(),
      createMany: jest.fn(),
      findByEmployeeId: jest.fn(),
    } as unknown as jest.Mocked<AuditLogRepository>;

    mockFieldDefinitionRepository = {
      findAll: jest.fn(),
      findByFieldName: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<FieldDefinitionRepository>;

    mockFieldDefinitionService = {
      register: jest.fn(),
      findAll: jest.fn(),
      validateValue: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<FieldDefinitionService>;

    syncService = new SyncService(
      mockEventEmitter,
      mockSyncLogRepository,
      mockMasterDataRepository,
      mockAuditLogRepository,
    );

    masterDataService = new MasterDataService(
      mockMasterDataRepository,
      mockAuditLogRepository,
      mockFieldDefinitionRepository,
      mockFieldDefinitionService,
      syncService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 13: Update Emits Change Event with Correct Payload
   *
   * For any employee field update, the emitted change event SHALL contain the correct
   * employee_code, field_name, old_value (matching the pre-update value), and new_value
   * (matching the post-update value).
   *
   * **Validates: Requirements 5.1**
   */
  describe('Property 13: Update Emits Change Event with Correct Payload', () => {
    it('emits event with correct employee_code, field_name, old_value, new_value for any field update', async () => {
      await fc.assert(
        fc.asyncProperty(
          schoolIdArb,
          employeeCodeArb,
          coreFieldNameArb,
          fieldValueArb,
          fieldValueArb,
          changedByArb,
          async (
            schoolId,
            employeeCode,
            fieldName,
            oldValue,
            newValue,
            changedBy,
          ) => {
            // Ensure old and new values differ (otherwise no change event should be emitted)
            fc.pre(String(oldValue) !== String(newValue));

            jest.clearAllMocks();

            const employeeId = `emp-${employeeCode}`;

            // Create existing employee with the "old" value for the field
            const existingEmployee = createMockEmployee({
              id: employeeId,
              schoolId,
              employeeCode,
              [fieldName]: oldValue,
            });

            // Mock: findById returns the existing employee
            mockMasterDataRepository.findById.mockResolvedValue(
              existingEmployee,
            );

            // Mock: update returns the updated employee
            const updatedEmployee = createMockEmployee({
              id: employeeId,
              schoolId,
              employeeCode,
              [fieldName]: newValue,
            });
            mockMasterDataRepository.update.mockResolvedValue(updatedEmployee);

            // Mock: auditLogRepository.createMany
            mockAuditLogRepository.createMany.mockResolvedValue([]);

            // Mock: syncLogRepository.create for emitChange
            mockSyncLogRepository.create.mockImplementation(
              async (data: Partial<SyncLogEntity>) =>
                ({
                  id: `sync-log-${Date.now()}`,
                  ...data,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  deletedAt: null,
                }) as SyncLogEntity,
            );

            // Execute the update
            const dto = { [fieldName]: newValue };
            await masterDataService.update(employeeId, dto, changedBy);

            // Verify: event was emitted with correct payload
            expect(mockEventEmitter.emit).toHaveBeenCalledWith(
              'master-data.changed',
              expect.objectContaining({
                schoolId,
                employeeCode,
                fieldName,
                oldValue: oldValue === null ? null : String(oldValue),
                newValue: newValue === null ? null : String(newValue),
                changedBy,
              }),
            );

            // Verify: sync log was created with correct master_to_module direction
            expect(mockSyncLogRepository.create).toHaveBeenCalledWith(
              expect.objectContaining({
                schoolId,
                employeeCode,
                fieldName,
                masterValue: newValue === null ? null : String(newValue),
                direction: SyncDirection.MASTER_TO_MODULE,
                status: SyncStatus.APPLIED,
              }),
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('does not emit event when field value has not actually changed', async () => {
      await fc.assert(
        fc.asyncProperty(
          schoolIdArb,
          employeeCodeArb,
          coreFieldNameArb,
          fieldValueArb.filter((v) => v !== null),
          changedByArb,
          async (schoolId, employeeCode, fieldName, sameValue, changedBy) => {
            jest.clearAllMocks();

            const employeeId = `emp-${employeeCode}`;

            // Employee has the same value already
            const existingEmployee = createMockEmployee({
              id: employeeId,
              schoolId,
              employeeCode,
              [fieldName]: sameValue,
            });

            mockMasterDataRepository.findById.mockResolvedValue(
              existingEmployee,
            );
            mockMasterDataRepository.update.mockResolvedValue(existingEmployee);

            // Update with the same value
            const dto = { [fieldName]: sameValue };
            await masterDataService.update(employeeId, dto, changedBy);

            // Verify: no event was emitted (no change detected)
            expect(mockEventEmitter.emit).not.toHaveBeenCalled();
            expect(mockSyncLogRepository.create).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 14: Module Change Creates Sync Log Entry
   *
   * For any incoming module change event, the system SHALL create a sync log entry with
   * the correct employee_code, field_name, source_module, module_value, direction set to
   * module_to_master, and the corresponding employee record SHALL be flagged for
   * reconciliation review.
   *
   * **Validates: Requirements 5.2, 5.3**
   */
  describe('Property 14: Module Change Creates Sync Log Entry', () => {
    it('creates sync log with correct data and module_to_master direction for any module change', async () => {
      await fc.assert(
        fc.asyncProperty(
          schoolIdArb,
          employeeCodeArb,
          coreFieldNameArb,
          fieldValueArb,
          sourceModuleArb,
          async (schoolId, employeeCode, fieldName, newValue, sourceModule) => {
            jest.clearAllMocks();

            // No existing master change (no conflict scenario)
            mockSyncLogRepository.findRecentMasterChange.mockResolvedValue(
              null,
            );

            const event: ModuleDataChangedEventPayload = {
              sourceModule,
              schoolId,
              employeeCode,
              fieldName,
              newValue: newValue === null ? null : String(newValue),
              timestamp: new Date(),
            };

            // Execute: receive module change
            await syncService.receiveModuleChange(event);

            // Verify: sync log was created with correct fields
            expect(mockSyncLogRepository.create).toHaveBeenCalledTimes(1);
            expect(mockSyncLogRepository.create).toHaveBeenCalledWith(
              expect.objectContaining({
                schoolId,
                employeeCode,
                fieldName,
                moduleValue: newValue === null ? null : String(newValue),
                sourceModule,
                direction: SyncDirection.MODULE_TO_MASTER,
                status: SyncStatus.PENDING,
              }),
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('records the correct source module in the sync log entry', async () => {
      await fc.assert(
        fc.asyncProperty(
          schoolIdArb,
          employeeCodeArb,
          coreFieldNameArb,
          fieldValueArb,
          sourceModuleArb,
          async (schoolId, employeeCode, fieldName, newValue, sourceModule) => {
            jest.clearAllMocks();

            mockSyncLogRepository.findRecentMasterChange.mockResolvedValue(
              null,
            );

            const event: ModuleDataChangedEventPayload = {
              sourceModule,
              schoolId,
              employeeCode,
              fieldName,
              newValue: newValue === null ? null : String(newValue),
              timestamp: new Date(),
            };

            await syncService.receiveModuleChange(event);

            // Verify the created sync log has the sourceModule field set correctly
            const createCall = mockSyncLogRepository.create.mock.calls[0][0];
            expect(createCall.sourceModule).toBe(sourceModule);
            expect(createCall.employeeCode).toBe(employeeCode);
            expect(createCall.fieldName).toBe(fieldName);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 15: Concurrent Changes Create Conflict
   *
   * For any employee field that has been changed in both Master Data and a source module
   * since the last sync, the system SHALL create a sync log entry with status conflict
   * rather than automatically applying either change.
   *
   * **Validates: Requirements 5.4**
   */
  describe('Property 15: Concurrent Changes Create Conflict', () => {
    it('creates conflict sync log when master change exists for the same employee+field', async () => {
      await fc.assert(
        fc.asyncProperty(
          schoolIdArb,
          employeeCodeArb,
          coreFieldNameArb,
          fieldValueArb,
          fieldValueArb,
          sourceModuleArb,
          async (
            schoolId,
            employeeCode,
            fieldName,
            masterNewValue,
            moduleNewValue,
            sourceModule,
          ) => {
            // Ensure values are different to make the conflict meaningful
            fc.pre(String(masterNewValue) !== String(moduleNewValue));

            jest.clearAllMocks();

            // Simulate an existing master-to-module change log (master changed first)
            const existingMasterChange = createMockSyncLog({
              schoolId,
              employeeCode,
              fieldName,
              masterValue:
                masterNewValue === null ? null : String(masterNewValue),
              moduleValue: null,
              sourceModule: 'master-data',
              direction: SyncDirection.MASTER_TO_MODULE,
              status: SyncStatus.APPLIED,
              createdAt: new Date(),
            });

            mockSyncLogRepository.findRecentMasterChange.mockResolvedValue(
              existingMasterChange,
            );

            // Module now sends a change for the same employee+field
            const event: ModuleDataChangedEventPayload = {
              sourceModule,
              schoolId,
              employeeCode,
              fieldName,
              newValue: moduleNewValue === null ? null : String(moduleNewValue),
              timestamp: new Date(),
            };

            // Execute: receive module change that conflicts with recent master change
            await syncService.receiveModuleChange(event);

            // Verify: sync log was created with CONFLICT status
            expect(mockSyncLogRepository.create).toHaveBeenCalledTimes(1);
            expect(mockSyncLogRepository.create).toHaveBeenCalledWith(
              expect.objectContaining({
                schoolId,
                employeeCode,
                fieldName,
                masterValue:
                  masterNewValue === null ? null : String(masterNewValue),
                moduleValue:
                  moduleNewValue === null ? null : String(moduleNewValue),
                sourceModule,
                direction: SyncDirection.MODULE_TO_MASTER,
                status: SyncStatus.CONFLICT,
              }),
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('does NOT create conflict when no recent master change exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          schoolIdArb,
          employeeCodeArb,
          coreFieldNameArb,
          fieldValueArb,
          sourceModuleArb,
          async (
            schoolId,
            employeeCode,
            fieldName,
            moduleNewValue,
            sourceModule,
          ) => {
            jest.clearAllMocks();

            // No recent master change exists
            mockSyncLogRepository.findRecentMasterChange.mockResolvedValue(
              null,
            );

            const event: ModuleDataChangedEventPayload = {
              sourceModule,
              schoolId,
              employeeCode,
              fieldName,
              newValue: moduleNewValue === null ? null : String(moduleNewValue),
              timestamp: new Date(),
            };

            await syncService.receiveModuleChange(event);

            // Verify: sync log was created with PENDING status (not conflict)
            expect(mockSyncLogRepository.create).toHaveBeenCalledTimes(1);
            expect(mockSyncLogRepository.create).toHaveBeenCalledWith(
              expect.objectContaining({
                status: SyncStatus.PENDING,
                direction: SyncDirection.MODULE_TO_MASTER,
              }),
            );

            // Verify: status is NOT conflict
            const createCall = mockSyncLogRepository.create.mock.calls[0][0];
            expect(createCall.status).not.toBe(SyncStatus.CONFLICT);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
