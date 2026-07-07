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
import { PeriodSwapService } from '../services/period-swap.service';
import { CreatePeriodSwapDto, PeriodSwapQueryDto, RejectPeriodSwapDto } from '../dto';

@ApiTags('period-swaps')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('api/v1/period-swaps')
export class PeriodSwapController {
  constructor(private readonly swapService: PeriodSwapService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER, UserRole.TEACHER)
  @RequirePermissions(Permission.PERIOD_SWAP_READ)
  @ApiOperation({ summary: 'Danh sách yêu cầu đổi tiết' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async findAll(
    @Query() query: PeriodSwapQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    // GV chỉ xem yêu cầu liên quan đến mình
    if (user.role === UserRole.TEACHER) {
      query.teacherId = user.id;
    }

    const { items, total } = await this.swapService.findAll(user.schoolId!, {
      page: query.page,
      limit: query.limit,
      teacherId: query.teacherId,
      status: query.status,
    });
    return {
      success: true,
      data: items,
      message: 'Lấy danh sách yêu cầu đổi tiết thành công',
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
  @RequirePermissions(Permission.PERIOD_SWAP_READ)
  @ApiOperation({ summary: 'Chi tiết yêu cầu đổi tiết' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const swap = await this.swapService.findById(id, user.schoolId!);
    return { success: true, data: swap, message: 'Lấy chi tiết yêu cầu đổi tiết thành công' };
  }

  @Post()
  @Roles(UserRole.TEACHER)
  @RequirePermissions(Permission.PERIOD_SWAP_CREATE)
  @ApiOperation({ summary: 'Tạo yêu cầu đổi tiết (GV)' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  async create(
    @Body() dto: CreatePeriodSwapDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const swap = await this.swapService.create(dto, user.schoolId!, user.id);
    return { success: true, data: swap, message: 'Tạo yêu cầu đổi tiết thành công' };
  }

  @Post(':id/accept')
  @Roles(UserRole.TEACHER)
  @RequirePermissions(Permission.PERIOD_SWAP_CREATE)
  @ApiOperation({ summary: 'GV target đồng ý đổi tiết' })
  @ApiResponse({ status: 200, description: 'Đồng ý thành công' })
  @ApiResponse({ status: 400, description: 'Không thể đồng ý' })
  async acceptByTarget(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const swap = await this.swapService.acceptByTarget(id, user.schoolId!, user.id);
    return { success: true, data: swap, message: 'Đã đồng ý đổi tiết' };
  }

  @Post(':id/reject-teacher')
  @Roles(UserRole.TEACHER)
  @RequirePermissions(Permission.PERIOD_SWAP_CREATE)
  @ApiOperation({ summary: 'GV target từ chối đổi tiết' })
  @ApiResponse({ status: 200, description: 'Từ chối thành công' })
  @ApiResponse({ status: 400, description: 'Không thể từ chối' })
  async rejectByTarget(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectPeriodSwapDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const swap = await this.swapService.rejectByTarget(
      id,
      user.schoolId!,
      user.id,
      dto.reason,
    );
    return { success: true, data: swap, message: 'Đã từ chối đổi tiết' };
  }

  @Post(':id/approve')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @RequirePermissions(Permission.PERIOD_SWAP_APPROVE)
  @ApiOperation({ summary: 'Admin duyệt đổi tiết' })
  @ApiResponse({ status: 200, description: 'Duyệt thành công' })
  @ApiResponse({ status: 400, description: 'Trạng thái không cho phép duyệt' })
  async approveByAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const swap = await this.swapService.approveByAdmin(id, user.schoolId!, user.id);
    return { success: true, data: swap, message: 'Đã duyệt đổi tiết thành công' };
  }

  @Post(':id/reject-admin')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @RequirePermissions(Permission.PERIOD_SWAP_APPROVE)
  @ApiOperation({ summary: 'Admin từ chối đổi tiết' })
  @ApiResponse({ status: 200, description: 'Từ chối thành công' })
  @ApiResponse({ status: 400, description: 'Trạng thái không cho phép từ chối' })
  async rejectByAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectPeriodSwapDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const swap = await this.swapService.rejectByAdmin(
      id,
      user.schoolId!,
      user.id,
      dto.reason,
    );
    return { success: true, data: swap, message: 'Admin đã từ chối đổi tiết' };
  }

  @Post(':id/cancel')
  @Roles(UserRole.TEACHER)
  @RequirePermissions(Permission.PERIOD_SWAP_CREATE)
  @ApiOperation({ summary: 'GV hủy yêu cầu đổi tiết (trước khi approved)' })
  @ApiResponse({ status: 200, description: 'Hủy thành công' })
  @ApiResponse({ status: 400, description: 'Không thể hủy' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const swap = await this.swapService.cancel(id, user.schoolId!, user.id);
    return { success: true, data: swap, message: 'Đã hủy yêu cầu đổi tiết' };
  }
}
