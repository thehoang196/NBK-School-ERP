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
} from '@nestjs/swagger';
import { Response } from 'express';
import { ImportService } from '../services/import.service';
import { ImportResultDto } from '../dto/import-result.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/role.enum';

@ApiTags('Import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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
        schoolId: {
          type: 'string',
          format: 'uuid',
          description: 'ID trường',
        },
      },
      required: ['file', 'schoolId'],
    },
  })
  @ApiResponse({ status: 200, description: 'Kết quả import', type: ImportResultDto })
  @ApiResponse({ status: 400, description: 'File không hợp lệ' })
  async importTeachers(
    @UploadedFile() file: Express.Multer.File,
    @Query('schoolId') schoolId: string,
  ): Promise<ImportResultDto> {
    return this.importService.importTeachers(file, schoolId);
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
  @ApiResponse({ status: 200, description: 'Kết quả import', type: ImportResultDto })
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
  @ApiResponse({ status: 200, description: 'Kết quả import', type: ImportResultDto })
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
  @ApiResponse({ status: 200, description: 'Kết quả import', type: ImportResultDto })
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
  @ApiResponse({ status: 200, description: 'Kết quả import', type: ImportResultDto })
  @ApiResponse({ status: 400, description: 'File không hợp lệ' })
  async importTimetable(
    @UploadedFile() file: Express.Multer.File,
    @Query('schoolId') schoolId: string,
    @Query('versionId') versionId: string,
  ): Promise<ImportResultDto> {
    return this.importService.importTimetable(file, schoolId, versionId);
  }

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
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=template-${type}.xlsx`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }
}
