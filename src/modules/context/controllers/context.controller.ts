import {
  Controller,
  Get,
  Post,
  Body,
  Ip,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ContextThrottlerGuard } from '../guards/context-throttler.guard';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { ContextService, ContextJwtUser } from '../services/context.service';
import { SwitchContextDto } from '../dto/switch-context.dto';
import { AccessibleSchoolsResponseDto } from '../dto/accessible-schools-response.dto';
import { CurrentContextResponseDto } from '../dto/current-context-response.dto';

/**
 * ContextController — API endpoints for workspace context management.
 *
 * Provides endpoints for:
 * - Retrieving accessible schools for the current user
 * - Switching workspace context
 * - Getting the current active context
 *
 * All endpoints require JWT authentication.
 */
@ApiTags('context')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/context')
export class ContextController {
  constructor(private readonly contextService: ContextService) {}

  /**
   * GET /api/v1/context/accessible-schools
   *
   * Returns the list of schools the authenticated user can switch to,
   * computed based on their role and hierarchy.
   */
  @Get('accessible-schools')
  @ApiOperation({
    summary: 'Lấy danh sách trường có quyền truy cập',
    description:
      'Trả về danh sách các trường mà người dùng hiện tại có quyền truy cập, ' +
      'tính toán dựa trên vai trò và cấu trúc phân cấp tổ chức. ' +
      'Kết quả được sắp xếp theo tên trường (A-Z), tối đa 50 trường.',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách trường có quyền truy cập (phân cấp: holding → company → school)',
    content: {
      'application/json': {
        examples: {
          multiSchoolHierarchy: {
            summary: 'SUPER_ADMIN / COMPANY_ADMIN — danh sách phân cấp',
            value: {
              schools: [
                {
                  id: 'b2d4f6a8-1234-5678-9abc-def012345678',
                  code: 'NBK-HLD',
                  name: 'Hệ thống Giáo dục Nguyễn Bỉnh Khiêm',
                  hierarchyLevel: 'holding',
                  canSwitch: true,
                },
                {
                  id: 'c3e5g7b9-2345-6789-abcd-ef0123456789',
                  code: 'NBK-CG',
                  name: 'Nguyễn Bỉnh Khiêm - Cầu Giấy',
                  hierarchyLevel: 'company',
                  canSwitch: true,
                },
                {
                  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  code: 'NBK-TH-CG',
                  name: 'Trường Tiểu học Nguyễn Bỉnh Khiêm - Cầu Giấy',
                  hierarchyLevel: 'school',
                  canSwitch: true,
                },
                {
                  id: 'd4f6h8c0-3456-789a-bcde-f01234567890',
                  code: 'NBK-THCS-CG',
                  name: 'Trường THCS Nguyễn Bỉnh Khiêm - Cầu Giấy',
                  hierarchyLevel: 'school',
                  canSwitch: true,
                },
                {
                  id: 'e5g7i9d1-4567-89ab-cdef-012345678901',
                  code: 'NBK-THPT-CG',
                  name: 'Trường THPT Nguyễn Bỉnh Khiêm - Cầu Giấy',
                  hierarchyLevel: 'school',
                  canSwitch: true,
                },
              ],
              canSwitch: true,
            },
          },
          singleSchool: {
            summary: 'SCHOOL_ADMIN / HR / VIEWER — trường duy nhất',
            value: {
              schools: [
                {
                  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  code: 'NBK-TH-CG',
                  name: 'Trường Tiểu học Nguyễn Bỉnh Khiêm - Cầu Giấy',
                  hierarchyLevel: 'school',
                  canSwitch: false,
                },
              ],
              canSwitch: false,
            },
          },
          teacherMultiSchool: {
            summary: 'TEACHER — nhiều trường phân công',
            value: {
              schools: [
                {
                  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  code: 'NBK-TH-CG',
                  name: 'Trường Tiểu học Nguyễn Bỉnh Khiêm - Cầu Giấy',
                  hierarchyLevel: 'school',
                  canSwitch: true,
                },
                {
                  id: 'd4f6h8c0-3456-789a-bcde-f01234567890',
                  code: 'NBK-THCS-CG',
                  name: 'Trường THCS Nguyễn Bỉnh Khiêm - Cầu Giấy',
                  hierarchyLevel: 'school',
                  canSwitch: true,
                },
              ],
              canSwitch: true,
            },
          },
          emptyList: {
            summary: 'Không có trường nào (trường INACTIVE hoặc chưa phân công)',
            value: {
              schools: [],
              canSwitch: false,
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa xác thực — JWT không hợp lệ hoặc hết hạn',
    content: {
      'application/json': {
        example: {
          success: false,
          data: null,
          message: 'Phiên đăng nhập không hợp lệ',
          errorCode: 'UNAUTHORIZED',
        },
      },
    },
  })
  async getAccessibleSchools(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<AccessibleSchoolsResponseDto> {
    const contextUser = this.mapToContextJwtUser(user);
    const result = await this.contextService.getAccessibleSchools(contextUser);

    return {
      schools: result.schools.map((school) => ({
        ...school,
        canSwitch: result.canSwitch,
      })),
      canSwitch: result.canSwitch,
    };
  }

  /**
   * POST /api/v1/context/switch
   *
   * Switches the user's active workspace context to the specified school.
   * Rate-limited to 30 requests per minute per user.
   */
  @Post('switch')
  @UseGuards(ContextThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @ApiOperation({
    summary: 'Chuyển đổi ngữ cảnh workspace',
    description:
      'Chuyển đổi ngữ cảnh workspace sang trường được chỉ định. ' +
      'Giới hạn 30 yêu cầu/phút/người dùng. ' +
      'Không cần đăng nhập lại — JWT vẫn hợp lệ sau khi chuyển.',
  })
  @ApiBody({
    type: SwitchContextDto,
    examples: {
      switchToSchool: {
        summary: 'Chuyển sang trường cụ thể',
        value: {
          schoolId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Chuyển đổi ngữ cảnh thành công',
    content: {
      'application/json': {
        example: {
          id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          code: 'NBK-TH-CG',
          name: 'Trường Tiểu học Nguyễn Bỉnh Khiêm - Cầu Giấy',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Định dạng schoolId không hợp lệ (không phải UUID)',
    content: {
      'application/json': {
        example: {
          success: false,
          data: null,
          message: 'Định dạng schoolId không hợp lệ. Vui lòng cung cấp UUID đúng',
          errorCode: 'INVALID_FORMAT',
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền truy cập trường này',
    content: {
      'application/json': {
        example: {
          success: false,
          data: null,
          message: 'Bạn không có quyền truy cập trường này',
          errorCode: 'CONTEXT_FORBIDDEN',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Trường học không tồn tại',
    content: {
      'application/json': {
        example: {
          success: false,
          data: null,
          message: 'Trường học không tồn tại',
          errorCode: 'SCHOOL_NOT_FOUND',
        },
      },
    },
  })
  @ApiResponse({
    status: 422,
    description: 'Trường học đang ngưng hoạt động (status ≠ ACTIVE)',
    content: {
      'application/json': {
        example: {
          success: false,
          data: null,
          message: 'Trường học hiện đang ngưng hoạt động',
          errorCode: 'SCHOOL_INACTIVE',
        },
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: 'Vượt quá giới hạn 30 yêu cầu/phút — rate limit',
    content: {
      'application/json': {
        example: {
          success: false,
          data: null,
          message: 'Quá nhiều yêu cầu chuyển đổi. Vui lòng thử lại sau.',
          errorCode: 'CONTEXT_SWITCH_RATE_LIMITED',
        },
      },
    },
  })
  async switchContext(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SwitchContextDto,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<{ id: string; code: string; name: string }> {
    const contextUser = this.mapToContextJwtUser(user);
    const correlationId = (req as unknown as Record<string, unknown>)['correlationId'] as string | undefined;
    return this.contextService.switchContext(contextUser, dto.schoolId, ip, correlationId);
  }

  /**
   * GET /api/v1/context/current
   *
   * Returns the user's current active context including active school details,
   * role, and whether context switching is available.
   */
  @Get('current')
  @ApiOperation({
    summary: 'Lấy ngữ cảnh hiện tại',
    description:
      'Trả về thông tin ngữ cảnh workspace hiện tại của người dùng, ' +
      'bao gồm trường đang hoạt động, vai trò, và trạng thái chuyển đổi. ' +
      'Frontend sử dụng endpoint này để hiển thị workspace indicator.',
  })
  @ApiResponse({
    status: 200,
    description: 'Ngữ cảnh hiện tại của người dùng',
    content: {
      'application/json': {
        examples: {
          activeContext: {
            summary: 'Đã chọn workspace — đang hoạt động bình thường',
            value: {
              activeSchoolId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              activeSchoolName: 'Trường Tiểu học Nguyễn Bỉnh Khiêm - Cầu Giấy',
              activeSchoolCode: 'NBK-TH-CG',
              globalView: false,
              role: 'company_admin',
              canSwitch: true,
              contextRequired: false,
            },
          },
          noContext: {
            summary: 'Chưa chọn workspace — cần chọn trước khi truy cập module',
            value: {
              activeSchoolId: null,
              activeSchoolName: null,
              activeSchoolCode: null,
              globalView: false,
              role: 'super_admin',
              canSwitch: true,
              contextRequired: true,
            },
          },
          singleSchoolUser: {
            summary: 'Người dùng một trường — không cần chuyển đổi',
            value: {
              activeSchoolId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              activeSchoolName: 'Trường Tiểu học Nguyễn Bỉnh Khiêm - Cầu Giấy',
              activeSchoolCode: 'NBK-TH-CG',
              globalView: false,
              role: 'school_admin',
              canSwitch: false,
              contextRequired: false,
            },
          },
          globalViewActive: {
            summary: 'SUPER_ADMIN — chế độ Global View',
            value: {
              activeSchoolId: null,
              activeSchoolName: null,
              activeSchoolCode: null,
              globalView: true,
              role: 'super_admin',
              canSwitch: true,
              contextRequired: false,
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa xác thực — JWT không hợp lệ hoặc hết hạn',
    content: {
      'application/json': {
        example: {
          success: false,
          data: null,
          message: 'Phiên đăng nhập không hợp lệ',
          errorCode: 'UNAUTHORIZED',
        },
      },
    },
  })
  async getCurrentContext(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<CurrentContextResponseDto> {
    const contextUser = this.mapToContextJwtUser(user);
    return this.contextService.getCurrentContext(contextUser);
  }

  /**
   * Maps CurrentUserPayload from JWT to ContextJwtUser interface used by ContextService.
   */
  private mapToContextJwtUser(user: CurrentUserPayload): ContextJwtUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
      accessibleSchoolIds: user.accessibleSchoolIds,
      companySchoolId: (user as ContextJwtUser).companySchoolId,
    };
  }
}
