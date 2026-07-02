import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DragDropService } from '../services/drag-drop.service';
import {
  DropTeacherSubjectDto,
  MoveSlotDto,
  SwapSlotsDto,
  DropTeacherToSlotDto,
  PreviewDropDto,
  BatchDropDto,
  AvailableTeachersQueryDto,
} from '../dto/drag-drop.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../common/enums/role.enum';

@ApiTags('Timetable Drag & Drop')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/timetable-dnd')
export class DragDropController {
  constructor(private readonly dragDropService: DragDropService) {}

  @Post('drop-teacher-subject')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({
    summary: 'Kéo GV + Môn vào ô trống',
    description: 'Scheduler kéo "GV Nguyễn Văn A - Toán" vào ô (Thứ 2, Tiết 3, Lớp 10A1). Tự động kiểm tra xung đột.',
  })
  @ApiResponse({ status: 201, description: 'Thả thành công' })
  @ApiResponse({ status: 400, description: 'Xung đột hoặc ô đã có tiết' })
  async dropTeacherSubject(@Body() dto: DropTeacherSubjectDto) {
    return this.dragDropService.dropTeacherSubject(dto);
  }

  @Post('move')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({
    summary: 'Di chuyển slot sang vị trí khác',
    description: 'Kéo tiết Toán từ (Thứ 2, Tiết 1) sang (Thứ 4, Tiết 3). Giữ nguyên GV, môn, lớp.',
  })
  @ApiResponse({ status: 200, description: 'Di chuyển thành công' })
  @ApiResponse({ status: 400, description: 'Xung đột tại vị trí đích' })
  async moveSlot(@Body() dto: MoveSlotDto) {
    return this.dragDropService.moveSlot(dto);
  }

  @Post('swap')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({
    summary: 'Hoán đổi 2 slots',
    description: 'Đổi vị trí 2 tiết trong TKB. VD: đổi tiết Toán (Thứ 2, T1) với Lý (Thứ 4, T3).',
  })
  @ApiResponse({ status: 200, description: 'Hoán đổi thành công' })
  @ApiResponse({ status: 400, description: 'Xung đột sau khi hoán đổi' })
  async swapSlots(@Body() dto: SwapSlotsDto) {
    return this.dragDropService.swapSlots(dto);
  }

  @Post('drop-teacher')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({
    summary: 'Kéo GV mới vào slot (thay đổi GV)',
    description: 'Kéo GV khác vào slot đã có để thay GV. VD: GV nghỉ phép → kéo GV dạy thay.',
  })
  @ApiResponse({ status: 200, description: 'Thay GV thành công' })
  @ApiResponse({ status: 400, description: 'GV mới bị xung đột' })
  async dropTeacherToSlot(@Body() dto: DropTeacherToSlotDto) {
    return this.dragDropService.dropTeacherToSlot(dto);
  }

  @Post('preview')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({
    summary: 'Xem trước xung đột (không lưu)',
    description: 'Kiểm tra xem có thể thả vào ô không TRƯỚC KHI thả. Dùng khi hover trên ô.',
  })
  @ApiResponse({ status: 200, description: 'Kết quả preview' })
  async previewDrop(@Body() dto: PreviewDropDto) {
    return this.dragDropService.previewDrop(dto);
  }

  @Post('batch')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({
    summary: 'Kéo thả hàng loạt (nhiều ô cùng lúc)',
    description: 'Phân 4 tiết Toán/tuần cho GV vào nhiều ô. Có thể bỏ qua ô bị xung đột.',
  })
  @ApiResponse({ status: 201, description: 'Batch drop thành công' })
  @ApiResponse({ status: 400, description: 'Xung đột (khi skipConflicts=false)' })
  async batchDrop(@Body() dto: BatchDropDto) {
    return this.dragDropService.batchDrop(dto);
  }

  @Get('available-teachers')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SCHEDULER)
  @ApiOperation({
    summary: 'Lấy danh sách GV khả dụng cho 1 ô',
    description: 'Trả về tất cả GV, đánh dấu ai khả dụng/bận. Hỗ trợ hiển thị khi kéo-thả.',
  })
  @ApiResponse({ status: 200, description: 'Danh sách GV' })
  async getAvailableTeachers(@Query() query: AvailableTeachersQueryDto) {
    return this.dragDropService.getAvailableTeachers(
      query.versionId,
      query.dayOfWeek,
      query.periodId,
      query.subjectId,
    );
  }
}
