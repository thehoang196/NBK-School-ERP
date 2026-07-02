import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TimetableGeneratorService } from '../services/timetable-generator.service';
import { GenerateTimetableDto } from '../dto/generate-timetable.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/role.enum';

@ApiTags('Timetable Generation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/timetable-generation')
export class TimetableGenerationController {
  constructor(private readonly generatorService: TimetableGeneratorService) {}

  @Post('generate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Sinh TKB tự động (FET engine)' })
  @ApiResponse({ status: 201, description: 'Job đã được tạo' })
  async generate(@Body() dto: GenerateTimetableDto) {
    const jobId = await this.generatorService.generate(
      dto.semesterId,
      dto.versionId,
      dto.timeoutSeconds,
    );

    return {
      jobId,
      message: 'Đã bắt đầu sinh TKB. Kiểm tra trạng thái qua GET /status/:jobId',
    };
  }

  @Get('status/:jobId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Kiểm tra trạng thái sinh TKB' })
  @ApiResponse({ status: 200, description: 'Trạng thái job' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy job' })
  async getStatus(@Param('jobId') jobId: string) {
    const job = this.generatorService.getJobStatus(jobId);
    if (!job) {
      throw new NotFoundException('Không tìm thấy job');
    }
    return job;
  }
}
