import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import { TimetableVersionService } from '../services/timetable-version.service';
import { TimetableComparisonService } from '../services/timetable-comparison.service';
import { CreateTimetableVersionDto } from '../dto/create-timetable-version.dto';
import { UpdateTimetableVersionDto } from '../dto/update-timetable-version.dto';
import { SaveTimetableVersionDto } from '../dto/save-timetable-version.dto';
import { OverwriteSlotsDto } from '../dto/overwrite-slots.dto';
import {
  TimetableVersionQueryDto,
  CompareVersionsDto,
} from '../dto/timetable-query.dto';
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
import { TimetableVersionEntity } from '../entities/timetable-version.entity';

interface JwtUser {
  id: string;
  email: string;
  role: string;
  schoolId: string | null;
}

@ApiTags('Timetable Versions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, SchoolScopeGuard)
@Controller('api/v1/timetable-versions')
export class TimetableVersionController {
  constructor(
    private readonly timetableVersionService: TimetableVersionService,
    private readonly comparisonService: TimetableComparisonService,
  ) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy danh sách phiên bản TKB' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async findAll(@Query() query: TimetableVersionQueryDto) {
    return this.timetableVersionService.findAll(query);
  }

  @Get('compare')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'So sánh 2 phiên bản TKB' })
  @ApiResponse({ status: 200, description: 'Kết quả so sánh' })
  @ApiQuery({ name: 'versionAId', type: String, description: 'ID phiên bản A' })
  @ApiQuery({ name: 'versionBId', type: String, description: 'ID phiên bản B' })
  async compare(@Query() query: CompareVersionsDto) {
    const data = await this.comparisonService.compareVersions(
      query.versionAId,
      query.versionBId,
    );
    return {
      success: true,
      data,
      message: 'So sánh phiên bản thành công',
    };
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy chi tiết phiên bản TKB' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseType<TimetableVersionEntity>> {
    const data = await this.timetableVersionService.findById(id);
    return {
      success: true,
      data,
      message: 'Lấy chi tiết phiên bản TKB thành công',
    };
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo phiên bản TKB mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  async create(
    @Body() dto: CreateTimetableVersionDto,
  ): Promise<ApiResponseType<TimetableVersionEntity>> {
    const data = await this.timetableVersionService.create(dto);
    return {
      success: true,
      data,
      message: 'Tạo phiên bản TKB thành công',
    };
  }

  @Post('save')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Lưu TKB thành phiên bản mới' })
  @ApiResponse({
    status: 201,
    description: 'Phiên bản TKB mới được tạo thành công',
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  async saveAsNewVersion(
    @Body() dto: SaveTimetableVersionDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponseType<TimetableVersionEntity>> {
    const version = await this.timetableVersionService.saveAsNewVersion(
      dto,
      user.schoolId ?? '',
    );
    return {
      success: true,
      data: version,
      message: `Đã lưu phiên bản "${version.name}" (v${version.versionNumber}) thành công`,
    };
  }

  @Post(':id/clone')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo bản sao nháp từ phiên bản' })
  @ApiResponse({ status: 201, description: 'Bản sao được tạo thành công' })
  @ApiResponse({
    status: 400,
    description: 'Không thể tạo bản sao từ phiên bản nháp',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phiên bản' })
  async cloneVersion(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseType<TimetableVersionEntity>> {
    const data = await this.timetableVersionService.cloneVersion(id);
    return {
      success: true,
      data,
      message: `Tạo bản sao nháp "${data.name}" (v${data.versionNumber}) thành công`,
    };
  }

  @Put(':id/slots')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Ghi đè slots phiên bản DRAFT' })
  @ApiResponse({ status: 200, description: 'Ghi đè slots thành công' })
  @ApiResponse({
    status: 400,
    description: 'Phiên bản không ở trạng thái nháp',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phiên bản' })
  async overwriteSlots(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OverwriteSlotsDto,
  ): Promise<ApiResponseType<null>> {
    await this.timetableVersionService.overwriteSlots(id, dto.slots);
    return {
      success: true,
      data: null,
      message: 'Ghi đè dữ liệu TKB thành công',
    };
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Cập nhật phiên bản TKB' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({
    status: 400,
    description: 'Không thể cập nhật phiên bản đã công bố',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimetableVersionDto,
  ): Promise<ApiResponseType<TimetableVersionEntity>> {
    const data = await this.timetableVersionService.update(id, dto);
    return {
      success: true,
      data,
      message: 'Cập nhật phiên bản TKB thành công',
    };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Xóa phiên bản TKB (chỉ draft)' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({
    status: 400,
    description: 'Không thể xóa phiên bản đã công bố',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseType<null>> {
    await this.timetableVersionService.delete(id);
    return {
      success: true,
      data: null,
      message: 'Xóa phiên bản TKB thành công',
    };
  }

  @Post(':id/publish')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Công bố phiên bản TKB' })
  @ApiResponse({ status: 200, description: 'Công bố thành công' })
  @ApiResponse({
    status: 400,
    description: 'Không thể công bố (trạng thái không hợp lệ)',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<ApiResponseType<TimetableVersionEntity>> {
    const user = req.user as JwtUser;
    const data = await this.timetableVersionService.publish(id, user.id);
    return {
      success: true,
      data,
      message: 'Công bố phiên bản TKB thành công',
    };
  }

  @Post(':id/rollback')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Rollback về phiên bản cũ (tạo bản mới từ bản cũ)' })
  @ApiResponse({ status: 201, description: 'Rollback thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phiên bản nguồn' })
  async rollback(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseType<TimetableVersionEntity>> {
    const data = await this.timetableVersionService.rollback(id);
    return {
      success: true,
      data,
      message: 'Rollback phiên bản TKB thành công',
    };
  }
}
