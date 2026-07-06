import {
  Controller,
  Get,
  Post,
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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { SchoolScopeGuard } from '../../../common/guards/school-scope.guard';
import { SchoolScope } from '../../../common/decorators/school-scope.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import {
  ApiResponse as ApiResponseType,
  PaginatedResponse,
} from '../../../common/interfaces/api-response.interface';
import { ConflictOrchestrationService } from '../services/conflict-orchestration.service';
import { ConflictLogRepository } from '../repositories/conflict-log.repository';
import { CheckSlotConflictDto } from '../dto/check-slot-conflict.dto';
import { CheckBatchConflictDto } from '../dto/check-batch-conflict.dto';
import { ConflictFilterDto } from '../dto/conflict-filter.dto';
import { OverrideConflictDto } from '../dto/override-conflict.dto';
import { ConflictLogFilterDto } from '../dto/conflict-log-filter.dto';
import {
  ConflictCheckResponseDto,
  BatchConflictResponseDto,
  FullVersionConflictResponseDto,
  ConflictLogResponseDto,
} from '../dto/conflict-response.dto';
import {
  ConflictCheckResult,
  FullVersionConflictResult,
  BatchConflictResult,
} from '../interfaces/conflict.interface';
import { SlotCheckPayload } from '../interfaces/conflict.interface';
import { SchoolContextRequiredException } from '../exceptions/conflict.exception';

@ApiTags('Conflict Detection')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SchoolScopeGuard)
@Controller('api/v1/timetable/conflicts')
export class ConflictController {
  constructor(
    private readonly conflictOrchestrationService: ConflictOrchestrationService,
    private readonly conflictLogRepository: ConflictLogRepository,
  ) {}

  @Post('check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kiểm tra xung đột cho một slot' })
  @ApiResponse({
    status: 200,
    description: 'Kết quả kiểm tra xung đột',
    type: ConflictCheckResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async checkSlot(
    @Body() dto: CheckSlotConflictDto,
    @SchoolScope() schoolId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponseType<ConflictCheckResult>> {
    this.validateSchoolContext(schoolId);

    const result = await this.conflictOrchestrationService.checkSingleSlot(
      dto,
      schoolId,
      user.id,
    );

    return {
      success: true,
      data: result,
      message: 'Kiểm tra xung đột thành công',
    };
  }

  @Post('check-batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kiểm tra xung đột cho nhiều slots (batch import)' })
  @ApiResponse({
    status: 200,
    description: 'Kết quả kiểm tra xung đột batch',
    type: BatchConflictResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async checkBatch(
    @Body() dto: CheckBatchConflictDto,
    @SchoolScope() schoolId: string,
  ): Promise<ApiResponseType<BatchConflictResult>> {
    this.validateSchoolContext(schoolId);

    // Convert CheckSlotConflictDto[] to SlotCheckPayload[]
    const slots: SlotCheckPayload[] = dto.slots.map((slot) => ({
      versionId: slot.versionId,
      dayOfWeek: slot.dayOfWeek,
      periodId: slot.periodId,
      teacherId: slot.teacherId,
      classId: slot.classId,
      roomId: slot.roomId ?? null,
      subjectId: slot.subjectId,
      excludeSlotId: slot.excludeSlotId,
    }));

    const result = await this.conflictOrchestrationService.checkBatch(
      slots,
      dto.versionId,
      schoolId,
    );

    return {
      success: true,
      data: result,
      message: 'Kiểm tra xung đột batch thành công',
    };
  }

  @Post('check-version/:versionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kiểm tra xung đột toàn bộ phiên bản TKB' })
  @ApiResponse({
    status: 200,
    description: 'Kết quả kiểm tra xung đột phiên bản',
    type: FullVersionConflictResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phiên bản' })
  @ApiResponse({ status: 408, description: 'Kiểm tra quá thời gian cho phép' })
  async checkVersion(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() filters: ConflictFilterDto,
    @SchoolScope() schoolId: string,
  ): Promise<ApiResponseType<FullVersionConflictResult>> {
    this.validateSchoolContext(schoolId);

    const result = await this.conflictOrchestrationService.checkFullVersion(
      versionId,
      schoolId,
      filters,
    );

    return {
      success: true,
      data: result,
      message: 'Kiểm tra xung đột phiên bản thành công',
    };
  }

  @Post('override')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ghi đè xung đột mềm với lý do' })
  @ApiResponse({ status: 200, description: 'Ghi đè xung đột thành công' })
  @ApiResponse({ status: 400, description: 'Lý do ghi đè không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bản ghi xung đột' })
  @ApiResponse({ status: 422, description: 'Không thể ghi đè xung đột cứng' })
  async overrideConflicts(
    @Body() dto: OverrideConflictDto,
    @SchoolScope() schoolId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponseType<null>> {
    this.validateSchoolContext(schoolId);

    await this.conflictOrchestrationService.overrideSoftConflicts(
      dto.slotId,
      dto.conflictLogIds,
      { reason: dto.reason },
      user.id,
      schoolId,
    );

    return {
      success: true,
      data: null,
      message: 'Ghi đè xung đột mềm thành công',
    };
  }

  @Get('logs/:versionId')
  @ApiOperation({ summary: 'Lấy danh sách audit log xung đột theo phiên bản' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách audit log xung đột',
    type: ConflictLogResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền truy cập — thiếu thông tin trường',
  })
  async getConflictLogs(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Query() filters: ConflictLogFilterDto,
    @SchoolScope() schoolId: string,
  ): Promise<PaginatedResponse<ConflictLogResponseDto>> {
    this.validateSchoolContext(schoolId);

    const { page, limit, ...filterParams } = filters;

    const [logs, total] = await this.conflictLogRepository.findByVersion(
      versionId,
      schoolId,
      {
        type: filterParams.type,
        severity: filterParams.severity,
        teacherId: filterParams.teacherId,
        classId: filterParams.classId,
        status: filterParams.status,
      },
      { page, limit },
    );

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: logs as unknown as ConflictLogResponseDto[],
      message: 'Lấy danh sách audit log xung đột thành công',
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Validate that a valid school context is present.
   * Throws 403 SCHOOL_CONTEXT_REQUIRED if schoolId is null (e.g., SUPER_ADMIN
   * accessing without explicit school context).
   */
  private validateSchoolContext(
    schoolId: string | null,
  ): asserts schoolId is string {
    if (!schoolId) {
      throw new SchoolContextRequiredException();
    }
  }
}
