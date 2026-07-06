import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Workbook, Worksheet } from 'exceljs';
import { MasterDataRepository } from '../repositories/master-data.repository';
import { FieldDefinitionRepository } from '../repositories/field-definition.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { EmployeeMasterEntity } from '../entities/employee-master.entity';
import { FieldDefinitionEntity } from '../entities/field-definition.entity';
import { EmployeeAuditLogEntity } from '../entities/employee-audit-log.entity';
import { ImportResultDto, ImportErrorDetail } from '../dto/import-result.dto';
import { Gender } from '../../../common/enums/status.enum';
import { FieldDataType } from '../enums/master-data.enum';

@Injectable()
export class ImportService {
  private static readonly COLUMN_MAPPING: Record<
    string,
    keyof EmployeeMasterEntity
  > = {
    'Mã NV': 'employeeCode',
    'Họ và Tên': 'fullName',
    'Tên gọi': 'shortName',
    'Cơ sở': 'campusName',
    Khối: 'gradeName',
    'Tổ bộ môn': 'departmentName',
    'Chức danh': 'jobTitle',
    'Chức danh/chức vụ': 'jobTitle',
    'Cấp bậc quản lý': 'managementLevel',
    'Giới tính': 'gender',
    'Max tiết/tuần': 'maxPeriodsPerWeek',
    'Số ngày công': 'workingDays',
  };

  private static readonly GENDER_MAPPING: Record<string, Gender> = {
    Nam: Gender.MALE,
    Nữ: Gender.FEMALE,
    Khác: Gender.OTHER,
  };

  constructor(
    private readonly masterDataRepository: MasterDataRepository,
    private readonly fieldDefinitionRepository: FieldDefinitionRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly dataSource: DataSource,
  ) {}

  async importFromExcel(
    schoolId: string,
    file: Buffer,
    changedBy: string,
  ): Promise<ImportResultDto> {
    const workbook = new Workbook();
    // Use Uint8Array slice to ensure correct buffer boundaries (avoids JSZip issues with shared ArrayBuffer)
    const safeBuffer = new Uint8Array(file).buffer;
    await workbook.xlsx.load(safeBuffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return {
        totalRows: 0,
        created: 0,
        updated: 0,
        conflicts: 0,
        errors: [{ row: 0, message: 'File import không chứa dữ liệu' }],
      };
    }

    const { coreFieldColumns, extendedFieldColumns } =
      this.parseHeaders(worksheet);

    const result: ImportResultDto = {
      totalRows: 0,
      created: 0,
      updated: 0,
      conflicts: 0,
      errors: [],
    };

    return this.dataSource.transaction(async (manager) => {
      // Auto-register unknown extended fields
      await this.registerExtendedFields(
        manager,
        schoolId,
        extendedFieldColumns,
      );

      // Process data rows (skip header row 1)
      const rowCount = worksheet.rowCount;
      for (let rowIndex = 2; rowIndex <= rowCount; rowIndex++) {
        const row = worksheet.getRow(rowIndex);

        // Skip empty rows
        if (this.isEmptyRow(row, coreFieldColumns, extendedFieldColumns)) {
          continue;
        }

        result.totalRows++;

        const rowResult = await this.processRow(
          manager,
          schoolId,
          row,
          rowIndex,
          coreFieldColumns,
          extendedFieldColumns,
          changedBy,
        );

        if (rowResult.error) {
          result.errors.push(rowResult.error);
        } else if (rowResult.created) {
          result.created++;
        } else if (rowResult.conflict) {
          result.conflicts++;
        }
      }

      return result;
    });
  }

  private parseHeaders(worksheet: Worksheet): {
    coreFieldColumns: Map<number, keyof EmployeeMasterEntity>;
    extendedFieldColumns: Map<number, string>;
  } {
    const coreFieldColumns = new Map<number, keyof EmployeeMasterEntity>();
    const extendedFieldColumns = new Map<number, string>();

    const headerRow = worksheet.getRow(1);

    headerRow.eachCell((cell, colNumber) => {
      const headerName = String(cell.value ?? '').trim();
      if (!headerName) return;

      const mappedField = ImportService.COLUMN_MAPPING[headerName];
      if (mappedField) {
        coreFieldColumns.set(colNumber, mappedField);
      } else {
        extendedFieldColumns.set(colNumber, headerName);
      }
    });

    return { coreFieldColumns, extendedFieldColumns };
  }

  private async registerExtendedFields(
    manager: EntityManager,
    schoolId: string,
    extendedFieldColumns: Map<number, string>,
  ): Promise<void> {
    for (const [, fieldName] of extendedFieldColumns) {
      const existing = await this.fieldDefinitionRepository.findByFieldName(
        schoolId,
        fieldName,
      );
      if (!existing) {
        const fieldDefEntity = manager.create(FieldDefinitionEntity, {
          schoolId,
          fieldName,
          dataType: FieldDataType.STRING,
          sourceModule: 'import',
          displayLabel: fieldName,
          isRequired: false,
          validationRules: null,
        });
        await manager.save(fieldDefEntity);
      }
    }
  }

