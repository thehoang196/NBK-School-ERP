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
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SalarySlipService } from '../services/salary-slip.service';
import { PayrollSnapshotService } from '../services/payroll-snapshot.service';
import { SalarySlipQueryDto } from '../dto/calculation/salary-slip-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/role.enum';

@ApiTags('Compensation - Salary Slips')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/compensation/salary-slips')
export class SalarySlipController {
  constructor(
    private readonly salarySlipService: SalarySlipService,
    private readonly snapshotService: PayrollSnapshotService,
  ) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy danh sách phiếu lương' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async findAll(@Query() query: SalarySlipQueryDto) {
    return this.salarySlipService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER)
  @ApiOperation({ summary: 'Lấy chi tiết phiếu lương' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.salarySlipService.findById(id);
  }

  @Post(':id/confirm')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Xác nhận phiếu lương (DRAFT → CONFIRMED)' })
  @ApiResponse({ status: 200, description: 'Xác nhận thành công' })
  @ApiResponse({
    status: 400,
    description: 'Phiếu lương không ở trạng thái DRAFT',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async confirm(@Param('id', ParseUUIDPipe) id: string) {
    const slip = await this.salarySlipService.confirm(id);
    return {
      success: true,
      data: slip,
      message: 'Xác nhận phiếu lương thành công',
    };
  }

  @Get(':id/snapshot')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy snapshot input tại thời điểm tính lương' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy snapshot' })
  async getSnapshot(@Param('id', ParseUUIDPipe) id: string) {
    const snapshot = await this.snapshotService.findBySalarySlip(id);
    return {
      success: true,
      data: snapshot,
      message: snapshot
        ? 'Lấy snapshot thành công'
        : 'Không tìm thấy snapshot cho phiếu lương này',
    };
  }
}
