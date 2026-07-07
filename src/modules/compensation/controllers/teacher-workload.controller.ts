import {
  Controller,
  Get,
  Post,
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
import { TeacherWorkloadService } from '../services/teacher-workload.service';

@ApiTags('teaching-workload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/teaching-workload')
export class TeacherWorkloadController {
  constructor(
    private readonly workloadService: TeacherWorkloadService,
  ) {}

  @Get(':teacherId')
  @ApiOperation({ summary: 'Lấy workload giáo viên theo kỳ lương' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getWorkload(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Query('payPeriodId') payPeriodId: string,
    @CurrentUser() user: { schoolId: string },
  ) {
    const workload = await this.workloadService.getWorkload(
      teacherId,
      payPeriodId,
      user.schoolId,
    );
    return {
      success: true,
      data: workload,
      message: workload
        ? 'Lấy workload thành công'
        : 'Chưa có dữ liệu workload cho kỳ này',
    };
  }

  @Post(':teacherId/calculate')
  @ApiOperation({ summary: 'Tính toán workload cho GV trong kỳ lương' })
  @ApiResponse({ status: 201, description: 'Tính toán thành công' })
  async calculateWorkload(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Query('payPeriodId') payPeriodId: string,
    @CurrentUser() user: { schoolId: string },
  ) {
    const workload = await this.workloadService.calculateWorkload(
      teacherId,
      payPeriodId,
      user.schoolId,
    );
    return {
      success: true,
      data: workload,
      message: 'Tính workload thành công',
    };
  }
}
