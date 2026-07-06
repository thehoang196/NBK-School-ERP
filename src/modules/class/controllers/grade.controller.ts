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
import { GradeService } from '../services/grade.service';
import { CreateGradeDto } from '../dto/create-grade.dto';
import { UpdateGradeDto } from '../dto/update-grade.dto';
import { GradeQueryDto } from '../dto/grade-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { SchoolScopeGuard } from '../../../common/guards/school-scope.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { UserRole } from '../../../common/enums/role.enum';

@ApiTags('grades')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, SchoolScopeGuard)
@Controller('api/v1/grades')
export class GradeController {
  constructor(private readonly gradeService: GradeService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy danh sách khối' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách khối thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async findAll(
    @Query() query: GradeQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gradeService.findAll(user.schoolId ?? '', query);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy chi tiết khối theo ID' })
  @ApiParam({ name: 'id', description: 'ID khối', type: String })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết khối thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy khối' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gradeService.findById(id, user.schoolId ?? '');
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Tạo khối mới' })
  @ApiResponse({ status: 201, description: 'Tạo khối thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền tạo khối' })
  async create(
    @Body() dto: CreateGradeDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gradeService.create(dto, user.schoolId ?? '');
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Cập nhật khối' })
  @ApiParam({ name: 'id', description: 'ID khối', type: String })
  @ApiResponse({ status: 200, description: 'Cập nhật khối thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền cập nhật khối' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy khối' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGradeDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.gradeService.update(id, user.schoolId ?? '', dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Xóa khối (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID khối', type: String })
  @ApiResponse({ status: 200, description: 'Xóa khối thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền xóa khối' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy khối' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.gradeService.remove(id, user.schoolId ?? '');
    return { success: true, data: null, message: 'Xóa khối thành công' };
  }
}
