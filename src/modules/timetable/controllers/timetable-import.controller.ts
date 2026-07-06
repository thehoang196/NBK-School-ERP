import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiProduces,
} from '@nestjs/swagger';
import { Response } from 'express';
import { TimetableImportService } from '../services/timetable-import.service';
import {
  ImportTimetableDto,
  TimetableImportResultDto,
} from '../dto/import-timetable.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { SchoolScopeGuard } from '../../../common/guards/school-scope.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { UserRole } from '../../../common/enums/role.enum';
import { ApiResponse as ApiResponseType } from '../../../common/interfaces/api-response.interface';

@ApiTags('Timetable Import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, SchoolScopeGuard)
@Controller('api/v1/timetable')
export class TimetableImportController {
  constructor(private readonly importService: TimetableImportService) {}

  @Post('import')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Import TKB từ file Excel',
    description:
      'Upload file Excel theo template chuẩn 6 cột (Lớp, Thứ, Tiết, Môn, GV, Phòng) cùng semesterId để import TKB. File phải có định dạng .xlsx/.xls và ≤ 10MB.',
  })
  @ApiBody({
    description: 'File Excel và semesterId',
    schema: {
      type: 'object',
      required: ['file', 'semesterId'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File Excel (.xlsx hoặc .xls)',
        },
        semesterId: {
          type: 'string',
          format: 'uuid',
          description: 'ID học kỳ đích',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Kết quả import TKB',
    type: TimetableImportResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'File không hợp lệ (sai định dạng, quá lớn, hoặc rỗng)',
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền thực hiện thao tác này',
  })
  async importTimetable(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportTimetableDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponseType<TimetableImportResultDto>> {
    const result = await this.importService.importFromExcel({
      file,
      schoolId: user.schoolId ?? '',
      semesterId: dto.semesterId,
    });

    return {
      success: true,
      data: result,
      message: result.versionId
        ? `Import thành công ${result.successCount}/${result.totalRows} dòng`
        : `Import thất bại: ${result.errorCount} dòng lỗi`,
    };
  }

  @Get('import/template')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({
    summary: 'Tải template import TKB',
    description:
      'Tải file Excel mẫu với 6 cột: Lớp, Thứ, Tiết, Môn, Giáo viên, Phòng kèm dữ liệu mẫu.',
  })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiResponse({ status: 200, description: 'File template Excel' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền thực hiện thao tác này',
  })
  async downloadTemplate(@Res() res: Response): Promise<void> {
    const buffer = await this.importService.generateTemplate();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="template_import_tkb.xlsx"',
    );
    res.send(buffer);
  }
}