  private async processRow(
    manager: EntityManager,
    schoolId: string,
    row: ReturnType<Worksheet['getRow']>,
    rowIndex: number,
    coreFieldColumns: Map<number, keyof EmployeeMasterEntity>,
    extendedFieldColumns: Map<number, string>,
    changedBy: string,
  ): Promise<{
    created?: boolean;
    conflict?: boolean;
    error?: ImportErrorDetail;
  }> {
    // Extract core field values from the row
    const coreValues = this.extractCoreValues(row, coreFieldColumns);

    // Validate employeeCode is present
    const employeeCode = coreValues.employeeCode as string | undefined;
    if (!employeeCode) {
      return {
        error: { row: rowIndex, message: 'Mã NV không được để trống' },
      };
    }

    // Extract extended field values
    const extendedFields: Record<string, unknown> = {};
    for (const [colNumber, fieldName] of extendedFieldColumns) {
      const cellValue = row.getCell(colNumber).value;
      if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
        extendedFields[fieldName] = String(cellValue);
      }
    }

    // Check if employee exists
    const existing = await manager.findOne(EmployeeMasterEntity, {
      where: { schoolId, employeeCode, deletedAt: undefined },
    });

    if (!existing) {
      // Create new record
      const newEmployee = manager.create(EmployeeMasterEntity, {
        schoolId,
        ...coreValues,
        extendedFields,
      });
      const saved = await manager.save(newEmployee);

      // Create audit log for creation
      const auditEntry = manager.create(EmployeeAuditLogEntity, {
        employeeMasterId: saved.id,
        fieldName: '*',
        oldValue: null,
        newValue: 'created',
        changedBy,
        changeSource: 'import',
      });
      await manager.save(auditEntry);

      return { created: true };
    } else {
      // Compare values and detect conflicts
      const hasConflict = this.detectConflicts(
        existing,
        coreValues,
        extendedFields,
      );

      if (hasConflict) {
        return { conflict: true };
      }

      // Values are the same - no action needed
      return {};
    }
  }

  private extractCoreValues(
    row: ReturnType<Worksheet['getRow']>,
    coreFieldColumns: Map<number, keyof EmployeeMasterEntity>,
  ): Partial<EmployeeMasterEntity> {
    const values: Partial<EmployeeMasterEntity> = {};

    for (const [colNumber, fieldName] of coreFieldColumns) {
      const cellValue = row.getCell(colNumber).value;
      const rawValue =
        cellValue !== null && cellValue !== undefined
          ? String(cellValue).trim()
          : '';

      if (!rawValue) continue;

      switch (fieldName) {
        case 'gender':
          (values as Record<string, unknown>)[fieldName] =
            ImportService.GENDER_MAPPING[rawValue] ?? null;
          break;
        case 'maxPeriodsPerWeek': {
          const parsed = parseInt(rawValue, 10);
          if (!isNaN(parsed)) {
            (values as Record<string, unknown>)[fieldName] = parsed;
          }
          break;
        }
        case 'workingDays': {
          const parsed = parseFloat(rawValue);
          if (!isNaN(parsed)) {
            (values as Record<string, unknown>)[fieldName] = parsed;
          }
          break;
        }
        default:
          (values as Record<string, unknown>)[fieldName] = rawValue;
          break;
      }
    }

    return values;
  }

  private detectConflicts(
    existing: EmployeeMasterEntity,
    coreValues: Partial<EmployeeMasterEntity>,
    extendedFields: Record<string, unknown>,
  ): boolean {
    // Check core fields for differences
    for (const [key, newValue] of Object.entries(coreValues)) {
      if (key === 'employeeCode') continue; // Skip matching key

      const existingValue = (existing as unknown as Record<string, unknown>)[
        key
      ];
      if (this.valueToString(existingValue) !== this.valueToString(newValue)) {
        return true;
      }
    }

    // Check extended fields for differences
    const existingExtended = existing.extendedFields || {};
    for (const [key, newValue] of Object.entries(extendedFields)) {
      const existingValue = existingExtended[key];
      if (this.valueToString(existingValue) !== this.valueToString(newValue)) {
        return true;
      }
    }

    return false;
  }

  private isEmptyRow(
    row: ReturnType<Worksheet['getRow']>,
    coreFieldColumns: Map<number, keyof EmployeeMasterEntity>,
    extendedFieldColumns: Map<number, string>,
  ): boolean {
    for (const colNumber of coreFieldColumns.keys()) {
      const cellValue = row.getCell(colNumber).value;
      if (
        cellValue !== null &&
        cellValue !== undefined &&
        String(cellValue).trim() !== ''
      ) {
        return false;
      }
    }
    for (const colNumber of extendedFieldColumns.keys()) {
      const cellValue = row.getCell(colNumber).value;
      if (
        cellValue !== null &&
        cellValue !== undefined &&
        String(cellValue).trim() !== ''
      ) {
        return false;
      }
    }
    return true;
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
}
