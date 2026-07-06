import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PayrollReportingService } from '../services/payroll-reporting.service';

@ApiTags('payroll-reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/reports')
export class PayrollReportingController {
  constructor(private readonly reportingService: PayrollReportingService) {}

  @Get('payroll-summary')
  @ApiOperation({ summary: 'Báo cáo tổng hợp lương theo kỳ' })
  @ApiQuery({ name: 'payPeriodId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getPayrollSummary(
    @Query('payPeriodId') payPeriodId: string,
    @CurrentUser() user: { schoolId: string },
  ) {
    const report = await this.reportingService.getPayrollSummary(
      user.schoolId,
      payPeriodId,
    );
    return {
      success: true,
      data: report,
      message: 'Lấy báo cáo tổng hợp lương thành công',
    };
  }

  @Get('teacher-income')
  @ApiOperation({ summary: 'Báo cáo thu nhập chi tiết theo giáo viên' })
  @ApiQuery({ name: 'payPeriodId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getTeacherIncome(
    @Query('payPeriodId') payPeriodId: string,
    @CurrentUser() user: { schoolId: string },
  ) {
    const report = await this.reportingService.getTeacherIncomeReport(
      user.schoolId,
      payPeriodId,
    );
    return {
      success: true,
      data: report,
      message: 'Lấy báo cáo thu nhập giáo viên thành công',
    };
  }

  @Get('overtime')
  @ApiOperation({ summary: 'Báo cáo tăng ca / vượt giờ' })
  @ApiQuery({ name: 'payPeriodId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getOvertimeReport(
    @Query('payPeriodId') payPeriodId: string,
    @CurrentUser() user: { schoolId: string },
  ) {
    const report = await this.reportingService.getOvertimeReport(
      user.schoolId,
      payPeriodId,
    );
    return {
      success: true,
      data: report,
      message: 'Lấy báo cáo vượt giờ thành công',
    };
  }

  @Get('payroll-cost-by-school')
  @ApiOperation({ summary: 'Báo cáo chi phí lương theo trường (Super Admin)' })
  @ApiQuery({ name: 'payPeriodId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getPayrollCostBySchool(
    @Query('payPeriodId') payPeriodId: string,
  ) {
    const report = await this.reportingService.getPayrollCostBySchool(
      payPeriodId,
    );
    return {
      success: true,
      data: report,
      message: 'Lấy báo cáo chi phí lương theo trường thành công',
    };
  }
}
