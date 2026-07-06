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
import { LeaveRequestService } from '../services/leave-request.service';
import { CreateLeaveRequestDto, LeaveRequestQueryDto } from '../dto';

@ApiTags('leave-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/leave-requests')
export class LeaveRequestController {
  constructor(private readonly leaveRequestService: LeaveRequestService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách đơn xin nghỉ' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async findAll(
    @Query() query: LeaveRequestQueryDto,
    @CurrentUser() user: { schoolId: string },
  ) {
    const { items, total } = await this.leaveRequestService.findAll(
      user.schoolId,
      query,
    );
    return {
      success: true,
      data: items,
      message: 'Lấy danh sách đơn xin nghỉ thành công',
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết đơn xin nghỉ' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { schoolId: string },
  ) {
    const request = await this.leaveRequestService.findById(id, user.schoolId);
    return { success: true, data: request, message: 'Lấy chi tiết đơn xin nghỉ thành công' };
  }

  @Post()
  @ApiOperation({ summary: 'Tạo đơn xin nghỉ (giáo viên)' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  async create(
    @Body() dto: CreateLeaveRequestDto,
    @CurrentUser() user: { userId: string; schoolId: string },
  ) {
    const request = await this.leaveRequestService.create(
      dto,
      user.schoolId,
      user.userId,
    );
    return { success: true, data: request, message: 'Tạo đơn xin nghỉ thành công' };
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Duyệt đơn xin nghỉ (admin/BGH)' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { adminNote?: string },
    @CurrentUser() user: { userId: string; schoolId: string },
  ) {
    const request = await this.leaveRequestService.approve(
      id,
      user.schoolId,
      user.userId,
      body.adminNote,
    );
    return { success: true, data: request, message: 'Duyệt đơn nghỉ thành công' };
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Từ chối đơn xin nghỉ (admin/BGH)' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string },
    @CurrentUser() user: { userId: string; schoolId: string },
  ) {
    const request = await this.leaveRequestService.reject(
      id,
      user.schoolId,
      user.userId,
      body.reason,
    );
    return { success: true, data: request, message: 'Từ chối đơn nghỉ thành công' };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Hủy đơn xin nghỉ (giáo viên)' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { userId: string; schoolId: string },
  ) {
    const request = await this.leaveRequestService.cancel(
      id,
      user.schoolId,
      user.userId,
    );
    return { success: true, data: request, message: 'Hủy đơn nghỉ thành công' };
  }
}
