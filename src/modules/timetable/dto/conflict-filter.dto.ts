import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ConflictSeverity, ConflictType } from '../enums/conflict.enum';

export class ConflictFilterDto {
  @ApiPropertyOptional({
    description: 'Lọc theo loại xung đột',
    enum: ConflictType,
  })
  @IsOptional()
  @IsEnum(ConflictType, { message: 'type phải là giá trị ConflictType hợp lệ' })
  type?: ConflictType;

  @ApiPropertyOptional({
    description: 'Lọc theo mức độ nghiêm trọng',
    enum: ConflictSeverity,
  })
  @IsOptional()
  @IsEnum(ConflictSeverity, {
    message: 'severity phải là giá trị ConflictSeverity hợp lệ',
  })
  severity?: ConflictSeverity;

  @ApiPropertyOptional({ description: 'Lọc theo ID giáo viên', format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'teacherId phải là UUID hợp lệ' })
  teacherId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID lớp học', format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'classId phải là UUID hợp lệ' })
  classId?: string;
}
