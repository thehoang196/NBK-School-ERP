import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { DataQualityService } from '../services/data-quality.service';
import { MergeTeachersDto } from '../dto/merge-teachers.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/role.enum';
import { TeacherEntity } from '../entities/teacher.entity';
import {
  DeduplicationResult,
  MergeResult,
  MergeOptions,
} from '../interfaces/data-quality.interface';

@ApiTags('Teacher Data Quality')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/teachers/data-quality')
export class DataQualityController {
  constructor(private readonly dataQualityService: DataQualityService) {}

  @Get('duplicates')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Phát hiện giáo viên trùng lặp (duplicates)' })
  @ApiQuery({ name: 'schoolId', type: 'string', description: 'ID trường' })
  @ApiQuery({
    name: 'threshold',
    type: 'number',
    required: false,
    description: 'Ngưỡng tương đồng (0-100, mặc định 80)',
  })
  @ApiResponse({ status: 200, description: 'Danh sách potential duplicates' })
  async findDuplicates(
    @Query('schoolId') schoolId: string,
    @Query('threshold') threshold?: string,
  ): Promise<DeduplicationResult> {
    const similarityThreshold = threshold ? parseInt(threshold, 10) : 80;
    return this.dataQualityService.deduplicateTeachers(
      schoolId,
      similarityThreshold,
    );
  }

  @Post('merge')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Merge hai giáo viên trùng lặp' })
  @ApiResponse({ status: 200, description: 'Kết quả merge' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 409, description: 'Hai giáo viên không cùng trường' })
  async mergeTeachers(@Body() dto: MergeTeachersDto): Promise<MergeResult> {
    const options: MergeOptions = {
      keepFieldsFromSecondary: dto.keepFieldsFromSecondary as
        Array<keyof TeacherEntity> | undefined,
      preserveHistory: dto.preserveHistory ?? true,
    };

    return this.dataQualityService.mergeTeachers(
      dto.primaryId,
      dto.secondaryId,
      options,
    );
  }
}
