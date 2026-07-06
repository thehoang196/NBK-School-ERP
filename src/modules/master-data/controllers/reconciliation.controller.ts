import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { UserRole } from '../../../common/enums/role.enum';
import { ReconciliationService } from '../services/reconciliation.service';
import { TriggerReconciliationDto } from '../dto/trigger-reconciliation.dto';
import { ApplyReconciliationDto } from '../dto/apply-reconciliation.dto';
import { ReconciliationResultDto } from '../dto/reconciliation-result.dto';

@ApiTags('Master Data - Reconciliation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/master-data/reconciliation')
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Trigger đối chiếu dữ liệu với Master Data' })
  @ApiResponse({
    status: 201,
    description: 'Đối chiếu thành công',
    type: ReconciliationResultDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async triggerReconciliation(
    @Body() dto: TriggerReconciliationDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ReconciliationResultDto> {
    return this.reconciliationService.triggerReconciliation(
      dto.schoolId,
      dto.sourceModule,
      dto.sourceData,
      user.id,
    );
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy báo cáo đối chiếu' })
  @ApiResponse({
    status: 200,
    description: 'Thành công',
    type: ReconciliationResultDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phiên đối chiếu' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async getReport(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReconciliationResultDto> {
    return this.reconciliationService.getReport(id);
  }

  @Post(':id/apply')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Áp dụng thay đổi từ đối chiếu vào Master Data' })
  @ApiResponse({ status: 200, description: 'Áp dụng thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phiên đối chiếu' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async applyChanges(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyReconciliationDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ success: boolean; message: string }> {
    await this.reconciliationService.applyChanges(
      id,
      dto.acceptedFields,
      user.id,
    );
    return { success: true, message: 'Áp dụng thay đổi đối chiếu thành công' };
  }

  @Post(':id/decline')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Từ chối thay đổi từ đối chiếu' })
  @ApiResponse({ status: 200, description: 'Từ chối thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phiên đối chiếu' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async declineChanges(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.reconciliationService.declineChanges(id);
    return { success: true, message: 'Từ chối thay đổi đối chiếu thành công' };
  }
}
