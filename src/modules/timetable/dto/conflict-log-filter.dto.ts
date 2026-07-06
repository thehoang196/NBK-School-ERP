import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import {
  ConflictLogStatus,
  ConflictSeverity,
  ConflictType,
} from '../enums/conflict.enum';

export class ConflictLogFilterDto extends PaginationDto {
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

  @ApiPropertyOptional({
    description: 'Lọc theo ID phiên bản TKB',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4', { message: 'versionId phải là UUID hợp lệ' })
  versionId?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái xung đột',
    enum: ConflictLogStatus,
  })
  @IsOptional()
  @IsEnum(ConflictLogStatus, {
    message: 'status phải là giá trị ConflictLogStatus hợp lệ',
  })
  status?: ConflictLogStatus;
}
