import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Workbook } from 'exceljs';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';
import {
  ExportTemplateEntity,
  ExportEntityTarget,
  ExportFieldMapping,
} from '../entities/export-template.entity';
import {
  ExportTeachersQueryDto,
  ExportFormat,
} from '../dto/export-teachers.dto';
import {
  Gender,
  TeacherType,
  TeacherStatus,
} from '../../../common/enums/status.enum';

/**
 * Service xử lý export data theo template customizable.
 * Hỗ trợ: Excel, CSV, JSON.
 */
@Injectable()
export class EntityExportService {
  constructor(
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(ExportTemplateEntity)
    private readonly templateRepo: Repository<ExportTemplateEntity>,
  ) {}

  // ─── TEACHER EXPORT ─────────────────────────────────────────────────────

  async exportTeachers(
    query: ExportTeachersQueryDto,
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const template = await this.resolveTemplate(
      query.templateId,
      query.schoolId,
      ExportEntityTarget.TEACHER,
    );

    const teachers = await this.fetchTeachers(query);

    switch (query.format) {
      case ExportFormat.EXCEL:
        return this.toExcel(teachers, template);
      case ExportFormat.CSV:
        return this.toCsv(teachers, template);
      case ExportFormat.JSON:
        return this.toJson(teachers, template);
      default:
        throw new BadRequestException(
          `Định dạng "${query.format}" không hợp lệ`,
        );
    }
  }

  // ─── TEMPLATE CRUD ──────────────────────────────────────────────────────

  async findAllTemplates(
    schoolId: string,
    entityTarget?: ExportEntityTarget,
  ): Promise<ExportTemplateEntity[]> {
    const where: Record<string, unknown> = { schoolId, deletedAt: IsNull() };
    if (entityTarget) {
      where['entityTarget'] = entityTarget;
    }
    return this.templateRepo.find({
      where: where as Record<string, unknown>,
      order: { isDefault: 'DESC', name: 'ASC' },
    });
  }

