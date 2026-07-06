import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import {
  TenantRlsService,
  RlsHealthCheckResult,
} from '../../common/tenant/tenant-rls.service';

/**
 * Admin endpoint for verifying RLS policy health across all tenant-scoped tables.
 * Restricted to SUPER_ADMIN role only.
 *
 * Validates: Requirements 8.4
 */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/admin')
export class TenantHealthController {
  constructor(private readonly tenantRlsService: TenantRlsService) {}

  @Get('tenant-health')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Kiểm tra trạng thái RLS trên các bảng tenant',
    description:
      'Kiểm tra Row-Level Security policies có được bật trên tất cả các bảng tenant-scoped hay không. Chỉ SUPER_ADMIN mới có quyền truy cập.',
  })
  @ApiResponse({
    status: 200,
    description: 'Kết quả kiểm tra RLS health check',
    schema: {
      type: 'object',
      properties: {
        healthy: { type: 'boolean', description: 'Tất cả bảng đã bật RLS' },
        tablesChecked: {
          type: 'number',
          description: 'Số bảng được kiểm tra',
        },
        tablesWithRls: {
          type: 'number',
          description: 'Số bảng đã có RLS',
        },
        tablesMissingRls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Danh sách bảng chưa bật RLS',
        },
        checkedAt: {
          type: 'string',
          format: 'date-time',
          description: 'Thời điểm kiểm tra',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa xác thực - JWT không hợp lệ hoặc thiếu',
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền - Chỉ SUPER_ADMIN mới được truy cập',
  })
  async checkTenantHealth(): Promise<RlsHealthCheckResult> {
    return this.tenantRlsService.verifyRlsPolicies();
  }
}
