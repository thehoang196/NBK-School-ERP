import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuditLogService } from '../services/audit-log.service';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { SchoolScopeGuard } from '../../../common/guards/school-scope.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { UserRole } from '../../../common/enums/role.enum';
import { Permission } from '../../../common/enums/permission.enum';

@ApiTags('audit-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, SchoolScopeGuard)
@Controller('api/v1/audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @RequirePermissions(Permission.AUDIT_LOG_READ)
  @ApiOperation({ summary: 'Lấy danh sách audit log' })
  @ApiResponse({ status: 200, description: 'Danh sách audit log' })
  async findAll(@Query() query: AuditLogQueryDto, @Req() req: Request) {
    const schoolScope = (req as unknown as Record<string, unknown>)['schoolScope'] as
      | string[]
      | null;
    const schoolId =
      schoolScope && schoolScope.length === 1 ? schoolScope[0] : null;
    return this.auditLogService.findAll(query, schoolId);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @RequirePermissions(Permission.AUDIT_LOG_READ)
  @ApiOperation({ summary: 'Lấy chi tiết audit log' })
  @ApiResponse({ status: 200, description: 'Chi tiết audit log' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async findById(@Param('id') id: string) {
    const log = await this.auditLogService.findById(id);
    if (!log) {
      throw new NotFoundException('Không tìm thấy audit log');
    }
    return log;
  }
}
