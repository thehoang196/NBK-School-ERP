import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Workbook, Column } from 'exceljs';
import { MasterDataRepository } from '../repositories/master-data.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { FieldDefinitionRepository } from '../repositories/field-definition.repository';
import { FieldDefinitionService } from './field-definition.service';
import { SyncService } from './sync.service';
import { EmployeeMasterEntity } from '../entities/employee-master.entity';
import { CreateEmployeeMasterDto } from '../dto/create-employee-master.dto';
import { UpdateEmployeeMasterDto } from '../dto/update-employee-master.dto';
import { EmployeeMasterQueryDto } from '../dto/employee-master-query.dto';
import { PaginatedResponse } from '../../../common/interfaces/api-response.interface';
import { EmployeeAuditLogEntity } from '../entities/employee-audit-log.entity';
import { FieldDefinitionEntity } from '../entities/field-definition.entity';

const GENDER_DISPLAY: Record<string, string> = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
};

interface CoreColumnDefinition {
  key: keyof EmployeeMasterEntity;
  header: string;
}

const CORE_COLUMN_DEFINITIONS: CoreColumnDefinition[] = [
  { key: 'employeeCode', header: 'Mã NV' },
  { key: 'campusName', header: 'Cơ sở' },
  { key: 'fullName', header: 'Họ và Tên' },
  { key: 'shortName', header: 'Tên gọi' },
  { key: 'gradeName', header: 'Khối' },
  { key: 'departmentName', header: 'Tổ bộ môn' },
  { key: 'jobTitle', header: 'Chức danh/chức vụ' },
  { key: 'managementLevel', header: 'Cấp bậc quản lý' },
  { key: 'gender', header: 'Giới tính' },
  { key: 'maxPeriodsPerWeek', header: 'Max tiết/tuần' },
  { key: 'workingDays', header: 'Số ngày công' },
];

