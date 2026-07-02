import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FunctionLibraryService } from '../services/function-library.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/role.enum';

@ApiTags('Compensation - Function Library')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/compensation/functions')
export class FunctionLibraryController {
  constructor(private readonly functionLibraryService: FunctionLibraryService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy danh sách hàm dựng sẵn với tài liệu' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async listFunctions() {
    const functions = this.functionLibraryService.getAllFunctions();
    return {
      success: true,
      data: functions,
      message: 'Lấy danh sách hàm thành công',
    };
  }
}
