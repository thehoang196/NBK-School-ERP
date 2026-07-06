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
  ParseUUIDPipe,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DepartmentService } from './department.service';
import { DepartmentMemberRepository } from './department-member.repository';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentQueryDto } from './dto/department-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SchoolScopeGuard } from '../../common/guards/school-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SchoolScope } from '../../common/decorators/school-scope.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { UserRepository } from '../auth/user.repository';

@ApiTags('departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, SchoolScopeGuard)
@Controller('api/v1/departments')
export class DepartmentController {
  constructor(
    private readonly departmentService: DepartmentService,
    private readonly memberRepository: DepartmentMemberRepository,
    private readonly userRepository: UserRepository,
  ) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.SCHEDULER,
    UserRole.TEACHER,
  )
  @ApiOperation({ summary: 'Lấy danh sách tổ bộ môn' })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách tổ bộ môn thành công',
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async findAll(
    @Query() query: DepartmentQueryDto,
    @SchoolScope() schoolScope: string | null,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    // TEACHER can only see departments they are a member of
    if (user.role === UserRole.TEACHER) {
      const userRecord = await this.userRepository.findById(user.id);
      if (!userRecord?.teacherId) {
        throw new ForbiddenException('Không có quyền thực hiện thao tác này');
      }
      const departmentIds =
        await this.memberRepository.findDepartmentIdsByTeacher(
          userRecord.teacherId,
        );
      return this.departmentService.findAllByIds(
        departmentIds,
        query,
        schoolScope,
      );
    }

    return this.departmentService.findAll(query, schoolScope);
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.SCHEDULER,
    UserRole.TEACHER,
  )
  @ApiOperation({ summary: 'Lấy chi tiết tổ bộ môn theo ID' })
  @ApiParam({ name: 'id', description: 'ID tổ bộ môn', type: String })
  @ApiResponse({
    status: 200,
    description: 'Lấy chi tiết tổ bộ môn thành công',
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tổ bộ môn' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @SchoolScope() schoolScope: string | null,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const department = await this.departmentService.findById(id);

    // Validate department thuộc school scope
    if (schoolScope && department.schoolId !== schoolScope) {
      throw new NotFoundException('Không tìm thấy tổ bộ môn');
    }

    // TEACHER can only access departments they belong to
    if (user.role === UserRole.TEACHER) {
      const userRecord = await this.userRepository.findById(user.id);
      if (!userRecord?.teacherId) {
        throw new ForbiddenException('Không có quyền thực hiện thao tác này');
      }
      const departmentIds =
        await this.memberRepository.findDepartmentIdsByTeacher(
          userRecord.teacherId,
        );
      if (!departmentIds.includes(id)) {
        throw new ForbiddenException('Không có quyền thực hiện thao tác này');
      }
    }

    return department;
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Tạo tổ bộ môn mới' })
  @ApiResponse({ status: 201, description: 'Tạo tổ bộ môn thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền tạo tổ bộ môn' })
  @ApiResponse({ status: 409, description: 'Tên tổ bộ môn đã tồn tại' })
  async create(
    @Body() dto: CreateDepartmentDto,
    @SchoolScope() schoolScope: string | null,
  ) {
    return this.departmentService.create(dto, schoolScope);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Cập nhật tổ bộ môn' })
  @ApiParam({ name: 'id', description: 'ID tổ bộ môn', type: String })
  @ApiResponse({ status: 200, description: 'Cập nhật tổ bộ môn thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền cập nhật tổ bộ môn',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tổ bộ môn' })
  @ApiResponse({ status: 409, description: 'Tên tổ bộ môn đã tồn tại' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
    @SchoolScope() schoolScope: string | null,
  ) {
    // Validate department thuộc school scope trước khi update
    if (schoolScope) {
      const department = await this.departmentService.findById(id);
      if (department.schoolId !== schoolScope) {
        throw new NotFoundException('Không tìm thấy tổ bộ môn');
      }
    }

    return this.departmentService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Xóa tổ bộ môn (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID tổ bộ môn', type: String })
  @ApiResponse({ status: 200, description: 'Xóa tổ bộ môn thành công' })
  @ApiResponse({
    status: 400,
    description: 'Không thể xóa tổ bộ môn vì còn thành viên',
  })
  @ApiResponse({ status: 401, description: 'Chưa xác thực' })
  @ApiResponse({ status: 403, description: 'Không có quyền xóa tổ bộ môn' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tổ bộ môn' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @SchoolScope() schoolScope: string | null,
  ) {
    // Validate department thuộc school scope trước khi xóa
    if (schoolScope) {
      const department = await this.departmentService.findById(id);
      if (department.schoolId !== schoolScope) {
        throw new NotFoundException('Không tìm thấy tổ bộ môn');
      }
    }

    await this.departmentService.remove(id);
    return { success: true, data: null, message: 'Xóa tổ bộ môn thành công' };
  }
}
