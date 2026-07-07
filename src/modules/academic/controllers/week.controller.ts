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
import { WeekService } from '../services/week.service';
import {
  CreateWeekDto,
  UpdateWeekDto,
  WeekQueryDto,
  GenerateWeeksDto,
  ReorderWeeksDto,
  BulkGenerateResultDto,
} from '../dto/week';
import { WeekEntity } from '../entities/week.entity';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { UserRole } from '../../../common/enums/role.enum';

@ApiTags('weeks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/weeks')
export class WeekController {
  constructor(private readonly weekService: WeekService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({
    summary:
      'Lấy danh sách tuần (hỗ trợ lọc theo semesterId, weekType, isHoliday)',
  })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  async findAll(
    @Query() query: WeekQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.weekService.findAll(query, query.schoolId || user.schoolId || '');
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Tạo tuần mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 409, description: 'Trùng ngày với tuần khác' })
  async create(
    @Body() dto: CreateWeekDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.weekService.create(dto, user.schoolId ?? '');
  }

  @Post('generate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({
    summary: 'Tự sinh tuần từ ngày bắt đầu đến ngày kết thúc học kỳ',
  })
  @ApiResponse({
    status: 201,
    description: 'Sinh tuần thành công',
    type: BulkGenerateResultDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy học kỳ' })
  @ApiResponse({
    status: 409,
    description: 'Học kỳ đã có tuần, cần xóa trước khi sinh lại',
  })
  async generate(
    @Body() dto: GenerateWeeksDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<BulkGenerateResultDto> {
    return this.weekService.bulkGenerate(dto.semesterId, user.schoolId ?? '');
  }

  @Patch('reorder/:semesterId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Sắp xếp lại thứ tự tuần trong học kỳ' })
  @ApiParam({ name: 'semesterId', description: 'ID học kỳ', type: String })
  @ApiResponse({
    status: 200,
    description: 'Sắp xếp thành công',
    type: [WeekEntity],
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy học kỳ' })
  async reorder(
    @Param('semesterId', ParseUUIDPipe) semesterId: string,
    @Body() dto: ReorderWeeksDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<WeekEntity[]> {
    return this.weekService.reorder(semesterId, dto, user.schoolId ?? '');
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy chi tiết tuần theo ID' })
  @ApiParam({ name: 'id', description: 'ID tuần', type: String })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.weekService.findById(id, user.schoolId ?? undefined);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Cập nhật thông tin tuần' })
  @ApiParam({ name: 'id', description: 'ID tuần', type: String })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  @ApiResponse({ status: 409, description: 'Trùng ngày với tuần khác' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWeekDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.weekService.update(id, dto, user.schoolId ?? '');
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Xóa tuần (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID tuần', type: String })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.weekService.remove(id, user.schoolId ?? undefined);
    return { message: 'Xóa tuần thành công' };
  }
}
