import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { DepartmentMemberService } from './department-member.service';
import { DepartmentMemberRepository } from './department-member.repository';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { UpdateLevelDto } from './dto/update-level.dto';
import { BatchUpdateDto } from './dto/batch-update.dto';
import { MemberQueryDto } from './dto/member-query.dto';
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

@ApiTags('Department Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, SchoolScopeGuard)
@Controller('api/v1/departments/:departmentId/members')
export class DepartmentMemberController {
  constructor(
    private readonly memberService: DepartmentMemberService,
    private readonly memberRepository: DepartmentMemberRepository,
    private readonly userRepository: UserRepository,
  ) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Thêm thành viên vào tổ bộ môn' })
  @ApiParam({ name: 'departmentId', description: 'ID tổ bộ môn', type: String })
  @ApiResponse({ status: 201, description: 'Thêm thành viên thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tổ bộ môn' })
  @ApiResponse({ status: 409, description: 'Giáo viên đã là thành viên' })
  async addMember(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Body() dto: AddMemberDto,
    @SchoolScope() schoolScope: string | null,
  ) {
    return this.memberService.addMember(departmentId, dto, schoolScope);
  }

  @Delete(':memberId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Xóa thành viên khỏi tổ bộ môn' })
  @ApiParam({ name: 'departmentId', description: 'ID tổ bộ môn', type: String })
  @ApiParam({ name: 'memberId', description: 'ID thành viên', type: String })
  @ApiResponse({ status: 200, description: 'Xóa thành viên thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy thành viên' })
  async removeMember(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @SchoolScope() schoolScope: string | null,
  ) {
    await this.memberService.removeMember(departmentId, memberId, schoolScope);
    return { message: 'Xóa thành viên thành công' };
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.SCHEDULER,
    UserRole.TEACHER,
  )
  @ApiOperation({ summary: 'Lấy danh sách thành viên tổ bộ môn' })
  @ApiParam({ name: 'departmentId', description: 'ID tổ bộ môn', type: String })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tổ bộ môn' })
  async listMembers(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Query() query: MemberQueryDto,
    @SchoolScope() schoolScope: string | null,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    // TEACHER can only view members of departments they belong to
    if (user.role === UserRole.TEACHER) {
      const userRecord = await this.userRepository.findById(user.id);
      if (!userRecord?.teacherId) {
        throw new ForbiddenException('Không có quyền thực hiện thao tác này');
      }
      const teacherDepartmentIds =
        await this.memberRepository.findDepartmentIdsByTeacher(
          userRecord.teacherId,
        );
      if (!teacherDepartmentIds.includes(departmentId)) {
        throw new ForbiddenException('Không có quyền thực hiện thao tác này');
      }
    }

    return this.memberService.listMembers(departmentId, query, schoolScope);
  }

  @Patch(':memberId/position')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Cập nhật chức danh thành viên' })
  @ApiParam({ name: 'departmentId', description: 'ID tổ bộ môn', type: String })
  @ApiParam({ name: 'memberId', description: 'ID thành viên', type: String })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy thành viên' })
  async updatePosition(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdatePositionDto,
    @SchoolScope() schoolScope: string | null,
  ) {
    return this.memberService.updatePositionTitle(
      departmentId,
      memberId,
      dto,
      schoolScope,
    );
  }

  @Patch(':memberId/level')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Cập nhật cấp bậc quản lý thành viên' })
  @ApiParam({ name: 'departmentId', description: 'ID tổ bộ môn', type: String })
  @ApiParam({ name: 'memberId', description: 'ID thành viên', type: String })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy thành viên' })
  async updateLevel(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateLevelDto,
    @SchoolScope() schoolScope: string | null,
  ) {
    return this.memberService.updateManagementLevel(
      departmentId,
      memberId,
      dto,
      schoolScope,
    );
  }

  @Post('batch')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Thao tác hàng loạt thành viên tổ bộ môn' })
  @ApiParam({ name: 'departmentId', description: 'ID tổ bộ môn', type: String })
  @ApiResponse({ status: 200, description: 'Thao tác hàng loạt thành công' })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ hoặc batch validation failed',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tổ bộ môn' })
  async batchUpdate(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Body() dto: BatchUpdateDto,
    @SchoolScope() schoolScope: string | null,
  ) {
    return this.memberService.batchUpdate(departmentId, dto, schoolScope);
  }
}