  async findTemplateById(id: string): Promise<ExportTemplateEntity> {
    const template = await this.templateRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!template) {
      throw new NotFoundException(
        `Không tìm thấy template export với ID "${id}"`,
      );
    }
    return template;
  }

  async createTemplate(
    data: Partial<ExportTemplateEntity>,
  ): Promise<ExportTemplateEntity> {
    // If setting as default, unset other defaults for same entity target
    if (data.isDefault && data.schoolId && data.entityTarget) {
      await this.templateRepo.update(
        {
          schoolId: data.schoolId,
          entityTarget: data.entityTarget,
          isDefault: true,
        },
        { isDefault: false },
      );
    }

    const entity = this.templateRepo.create(data);
    return this.templateRepo.save(entity);
  }

  async updateTemplate(
    id: string,
    data: Partial<ExportTemplateEntity>,
  ): Promise<ExportTemplateEntity> {
    const existing = await this.findTemplateById(id);

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await this.templateRepo.update(
        {
          schoolId: existing.schoolId,
          entityTarget: existing.entityTarget,
          isDefault: true,
        },
        { isDefault: false },
      );
    }

    await this.templateRepo.update(id, data);
    return this.findTemplateById(id);
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.templateRepo.softDelete(id);
  }

  // ─── PRIVATE: FORMAT CONVERSION ────────────────────────────────────────

  private async toExcel(
    data: Record<string, unknown>[],
    template: ExportFieldMapping[],
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const workbook = new Workbook();
    workbook.creator = 'NBK_EMS';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Data');

    // Set columns from template
    worksheet.columns = template.map((field) => ({
      header: field.displayName,
      key: field.dbField,
      width: field.width,
    }));

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Add data rows
    for (const row of data) {
      const rowData: Record<string, unknown> = {};
      for (const field of template) {
        rowData[field.dbField] = this.transformValue(
          row[field.dbField],
          field.transform,
        );
      }
      worksheet.addRow(rowData);
    }

    // Auto-filter
    if (data.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: data.length + 1, column: template.length },
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const timestamp = new Date().toISOString().slice(0, 10);

    return {
      buffer: Buffer.from(buffer),
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `export-teachers-${timestamp}.xlsx`,
    };
  }

  private async toCsv(
    data: Record<string, unknown>[],
    template: ExportFieldMapping[],
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const lines: string[] = [];

    // Header
    lines.push(template.map((f) => this.csvEscape(f.displayName)).join(','));

    // Data rows
    for (const row of data) {
      const values = template.map((field) => {
        const value = this.transformValue(row[field.dbField], field.transform);
        return this.csvEscape(
          value !== null && value !== undefined ? String(value) : '',
        );
      });
      lines.push(values.join(','));
    }

    // BOM for UTF-8 Excel compatibility
    const bom = '\uFEFF';
    const csvContent = bom + lines.join('\r\n');
    const timestamp = new Date().toISOString().slice(0, 10);

    return {
      buffer: Buffer.from(csvContent, 'utf-8'),
      contentType: 'text/csv; charset=utf-8',
      filename: `export-teachers-${timestamp}.csv`,
    };
  }

  private async toJson(
    data: Record<string, unknown>[],
    template: ExportFieldMapping[],
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    // Map field names to display names for cleaner JSON output
    const mapped = data.map((row) => {
      const obj: Record<string, unknown> = {};
      for (const field of template) {
        obj[field.displayName] = this.transformValue(
          row[field.dbField],
          field.transform,
        );
      }
      return obj;
    });

    const jsonContent = JSON.stringify(mapped, null, 2);
    const timestamp = new Date().toISOString().slice(0, 10);

    return {
      buffer: Buffer.from(jsonContent, 'utf-8'),
      contentType: 'application/json; charset=utf-8',
      filename: `export-teachers-${timestamp}.json`,
    };
  }

  // ─── PRIVATE: DATA FETCHING ─────────────────────────────────────────────

  private async fetchTeachers(
    query: ExportTeachersQueryDto,
  ): Promise<Record<string, unknown>[]> {
    const queryBuilder = this.teacherRepo
      .createQueryBuilder('teacher')
      .leftJoinAndSelect('teacher.grade', 'grade')
      .leftJoinAndSelect('teacher.department', 'department')
      .where('teacher.schoolId = :schoolId', { schoolId: query.schoolId })
      .andWhere('teacher.deletedAt IS NULL');

    if (query.gradeId) {
      queryBuilder.andWhere('teacher.gradeId = :gradeId', {
        gradeId: query.gradeId,
      });
    }

    if (query.departmentId) {
      queryBuilder.andWhere('teacher.departmentId = :departmentId', {
        departmentId: query.departmentId,
      });
    }

    if (query.status && query.status !== 'all') {
      queryBuilder.andWhere('teacher.status = :status', {
        status: query.status,
      });
    }

    if (query.search) {
      queryBuilder.andWhere(
        '(teacher.fullName ILIKE :search OR teacher.employeeCode ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    queryBuilder.orderBy('teacher.fullName', 'ASC');

    const teachers = await queryBuilder.getMany();

    // Flatten relations for export
    return teachers.map((t) => ({
      id: t.id,
      employeeCode: t.employeeCode,
      citizenId: t.citizenId,
      fullName: t.fullName,
      shortName: t.shortName,
      gender: t.gender,
      dateOfBirth: t.dateOfBirth,
      phone: t.phone,
      email: t.email,
      gradeName: t.grade?.name || '',
      departmentName: t.department?.name || '',
      jobTitle: t.jobTitle,
      managementLevel: t.managementLevel,
      position: t.position,
      teacherType: t.teacherType,
      maxPeriodsPerWeek: t.maxPeriodsPerWeek,
      minPeriodsPerWeek: t.minPeriodsPerWeek,
      maxPeriodsPerDay: t.maxPeriodsPerDay,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }

  // ─── PRIVATE: TEMPLATE RESOLUTION ──────────────────────────────────────

  private async resolveTemplate(
    templateId: string | undefined,
    schoolId: string,
    entityTarget: ExportEntityTarget,
  ): Promise<ExportFieldMapping[]> {
    if (templateId) {
      const template = await this.templateRepo.findOne({
        where: { id: templateId, deletedAt: IsNull() },
      });
      if (!template) {
        throw new NotFoundException(
          `Không tìm thấy template với ID "${templateId}"`,
        );
      }
      return template.fieldMappings;
    }

    // Look for default template for this school + entity
    const defaultTemplate = await this.templateRepo.findOne({
      where: { schoolId, entityTarget, isDefault: true, deletedAt: IsNull() },
    });

    if (defaultTemplate) {
      return defaultTemplate.fieldMappings;
    }

    // Fallback: built-in default template
    return this.getBuiltInTemplate(entityTarget);
  }

  private getBuiltInTemplate(
    entityTarget: ExportEntityTarget,
  ): ExportFieldMapping[] {
    switch (entityTarget) {
      case ExportEntityTarget.TEACHER:
        return [
          { dbField: 'employeeCode', displayName: 'Mã NV', width: 15 },
          { dbField: 'fullName', displayName: 'Họ và Tên', width: 25 },
          { dbField: 'shortName', displayName: 'Tên gọi', width: 15 },
          {
            dbField: 'gender',
            displayName: 'Giới tính',
            width: 12,
            transform: 'gender_vi',
          },
          {
            dbField: 'dateOfBirth',
            displayName: 'Ngày sinh',
            width: 12,
            transform: 'date',
          },
          { dbField: 'phone', displayName: 'Số điện thoại', width: 15 },
          { dbField: 'email', displayName: 'Email', width: 25 },
          { dbField: 'gradeName', displayName: 'Khối', width: 12 },
          { dbField: 'departmentName', displayName: 'Tổ bộ môn', width: 20 },
          { dbField: 'jobTitle', displayName: 'Chức danh', width: 20 },
          { dbField: 'managementLevel', displayName: 'Cấp bậc QL', width: 18 },
          {
            dbField: 'teacherType',
            displayName: 'Loại GV',
            width: 15,
            transform: 'teacher_type_vi',
          },
          {
            dbField: 'maxPeriodsPerWeek',
            displayName: 'Max tiết/tuần',
            width: 14,
          },
          {
            dbField: 'status',
            displayName: 'Trạng thái',
            width: 12,
            transform: 'status_vi',
          },
        ];
      case ExportEntityTarget.SUBJECT:
        return [
          { dbField: 'code', displayName: 'Mã môn', width: 10 },
          { dbField: 'name', displayName: 'Tên môn học', width: 25 },
          { dbField: 'periodsPerWeek', displayName: 'Số tiết/tuần', width: 14 },
        ];
      case ExportEntityTarget.CLASS:
        return [
          { dbField: 'name', displayName: 'Tên lớp', width: 12 },
          { dbField: 'gradeName', displayName: 'Khối', width: 12 },
          { dbField: 'studentCount', displayName: 'Sĩ số', width: 10 },
        ];
      case ExportEntityTarget.DEPARTMENT:
        return [
          { dbField: 'name', displayName: 'Tổ bộ môn', width: 25 },
          { dbField: 'headTeacherName', displayName: 'Tổ trưởng', width: 25 },
        ];
      default:
        return [{ dbField: 'id', displayName: 'ID', width: 36 }];
    }
  }

  // ─── PRIVATE: VALUE TRANSFORMS ─────────────────────────────────────────

  private transformValue(value: unknown, transform?: string): unknown {
    if (value === null || value === undefined) return '';
    if (!transform) return value;

    switch (transform) {
      case 'date':
        return this.formatDate(value);
      case 'gender_vi':
        return this.genderToVietnamese(value as Gender);
      case 'teacher_type_vi':
        return this.teacherTypeToVietnamese(value as TeacherType);
      case 'status_vi':
        return this.statusToVietnamese(value as TeacherStatus);
      case 'boolean_vi':
        return value ? 'Có' : 'Không';
      default:
        return value;
    }
  }

  private formatDate(value: unknown): string {
    if (!value) return '';
    const dateStr = String(value);
    // If already in format YYYY-MM-DD, convert to DD/MM/YYYY
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const parts = dateStr.substring(0, 10).split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }

  private genderToVietnamese(gender: Gender): string {
    switch (gender) {
      case Gender.MALE:
        return 'Nam';
      case Gender.FEMALE:
        return 'Nữ';
      case Gender.OTHER:
        return 'Khác';
      default:
        return '';
    }
  }

  private teacherTypeToVietnamese(type: TeacherType): string {
    switch (type) {
      case TeacherType.FULL_TIME:
        return 'Cơ hữu';
      case TeacherType.ASSISTANT:
        return 'Trợ giảng';
      case TeacherType.VISITING:
        return 'Thỉnh giảng';
      case TeacherType.INTER_SCHOOL:
        return 'Liên trường';
      default:
        return String(type);
    }
  }

  private statusToVietnamese(status: TeacherStatus): string {
    switch (status) {
      case TeacherStatus.ACTIVE:
        return 'Đang làm';
      case TeacherStatus.RESIGNED:
        return 'Nghỉ việc';
      case TeacherStatus.ON_LEAVE:
        return 'Tạm nghỉ';
      default:
        return String(status);
    }
  }

  private csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
