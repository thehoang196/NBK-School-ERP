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
import {
  PayrollAdjustmentService,
  CreateAdjustmentDto,
} from '../services/payroll-adjustment.service';

@ApiTags('payroll-adjustments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/payroll-adjustments')
export class PayrollAdjustmentController {
  constructor(
    private readonly adjustmentService: PayrollAdjustmentService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách điều chỉnh lương' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('teacherId') teacherId?: string,
    @Query('payPeriodId') payPeriodId?: string,
    @CurrentUser() user?: { schoolId: string },
  ) {
    const { items, total } = await this.adjustmentService.findAll(
      user!.schoolId,
      { page: +page, limit: +limit, teacherId, payPeriodId },
    );
    return {
      success: true,
      data: items,
      message: 'Lấy danh sách điều chỉnh lương thành công',
      meta: { page: +page, limit: +limit, total, totalPages: Math.ceil(total / +limit) },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết điều chỉnh lương' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { schoolId: string },
  ) {
    const adj = await this.adjustmentService.findById(id, user.schoolId);
    return { success: true, data: adj, message: 'Lấy chi tiết điều chỉnh lương thành công' };
  }

  @Post()
  @ApiOperation({ summary: 'Tạo điều chỉnh lương' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  async create(
    @Body() dto: CreateAdjustmentDto,
    @CurrentUser() user: { userId: string; schoolId: string },
  ) {
    const adj = await this.adjustmentService.create(
      user.schoolId,
      dto,
      user.userId,
    );
    return { success: true, data: adj, message: 'Tạo điều chỉnh lương thành công' };
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Duyệt điều chỉnh lương' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { userId: string; schoolId: string },
  ) {
    const adj = await this.adjustmentService.approve(id, user.schoolId, user.userId);
    return { success: true, data: adj, message: 'Duyệt điều chỉnh lương thành công' };
  }
}
