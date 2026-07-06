import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PayrollRunService } from '../services/payroll-run.service';
import { PayrollRunStatus } from '../enums';

@ApiTags('payroll-runs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/payroll-runs')
export class PayrollRunController {
  constructor(private readonly payrollRunService: PayrollRunService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách payroll runs' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('payPeriodId') payPeriodId?: string,
    @Query('status') status?: PayrollRunStatus,
    @CurrentUser() user?: { schoolId: string },
  ) {
    const { items, total } = await this.payrollRunService.findAll(
      user!.schoolId,
      { page: +page, limit: +limit, payPeriodId, status },
    );
    return {
      success: true,
      data: items,
      message: 'Lấy danh sách payroll runs thành công',
      meta: { page: +page, limit: +limit, total, totalPages: Math.ceil(total / +limit) },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết payroll run' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { schoolId: string },
  ) {
    const run = await this.payrollRunService.findById(id, user.schoolId);
    return { success: true, data: run, message: 'Lấy chi tiết payroll run thành công' };
  }

  @Post()
  @ApiOperation({ summary: 'Tạo payroll run mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  async create(
    @Body() body: { payPeriodId: string; name: string; note?: string },
    @CurrentUser() user: { userId: string; schoolId: string },
  ) {
    const run = await this.payrollRunService.create(
      user.schoolId,
      body,
      user.userId,
    );
    return { success: true, data: run, message: 'Tạo payroll run thành công' };
  }

  @Post(':id/submit-review')
  @ApiOperation({ summary: 'Submit payroll run for review (DRAFT → REVIEWED)' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async submitForReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { comment?: string },
    @CurrentUser() user: { userId: string; schoolId: string },
  ) {
    const run = await this.payrollRunService.submitForReview(
      id,
      user.schoolId,
      user.userId,
      body.comment,
    );
    return { success: true, data: run, message: 'Đã gửi duyệt thành công' };
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve payroll run (REVIEWED → APPROVED)' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { comment?: string },
    @CurrentUser() user: { userId: string; schoolId: string },
  ) {
    const run = await this.payrollRunService.approve(
      id,
      user.schoolId,
      user.userId,
      body.comment,
    );
    return { success: true, data: run, message: 'Đã duyệt payroll run thành công' };
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject payroll run' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string },
    @CurrentUser() user: { userId: string; schoolId: string },
  ) {
    const run = await this.payrollRunService.reject(
      id,
      user.schoolId,
      user.userId,
      body.reason,
    );
    return { success: true, data: run, message: 'Đã từ chối payroll run' };
  }

  @Post(':id/mark-paid')
  @ApiOperation({ summary: 'Mark payroll run as paid (APPROVED → PAID)' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { comment?: string },
    @CurrentUser() user: { userId: string; schoolId: string },
  ) {
    const run = await this.payrollRunService.markPaid(
      id,
      user.schoolId,
      user.userId,
      body.comment,
    );
    return { success: true, data: run, message: 'Đã đánh dấu đã chi trả thành công' };
  }

  @Post(':id/reopen')
  @ApiOperation({ summary: 'Reopen rejected payroll run (REJECTED → DRAFT)' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { userId: string; schoolId: string },
  ) {
    const run = await this.payrollRunService.reopen(id, user.schoolId, user.userId);
    return { success: true, data: run, message: 'Mở lại payroll run thành công' };
  }

  @Get(':id/approval-history')
  @ApiOperation({ summary: 'Lịch sử phê duyệt payroll run' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getApprovalHistory(@Param('id', ParseUUIDPipe) id: string) {
    const history = await this.payrollRunService.getApprovalHistory(id);
    return { success: true, data: history, message: 'Lấy lịch sử phê duyệt thành công' };
  }
}
