import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ExportExcelService } from '../services/export-excel.service';
import { ExportPdfService } from '../services/export-pdf.service';
import { EntityExportService } from '../services/entity-export.service';
import { ExportQueryDto } from '../dto/export-query.dto';
import { ExportTeachersQueryDto } from '../dto/export-teachers.dto';
import { CreateExportTemplateDto } from '../dto/create-export-template.dto';
import { UpdateExportTemplateDto } from '../dto/update-export-template.dto';
import {
  ExportTemplateEntity,
  ExportEntityTarget,
} from '../entities/export-template.entity';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/role.enum';

@ApiTags('Export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/export')
export class ExportController {
  constructor(
    private readonly exportExcelService: ExportExcelService,
    private readonly exportPdfService: ExportPdfService,
    private readonly entityExportService: EntityExportService,
  ) {}

  // ─── TIMETABLE EXPORT ───────────────────────────────────────────────────

  @Get('timetable/excel')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.SCHEDULER,
    UserRole.TEACHER,
  )
  @ApiOperation({ summary: 'Xuất thời khóa biểu dạng Excel' })
  @ApiResponse({ status: 200, description: 'File Excel TKB' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phiên bản TKB' })
  async exportTimetableExcel(
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.exportExcelService.exportTimetable(query);
    const filename = this.generateTimetableFilename(query, 'xlsx');

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=${filename}`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Get('timetable/pdf')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.SCHEDULER,
    UserRole.TEACHER,
  )
  @ApiOperation({ summary: 'Xuất thời khóa biểu dạng PDF' })
  @ApiResponse({ status: 200, description: 'File PDF TKB' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phiên bản TKB' })
  async exportTimetablePdf(
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.exportPdfService.exportTimetable(query);
    const filename = this.generateTimetableFilename(query, 'pdf');

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${filename}`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  // ─── TEACHER EXPORT (Multi-format + Template) ───────────────────────────

  @Get('teachers')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({
    summary: 'Xuất danh sách giáo viên (Excel/CSV/JSON) theo template',
  })
  @ApiResponse({ status: 200, description: 'File xuất theo định dạng yêu cầu' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy template' })
  async exportTeachers(
    @Query() query: ExportTeachersQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.entityExportService.exportTeachers(query);

    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename=${encodeURIComponent(result.filename)}`,
      'Content-Length': result.buffer.length,
    });

    res.send(result.buffer);
  }

  // ─── EXPORT TEMPLATES CRUD ──────────────────────────────────────────────

  @Get('templates')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy danh sách export templates' })
  @ApiQuery({ name: 'schoolId', type: 'string' })
  @ApiQuery({ name: 'entityTarget', enum: ExportEntityTarget, required: false })
  @ApiResponse({ status: 200, description: 'Danh sách templates' })
  async findAllTemplates(
    @Query('schoolId') schoolId: string,
    @Query('entityTarget') entityTarget?: ExportEntityTarget,
  ): Promise<ExportTemplateEntity[]> {
    return this.entityExportService.findAllTemplates(schoolId, entityTarget);
  }

  @Get('templates/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy chi tiết một export template' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Chi tiết template' })
  async findTemplateById(
    @Param('id') id: string,
  ): Promise<ExportTemplateEntity> {
    return this.entityExportService.findTemplateById(id);
  }

  @Post('templates')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Tạo export template mới' })
  @ApiResponse({ status: 201, description: 'Template đã tạo' })
  async createTemplate(
    @Body() dto: CreateExportTemplateDto,
  ): Promise<ExportTemplateEntity> {
    return this.entityExportService.createTemplate({
      schoolId: dto.schoolId,
      entityTarget: dto.entityTarget,
      name: dto.name,
      description: dto.description || null,
      fieldMappings: dto.fieldMappings,
      isDefault: dto.isDefault ?? false,
    });
  }

  @Put('templates/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Cập nhật export template' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Template đã cập nhật' })
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateExportTemplateDto,
  ): Promise<ExportTemplateEntity> {
    return this.entityExportService.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Xóa export template (soft delete)' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Template đã xóa' })
  async deleteTemplate(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.entityExportService.deleteTemplate(id);
    return { success: true };
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────────────────

  private generateTimetableFilename(
    query: ExportQueryDto,
    extension: string,
  ): string {
    const timestamp = new Date().toISOString().slice(0, 10);
    const prefix = 'tkb';
    const viewSuffix = query.viewType || 'full';
    return `${prefix}-${viewSuffix}-${timestamp}.${extension}`;
  }
}
