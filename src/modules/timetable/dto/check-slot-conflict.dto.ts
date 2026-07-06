import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CheckSlotConflictDto {
  @ApiProperty({ description: 'ID phiên bản TKB', format: 'uuid' })
  @IsNotEmpty({ message: 'versionId không được để trống' })
  @IsUUID('4', { message: 'versionId phải là UUID hợp lệ' })
  versionId: string;

  @ApiProperty({
    description: 'Ngày trong tuần (2=Thứ 2, 7=Thứ 7)',
    minimum: 2,
    maximum: 7,
    example: 2,
  })
  @IsNumber({}, { message: 'dayOfWeek phải là số' })
  @Min(2, { message: 'dayOfWeek phải từ 2 (Thứ 2) trở lên' })
  @Max(7, { message: 'dayOfWeek không được vượt quá 7 (Thứ 7)' })
  dayOfWeek: number;

  @ApiProperty({ description: 'ID tiết học', format: 'uuid' })
  @IsNotEmpty({ message: 'periodId không được để trống' })
  @IsUUID('4', { message: 'periodId phải là UUID hợp lệ' })
  periodId: string;

  @ApiProperty({ description: 'ID giáo viên', format: 'uuid' })
  @IsNotEmpty({ message: 'teacherId không được để trống' })
  @IsUUID('4', { message: 'teacherId phải là UUID hợp lệ' })
  teacherId: string;

  @ApiProperty({ description: 'ID lớp học', format: 'uuid' })
  @IsNotEmpty({ message: 'classId không được để trống' })
  @IsUUID('4', { message: 'classId phải là UUID hợp lệ' })
  classId: string;

  @ApiPropertyOptional({
    description: 'ID phòng học (có thể null)',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4', { message: 'roomId phải là UUID hợp lệ' })
  roomId?: string;

  @ApiProperty({ description: 'ID môn học', format: 'uuid' })
  @IsNotEmpty({ message: 'subjectId không được để trống' })
  @IsUUID('4', { message: 'subjectId phải là UUID hợp lệ' })
  subjectId: string;

  @ApiPropertyOptional({
    description:
      'ID slot cần loại trừ khi kiểm tra (dùng cho thao tác cập nhật)',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4', { message: 'excludeSlotId phải là UUID hợp lệ' })
  excludeSlotId?: string;
}
