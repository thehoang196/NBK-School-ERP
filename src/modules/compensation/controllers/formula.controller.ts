import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FormulaService } from '../services/formula.service';
import { CreateFormulaDto } from '../dto/formula/create-formula.dto';
import { UpdateFormulaDto } from '../dto/formula/update-formula.dto';
import { ValidateFormulaDto } from '../dto/formula/validate-formula.dto';
import { FormulaQueryDto } from '../dto/formula/formula-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/role.enum';

@ApiTags('Compensation - Formulas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/compensation/formulas')
export class FormulaController {
  constructor(private readonly formulaService: FormulaService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy danh sách công thức' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async findAll(@Query() query: FormulaQueryDto) {
    return this.formulaService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy chi tiết công thức' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.formulaService.findById(id);
  }

  @Get(':id/versions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Lấy lịch sử phiên bản công thức' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  async getVersions(@Param('id', ParseUUIDPipe) id: string) {
    return this.formulaService.getVersionsByFormulaId(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Tạo công thức mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 400, description: 'Công thức không hợp lệ' })
  async create(@Body() dto: CreateFormulaDto) {
    return this.formulaService.create(dto);
  }

  @Post('validate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Validate công thức' })
  @ApiResponse({ status: 200, description: 'Kết quả validation' })
  async validate(@Body() dto: ValidateFormulaDto) {
    return this.formulaService.validate(dto);
  }

  @Post(':id/publish')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Publish công thức' })
  @ApiResponse({ status: 200, description: 'Publish thành công' })
  @ApiResponse({ status: 400, description: 'Không thể publish' })
  async publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.formulaService.publish(id);
  }

  @Post(':id/rollback/:version')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Rollback công thức về phiên bản cũ' })
  @ApiResponse({ status: 200, description: 'Rollback thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phiên bản' })
  async rollback(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.formulaService.rollback(id, version);
  }

  @Post(':id/clone')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Clone công thức sang pay component khác' })
  @ApiResponse({ status: 201, description: 'Clone thành công' })
  async clone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { payComponentId: string; schoolId: string },
  ) {
    return this.formulaService.clone(id, body.payComponentId, body.schoolId);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Cập nhật công thức (tạo phiên bản mới)' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 400, description: 'Công thức không hợp lệ' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFormulaDto,
  ) {
    return this.formulaService.update(id, dto);
  }
}
