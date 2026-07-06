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
} from '@nestjs/swagger';
import { VariableService } from '../services/variable.service';
import { CreateVariableDto } from '../dto/variable/create-variable.dto';
import { UpdateVariableDto } from '../dto/variable/update-variable.dto';
import { VariableQueryDto } from '../dto/variable/variable-query.dto';
import { CreateVariableOverrideDto } from '../dto/variable/create-variable-override.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/role.enum';

@ApiTags('Compensation - Variables')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/compensation/variables')
export class VariableController {
  constructor(private readonly variableService: VariableService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy danh sách biến' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async findAll(@Query() query: VariableQueryDto) {
    return this.variableService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy chi tiết biến' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.variableService.findById(id);
  }

  @Get(':id/history')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy lịch sử thay đổi biến' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.variableService.getHistory(id);
  }

  @Get(':id/overrides')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy danh sách override của biến' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async findOverrides(@Param('id', ParseUUIDPipe) id: string) {
    return this.variableService.findOverrides(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Tạo biến mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 409, description: 'Mã đã tồn tại' })
  async create(@Body() dto: CreateVariableDto) {
    return this.variableService.create(dto);
  }

  @Post(':id/overrides')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Tạo override cho biến' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  async createOverride(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVariableOverrideDto,
  ) {
    return this.variableService.createOverride(id, dto);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Cập nhật biến' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVariableDto,
  ) {
    return this.variableService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Xóa biến (soft delete)' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 400, description: 'Đang được tham chiếu' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async softDelete(@Param('id', ParseUUIDPipe) id: string) {
    await this.variableService.softDelete(id);
    return { success: true, message: 'Xóa biến thành công' };
  }
}
