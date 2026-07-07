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
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { UserRole } from '../../../common/enums/role.enum';
import { Permission } from '../../../common/enums/permission.enum';
import { LeaveRequestService } from '../services/leave-request.service';
import {
  CreateLeaveRequestDto,
  LeaveRequestQueryDto,
  ApproveLeaveRequestDto,
  RejectLeaveRequestDto,
} from '../dto';

@ApiTags('leave-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('api/v1/leave-requests')
export class LeaveRequestController {
  constructor(private readonly leaveRequestService: LeaveRequestService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER, UserRole.TEACHER)
  @RequirePermissions(Permission.LEAVE_REQUEST_READ)
  @ApiOperation({ summary: 'Danh sách đơn xin nghỉ' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async findAll(
    @Query() query: LeaveRequestQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    // GV chỉ xem đơn của mình, admin xem tất cả
    if (user.role === UserRole.TEACHER) {
      query.teacherId = user.id;
    }

    const { items, total } = await this.leaveRequestService.findAll(
      user.schoolId!,
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
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER, UserRole.TEACHER)
  @RequirePermissions(Permission.LEAVE_REQUEST_READ)
  @ApiOperation({ summary: 'Chi tiết đơn xin nghỉ' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const request = await this.leaveRequestService.findById(id, user.schoolId!);
    return { success: true, data: request, message: 'Lấy chi tiết đơn xin nghỉ thành công' };
  }

  @Post()
  @Roles(UserRole.TEACHER)
  @RequirePermissions(Permission.LEAVE_REQUEST_CREATE)
  @ApiOperation({ summary: 'Tạo đơn xin nghỉ (giáo viên)' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc trùng ngày' })
  async create(
    @Body() dto: CreateLeaveRequestDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const request = await this.leaveRequestService.create(
      dto,
      user.schoolId!,
      user.id,
    );
    return { success: true, data: request, message: 'Tạo đơn xin nghỉ thành công' };
  }

  @Post(':id/approve')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @RequirePermissions(Permission.LEAVE_REQUEST_APPROVE)
  @ApiOperation({ summary: 'Duyệt đơn xin nghỉ (admin/BGH)' })
  @ApiResponse({ status: 200, description: 'Duyệt thành công' })
  @ApiResponse({ status: 400, description: 'Đơn không ở trạng thái chờ duyệt' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveLeaveRequestDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const request = await this.leaveRequestService.approve(
      id,
      user.schoolId!,
      user.id,
      dto.adminNote,
    );
    return { success: true, data: request, message: 'Duyệt đơn nghỉ thành công' };
  }

  @Post(':id/reject')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @RequirePermissions(Permission.LEAVE_REQUEST_REJECT)
  @ApiOperation({ summary: 'Từ chối đơn xin nghỉ (admin/BGH)' })
  @ApiResponse({ status: 200, description: 'Từ chối thành công' })
  @ApiResponse({ status: 400, description: 'Đơn không ở trạng thái chờ duyệt' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectLeaveRequestDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const request = await this.leaveRequestService.reject(
      id,
      user.schoolId!,
      user.id,
      dto.reason,
    );
    return { success: true, data: request, message: 'Từ chối đơn nghỉ thành công' };
  }

  @Post(':id/cancel')
  @Roles(UserRole.TEACHER)
  @RequirePermissions(Permission.LEAVE_REQUEST_CREATE)
  @ApiOperation({ summary: 'Hủy đơn xin nghỉ (giáo viên - chỉ khi đang chờ)' })
  @ApiResponse({ status: 200, description: 'Hủy thành công' })
  @ApiResponse({ status: 400, description: 'Không thể hủy' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const request = await this.leaveRequestService.cancel(
      id,
      user.schoolId!,
      user.id,
    );
    return { success: true, data: request, message: 'Hủy đơn nghỉ thành công' };
  }
}
