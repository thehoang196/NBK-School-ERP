import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Sse,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { SchoolScopeGuard } from '../../../common/guards/school-scope.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';
import { GenerationPipelineService } from '../services/generation-pipeline.service';
import { GenerationProgressGatewayService } from '../services/generation-progress-gateway.service';
import {
  SubmitGenerationDto,
  GenerationSubmissionResultDto,
  GenerationJobStatusDto,
} from '../dto/submit-generation.dto';

/**
 * Controller for timetable generation pipeline endpoints.
 * Handles submission, status tracking, cancellation, and progress streaming.
 */
@ApiTags('Timetable Generation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SchoolScopeGuard)
@Controller('api/v1/timetable/generate')
export class TimetableGenerationController {
  constructor(
    private readonly pipelineService: GenerationPipelineService,
    private readonly progressGateway: GenerationProgressGatewayService,
  ) {}

  /**
   * POST /api/v1/timetable/generate
   * Submit a new timetable generation request.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Gửi yêu cầu sinh TKB tự động' })
  @SwaggerResponse({
    status: 201,
    description: 'Job đã được tạo thành công',
    type: GenerationSubmissionResultDto,
  })
  @SwaggerResponse({
    status: 409,
    description: 'Đang có quá trình sinh TKB khác cho học kỳ này',
  })
  @SwaggerResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ' })
  @SwaggerResponse({
    status: 403,
    description: 'Không có quyền truy cập trường này',
  })
  async submitGeneration(
    @Body() dto: SubmitGenerationDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<GenerationSubmissionResultDto>> {
    const result = await this.pipelineService.submitGeneration(dto, user);

    return {
      success: true,
      data: {
        jobId: result.jobId,
        versionId: result.versionId,
        status: result.status,
      },
      message:
        'Đã bắt đầu sinh TKB. Kiểm tra trạng thái qua GET /status/:jobId',
    };
  }

  /**
   * GET /api/v1/timetable/generate/:jobId/status
   * Get the current status of a generation job.
   */
  @Get(':jobId/status')
  @ApiOperation({ summary: 'Lấy trạng thái job sinh TKB' })
  @ApiParam({
    name: 'jobId',
    description: 'ID của job trong queue',
    type: String,
  })
  @SwaggerResponse({
    status: 200,
    description: 'Trạng thái job',
    type: GenerationJobStatusDto,
  })
  @SwaggerResponse({ status: 404, description: 'Không tìm thấy job' })
  async getJobStatus(
    @Param('jobId') jobId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<GenerationJobStatusDto>> {
    const schoolId = user.schoolId ?? '';
    const status = await this.pipelineService.getJobStatus(jobId, schoolId);

    return {
      success: true,
      data: {
        jobId: status.jobId,
        versionId: status.versionId,
        status: status.status,
        progress: status.progress,
        stage: status.stage,
        errorMessage: status.errorMessage,
        completedAt: status.completedAt,
      },
      message: 'Lấy trạng thái job thành công',
    };
  }

  /**
   * DELETE /api/v1/timetable/generate/:jobId
   * Cancel a generation job.
   */
  @Delete(':jobId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hủy job sinh TKB' })
  @ApiParam({ name: 'jobId', description: 'ID của job cần hủy', type: String })
  @SwaggerResponse({ status: 200, description: 'Đã hủy job thành công' })
  @SwaggerResponse({ status: 404, description: 'Không tìm thấy job' })
  async cancelJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<{ message: string }>> {
    const schoolId = user.schoolId ?? '';
    await this.pipelineService.cancelJob(jobId, schoolId);

    return {
      success: true,
      data: { message: 'Đã hủy job sinh TKB thành công' },
      message: 'Đã hủy job sinh TKB thành công',
    };
  }

  /**
   * GET /api/v1/timetable/generate/:versionId/progress (SSE)
   * Stream real-time progress events for a specific timetable version.
   */
  @Sse(':versionId/progress')
  @ApiOperation({ summary: 'Stream tiến trình sinh TKB (SSE)' })
  @ApiParam({
    name: 'versionId',
    description: 'ID của phiên bản TKB',
    type: String,
  })
  @SwaggerResponse({
    status: 200,
    description: 'SSE stream tiến trình sinh TKB',
  })
  streamProgress(
    @Param('versionId') versionId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Observable<MessageEvent> {
    const schoolId = user.schoolId ?? '';

    // Get the latest progress (for late-connecting clients)
    const latestProgress = this.progressGateway.getLatestProgress(versionId);

    // Create the SSE stream from the progress gateway
    const progressStream$ = this.progressGateway
      .streamProgress(versionId, schoolId)
      .pipe(
        map(
          (event) =>
            ({
              data: JSON.stringify(event),
            }) as MessageEvent,
        ),
      );

    // If there's cached progress, emit it first for late-connecting clients
    if (latestProgress) {
      return progressStream$.pipe(
        startWith({
          data: JSON.stringify(latestProgress),
        } as MessageEvent),
      );
    }

    return progressStream$;
  }
}
