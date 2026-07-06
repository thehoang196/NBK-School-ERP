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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RuleService } from '../services/rule.service';
import { RuleEvaluator, TeacherContext } from '../services/rule-evaluator';
import { CreateRuleDto } from '../dto/rule/create-rule.dto';
import { UpdateRuleDto } from '../dto/rule/update-rule.dto';
import { RuleQueryDto } from '../dto/rule/rule-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/role.enum';

@ApiTags('Compensation - Rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/compensation/rules')
export class RuleController {
  constructor(
    private readonly ruleService: RuleService,
    private readonly ruleEvaluator: RuleEvaluator,
  ) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy danh sách quy tắc' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async findAll(@Query() query: RuleQueryDto) {
    return this.ruleService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy chi tiết quy tắc' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.ruleService.findById(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Tạo quy tắc mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  async create(@Body() dto: CreateRuleDto) {
    return this.ruleService.create(dto);
  }

  @Post('evaluate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Evaluate quy tắc cho teacher context' })
  @ApiResponse({ status: 200, description: 'Kết quả evaluate' })
  async evaluate(@Body() body: { schoolId: string; context: TeacherContext }) {
    return this.ruleEvaluator.evaluate(body.schoolId, body.context);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Cập nhật quy tắc' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRuleDto,
  ) {
    return this.ruleService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Xóa quy tắc (soft delete)' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async softDelete(@Param('id', ParseUUIDPipe) id: string) {
    await this.ruleService.softDelete(id);
    return { success: true, message: 'Xóa quy tắc thành công' };
  }
}
