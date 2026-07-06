import {
  Controller,
  Get,
  Post,
  Put,
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
  ApiQuery,
} from '@nestjs/swagger';
import { TeachingAssignmentService } from './teaching-assignment.service';
import {
  CreateTeachingAssignmentDto,
  UpdateTeachingAssignmentDto,
  BulkCreateTeachingAssignmentDto,
  CopyPreviousTeachingAssignmentDto,
  TeachingAssignmentQueryDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';

@ApiTags('Teaching Assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/teaching-assignments')
export class TeachingAssignmentController {
  constructor(
    private readonly teachingAssignmentService: TeachingAssignmentService,
  ) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy danh sách phân công giảng dạy' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async findAll(@Query() query: TeachingAssignmentQueryDto) {
    return this.teachingAssignmentService.findAll(query);
  }

  @Get('workload')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({
    summary: 'Lấy thông tin khối lượng giảng dạy tất cả giáo viên',
  })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiQuery({ name: 'semesterId', required: true, description: 'ID học kỳ' })
  async getAllWorkloads(@Query('semesterId') semesterId: string) {
    const data =
      await this.teachingAssignmentService.checkAllWorkloads(semesterId);
    return {
      success: true,
      data,
      message: 'Lấy thông tin khối lượng giảng dạy thành công',
    };
  }

  @Get('workload/:teacherId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({
    summary: 'Lấy thông tin khối lượng giảng dạy của một giáo viên',
  })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy giáo viên' })
  @ApiParam({ name: 'teacherId', description: 'ID giáo viên' })
  @ApiQuery({ name: 'semesterId', required: true, description: 'ID học kỳ' })
  async getTeacherWorkload(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Query('semesterId') semesterId: string,
  ) {
    const data = await this.teachingAssignmentService.checkWorkload(
      teacherId,
      semesterId,
    );
    return {
      success: true,
      data,
      message: 'Lấy thông tin khối lượng giảng dạy thành công',
    };
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy chi tiết phân công giảng dạy' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.teachingAssignmentService.findById(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Tạo phân công giảng dạy' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 409, description: 'Phân công đã tồn tại' })
  async create(@Body() dto: CreateTeachingAssignmentDto) {
    const data = await this.teachingAssignmentService.create(dto);
    const warning =
      await this.teachingAssignmentService.getQualificationWarning(
        dto.teacherId,
        dto.subjectId,
      );
    return {
      success: true,
      data,
      message: 'Tạo phân công giảng dạy thành công',
      ...(warning && { warning }),
    };
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Cập nhật phân công giảng dạy' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  @ApiResponse({ status: 409, description: 'Phân công đã tồn tại' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeachingAssignmentDto,
  ) {
    const data = await this.teachingAssignmentService.update(id, dto);
    const warning =
      await this.teachingAssignmentService.getQualificationWarning(
        data.teacherId,
        data.subjectId,
      );
    return {
      success: true,
      data,
      message: 'Cập nhật phân công giảng dạy thành công',
      ...(warning && { warning }),
    };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Xóa phân công giảng dạy (soft delete)' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.teachingAssignmentService.remove(id);
    return {
      success: true,
      data: null,
      message: 'Xóa phân công giảng dạy thành công',
    };
  }

  @Post('bulk')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Tạo hàng loạt phân công giảng dạy' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 409, description: 'Có phân công trùng lặp' })
  async bulkCreate(@Body() dto: BulkCreateTeachingAssignmentDto) {
    return this.teachingAssignmentService.bulkCreate(dto);
  }

  @Post('copy-previous')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Sao chép phân công từ học kỳ trước' })
  @ApiResponse({ status: 201, description: 'Sao chép thành công' })
  @ApiResponse({ status: 400, description: 'Không có dữ liệu học kỳ nguồn' })
  async copyFromPrevious(@Body() dto: CopyPreviousTeachingAssignmentDto) {
    return this.teachingAssignmentService.copyFromPreviousSemester(dto);
  }
}
