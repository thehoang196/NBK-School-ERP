import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SimulationService } from '../services/simulation.service';
import { SimulateDto } from '../dto/calculation/simulate.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/role.enum';

@ApiTags('Compensation - Simulation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/compensation')
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  @Post('simulate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({
    summary: 'Mô phỏng tính lương cho một giáo viên (không lưu dữ liệu)',
  })
  @ApiResponse({ status: 200, description: 'Kết quả mô phỏng chi tiết' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  async simulate(@Body() dto: SimulateDto) {
    const result = await this.simulationService.simulate({
      teacherId: dto.teacherId,
      schoolId: dto.schoolId,
      payPeriodId: dto.payPeriodId,
      variableOverrides: dto.variableOverrides,
    });

    return {
      success: true,
      data: result,
      message: 'Mô phỏng tính lương thành công',
    };
  }
}
