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
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { SubjectService } from './subject.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { SubjectQueryDto } from './dto/subject-query.dto';
import { BulkUpsertSubjectGradeDto } from './dto/bulk-upsert-subject-grade.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';

@ApiTags('subjects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/subjects')
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy danh sách môn học' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách môn học thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async findAll(@Query() query: SubjectQueryDto) {
    return this.subjectService.findAll(query);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Tạo môn học mới' })
  @ApiResponse({ status: 201, description: 'Tạo môn học thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 409, description: 'Mã môn học đã tồn tại' })
  async create(@Body() dto: CreateSubjectDto) {
    return this.subjectService.create(dto);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy chi tiết môn học theo ID' })
  @ApiParam({ name: 'id', description: 'ID môn học (UUID)', type: String })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết môn học thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy môn học' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.subjectService.findById(id, user.schoolId ?? undefined);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Cập nhật thông tin môn học' })
  @ApiParam({ name: 'id', description: 'ID môn học (UUID)', type: String })
  @ApiResponse({ status: 200, description: 'Cập nhật môn học thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy môn học' })
  @ApiResponse({ status: 409, description: 'Mã môn học đã tồn tại' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubjectDto,
  ) {
    return this.subjectService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Xóa môn học (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID môn học (UUID)', type: String })
  @ApiResponse({ status: 200, description: 'Xóa môn học thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy môn học' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.subjectService.softDelete(id, user.schoolId ?? undefined);
    return { success: true, data: null, message: 'Xóa môn học thành công' };
  }

  // ============ SubjectGrade Endpoints (REQ-9.2) ============

  @Post(':id/grades')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({
    summary: 'Gán số tiết/tuần theo khối cho môn học (bulk upsert)',
  })
  @ApiParam({ name: 'id', description: 'ID môn học (UUID)', type: String })
  @ApiResponse({ status: 201, description: 'Gán số tiết theo khối thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy môn học' })
  async bulkUpsertGrades(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BulkUpsertSubjectGradeDto,
  ) {
    const data = await this.subjectService.bulkUpsertSubjectGrades(
      id,
      dto.grades,
    );
    return {
      success: true,
      data,
      message: 'Gán số tiết theo khối thành công',
    };
  }

  @Get(':id/grades')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy danh sách số tiết/tuần theo khối của môn học' })
  @ApiParam({ name: 'id', description: 'ID môn học (UUID)', type: String })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách số tiết theo khối thành công',
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy môn học' })
  async getSubjectGrades(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.subjectService.getSubjectGrades(id);
    return {
      success: true,
      data,
      message: 'Lấy danh sách số tiết theo khối thành công',
    };
  }
}