@Injectable()
export class MasterDataService {
  private static readonly CORE_FIELDS: (keyof EmployeeMasterEntity)[] = [
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

  constructor(
    private readonly masterDataRepository: MasterDataRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly fieldDefinitionRepository: FieldDefinitionRepository,
    private readonly fieldDefinitionService: FieldDefinitionService,
    private readonly syncService: SyncService,
  ) {}

  async findAll(
    query: EmployeeMasterQueryDto,
  ): Promise<PaginatedResponse<EmployeeMasterEntity>> {
    const [data, total] = await this.masterDataRepository.findAll(query);
    const totalPages = Math.ceil(total / query.limit);

    return {
      success: true,
      data,
      message: 'Lấy danh sách nhân sự thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<EmployeeMasterEntity> {
    const record = await this.masterDataRepository.findById(id);
    if (!record) {
      throw new NotFoundException(`Không tìm thấy nhân sự với ID ${id}`);
    }
    return record;
  }

  async findByEmployeeCode(
    schoolId: string,
    employeeCode: string,
  ): Promise<EmployeeMasterEntity | null> {
    return this.masterDataRepository.findByEmployeeCode(schoolId, employeeCode);
  }

  async create(dto: CreateEmployeeMasterDto): Promise<EmployeeMasterEntity> {
    const existing = await this.masterDataRepository.findByEmployeeCode(
      dto.schoolId,
      dto.employeeCode,
    );

    if (existing) {
      throw new ConflictException(
        `Mã NV ${dto.employeeCode} đã tồn tại trong trường này`,
      );
    }

    if (dto.extendedFields) {
      await this.validateExtendedFields(dto.schoolId, dto.extendedFields);
    }

    return this.masterDataRepository.create(dto);
  }

  async update(
    id: string,
    dto: UpdateEmployeeMasterDto,
    changedBy: string,
  ): Promise<EmployeeMasterEntity> {
    const existing = await this.findById(id);

    if (dto.extendedFields) {
      await this.validateExtendedFields(existing.schoolId, dto.extendedFields);
    }

    const auditEntries = this.buildAuditEntries(existing, dto, changedBy);

    if (auditEntries.length > 0) {
      await this.auditLogRepository.createMany(auditEntries);
    }

    const updated = await this.masterDataRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException(`Không tìm thấy nhân sự với ID ${id}`);
    }

    // Emit change events for each changed field (bidirectional sync)
    if (auditEntries.length > 0) {
      for (const entry of auditEntries) {
        await this.syncService.emitChange({
          schoolId: existing.schoolId,
          employeeCode: existing.employeeCode,
          fieldName: entry.fieldName!,
          oldValue: entry.oldValue ?? null,
          newValue: entry.newValue ?? null,
          changedBy,
          timestamp: new Date(),
        });
      }
    }

    return updated;
  }

  async softDelete(id: string): Promise<void> {
    await this.findById(id);
    await this.masterDataRepository.softDelete(id);
  }

  async exportToExcel(
    schoolId: string,
    query: EmployeeMasterQueryDto,
  ): Promise<Buffer> {
    // Fetch all employees matching the query (override pagination to get all)
    const exportQuery: EmployeeMasterQueryDto = {
      ...query,
      schoolId,
      page: 1,
      limit: 100,
    };

    const allEmployees: EmployeeMasterEntity[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      exportQuery.page = page;
      const [data, total] =
        await this.masterDataRepository.findAll(exportQuery);
      allEmployees.push(...data);
      hasMore = allEmployees.length < total;
      page++;
    }

    // Fetch all registered field definitions for the school
    const fieldDefinitions: FieldDefinitionEntity[] =
      await this.fieldDefinitionRepository.findAll(schoolId);

    // Create workbook and worksheet
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Danh sách nhân sự');

    // Set up columns: Core fields + Extended fields
    const columns: Partial<Column>[] = CORE_COLUMN_DEFINITIONS.map((col) => ({
      header: col.header,
      key: col.key,
      width: 20,
    }));

    for (const fieldDef of fieldDefinitions) {
      columns.push({
        header: fieldDef.displayLabel,
        key: `ext_${fieldDef.fieldName}`,
        width: 20,
      });
    }

    worksheet.columns = columns;

    // Add data rows
    for (const employee of allEmployees) {
      const row: Record<string, unknown> = {};

      // Core fields
      for (const col of CORE_COLUMN_DEFINITIONS) {
        if (col.key === 'gender') {
          const genderValue = employee.gender;
          row[col.key] = genderValue
            ? GENDER_DISPLAY[genderValue] || genderValue
            : '';
        } else {
          row[col.key] = employee[col.key] ?? '';
        }
      }

      // Extended fields
      for (const fieldDef of fieldDefinitions) {
        const value = employee.extendedFields?.[fieldDef.fieldName];
        row[`ext_${fieldDef.fieldName}`] = value ?? '';
      }

      worksheet.addRow(row);
    }

    // Return buffer
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  private buildAuditEntries(
    existing: EmployeeMasterEntity,
    dto: UpdateEmployeeMasterDto,
    changedBy: string,
  ): Partial<EmployeeAuditLogEntity>[] {
    const entries: Partial<EmployeeAuditLogEntity>[] = [];

    for (const field of MasterDataService.CORE_FIELDS) {
      if (field in dto) {
        const oldValue = existing[field];
        const newValue = (dto as Record<string, unknown>)[field];

        if (this.valueToString(oldValue) !== this.valueToString(newValue)) {
          entries.push({
            employeeMasterId: existing.id,
            fieldName: field,
            oldValue: this.valueToString(oldValue),
            newValue: this.valueToString(newValue),
            changedBy,
            changeSource: 'manual',
          });
        }
      }
    }

    if (dto.extendedFields) {
      const oldExtended = existing.extendedFields || {};
      const newExtended = dto.extendedFields;

      for (const key of Object.keys(newExtended)) {
        const oldVal = oldExtended[key];
        const newVal = newExtended[key];

        if (this.valueToString(oldVal) !== this.valueToString(newVal)) {
          entries.push({
            employeeMasterId: existing.id,
            fieldName: `extendedFields.${key}`,
            oldValue: this.valueToString(oldVal),
            newValue: this.valueToString(newVal),
            changedBy,
            changeSource: 'manual',
          });
        }
      }
    }

    return entries;
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

  private async validateExtendedFields(
    schoolId: string,
    extendedFields: Record<string, unknown>,
  ): Promise<void> {
    for (const [fieldName, value] of Object.entries(extendedFields)) {
      const fieldDefinition =
        await this.fieldDefinitionRepository.findByFieldName(
          schoolId,
          fieldName,
        );

      if (fieldDefinition) {
        const isValid = this.fieldDefinitionService.validateValue(
          fieldDefinition,
          value,
        );
        if (!isValid) {
          throw new BadRequestException(
            `Giá trị của trường ${fieldName} không đúng kiểu dữ liệu ${fieldDefinition.dataType}`,
          );
        }
      }
    }
  }
}
