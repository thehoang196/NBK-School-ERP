import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UpdateTeachingAssignmentDto {
  @ApiPropertyOptional({ description: 'ID giáo viên' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'teacherId phải là UUID hợp lệ' })
  teacherId?: string;

  @ApiPropertyOptional({ description: 'ID lớp học' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'classId phải là UUID hợp lệ' })
  classId?: string;

  @ApiPropertyOptional({ description: 'ID môn học' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'subjectId phải là UUID hợp lệ' })
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Số tiết/tuần', minimum: 1, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  periodsPerWeek?: number;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  note?: string;
}
