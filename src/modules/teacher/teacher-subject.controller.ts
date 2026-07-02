import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { TeacherSubjectService } from './teacher-subject.service';
import { AssignTeacherSubjectsDto } from './dto/assign-teacher-subjects.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';

@ApiTags('Teacher Subjects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/teachers/:teacherId/subjects')
export class TeacherSubjectController {
  constructor(private readonly teacherSubjectService: TeacherSubjectService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy danh sách môn học giảng dạy của giáo viên' })
  @ApiParam({ name: 'teacherId', description: 'ID giáo viên' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy giáo viên' })
  async findAll(@Param('teacherId', ParseUUIDPipe) teacherId: string) {
    const links = await this.teacherSubjectService.getAssignmentsForTeacher(teacherId);
    const data = links.map((link) => ({
      id: link.id,
      subjectId: link.subjectId,
      subject: link.subject,
    }));
    return {
      success: true,
      data,
      message: 'Lấy danh sách môn học giảng dạy thành công',
    };
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Gán một hoặc nhiều môn học giảng dạy cho giáo viên' })
  @ApiParam({ name: 'teacherId', description: 'ID giáo viên' })
  @ApiResponse({ status: 201, description: 'Gán thành công' })
  @ApiResponse({ status: 400, description: 'Môn học không cùng trường với giáo viên' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy giáo viên hoặc môn học' })
  @ApiResponse({ status: 409, description: 'Giáo viên đã được gán môn học này' })
  async assign(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Body() dto: AssignTeacherSubjectsDto,
  ) {
    const data = await this.teacherSubjectService.assignSubjects(teacherId, dto.subjectIds);
    return {
      success: true,
      data,
      message: 'Gán môn học giảng dạy thành công',
    };
  }

  @Delete(':assignmentId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Gỡ một môn học giảng dạy khỏi giáo viên (soft delete)' })
  @ApiParam({ name: 'teacherId', description: 'ID giáo viên' })
  @ApiParam({ name: 'assignmentId', description: 'ID liên kết môn học giảng dạy' })
  @ApiResponse({ status: 200, description: 'Gỡ thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy liên kết môn học giảng dạy' })
  async remove(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    await this.teacherSubjectService.removeAssignment(teacherId, assignmentId);
    return {
      success: true,
      data: null,
      message: 'Gỡ môn học giảng dạy thành công',
    };
  }
}
