import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ConflictLogStatus,
  ConflictSeverity,
  ConflictType,
  ValidationContext,
} from '../enums/conflict.enum';

export class ConflictDetailsResponseDto {
  @ApiPropertyOptional({ description: 'ID slot được kiểm tra', format: 'uuid' })
  targetSlotId?: string;

  @ApiPropertyOptional({ description: 'ID slot xung đột', format: 'uuid' })
  conflictingSlotId?: string;

  @ApiPropertyOptional({ description: 'ID giáo viên', format: 'uuid' })
  teacherId?: string;

  @ApiPropertyOptional({ description: 'Tên giáo viên' })
  teacherName?: string;

  @ApiPropertyOptional({ description: 'ID lớp học', format: 'uuid' })
  classId?: string;

  @ApiPropertyOptional({ description: 'Tên lớp học' })
  className?: string;

  @ApiPropertyOptional({ description: 'ID phòng học', format: 'uuid' })
  roomId?: string;

  @ApiPropertyOptional({ description: 'Tên phòng học' })
  roomName?: string;

  @ApiPropertyOptional({ description: 'ID môn học', format: 'uuid' })
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Tên môn học' })
  subjectName?: string;

  @ApiPropertyOptional({ description: 'Ngày trong tuần' })
  dayOfWeek?: number;

  @ApiPropertyOptional({ description: 'ID tiết học', format: 'uuid' })
  periodId?: string;

  @ApiPropertyOptional({ description: 'Thứ tự tiết học' })
  periodOrder?: number;

  @ApiPropertyOptional({
    description: 'Số lượng hiện tại (cho soft constraints)',
  })
  currentCount?: number;

  @ApiPropertyOptional({ description: 'Số lượng tối đa cho phép' })
  maxAllowed?: number;

  @ApiPropertyOptional({ description: 'Campus nguồn' })
  campusFrom?: string;

  @ApiPropertyOptional({ description: 'Campus đích' })
  campusTo?: string;

  @ApiPropertyOptional({
    description: 'Các ngày bị ảnh hưởng',
    type: [Number],
  })
  affectedDays?: number[];
}

export class ConflictItemResponseDto {
  @ApiProperty({
    description: 'Loại xung đột',
    enum: ConflictType,
  })
  type: ConflictType;

  @ApiProperty({
    description: 'Mức độ nghiêm trọng',
    enum: ConflictSeverity,
  })
  severity: ConflictSeverity;

  @ApiProperty({ description: 'Thông báo mô tả xung đột' })
  message: string;

  @ApiProperty({
    description: 'Chi tiết xung đột',
    type: ConflictDetailsResponseDto,
  })
  details: ConflictDetailsResponseDto;
}

export class ConflictCheckResponseDto {
  @ApiProperty({ description: 'Có xung đột cứng hay không' })
  hasHardConflicts: boolean;

  @ApiProperty({ description: 'Có xung đột mềm hay không' })
  hasSoftConflicts: boolean;

  @ApiProperty({
    description: 'Danh sách xung đột phát hiện được',
    type: [ConflictItemResponseDto],
  })
  conflicts: ConflictItemResponseDto[];

  @ApiProperty({ description: 'Số lượng xung đột cứng' })
  hardCount: number;

  @ApiProperty({ description: 'Số lượng xung đột mềm' })
  softCount: number;
}

export class FullVersionConflictResponseDto {
  @ApiProperty({ description: 'ID phiên bản TKB', format: 'uuid' })
  versionId: string;

  @ApiProperty({ description: 'Tổng số slots trong phiên bản' })
  totalSlots: number;

  @ApiProperty({ description: 'Tổng số xung đột phát hiện' })
  totalConflicts: number;

  @ApiProperty({ description: 'Số lượng xung đột cứng' })
  hardCount: number;

  @ApiProperty({ description: 'Số lượng xung đột mềm' })
  softCount: number;

  @ApiProperty({
    description: 'Xung đột nhóm theo loại',
    type: 'object',
    additionalProperties: {
      type: 'array',
      items: { $ref: '#/components/schemas/ConflictItemResponseDto' },
    },
  })
  byType: Record<ConflictType, ConflictItemResponseDto[]>;

  @ApiProperty({
    description: 'Danh sách tất cả xung đột',
    type: [ConflictItemResponseDto],
  })
  conflicts: ConflictItemResponseDto[];
}

export class BatchSlotConflictResponseDto {
  @ApiProperty({ description: 'Chỉ số dòng trong file import (0-indexed)' })
  rowIndex: number;

  @ApiProperty({
    description: 'Danh sách xung đột cho slot này',
    type: [ConflictItemResponseDto],
  })
  conflicts: ConflictItemResponseDto[];
}

export class BatchConflictResponseDto {
  @ApiProperty({ description: 'Tổng số slots trong batch' })
  totalSlots: number;

  @ApiProperty({ description: 'Số slots hợp lệ (không có xung đột cứng)' })
  validSlots: number;

  @ApiProperty({ description: 'Số slots không hợp lệ (có xung đột cứng)' })
  invalidSlots: number;

  @ApiProperty({
    description: 'Chi tiết xung đột theo từng slot',
    type: [BatchSlotConflictResponseDto],
  })
  conflicts: BatchSlotConflictResponseDto[];

  @ApiProperty({
    description: 'Có thể tiếp tục với override (chỉ có soft conflicts)',
  })
  canProceedWithOverride: boolean;
}

export class ConflictLogResponseDto {
  @ApiProperty({ description: 'ID bản ghi log', format: 'uuid' })
  id: string;

  @ApiProperty({
    description: 'Loại xung đột',
    enum: ConflictType,
  })
  conflictType: ConflictType;

  @ApiProperty({
    description: 'Mức độ nghiêm trọng',
    enum: ConflictSeverity,
  })
  severity: ConflictSeverity;

  @ApiProperty({ description: 'Ngày trong tuần' })
  dayOfWeek: number;

  @ApiProperty({ description: 'ID tiết học', format: 'uuid' })
  periodId: string;

  @ApiPropertyOptional({ description: 'ID giáo viên', format: 'uuid' })
  teacherId?: string;

  @ApiPropertyOptional({ description: 'ID lớp học', format: 'uuid' })
  classId?: string;

  @ApiPropertyOptional({ description: 'ID phòng học', format: 'uuid' })
  roomId?: string;

  @ApiPropertyOptional({ description: 'ID môn học', format: 'uuid' })
  subjectId?: string;

  @ApiProperty({ description: 'Thông báo xung đột' })
  message: string;

  @ApiPropertyOptional({
    description: 'Chi tiết xung đột',
    type: ConflictDetailsResponseDto,
  })
  details?: ConflictDetailsResponseDto;

  @ApiProperty({
    description: 'Ngữ cảnh kiểm tra',
    enum: ValidationContext,
  })
  validationContext: ValidationContext;

  @ApiProperty({
    description: 'Trạng thái xung đột',
    enum: ConflictLogStatus,
  })
  status: ConflictLogStatus;

  @ApiProperty({ description: 'Thời gian phát hiện' })
  detectedAt: Date;

  @ApiPropertyOptional({ description: 'ID người ghi đè', format: 'uuid' })
  overriddenBy?: string;

  @ApiPropertyOptional({ description: 'Thời gian ghi đè' })
  overriddenAt?: Date;

  @ApiPropertyOptional({ description: 'Lý do ghi đè' })
  overrideReason?: string;
}
