import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JobsService } from './jobs.service';
import { JobQueryDto } from './dto/job-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SchoolScopeGuard } from '../../common/guards/school-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';

@ApiTags('Jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, SchoolScopeGuard)
@Controller('api/v1/jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.SCHEDULER,
  )
  @ApiOperation({ summary: 'Lấy danh sách jobs' })
  @ApiResponse({ status: 200, description: 'Danh sách jobs' })
  async findAll(@Query() query: JobQueryDto, @Req() req: Request) {
    const schoolScope = (req as unknown as Record<string, unknown>)[
      'schoolScope'
    ] as string[] | null;
    const schoolId =
      schoolScope && schoolScope.length === 1 ? schoolScope[0] : null;
    return this.jobsService.getJobs(query, schoolId);
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.SCHEDULER,
  )
  @ApiOperation({ summary: 'Lấy trạng thái job theo ID' })
  @ApiParam({ name: 'id', type: 'string', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Chi tiết job' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy job' })
  async findById(@Param('id') id: string) {
    return this.jobsService.getJobById(id);
  }
}
