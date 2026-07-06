import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OrgTeacherService } from '../services/org-teacher.service';
import { OrgTeacherQueryDto } from '../dto/org-teacher-query.dto';
import {
  OrgTeacherResponseDto,
  OrgTeacherDetailDto,
} from '../dto/org-teacher-response.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { UserRole } from '../../../common/enums/role.enum';
import {
  PaginatedResponse,
  ApiResponse,
} from '../../../common/interfaces/api-response.interface';

@ApiTags('Organization Teachers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/org/teachers')
export class OrgTeacherController {
  constructor(private readonly orgTeacherService: OrgTeacherService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy danh sách giáo viên toàn tổ chức' })
  @SwaggerResponse({ status: 200, description: 'Lấy danh sách thành công' })
  @SwaggerResponse({ status: 401, description: 'Chưa xác thực' })
  @SwaggerResponse({ status: 403, description: 'Không có quyền' })
  async findAll(
    @Query() query: OrgTeacherQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<PaginatedResponse<OrgTeacherResponseDto>> {
    const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;
    return this.orgTeacherService.findAll(
      query,
      user.schoolId ?? undefined,
      isSuperAdmin,
    );
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy chi tiết giáo viên với lịch sử phân công' })
  @SwaggerResponse({ status: 200, description: 'Lấy chi tiết thành công' })
  @SwaggerResponse({ status: 401, description: 'Chưa xác thực' })
  @SwaggerResponse({ status: 403, description: 'Không có quyền' })
  @SwaggerResponse({ status: 404, description: 'Không tìm thấy giáo viên' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<OrgTeacherDetailDto>> {
    const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;
    const data = await this.orgTeacherService.findOne(
      id,
      user.schoolId ?? undefined,
      isSuperAdmin,
    );

    return {
      success: true,
      data,
      message: 'Lấy chi tiết giáo viên thành công',
    };
  }
}
