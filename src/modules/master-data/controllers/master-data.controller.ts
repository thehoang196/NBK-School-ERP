import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  Res,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { SchoolScopeGuard } from '../../../common/guards/school-scope.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { SchoolScope } from '../../../common/decorators/school-scope.decorator';
import { UserRole } from '../../../common/enums/role.enum';
import { MasterDataService } from '../services/master-data.service';
import { ImportService } from '../services/import.service';
import { SyncService } from '../services/sync.service';
import { CreateEmployeeMasterDto } from '../dto/create-employee-master.dto';
import { UpdateEmployeeMasterDto } from '../dto/update-employee-master.dto';
import { EmployeeMasterQueryDto } from '../dto/employee-master-query.dto';
import { SyncLogQueryDto } from '../dto/sync-log-query.dto';

@ApiTags('Master Data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, SchoolScopeGuard)
@Controller('api/v1/master-data')
export class MasterDataController {
  constructor(
    private readonly masterDataService: MasterDataService,
    private readonly importService: ImportService,
    private readonly syncService: SyncService,
  ) {}

  @Get('employees')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Lấy danh sách nhân sự (phân trang)' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách thành công' })
  async findAll(
    @Query() query: EmployeeMasterQueryDto,
    @SchoolScope() schoolScope: string | null,
  ) {
    if (schoolScope) {
      query.schoolId = schoolScope;
    }
    return this.masterDataService.findAll(query);
  }

  @Get('employees/export')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Export danh sách nhân sự ra Excel' })
  @ApiResponse({ status: 200, description: 'Export thành công' })
  async exportToExcel(
    @Query() query: EmployeeMasterQueryDto,
    @SchoolScope() schoolScope: string | null,
    @Res() res: Response,
  ) {
    const schoolId = schoolScope ?? query.schoolId;
    if (!schoolId) {
      throw new BadRequestException('schoolId là bắt buộc khi export');
    }

    const buffer = await this.masterDataService.exportToExcel(schoolId, query);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=danh-sach-nhan-su.xlsx',
    );
    res.send(buffer);
  }

  @Get('employees/:id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.HR,
    UserRole.TEACHER,
  )
  @ApiOperation({ summary: 'Lấy chi tiết nhân sự theo ID' })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy nhân sự' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const employee = await this.masterDataService.findById(id);

    // TEACHER can only view their own record
    if (user.role === UserRole.TEACHER && employee.schoolId !== user.schoolId) {
      throw new BadRequestException(
        'Bạn chỉ có quyền xem thông tin của chính mình',
      );
    }

    return {
      success: true,
      data: employee,
      message: 'Lấy chi tiết nhân sự thành công',
    };
  }

  @Post('employees')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Tạo nhân sự mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 409, description: 'Mã NV đã tồn tại' })
  async create(
    @Body() dto: CreateEmployeeMasterDto,
    @SchoolScope() schoolScope: string | null,
  ) {
    if (schoolScope) {
      dto.schoolId = schoolScope;
    }

    const employee = await this.masterDataService.create(dto);
    return {
      success: true,
      data: employee,
      message: 'Tạo nhân sự thành công',
    };
  }

  @Patch('employees/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Cập nhật nhân sự' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy nhân sự' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeMasterDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const employee = await this.masterDataService.update(id, dto, user.id);
    return {
      success: true,
      data: employee,
      message: 'Cập nhật nhân sự thành công',
    };
  }

  @Delete('employees/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Xóa nhân sự (soft delete)' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy nhân sự' })
  async softDelete(@Param('id', ParseUUIDPipe) id: string) {
    await this.masterDataService.softDelete(id);
    return {
      success: true,
      data: null,
      message: 'Xóa nhân sự thành công',
    };
  }

  @Post('employees/import')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import nhân sự từ file Excel' })
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
    },
  })
  @ApiResponse({ status: 201, description: 'Import thành công' })
  @ApiResponse({ status: 400, description: 'File không hợp lệ' })
  async importFromExcel(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserPayload,
    @SchoolScope() schoolScope: string | null,
    @Query('schoolId') querySchoolId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File upload là bắt buộc');
    }

    const schoolId = schoolScope ?? user.schoolId ?? querySchoolId;
    if (!schoolId) {
      throw new BadRequestException('schoolId là bắt buộc khi import');
    }

    const result = await this.importService.importFromExcel(
      schoolId,
      file.buffer,
      user.id,
    );

    return {
      success: true,
      data: result,
      message: 'Import nhân sự thành công',
    };
  }

  @Get('sync-logs')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy lịch sử đồng bộ' })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách sync log thành công',
  })
  async getSyncLogs(
    @Query() query: SyncLogQueryDto,
    @SchoolScope() schoolScope: string | null,
  ) {
    if (schoolScope) {
      query.schoolId = schoolScope;
    }
    return this.syncService.getSyncLogs(query);
  }
}
