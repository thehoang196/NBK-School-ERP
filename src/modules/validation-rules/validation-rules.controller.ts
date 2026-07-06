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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ValidationRulesService } from './validation-rules.service';
import { ValidationRulesRepository } from './validation-rules.repository';
import {
  ValidationRuleEntity,
  ValidationEntityTarget,
} from './entities/validation-rule.entity';
import { CreateValidationRuleDto } from './dto/create-validation-rule.dto';
import { UpdateValidationRuleDto } from './dto/update-validation-rule.dto';
import { ValidateFieldDto } from './dto/validate-field.dto';
import {
  ValidationResult,
  BatchValidationResult,
} from './interfaces/validation.interface';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';

@ApiTags('Validation Rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/validation-rules')
export class ValidationRulesController {
  constructor(
    private readonly service: ValidationRulesService,
    private readonly repository: ValidationRulesRepository,
  ) {}

  // ─── CRUD MANAGEMENT ────────────────────────────────────────────────────

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy danh sách validation rules' })
  @ApiQuery({ name: 'schoolId', type: 'string' })
  @ApiQuery({
    name: 'entityTarget',
    enum: ValidationEntityTarget,
    required: false,
  })
  @ApiResponse({ status: 200, description: 'Danh sách rules' })
  async findAll(
    @Query('schoolId') schoolId: string,
    @Query('entityTarget') entityTarget?: ValidationEntityTarget,
  ): Promise<ValidationRuleEntity[]> {
    return this.repository.findAll(schoolId, entityTarget);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy chi tiết một rule' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Chi tiết rule' })
  async findById(
    @Param('id') id: string,
  ): Promise<ValidationRuleEntity | null> {
    return this.repository.findById(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Tạo validation rule mới' })
  @ApiResponse({ status: 201, description: 'Rule đã tạo' })
  async create(
    @Body() dto: CreateValidationRuleDto,
  ): Promise<ValidationRuleEntity> {
    return this.repository.create({
      schoolId: dto.schoolId,
      entityTarget: dto.entityTarget,
      fieldName: dto.fieldName,
      ruleType: dto.ruleType,
      ruleConfig: dto.ruleConfig,
      errorMessage: dto.errorMessage,
      isActive: dto.isActive ?? true,
      priority: dto.priority ?? 0,
    });
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Cập nhật validation rule' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Rule đã cập nhật' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateValidationRuleDto,
  ): Promise<ValidationRuleEntity | null> {
    return this.repository.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Xóa validation rule (soft delete)' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Rule đã xóa' })
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.repository.softDelete(id);
    return { success: true };
  }

  // ─── VALIDATION EXECUTION ──────────────────────────────────────────────

  @Post('validate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Validate một field theo rules đã cấu hình' })
  @ApiResponse({ status: 200, description: 'Kết quả validation' })
  async validateField(
    @Body() dto: ValidateFieldDto,
  ): Promise<ValidationResult> {
    return this.service.validateField(
      dto.fieldName,
      dto.value,
      dto.schoolId,
      dto.entityTarget,
    );
  }

  @Post('validate-batch')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({
    summary: 'Validate nhiều rows cùng lúc (dùng cho import preview)',
  })
  @ApiQuery({ name: 'schoolId', type: 'string' })
  @ApiQuery({ name: 'entityTarget', enum: ValidationEntityTarget })
  @ApiResponse({ status: 200, description: 'Kết quả batch validation' })
  async validateBatch(
    @Query('schoolId') schoolId: string,
    @Query('entityTarget') entityTarget: ValidationEntityTarget,
    @Body() rows: Array<{ rowIndex: number; data: Record<string, unknown> }>,
  ): Promise<BatchValidationResult> {
    return this.service.validateBatch(rows, schoolId, entityTarget);
  }
}
