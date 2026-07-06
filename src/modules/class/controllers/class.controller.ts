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
import { ClassService } from '../services/class.service';
import { CreateClassDto } from '../dto/create-class.dto';
import { UpdateClassDto } from '../dto/update-class.dto';
import { ClassQueryDto } from '../dto/class-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { SchoolScopeGuard } from '../../../common/guards/school-scope.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { UserRole } from '../../../common/enums/role.enum';

@ApiTags('classes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, SchoolScopeGuard)
@Controller('api/v1/classes')
export class ClassController {
  constructor(private readonly classService: ClassService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy danh sách lớp' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách lớp thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async findAll(
    @Query() query: ClassQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.classService.findAll(query, user.schoolId);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy chi tiết lớp theo ID' })
  @ApiParam({ name: 'id', description: 'ID lớp', type: String })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết lớp thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy lớp' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.classService.findById(id, user.schoolId ?? undefined);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Tạo lớp mới' })
  @ApiResponse({ status: 201, description: 'Tạo lớp thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền tạo lớp' })
  @ApiResponse({
    status: 409,
    description: 'Trùng tên lớp trong cùng khối và năm học',
  })
  async create(
    @Body() dto: CreateClassDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.classService.create(dto, user.schoolId);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Cập nhật thông tin lớp' })
  @ApiParam({ name: 'id', description: 'ID lớp', type: String })
  @ApiResponse({ status: 200, description: 'Cập nhật lớp thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền cập nhật lớp' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy lớp' })
  @ApiResponse({
    status: 409,
    description: 'Trùng tên lớp trong cùng khối và năm học',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.classService.update(id, dto, user.schoolId);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Xóa lớp (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID lớp', type: String })
  @ApiResponse({ status: 200, description: 'Xóa lớp thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền xóa lớp' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy lớp' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.classService.remove(id, user.schoolId);
    return { success: true, data: null, message: 'Xóa lớp thành công' };
  }
}
