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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { PeriodDefinitionService } from '../services/period-definition.service';
import {
  CreatePeriodDefinitionDto,
  UpdatePeriodDefinitionDto,
  PeriodDefinitionQueryDto,
} from '../dto/period-definition';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { UserRole } from '../../../common/enums/role.enum';

@ApiTags('period-definitions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/period-definitions')
export class PeriodDefinitionController {
  constructor(
    private readonly periodDefinitionService: PeriodDefinitionService,
  ) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy danh sách tiết học' })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách tiết học thành công',
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async findAll(
    @Query() query: PeriodDefinitionQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.periodDefinitionService.findAll(query, query.schoolId || user.schoolId || '');
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy chi tiết tiết học theo ID' })
  @ApiParam({ name: 'id', description: 'ID tiết học (UUID)', type: String })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết tiết học thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tiết học' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.periodDefinitionService.findById(
      id,
      user.schoolId ?? undefined,
    );
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo tiết học mới' })
  @ApiResponse({ status: 201, description: 'Tạo tiết học thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async create(
    @Body() dto: CreatePeriodDefinitionDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.periodDefinitionService.create(dto, user.schoolId ?? '');
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Cập nhật tiết học' })
  @ApiParam({ name: 'id', description: 'ID tiết học (UUID)', type: String })
  @ApiResponse({ status: 200, description: 'Cập nhật tiết học thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tiết học' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePeriodDefinitionDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.periodDefinitionService.update(
      id,
      dto,
      user.schoolId ?? undefined,
    );
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Xóa tiết học (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID tiết học (UUID)', type: String })
  @ApiResponse({ status: 200, description: 'Xóa tiết học thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tiết học' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.periodDefinitionService.remove(id, user.schoolId ?? undefined);
    return { success: true, data: null, message: 'Xóa tiết học thành công' };
  }
}
