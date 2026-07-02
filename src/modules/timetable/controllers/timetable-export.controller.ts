import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProduces } from '@nestjs/swagger';
import { Response } from 'express';
import { TimetableExportService } from '../services/timetable-export.service';
import { ExportTimetableQueryDto } from '../dto/export-timetable.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { SchoolScopeGuard } from '../../../common/guards/school-scope.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/role.enum';

@ApiTags('Timetable Export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, SchoolScopeGuard)
@Controller('api/v1/timetable-export')
export class TimetableExportController {
  constructor(private readonly exportService: TimetableExportService) {}

  @Get('excel')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER, UserRole.TEACHER)
  @ApiOperation({
    summary: 'Xuất TKB ra file Excel',
    description: 'Xuất TKB theo template chuẩn: mỗi khối 1 sheet, hiển thị Thứ/Tiết/Lớp/Môn/GV. Kèm sheet Mã môn học và Mã giáo viên.',
  })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiResponse({ status: 200, description: 'File Excel' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phiên bản TKB' })
  async exportExcel(
    @Query() query: ExportTimetableQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.exportService.exportToExcel({
      versionId: query.versionId,
      gradeId: query.gradeId,
      effectiveFrom: query.effectiveFrom,
      effectiveTo: query.effectiveTo,
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
