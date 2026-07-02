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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PayComponentService } from '../services/pay-component.service';
import { CreatePayComponentDto } from '../dto/pay-component/create-pay-component.dto';
import { UpdatePayComponentDto } from '../dto/pay-component/update-pay-component.dto';
import { PayComponentQueryDto } from '../dto/pay-component/pay-component-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/role.enum';

@ApiTags('Compensation - Pay Components')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/compensation/pay-components')
export class PayComponentController {
  constructor(private readonly payComponentService: PayComponentService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy danh sách thành phần lương' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async findAll(@Query() query: PayComponentQueryDto) {
    return this.payComponentService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy chi tiết thành phần lương' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.payComponentService.findById(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Tạo thành phần lương mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 409, description: 'Mã đã tồn tại' })
  async create(@Body() dto: CreatePayComponentDto) {
    return this.payComponentService.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Cập nhật thành phần lương' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc đang được tham chiếu' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePayComponentDto,
  ) {
    return this.payComponentService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Vô hiệu hóa thành phần lương (soft delete)' })
  @ApiResponse({ status: 200, description: 'Vô hiệu hóa thành công' })
  @ApiResponse({ status: 400, description: 'Đang được tham chiếu bởi công thức' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    await this.payComponentService.deactivate(id);
    return { success: true, message: 'Vô hiệu hóa thành phần lương thành công' };
  }
}
