import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ExportExcelService } from '../services/export-excel.service';
import { ExportPdfService } from '../services/export-pdf.service';
import { ExportQueryDto } from '../dto/export-query.dto';
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
  ) {}

  @Get('timetable/excel')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER, UserRole.TEACHER)
  @ApiOperation({ summary: 'Xuất thời khóa biểu dạng Excel' })
  @ApiResponse({ status: 200, description: 'File Excel TKB' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phiên bản TKB' })
  async exportTimetableExcel(
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.exportExcelService.exportTimetable(query);

    const filename = this.generateFilename(query, 'xlsx');

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=${filename}`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Get('timetable/pdf')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER, UserRole.TEACHER)
  @ApiOperation({ summary: 'Xuất thời khóa biểu dạng PDF' })
  @ApiResponse({ status: 200, description: 'File PDF TKB' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phiên bản TKB' })
  async exportTimetablePdf(
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.exportPdfService.exportTimetable(query);

    const filename = this.generateFilename(query, 'pdf');

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${filename}`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  private generateFilename(query: ExportQueryDto, extension: string): string {
    const timestamp = new Date().toISOString().slice(0, 10);
    const prefix = 'tkb';
    const viewSuffix = query.viewType || 'full';
    return `${prefix}-${viewSuffix}-${timestamp}.${extension}`;
  }
}
