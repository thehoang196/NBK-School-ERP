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
import { PeriodSwapService } from '../services/period-swap.service';
import { CreatePeriodSwapDto } from '../dto';
import { PeriodSwapStatus } from '../enums';

@ApiTags('period-swaps')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/period-swaps')
export class PeriodSwapController {
  constructor(private readonly swapService: PeriodSwapService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách yêu cầu đổi tiết' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('teacherId') teacherId?: string,
    @Query('status') status?: PeriodSwapStatus,
    @CurrentUser() user?: { schoolId: string },
  ) {
    const { items, total } = await this.swapService.findAll(user!.schoolId, {
      page: +page,
      limit: +limit,
      teacherId,
      status,
    });
    return {
      success: true,
      data: items,
      message: 'Lấy danh sách yêu cầu đổi tiết thành công',
      meta: { page: +page, limit: +limit, total, totalPages: Math.ceil(total / +limit) },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết yêu cầu đổi tiết' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { schoolId: string },
  ) {
    const swap = await this.swapService.findById(id, user.schoolId);
    return { success: true, data: swap, message: 'Lấy chi tiết yêu cầu đổi tiết thành công' };
  }

  @Post()
  @ApiOperation({ summary: 'Tạo yêu cầu đổi tiết (GV)' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  async create(
    @Body() dto: CreatePeriodSwapDto,
    @CurrentUser() user: { userId: string; schoolId: string },
  ) {
    const swap = await this.swapService.create(dto, user.schoolId, user.userId);
    return { success: true, data: swap, message: 'Tạo yêu cầu đổi tiết thành công' };
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'GV target đồng ý đổi tiết' })
  async acceptByTarget(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { userId: string; schoolId: string },
  ) {
    const swap = await this.swapService.acceptByTarget(id, user.schoolId, user.userId);
    return { success: true, data: swap, message: 'Đã đồng ý đổi tiết' };
  }

  @Post(':id/reject-teacher')
  @ApiOperation({ summary: 'GV target từ chối đổi tiết' })
  async rejectByTarget(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string },
    @CurrentUser() user: { userId: string; schoolId: string },
  ) {
    const swap = await this.swapService.rejectByTarget(
      id,
      user.schoolId,
      user.userId,
      body.reason,
    );
    return { success: true, data: swap, message: 'Đã từ chối đổi tiết' };
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Admin duyệt đổi tiết' })
  async approveByAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { userId: string; schoolId: string },
  ) {
    const swap = await this.swapService.approveByAdmin(id, user.schoolId, user.userId);
    return { success: true, data: swap, message: 'Đã duyệt đổi tiết thành công' };
  }

  @Post(':id/reject-admin')
  @ApiOperation({ summary: 'Admin từ chối đổi tiết' })
  async rejectByAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string },
    @CurrentUser() user: { userId: string; schoolId: string },
  ) {
    const swap = await this.swapService.rejectByAdmin(
      id,
      user.schoolId,
      user.userId,
      body.reason,
    );
    return { success: true, data: swap, message: 'Admin đã từ chối đổi tiết' };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'GV hủy yêu cầu đổi tiết' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { userId: string; schoolId: string },
  ) {
    const swap = await this.swapService.cancel(id, user.schoolId, user.userId);
    return { success: true, data: swap, message: 'Đã hủy yêu cầu đổi tiết' };
  }
}
