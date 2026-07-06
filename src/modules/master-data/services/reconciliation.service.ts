import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ReconciliationSessionEntity } from '../entities/reconciliation-session.entity';
import { EmployeeMasterEntity } from '../entities/employee-master.entity';
import { EmployeeAuditLogEntity } from '../entities/employee-audit-log.entity';
import { MasterDataRepository } from '../repositories/master-data.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { FieldDefinitionRepository } from '../repositories/field-definition.repository';
import { ReconciliationStatus } from '../enums/master-data.enum';
import {
  ReconciliationReportData,
  ReconciliationDifference,
} from '../interfaces/reconciliation.interface';
import { ReconciliationResultDto } from '../dto/reconciliation-result.dto';

export interface SourceDataItem {
  employeeCode: string;
  [fieldName: string]: string | number | null;
}

@Injectable()
export class ReconciliationService {
  private static readonly CORE_FIELD_MAP: Record<
    string,
    keyof EmployeeMasterEntity
  > = {
    campusName: 'campusName',
    fullName: 'fullName',
    shortName: 'shortName',
    gradeName: 'gradeName',
    departmentName: 'departmentName',
    jobTitle: 'jobTitle',
    managementLevel: 'managementLevel',
    gender: 'gender',
    maxPeriodsPerWeek: 'maxPeriodsPerWeek',
    workingDays: 'workingDays',
  };

  constructor(
    @InjectRepository(ReconciliationSessionEntity)
    private readonly reconciliationRepo: Repository<ReconciliationSessionEntity>,
    private readonly masterDataRepository: MasterDataRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly fieldDefinitionRepository: FieldDefinitionRepository,
    private readonly dataSource: DataSource,
  ) {}

  async triggerReconciliation(
    schoolId: string,
    sourceModule: string,
    sourceData: SourceDataItem[],
    triggeredBy: string,
  ): Promise<ReconciliationResultDto> {
    const differences: ReconciliationDifference[] = [];
    const newRecordCodes: string[] = [];
    const newFields: string[] = [];

    // Get all registered field definitions for this school
    const fieldDefinitions =
      await this.fieldDefinitionRepository.findAll(schoolId);
    const registeredFieldNames = new Set(
      fieldDefinitions.map((fd) => fd.fieldName),
    );

    let matchedCount = 0;

    for (const sourceItem of sourceData) {
      const { employeeCode, ...fields } = sourceItem;

      // Find matching employee in Master Data
      const employee = await this.masterDataRepository.findByEmployeeCode(
        schoolId,
        employeeCode,
      );

      if (!employee) {
        newRecordCodes.push(employeeCode);
        continue;
      }

      matchedCount++;

      // Compare each field
      for (const [fieldName, sourceValue] of Object.entries(fields)) {
        // Check if field is registered (Core or Extended)
        const isCoreField = fieldName in ReconciliationService.CORE_FIELD_MAP;
        const isRegisteredExtended = registeredFieldNames.has(fieldName);

        if (!isCoreField && !isRegisteredExtended) {
          if (!newFields.includes(fieldName)) {
            newFields.push(fieldName);
          }
          continue;
        }

        // Get master value
        let masterValue: string | number | null;
        if (isCoreField) {
          const entityField = ReconciliationService.CORE_FIELD_MAP[fieldName];
          masterValue = employee[entityField] as string | number | null;
        } else {
          masterValue =
            (employee.extendedFields?.[fieldName] as string | number | null) ??
            null;
        }

        // Compare values
        const masterStr = this.valueToString(masterValue);
        const sourceStr = this.valueToString(sourceValue);

        if (masterStr !== sourceStr) {
          differences.push({
            employeeCode,
            fieldName,
            masterValue: masterStr,
            sourceValue: sourceStr,
          });
        }
      }
    }

    const conflictRecords = new Set(differences.map((d) => d.employeeCode))
      .size;

    const reportData: ReconciliationReportData = {
      differences,
      newFields,
      newRecords: newRecordCodes,
    };

    // Create session
    const session = this.reconciliationRepo.create({
      schoolId,
      sourceModule,
      status: ReconciliationStatus.COMPLETED,
      totalRecords: sourceData.length,
      matchedRecords: matchedCount,
      conflictRecords,
      newRecords: newRecordCodes.length,
      reportData,
      triggeredBy,
      completedAt: new Date(),
    });

    const savedSession = await this.reconciliationRepo.save(session);

    return this.toResultDto(savedSession);
  }

