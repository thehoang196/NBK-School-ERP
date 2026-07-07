import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AcademicYearService } from '../services/academic-year.service';
import {
  CreateAcademicYearDto,
  UpdateAcademicYearDto,
  AcademicYearQueryDto,
  TransitionStatusDto,
} from '../dto/academic-year';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { SchoolScopeGuard } from '../../../common/guards/school-scope.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { UserRole } from '../../../common/enums/role.enum';

@ApiTags('Academic Years')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, SchoolScopeGuard)
@Controller('api/v1/academic-years')
export class AcademicYearController {
  constructor(private readonly academicYearService: AcademicYearService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy danh sách năm học' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách năm học thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async findAll(
    @Query() query: AcademicYearQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    // SUPER_ADMIN: dùng schoolId từ query param; các role khác: từ JWT
    const schoolId = query.schoolId || user.schoolId || '';
    return this.academicYearService.findAll(schoolId, query);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy chi tiết năm học theo ID' })
  @ApiParam({ name: 'id', description: 'ID năm học', type: String })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết năm học thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy năm học' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() _user: CurrentUserPayload,
  ) {
    return this.academicYearService.findById(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Tạo năm học mới' })
  @ApiResponse({ status: 201, description: 'Tạo năm học thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền tạo năm học' })
  async create(
    @Body() dto: CreateAcademicYearDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    // Gán schoolId từ JWT payload nếu user không phải SUPER_ADMIN
    if (user.schoolId) {
      dto.schoolId = user.schoolId;
    }
    return this.academicYearService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Cập nhật năm học' })
  @ApiParam({ name: 'id', description: 'ID năm học', type: String })
  @ApiResponse({ status: 200, description: 'Cập nhật năm học thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền cập nhật năm học' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy năm học' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAcademicYearDto,
    @CurrentUser() _user: CurrentUserPayload,
  ) {
    return this.academicYearService.update(id, dto);
  }

  @Patch(':id/set-current')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Đặt năm học làm năm học hiện tại' })
  @ApiParam({ name: 'id', description: 'ID năm học', type: String })
  @ApiResponse({ status: 200, description: 'Đặt năm học hiện tại thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền thực hiện' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy năm học' })
  async setCurrent(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.academicYearService.setCurrent(id, user.schoolId ?? '');
  }

  @Patch(':id/transition-status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({
    summary: 'Chuyển trạng thái năm học (planning → active → completed)',
  })
  @ApiParam({ name: 'id', description: 'ID năm học', type: String })
  @ApiResponse({ status: 200, description: 'Chuyển trạng thái thành công' })
  @ApiResponse({ status: 400, description: 'Chuyển trạng thái không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền thực hiện' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy năm học' })
  async transitionStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionStatusDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.academicYearService.transitionStatus(
      id,
      dto.newStatus,
      user.schoolId ?? '',
    );
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Xóa năm học (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID năm học', type: String })
  @ApiResponse({ status: 200, description: 'Xóa năm học thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền xóa năm học' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy năm học' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() _user: CurrentUserPayload,
  ) {
    await this.academicYearService.remove(id);
    return { success: true, data: null, message: 'Xóa năm học thành công' };
  }
}
