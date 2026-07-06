import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AttendanceService } from '../services/attendance.service';
import { AttendanceSummaryService } from '../services/attendance-summary.service';
import { AttendanceImportService } from '../services/attendance-import.service';
import {
  CreateAttendanceRecordDto,
  UpdateAttendanceRecordDto,
  AttendanceQueryDto,
  AttendanceSummaryQueryDto,
  BulkCreateAttendanceDto,
} from '../dto';

@ApiTags('attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly summaryService: AttendanceSummaryService,
    private readonly importService: AttendanceImportService,
  ) {}

  // ─── RECORDS ─────────────────────────────────────────────────────────────

  @Get('records')
  @ApiOperation({ summary: 'Danh sách bản ghi chấm công' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async findAll(
    @Query() query: AttendanceQueryDto,
    @CurrentUser() user: { schoolId: string },
  ) {
    const { items, total } = await this.attendanceService.findAll(
      user.schoolId,
      query,
    );
    return {
      success: true,
      data: items,
      message: 'Lấy danh sách chấm công thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  @Get('records/:id')
  @ApiOperation({ summary: 'Chi tiết bản ghi chấm công' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { schoolId: string },
  ) {
    const record = await this.attendanceService.findById(id, user.schoolId);
    return {
      success: true,
      data: record,
      message: 'Lấy chi tiết chấm công thành công',
    };
  }

  @Post('records')
  @ApiOperation({ summary: 'Tạo bản ghi chấm công' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  async create(
    @Body() dto: CreateAttendanceRecordDto,
    @CurrentUser() user: { userId: string; schoolId: string },
  ) {
    const record = await this.attendanceService.create(
      dto,
      user.schoolId,
      user.userId,
    );
    return {
      success: true,
      data: record,
      message: 'Tạo bản ghi chấm công thành công',
    };
  }

  @Post('records/bulk')
  @ApiOperation({ summary: 'Tạo nhiều bản ghi chấm công' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  async bulkCreate(
    @Body() dto: BulkCreateAttendanceDto,
    @CurrentUser() user: { userId: string; schoolId: string },
  ) {
    const result = await this.attendanceService.bulkCreate(
      dto,
      user.schoolId,
      user.userId,
    );
    return {
      success: true,
      data: result,
      message: `Tạo ${result.successCount} bản ghi thành công, ${result.errorCount} lỗi`,
    };
  }

  @Patch('records/:id')
  @ApiOperation({ summary: 'Cập nhật bản ghi chấm công' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttendanceRecordDto,
    @CurrentUser() user: { userId: string; schoolId: string },
  ) {
    const record = await this.attendanceService.update(
      id,
      dto,
      user.schoolId,
      user.userId,
    );
    return {
      success: true,
      data: record,
      message: 'Cập nhật chấm công thành công',
    };
  }

  @Delete('records/:id')
  @ApiOperation({ summary: 'Xóa bản ghi chấm công' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { schoolId: string },
  ) {
    await this.attendanceService.delete(id, user.schoolId);
    return {
      success: true,
      data: null,
      message: 'Xóa bản ghi chấm công thành công',
    };
  }

  // ─── IMPORT ──────────────────────────────────────────────────────────────

  @Post('import')
  @ApiOperation({ summary: 'Import chấm công từ Excel' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Import thành công' })
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { userId: string; schoolId: string },
  ) {
    if (!file) {
      return {
        success: false,
        data: null,
        message: 'Vui lòng tải lên file Excel',
      };
    }

    const result = await this.importService.importFromExcel(
      file.buffer,
      user.schoolId,
      user.userId,
    );

    return {
      success: true,
      data: result,
      message: `Import: ${result.successCount} thành công, ${result.errorCount} lỗi`,
    };
  }

  // ─── SUMMARIES ───────────────────────────────────────────────────────────

  @Get('summaries')
  @ApiOperation({ summary: 'Danh sách tổng hợp chấm công theo tháng' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async findSummaries(
    @Query() query: AttendanceSummaryQueryDto,
    @CurrentUser() user: { schoolId: string },
  ) {
    const { items, total } = await this.summaryService.findAll(
      user.schoolId,
      query,
    );
    return {
      success: true,
      data: items,
      message: 'Lấy tổng hợp chấm công thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  @Post('summaries/calculate')
  @ApiOperation({ summary: 'Tính tổng hợp chấm công cho tất cả GV trong tháng' })
  @ApiResponse({ status: 201, description: 'Tính toán thành công' })
  async calculateSummaries(
    @Body() body: { month: number; year: number; standardWorkDays?: number },
    @CurrentUser() user: { schoolId: string },
  ) {
    const result = await this.summaryService.calculateAllSummaries(
      user.schoolId,
      body.month,
      body.year,
      body.standardWorkDays,
    );
    return {
      success: true,
      data: result,
      message: `Tính tổng hợp: ${result.successCount} GV thành công`,
    };
  }

  @Post('summaries/finalize')
  @ApiOperation({ summary: 'Chốt công tháng' })
  @ApiResponse({ status: 200, description: 'Chốt thành công' })
  async finalizeSummaries(
    @Body() body: { month: number; year: number },
    @CurrentUser() user: { schoolId: string },
  ) {
    await this.summaryService.finalize(user.schoolId, body.month, body.year);
    return {
      success: true,
      data: null,
      message: `Chốt công tháng ${body.month}/${body.year} thành công`,
    };
  }
}
