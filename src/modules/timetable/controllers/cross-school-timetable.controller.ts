import {
  Controller,
  Get,
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
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/role.enum';
import { ApiResponse as ApiResponseType } from '../../../common/interfaces/api-response.interface';
import {
  CrossSchoolTimetableService,
  MergedTimetableSlot,
} from '../services/cross-school-timetable.service';

@ApiTags('Cross-School Timetable')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/timetable/cross-school')
export class CrossSchoolTimetableController {
  constructor(
    private readonly crossSchoolTimetableService: CrossSchoolTimetableService,
  ) {}

  @Get('teacher/:teacherId')
  @Roles(
    UserRole.TEACHER,
    UserRole.SCHEDULER,
    UserRole.SCHOOL_ADMIN,
    UserRole.SUPER_ADMIN,
  )
  @ApiOperation({
    summary: 'Lấy thời khóa biểu hợp nhất cross-school cho giáo viên',
  })
  @ApiParam({
    name: 'teacherId',
    type: String,
    description: 'UUID của giáo viên',
  })
  @ApiQuery({
    name: 'semesterId',
    type: String,
    required: true,
    description: 'UUID của học kỳ (bắt buộc)',
  })
  @ApiQuery({
    name: 'schoolId',
    type: String,
    required: false,
    description: 'UUID của trường để lọc (tùy chọn)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy thời khóa biểu hợp nhất thành công',
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa xác thực',
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền truy cập',
  })
  async getMergedTimetable(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Query('semesterId', ParseUUIDPipe) semesterId: string,
    @Query('schoolId') schoolId?: string,
  ): Promise<ApiResponseType<MergedTimetableSlot[]>> {
    const data = await this.crossSchoolTimetableService.getMergedTimetable(
      teacherId,
      semesterId,
      schoolId,
    );
    return {
      success: true,
      data,
      message: 'Lấy thời khóa biểu hợp nhất cross-school thành công',
    };
  }
}
