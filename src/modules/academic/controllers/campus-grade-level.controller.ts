import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseEnumPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CampusGradeLevelService } from '../services/campus-grade-level.service';
import { AssignGradeLevelDto } from '../dto/campus-grade-level/assign-grade-level.dto';
import { CampusGradeLevelQueryDto } from '../dto/campus-grade-level/campus-grade-level-query.dto';
import { CampusGradeLevelResponseDto } from '../dto/campus-grade-level/campus-grade-level-response.dto';
import { GradeLevel } from '../enums';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { UserRole } from '../../../common/enums/role.enum';

@ApiTags('Campus Grade Levels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/campus-grade-levels')
export class CampusGradeLevelController {
  constructor(
    private readonly campusGradeLevelService: CampusGradeLevelService,
  ) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Gán cấp học cho cơ sở' })
  @ApiResponse({
    status: 201,
    description: 'Gán cấp học thành công',
    type: CampusGradeLevelResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({
    status: 409,
    description: 'Cấp học đã được gán cho cơ sở này',
  })
  async assign(
    @Body() dto: AssignGradeLevelDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<CampusGradeLevelResponseDto> {
    const result = await this.campusGradeLevelService.assign(
      dto,
      user.schoolId!,
    );
    return result;
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy danh sách liên kết cơ sở - cấp học' })
  @ApiResponse({
    status: 200,
    description: 'Thành công',
    type: [CampusGradeLevelResponseDto],
  })
  async findAll(
    @Query() query: CampusGradeLevelQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<CampusGradeLevelResponseDto[]> {
    return this.campusGradeLevelService.findAll(query, user.schoolId!);
  }

  @Get('by-campus/:campusId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy danh sách cấp học theo cơ sở' })
  @ApiParam({ name: 'campusId', description: 'ID cơ sở', type: String })
  @ApiResponse({
    status: 200,
    description: 'Thành công',
    type: [CampusGradeLevelResponseDto],
  })
  async findByCampus(
    @Param('campusId', ParseUUIDPipe) campusId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<CampusGradeLevelResponseDto[]> {
    return this.campusGradeLevelService.findByCampus(campusId, user.schoolId!);
  }

  @Get('by-grade/:gradeLevel')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy danh sách cơ sở theo cấp học' })
  @ApiParam({
    name: 'gradeLevel',
    description: 'Cấp học',
    enum: GradeLevel,
  })
  @ApiResponse({
    status: 200,
    description: 'Thành công',
    type: [CampusGradeLevelResponseDto],
  })
  async findByGradeLevel(
    @Param('gradeLevel', new ParseEnumPipe(GradeLevel)) gradeLevel: GradeLevel,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<CampusGradeLevelResponseDto[]> {
    return this.campusGradeLevelService.findByGradeLevel(
      gradeLevel,
      user.schoolId!,
    );
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Xóa liên kết cơ sở - cấp học (soft delete)' })
  @ApiParam({
    name: 'id',
    description: 'ID bản ghi campus-grade-level',
    type: String,
  })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bản ghi' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ message: string }> {
    await this.campusGradeLevelService.remove(id, user.schoolId!);
    return { message: 'Xóa liên kết cơ sở - cấp học thành công' };
  }
}
