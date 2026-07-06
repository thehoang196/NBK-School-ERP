import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/role.enum';
import { FieldDefinitionService } from '../services/field-definition.service';
import { RegisterFieldDto } from '../dto/register-field.dto';
import { FieldDefinitionEntity } from '../entities/field-definition.entity';

@ApiTags('Master Data - Field Definitions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/master-data/field-definitions')
export class FieldDefinitionController {
  constructor(
    private readonly fieldDefinitionService: FieldDefinitionService,
  ) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy danh sách định nghĩa trường mở rộng' })
  @ApiQuery({
    name: 'schoolId',
    required: true,
    type: String,
    description: 'School ID (UUID)',
  })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async findAll(
    @Query('schoolId') schoolId: string,
  ): Promise<FieldDefinitionEntity[]> {
    return this.fieldDefinitionService.findAll(schoolId);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Đăng ký trường mở rộng mới' })
  @ApiResponse({ status: 201, description: 'Đăng ký thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 409, description: 'Trường đã tồn tại' })
  async register(
    @Body() dto: RegisterFieldDto,
  ): Promise<FieldDefinitionEntity> {
    return this.fieldDefinitionService.register(dto);
  }
}
