import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  Matches,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Kéo GV + Môn học vào ô trống trên TKB
 * Use case: Scheduler kéo "GV Nguyễn Văn A - Toán" vào ô (Thứ 2, Tiết 3, Lớp 10A1)
 */
export class DropTeacherSubjectDto {
  @ApiProperty({ description: 'ID phiên bản TKB' })
  @Matches(UUID_REGEX, { message: 'versionId phải là UUID hợp lệ' })
  @IsNotEmpty()
  versionId: string;

  @ApiProperty({ description: 'ID giáo viên được kéo thả' })
  @Matches(UUID_REGEX, { message: 'teacherId phải là UUID hợp lệ' })
  @IsNotEmpty()
  teacherId: string;

  @ApiProperty({ description: 'ID môn học được kéo thả' })
  @Matches(UUID_REGEX, { message: 'subjectId phải là UUID hợp lệ' })
  @IsNotEmpty()
  subjectId: string;

  @ApiProperty({ description: 'ID lớp (ô đích)' })
  @Matches(UUID_REGEX, { message: 'classId phải là UUID hợp lệ' })
  @IsNotEmpty()
  classId: string;

  @ApiProperty({
    description: 'Ngày trong tuần đích (2=Thứ 2, 7=Thứ 7)',
    minimum: 2,
    maximum: 7,
  })
  @IsInt()
  @Min(2)
  @Max(7)
  dayOfWeek: number;

  @ApiProperty({ description: 'ID tiết học đích' })
  @Matches(UUID_REGEX, { message: 'periodId phải là UUID hợp lệ' })
  @IsNotEmpty()
  periodId: string;

  @ApiPropertyOptional({ description: 'ID phòng học' })
  @IsOptional()
  @Matches(UUID_REGEX, { message: 'roomId phải là UUID hợp lệ' })
  roomId?: string;

