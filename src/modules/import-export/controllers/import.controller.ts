import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { ImportService } from '../services/import.service';
import { ImportResultDto } from '../dto/import-result.dto';
import { ImportBatchResponseDto } from '../dto/import-batch-response.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { UserRole } from '../../../common/enums/role.enum';
import { ConflictStrategy } from '../enums/conflict-strategy.enum';

@ApiTags('Import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Throttle({ strict: { ttl: 60000, limit: 10 } })
@Controller('api/v1/import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('teachers')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import danh sách giáo viên từ Excel' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File Excel (.xlsx)',
        },
      },
      required: ['file'],
    },
  })
  @ApiQuery({ name: 'schoolId', type: 'string', description: 'ID trường' })
  @ApiQuery({
    name: 'conflictStrategy',
    enum: ConflictStrategy,
    required: false,
    description:
      'Chiến lược xử lý trùng lặp: strict (fail), upsert (ghi đè), merge (chỉ update non-null)',
  })
  @ApiResponse({
    status: 200,
    description: 'Kết quả import (đồng bộ)',
    type: ImportResultDto,
  })
  @ApiResponse({
    status: 202,
    description: 'Import async đã được tạo (file lớn > 100 dòng)',
    type: ImportBatchResponseDto,
  })
  @ApiResponse({ status: 400, description: 'File không hợp lệ' })
  async importTeachers(
    @UploadedFile() file: Express.Multer.File,
    @Query('schoolId') schoolId: string,
    @Query('conflictStrategy') conflictStrategy?: ConflictStrategy,
    @CurrentUser() user?: CurrentUserPayload,
  ): Promise<ImportResultDto | ImportBatchResponseDto> {
    return this.importService.importTeachers(
      file,
      schoolId,
      conflictStrategy || ConflictStrategy.STRICT,
      user?.id,
    );
  }

  @Post('subjects')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import danh sách môn học từ Excel' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File Excel (.xlsx)',
        },
        schoolId: {
          type: 'string',
          format: 'uuid',
          description: 'ID trường',
        },
      },
      required: ['file', 'schoolId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Kết quả import',
    type: ImportResultDto,
  })
  @ApiResponse({ status: 400, description: 'File không hợp lệ' })
  async importSubjects(
    @UploadedFile() file: Express.Multer.File,
    @Query('schoolId') schoolId: string,
  ): Promise<ImportResultDto> {
    return this.importService.importSubjects(file, schoolId);
  }

  @Post('classes')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import danh sách lớp từ Excel' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File Excel (.xlsx)',
        },
        schoolId: {
          type: 'string',
          format: 'uuid',
          description: 'ID trường',
        },
      },
      required: ['file', 'schoolId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Kết quả import',
    type: ImportResultDto,
  })
  @ApiResponse({ status: 400, description: 'File không hợp lệ' })
  async importClasses(
    @UploadedFile() file: Express.Multer.File,
    @Query('schoolId') schoolId: string,
  ): Promise<ImportResultDto> {
    return this.importService.importClasses(file, schoolId);
  }

  @Post('departments')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import danh sách tổ bộ môn từ Excel' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File Excel (.xlsx)',
        },
        schoolId: {
          type: 'string',
          format: 'uuid',
          description: 'ID trường',
        },
      },
      required: ['file', 'schoolId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Kết quả import',
    type: ImportResultDto,
  })
  @ApiResponse({ status: 400, description: 'File không hợp lệ' })
  async importDepartments(
    @UploadedFile() file: Express.Multer.File,
    @Query('schoolId') schoolId: string,
  ): Promise<ImportResultDto> {
    return this.importService.importDepartments(file, schoolId);
  }

  @Post('timetable')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import thời khóa biểu từ Excel' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File Excel (.xlsx)',
        },
        schoolId: {
          type: 'string',
          format: 'uuid',
          description: 'ID trường',
        },
        versionId: {
          type: 'string',
          format: 'uuid',
          description: 'ID phiên bản TKB',
        },
      },
      required: ['file', 'schoolId', 'versionId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Kết quả import',
    type: ImportResultDto,
  })
  @ApiResponse({ status: 400, description: 'File không hợp lệ' })
  async importTimetable(
    @UploadedFile() file: Express.Multer.File,
    @Query('schoolId') schoolId: string,
    @Query('versionId') versionId: string,
  ): Promise<ImportResultDto> {
    return this.importService.importTimetable(file, schoolId, versionId);
  }

  // ─── BATCH STATUS ───────────────────────────────────────────────────────

  @Get('batches/:batchId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy trạng thái/tiến độ import batch' })
  @ApiParam({ name: 'batchId', type: 'string', description: 'ID batch import' })
  @ApiResponse({
    status: 200,
    description: 'Trạng thái batch import',
    type: ImportBatchResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy batch' })
  async getImportBatchStatus(
    @Param('batchId') batchId: string,
  ): Promise<ImportBatchResponseDto> {
    return this.importService.getImportBatchStatus(batchId);
  }

  // ─── TEMPLATE DOWNLOAD ─────────────────────────────────────────────────

  @Get('template/:type')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Tải file mẫu import' })
  @ApiParam({
    name: 'type',
    enum: ['teachers', 'subjects', 'classes', 'timetable', 'departments'],
    description: 'Loại template cần tải',
  })
  @ApiResponse({ status: 200, description: 'File Excel template' })
  @ApiResponse({ status: 400, description: 'Loại template không hợp lệ' })
  async downloadTemplate(
    @Param('type') type: string,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.importService.generateTemplate(type);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=template-${type}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }
}
