import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CurriculumPlanService, CreateCurriculumPlanInput } from './curriculum-plan.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { SchoolScopeGuard } from '../../common/guards/school-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';

@ApiTags('Curriculum Plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, SchoolScopeGuard)
@Controller('api/v1/curriculum-plans')
export class CurriculumPlanController {
  constructor(private readonly service: CurriculumPlanService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy danh sách kế hoạch giảng dạy' })
  @ApiResponse({ status: 200, description: 'Danh sách kế hoạch' })
  async findAll(@Query('schoolId') schoolId: string) {
    return this.service.findBySchool(schoolId);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Chi tiết kế hoạch giảng dạy' })
  @ApiResponse({ status: 200, description: 'Chi tiết kế hoạch' })
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Tạo kế hoạch giảng dạy mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  async create(@Body() dto: CreateCurriculumPlanInput) {
    return this.service.create(dto);
  }

  @Patch(':id/approve')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Phê duyệt kế hoạch giảng dạy' })
  @ApiResponse({ status: 200, description: 'Phê duyệt thành công' })
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.approve(id, user.id);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Xóa kế hoạch giảng dạy' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { message: 'Đã xóa kế hoạch giảng dạy' };
  }
}
