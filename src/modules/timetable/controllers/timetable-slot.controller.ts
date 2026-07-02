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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { TimetableService, SlotWithConflicts } from '../services/timetable.service';
import { CreateTimetableSlotDto } from '../dto/create-timetable-slot.dto';
import { UpdateTimetableSlotDto } from '../dto/update-timetable-slot.dto';
import { CheckConflictsDto } from '../dto/check-conflicts.dto';
import { TimetableSlotQueryDto } from '../dto/timetable-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { SchoolScopeGuard } from '../../../common/guards/school-scope.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/role.enum';
import { ApiResponse as ApiResponseType } from '../../../common/interfaces/api-response.interface';
import { TimetableSlotEntity } from '../entities/timetable-slot.entity';
import { ConflictResult } from '../services/conflict-detection.service';

@ApiTags('Timetable Slots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, SchoolScopeGuard)
@Controller('api/v1/timetable-slots')
export class TimetableSlotController {
  constructor(private readonly timetableService: TimetableService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER, UserRole.TEACHER)
  @ApiOperation({ summary: 'Lấy danh sách slot TKB (filter by version, class, teacher)' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async findAll(
    @Query() query: TimetableSlotQueryDto,
  ): Promise<ApiResponseType<TimetableSlotEntity[]>> {
    const data = await this.timetableService.findSlots(query);
    return {
      success: true,
      data,
      message: 'Lấy danh sách slot TKB thành công',
    };
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo slot TKB (kéo-thả)' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 400, description: 'Xung đột không thể bỏ qua' })
  async create(
    @Body() dto: CreateTimetableSlotDto,
  ): Promise<ApiResponseType<SlotWithConflicts>> {
    const data = await this.timetableService.createSlot(dto);
    return {
      success: true,
      data,
      message: 'Tạo slot TKB thành công',
    };
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Cập nhật slot TKB' })
  @ApiParam({ name: 'id', type: String, description: 'UUID của slot' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 400, description: 'Xung đột' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimetableSlotDto,
  ): Promise<ApiResponseType<SlotWithConflicts>> {
    const data = await this.timetableService.updateSlot(id, dto);
    return {
      success: true,
      data,
      message: 'Cập nhật slot TKB thành công',
    };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Xóa slot TKB' })
  @ApiParam({ name: 'id', type: String, description: 'UUID của slot' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseType<null>> {
    await this.timetableService.deleteSlot(id);
    return {
      success: true,
      data: null,
      message: 'Xóa slot TKB thành công',
    };
  }

  @Post('check-conflicts')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kiểm tra xung đột cho một slot cụ thể' })
  @ApiResponse({ status: 200, description: 'Danh sách xung đột' })
  async checkConflicts(
    @Body() dto: CheckConflictsDto,
  ): Promise<ApiResponseType<ConflictResult[]>> {
    const data = await this.timetableService.checkSlotConflicts(dto);
    return {
      success: true,
      data,
      message: 'Kiểm tra xung đột thành công',
    };
  }
}
