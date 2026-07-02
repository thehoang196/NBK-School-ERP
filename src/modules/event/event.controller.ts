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
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventQueryDto, CalendarQueryDto } from './dto/event-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';

@ApiTags('Events - Sự kiện & Lịch nghỉ')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy danh sách sự kiện (có phân trang, lọc)' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async findAll(@Query() query: EventQueryDto) {
    return this.eventService.findAll(query);
  }

  @Get('calendar')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy sự kiện theo lịch tháng (calendar view)' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getCalendar(@Query() query: CalendarQueryDto) {
    const data = await this.eventService.getCalendar(query);
    return {
      success: true,
      data,
      message: 'Lấy lịch sự kiện thành công',
    };
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({ summary: 'Lấy chi tiết sự kiện theo ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy sự kiện' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.eventService.findById(id);
    return {
      success: true,
      data,
      message: 'Lấy chi tiết sự kiện thành công',
    };
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo sự kiện mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  async create(@Body() dto: CreateEventDto) {
    const data = await this.eventService.create(dto);
    return {
      success: true,
      data,
      message: 'Tạo sự kiện thành công',
    };
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Cập nhật sự kiện' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy sự kiện' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
  ) {
    const data = await this.eventService.update(id, dto);
    return {
      success: true,
      data,
      message: 'Cập nhật sự kiện thành công',
    };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Xóa sự kiện (soft delete)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy sự kiện' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.eventService.remove(id);
    return {
      success: true,
      data: null,
      message: 'Xóa sự kiện thành công',
    };
  }
}
