import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { TeacherSchoolAssignmentService } from './teacher-school-assignment.service';
import { CreateTeacherSchoolAssignmentDto } from './dto/create-teacher-school-assignment.dto';
import { TeacherSchoolAssignmentResponseDto } from './dto/teacher-school-assignment-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { ApiResponse } from '../../common/interfaces/api-response.interface';
import { TeacherSchoolAssignmentEntity } from './entities/teacher-school-assignment.entity';

@ApiTags('teacher-school-assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/teacher-school-assignments')
export class TeacherSchoolAssignmentController {
  constructor(
    private readonly teacherSchoolAssignmentService: TeacherSchoolAssignmentService,
  ) {}

  @Post()
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo phân công giáo viên - trường mới' })
  @SwaggerResponse({
    status: 201,
    description: 'Tạo phân công thành công',
    type: TeacherSchoolAssignmentResponseDto,
  })
  @SwaggerResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @SwaggerResponse({ status: 403, description: 'Không có quyền' })
  @SwaggerResponse({ status: 409, description: 'Phân công đã tồn tại' })
  async create(
    @Body() dto: CreateTeacherSchoolAssignmentDto,
  ): Promise<ApiResponse<TeacherSchoolAssignmentEntity>> {
    const data =
      await this.teacherSchoolAssignmentService.createAssignment(dto);
    return {
      success: true,
      data,
      message: 'Tạo phân công giáo viên liên trường thành công',
    };
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vô hiệu hóa phân công giáo viên - trường' })
  @ApiParam({ name: 'id', description: 'ID bản ghi phân công', type: 'string' })
  @SwaggerResponse({ status: 200, description: 'Vô hiệu hóa thành công' })
  @SwaggerResponse({
    status: 400,
    description: 'Không thể vô hiệu hóa phân công chính',
  })
  @SwaggerResponse({ status: 404, description: 'Không tìm thấy phân công' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<null>> {
    await this.teacherSchoolAssignmentService.deactivateAssignment(id);
    return {
      success: true,
      data: null,
      message: 'Vô hiệu hóa phân công thành công',
    };
  }

  @Get('teacher/:teacherId')
  @ApiOperation({ summary: 'Lấy danh sách phân công theo giáo viên' })
  @ApiParam({ name: 'teacherId', description: 'ID giáo viên', type: 'string' })
  @SwaggerResponse({
    status: 200,
    description: 'Thành công',
    type: [TeacherSchoolAssignmentResponseDto],
  })
  async findByTeacher(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
  ): Promise<ApiResponse<TeacherSchoolAssignmentEntity[]>> {
    const data =
      await this.teacherSchoolAssignmentService.findByTeacher(teacherId);
    return {
      success: true,
      data,
      message: 'Lấy danh sách phân công theo giáo viên thành công',
    };
  }

  @Get('school/:schoolId')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Lấy danh sách phân công theo trường' })
  @ApiParam({ name: 'schoolId', description: 'ID trường', type: 'string' })
  @SwaggerResponse({
    status: 200,
    description: 'Thành công',
    type: [TeacherSchoolAssignmentResponseDto],
  })
  @SwaggerResponse({ status: 403, description: 'Không có quyền' })
  async findBySchool(
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
  ): Promise<ApiResponse<TeacherSchoolAssignmentEntity[]>> {
    const data =
      await this.teacherSchoolAssignmentService.findBySchool(schoolId);
    return {
      success: true,
      data,
      message: 'Lấy danh sách phân công theo trường thành công',
    };
  }
}
