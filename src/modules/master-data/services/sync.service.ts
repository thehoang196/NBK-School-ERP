import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { SyncLogRepository } from '../repositories/sync-log.repository';
import { MasterDataRepository } from '../repositories/master-data.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { SyncLogEntity } from '../entities/sync-log.entity';
import { SyncLogQueryDto } from '../dto/sync-log-query.dto';
import { SyncDirection, SyncStatus } from '../enums/master-data.enum';
import { MasterDataChangedEventPayload } from '../events/master-data-changed.event';
import { ModuleDataChangedEventPayload } from '../events/module-data-changed.event';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';

@Injectable()
export class SyncService {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly syncLogRepository: SyncLogRepository,
    private readonly masterDataRepository: MasterDataRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async emitChange(event: MasterDataChangedEventPayload): Promise<void> {
    this.eventEmitter.emit('master-data.changed', event);

    await this.syncLogRepository.create({
      schoolId: event.schoolId,
      employeeCode: event.employeeCode,
      fieldName: event.fieldName,
      masterValue: event.newValue,
      moduleValue: null,
      sourceModule: 'master-data',
      direction: SyncDirection.MASTER_TO_MODULE,
      status: SyncStatus.APPLIED,
    });
  }

  @OnEvent('module.employee.changed')
  async receiveModuleChange(
    event: ModuleDataChangedEventPayload,
  ): Promise<void> {
    // Check for conflict: look for existing sync log entry where
    // the same employee + field was recently changed from master
    const existingMasterChange =
      await this.syncLogRepository.findRecentMasterChange(
        event.schoolId,
        event.employeeCode,
        event.fieldName,
      );

    if (existingMasterChange) {
      // Conflict detected: both master and module changed the same field
      await this.syncLogRepository.create({
        schoolId: event.schoolId,
        employeeCode: event.employeeCode,
        fieldName: event.fieldName,
        masterValue: existingMasterChange.masterValue,
        moduleValue: event.newValue,
        sourceModule: event.sourceModule,
        direction: SyncDirection.MODULE_TO_MASTER,
        status: SyncStatus.CONFLICT,
      });
    } else {
      // No conflict: create sync log with PENDING status
      await this.syncLogRepository.create({
        schoolId: event.schoolId,
        employeeCode: event.employeeCode,
        fieldName: event.fieldName,
        masterValue: null,
        moduleValue: event.newValue,
        sourceModule: event.sourceModule,
        direction: SyncDirection.MODULE_TO_MASTER,
        status: SyncStatus.PENDING,
      });
    }
  }

  async resolveConflict(
    syncLogId: string,
    resolution: 'master' | 'module',
    resolvedBy: string,
  ): Promise<void> {
    const syncLog = await this.syncLogRepository.findById(syncLogId);

    if (!syncLog) {
      throw new NotFoundException(
        `Không tìm thấy bản ghi đồng bộ với ID ${syncLogId}`,
      );
    }

    if (resolution === 'master') {
      // Keep master value, just resolve the conflict
      await this.syncLogRepository.update(syncLogId, {
        status: SyncStatus.RESOLVED,
        resolvedBy,
        resolvedAt: new Date(),
      });
    } else {
      // Apply module value to master data
      const employee = await this.masterDataRepository.findByEmployeeCode(
        syncLog.schoolId,
        syncLog.employeeCode,
      );

      if (!employee) {
        throw new NotFoundException(
          `Không tìm thấy nhân sự với mã ${syncLog.employeeCode}`,
        );
      }

      // Determine if the field is a core field or extended field
      const coreFields: string[] = [
        'employeeCode',
        'campusName',
        'fullName',
        'shortName',
        'gradeName',
        'departmentName',
        'jobTitle',
        'managementLevel',
        'gender',
        'maxPeriodsPerWeek',
        'workingDays',
      ];

      if (coreFields.includes(syncLog.fieldName)) {
        await this.masterDataRepository.update(employee.id, {
          [syncLog.fieldName]: syncLog.moduleValue,
        });
      } else {
        // Extended field
        const updatedExtendedFields = {
          ...employee.extendedFields,
          [syncLog.fieldName]: syncLog.moduleValue,
        };
        await this.masterDataRepository.update(employee.id, {
          extendedFields: updatedExtendedFields,
        });
      }

      // Create audit log entry for the resolution
      await this.auditLogRepository.create({
        employeeMasterId: employee.id,
        fieldName: syncLog.fieldName,
        oldValue: syncLog.masterValue,
        newValue: syncLog.moduleValue,
        changedBy: resolvedBy,
        changeSource: 'sync',
      });

      // Update sync log status
      await this.syncLogRepository.update(syncLogId, {
        status: SyncStatus.RESOLVED,
        resolvedBy,
        resolvedAt: new Date(),
      });
    }
  }

  async getSyncLogs(
    query: SyncLogQueryDto,
  ): Promise<PaginatedResponse<SyncLogEntity>> {
    const [data, total] = await this.syncLogRepository.findAll(query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách sync log thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }
}
