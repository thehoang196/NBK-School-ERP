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
import { SemesterService } from '../services/semester.service';
import {
  CreateSemesterDto,
  UpdateSemesterDto,
  SemesterQueryDto,
} from '../dto/semester';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { UserRole } from '../../../common/enums/role.enum';

@ApiTags('semesters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/semesters')
export class SemesterController {
  constructor(private readonly semesterService: SemesterService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy danh sách học kỳ' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách học kỳ thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async findAll(
    @Query() query: SemesterQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.semesterService.findAll(user.schoolId ?? '', query);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy chi tiết học kỳ theo ID' })
  @ApiParam({ name: 'id', description: 'ID học kỳ', type: String })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết học kỳ thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy học kỳ' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.semesterService.findById(id, user.schoolId ?? undefined);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Tạo học kỳ mới' })
  @ApiResponse({ status: 201, description: 'Tạo học kỳ thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async create(
    @Body() dto: CreateSemesterDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.semesterService.create(user.schoolId ?? '', dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Cập nhật học kỳ' })
  @ApiParam({ name: 'id', description: 'ID học kỳ', type: String })
  @ApiResponse({ status: 200, description: 'Cập nhật học kỳ thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy học kỳ' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSemesterDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.semesterService.update(id, user.schoolId ?? '', dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Xóa học kỳ (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID học kỳ', type: String })
  @ApiResponse({ status: 200, description: 'Xóa học kỳ thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy học kỳ' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.semesterService.remove(id, user.schoolId ?? '');
    return { message: 'Xóa học kỳ thành công' };
  }
}