  async getReport(reconciliationId: string): Promise<ReconciliationResultDto> {
    const session = await this.reconciliationRepo.findOne({
      where: { id: reconciliationId },
    });

    if (!session) {
      throw new NotFoundException('Không tìm thấy phiên đối chiếu');
    }

    return this.toResultDto(session);
  }

  async applyChanges(
    reconciliationId: string,
    acceptedFields: string[],
    changedBy: string,
  ): Promise<void> {
    const session = await this.reconciliationRepo.findOne({
      where: { id: reconciliationId },
    });

    if (!session) {
      throw new NotFoundException('Không tìm thấy phiên đối chiếu');
    }

    const reportData = session.reportData;
    if (!reportData) {
      return;
    }

    // Filter differences to only accepted fields
    const acceptedDifferences = reportData.differences.filter((diff) =>
      acceptedFields.includes(diff.fieldName),
    );

    await this.dataSource.transaction(async (manager) => {
      for (const diff of acceptedDifferences) {
        // Find the employee
        const employee = await this.masterDataRepository.findByEmployeeCode(
          session.schoolId,
          diff.employeeCode,
        );

        if (!employee) {
          continue;
        }

        const isCoreField =
          diff.fieldName in ReconciliationService.CORE_FIELD_MAP;

        if (isCoreField) {
          const entityField =
            ReconciliationService.CORE_FIELD_MAP[diff.fieldName];
          const updateData: Record<string, unknown> = {};
          updateData[entityField] = this.parseValue(diff.sourceValue);
          await manager
            .createQueryBuilder()
            .update(EmployeeMasterEntity)
            .set(updateData as Partial<EmployeeMasterEntity>)
            .where('id = :id', { id: employee.id })
            .execute();
        } else {
          // Extended field
          const updatedExtended = {
            ...employee.extendedFields,
            [diff.fieldName]: this.parseValue(diff.sourceValue),
          };
          await manager
            .createQueryBuilder()
            .update(EmployeeMasterEntity)
            .set({
              extendedFields: updatedExtended,
            } as Partial<EmployeeMasterEntity>)
            .where('id = :id', { id: employee.id })
            .execute();
        }

        // Create audit log entry
        const auditLog = manager.create(EmployeeAuditLogEntity, {
          employeeMasterId: employee.id,
          fieldName: isCoreField
            ? diff.fieldName
            : `extendedFields.${diff.fieldName}`,
          oldValue: diff.masterValue,
          newValue: diff.sourceValue,
          changedBy,
          changeSource: 'reconciliation',
        });
        await manager.save(EmployeeAuditLogEntity, auditLog);
      }

      // Update session status
      await manager.update(ReconciliationSessionEntity, reconciliationId, {
        status: ReconciliationStatus.APPLIED,
        completedAt: new Date(),
      });
    });
  }

  async declineChanges(reconciliationId: string): Promise<void> {
    const session = await this.reconciliationRepo.findOne({
      where: { id: reconciliationId },
    });

    if (!session) {
      throw new NotFoundException('Không tìm thấy phiên đối chiếu');
    }

    await this.reconciliationRepo.update(reconciliationId, {
      status: ReconciliationStatus.DECLINED,
      completedAt: new Date(),
    });
  }

  private toResultDto(
    session: ReconciliationSessionEntity,
  ): ReconciliationResultDto {
    const dto = new ReconciliationResultDto();
    dto.id = session.id;
    dto.schoolId = session.schoolId;
    dto.sourceModule = session.sourceModule;
    dto.status = session.status;
    dto.totalRecords = session.totalRecords;
    dto.matchedRecords = session.matchedRecords;
    dto.conflictRecords = session.conflictRecords;
    dto.newRecords = session.newRecords;
    dto.reportData = session.reportData;
    dto.triggeredBy = session.triggeredBy;
    dto.createdAt = session.createdAt;
    dto.completedAt = session.completedAt;
    return dto;
  }

  private valueToString(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  private parseValue(value: string | null): string | number | null {
    if (value === null) {
      return null;
    }
    // Try to parse as number
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') {
      return num;
    }
    return value;
  }
}
