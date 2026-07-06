import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CalculationService } from '../services/calculation.service';
import { CalculateDto } from '../dto/calculation/calculate.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/role.enum';

@ApiTags('Compensation - Calculation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/compensation')
export class CalculationController {
  constructor(private readonly calculationService: CalculationService) {}

  @Post('calculate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Chạy tính lương cho kỳ lương' })
  @ApiResponse({
    status: 200,
    description: 'Tính lương thành công, trả về báo cáo tóm tắt',
  })
  @ApiResponse({
    status: 400,
    description: 'Kỳ lương đã đóng hoặc không có công thức',
  })
  async calculate(@Body() dto: CalculateDto) {
    // In production, teacherDataList would be fetched from teacher module
    // For now, we accept teacherIds in the request and fetch minimal teacher data
    // This will be integrated with the Teacher module
    const teacherDataList = (dto.teacherIds || []).map((id) => ({
      id,
      schoolId: dto.schoolId,
    }));

    const summary = await this.calculationService.calculate(
      {
        schoolId: dto.schoolId,
        payPeriodId: dto.payPeriodId,
        teacherIds: dto.teacherIds,
      },
      teacherDataList,
    );

    return {
      success: true,
      data: summary,
      message: `Tính lương hoàn tất: ${summary.successCount}/${summary.totalTeachers} thành công`,
    };
  }
}