  @ApiPropertyOptional({
    description: 'Tiết đôi (tự động chiếm thêm tiết kế tiếp)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDoublePeriod?: boolean;
}

/**
 * Di chuyển slot từ vị trí này sang vị trí khác
 * Use case: Kéo tiết Toán từ (Thứ 2, Tiết 1) sang (Thứ 4, Tiết 3)
 */
export class MoveSlotDto {
  @ApiProperty({ description: 'ID slot cần di chuyển' })
  @Matches(UUID_REGEX, { message: 'slotId phải là UUID hợp lệ' })
  @IsNotEmpty()
  slotId: string;

  @ApiProperty({
    description: 'Ngày trong tuần đích (2=Thứ 2, 7=Thứ 7)',
    minimum: 2,
    maximum: 7,
  })
  @IsInt()
  @Min(2)
  @Max(7)
  targetDayOfWeek: number;

  @ApiProperty({ description: 'ID tiết học đích' })
  @Matches(UUID_REGEX, { message: 'targetPeriodId phải là UUID hợp lệ' })
  @IsNotEmpty()
  targetPeriodId: string;

  @ApiPropertyOptional({ description: 'ID phòng mới (nếu muốn đổi phòng)' })
  @IsOptional()
  @Matches(UUID_REGEX, { message: 'targetRoomId phải là UUID hợp lệ' })
  targetRoomId?: string;
}

/**
 * Hoán đổi 2 slots
 * Use case: Đổi tiết Toán (Thứ 2, Tiết 1) với tiết Lý (Thứ 4, Tiết 3)
 */
export class SwapSlotsDto {
  @ApiProperty({ description: 'ID slot thứ nhất' })
  @Matches(UUID_REGEX, { message: 'slotAId phải là UUID hợp lệ' })
  @IsNotEmpty()
  slotAId: string;

  @ApiProperty({ description: 'ID slot thứ hai' })
  @Matches(UUID_REGEX, { message: 'slotBId phải là UUID hợp lệ' })
  @IsNotEmpty()
  slotBId: string;
}

/**
 * Thay đổi GV cho slot (kéo GV mới vào slot đã có)
 * Use case: GV nghỉ phép, kéo GV khác vào dạy thay
 */
export class DropTeacherToSlotDto {
  @ApiProperty({ description: 'ID slot cần thay GV' })
  @Matches(UUID_REGEX, { message: 'slotId phải là UUID hợp lệ' })
  @IsNotEmpty()
  slotId: string;

  @ApiProperty({ description: 'ID giáo viên mới' })
  @Matches(UUID_REGEX, { message: 'teacherId phải là UUID hợp lệ' })
  @IsNotEmpty()
  teacherId: string;
}

/**
 * Xem trước xung đột trước khi thả (preview - không lưu)
 */
export class PreviewDropDto {
  @ApiProperty({ description: 'ID phiên bản TKB' })
  @Matches(UUID_REGEX, { message: 'versionId phải là UUID hợp lệ' })
  @IsNotEmpty()
  versionId: string;

  @ApiProperty({ description: 'ID giáo viên' })
  @Matches(UUID_REGEX, { message: 'teacherId phải là UUID hợp lệ' })
  @IsNotEmpty()
  teacherId: string;

  @ApiProperty({ description: 'ID lớp' })
  @Matches(UUID_REGEX, { message: 'classId phải là UUID hợp lệ' })
  @IsNotEmpty()
  classId: string;

  @ApiProperty({ description: 'ID môn học' })
  @Matches(UUID_REGEX, { message: 'subjectId phải là UUID hợp lệ' })
  @IsNotEmpty()
  subjectId: string;

  @ApiProperty({ description: 'Ngày trong tuần (2-7)' })
  @IsInt()
  @Min(2)
  @Max(7)
  dayOfWeek: number;

  @ApiProperty({ description: 'ID tiết học' })
  @Matches(UUID_REGEX, { message: 'periodId phải là UUID hợp lệ' })
  @IsNotEmpty()
  periodId: string;

  @ApiPropertyOptional({ description: 'ID phòng học' })
  @IsOptional()
  @Matches(UUID_REGEX, { message: 'roomId phải là UUID hợp lệ' })
  roomId?: string;
}

/**
 * Kéo thả hàng loạt - GV+Môn vào nhiều ô cùng lúc
 * Use case: Phân 4 tiết Toán/tuần cho GV Nguyễn Văn A dạy lớp 10A1
 */
export class BatchDropTargetDto {
  @ApiProperty({ description: 'Ngày trong tuần (2-7)' })
  @IsInt()
  @Min(2)
  @Max(7)
  dayOfWeek: number;

  @ApiProperty({ description: 'ID tiết học' })
  @Matches(UUID_REGEX, { message: 'periodId phải là UUID hợp lệ' })
  @IsNotEmpty()
  periodId: string;

  @ApiPropertyOptional({ description: 'ID phòng học' })
  @IsOptional()
  @Matches(UUID_REGEX, { message: 'roomId phải là UUID hợp lệ' })
  roomId?: string;
}

export class BatchDropDto {
  @ApiProperty({ description: 'ID phiên bản TKB' })
  @Matches(UUID_REGEX, { message: 'versionId phải là UUID hợp lệ' })
  @IsNotEmpty()
  versionId: string;

  @ApiProperty({ description: 'ID giáo viên' })
  @Matches(UUID_REGEX, { message: 'teacherId phải là UUID hợp lệ' })
  @IsNotEmpty()
  teacherId: string;

  @ApiProperty({ description: 'ID môn học' })
  @Matches(UUID_REGEX, { message: 'subjectId phải là UUID hợp lệ' })
  @IsNotEmpty()
  subjectId: string;

  @ApiProperty({ description: 'ID lớp' })
  @Matches(UUID_REGEX, { message: 'classId phải là UUID hợp lệ' })
  @IsNotEmpty()
  classId: string;

  @ApiProperty({
    description: 'Danh sách các ô đích',
    type: [BatchDropTargetDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchDropTargetDto)
  targets: BatchDropTargetDto[];

  @ApiPropertyOptional({
    description: 'Bỏ qua các ô bị xung đột (chỉ tạo ô hợp lệ)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  skipConflicts?: boolean;
}

/**
 * Lấy danh sách GV khả dụng cho 1 ô (hỗ trợ kéo-thả)
 */
export class AvailableTeachersQueryDto {
  @ApiProperty({ description: 'ID phiên bản TKB' })
  @IsString()
  @IsNotEmpty()
  versionId: string;

  @ApiProperty({ description: 'Ngày trong tuần (2-7)' })
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(7)
  dayOfWeek: number;

  @ApiProperty({ description: 'ID tiết học' })
  @IsString()
  @IsNotEmpty()
  periodId: string;

  @ApiPropertyOptional({
    description: 'Lọc theo ID môn học (chỉ GV dạy được môn này)',
  })
  @IsOptional()
  @IsString()
  subjectId?: string;
}
