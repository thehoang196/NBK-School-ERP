import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsInt, Min, Max, IsOptional, Matches } from 'class-validator';
import { Type } from 'class-transformer';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateTeachingAssignmentDto {
  @ApiProperty({ description: 'ID học kỳ' })
  @IsNotEmpty()
  @IsString()
  @Matches(UUID_REGEX, { message: 'semesterId phải là UUID hợp lệ' })
  semesterId: string;

  @ApiProperty({ description: 'ID giáo viên' })
  @IsNotEmpty()
  @IsString()
  @Matches(UUID_REGEX, { message: 'teacherId phải là UUID hợp lệ' })
  teacherId: string;

  @ApiProperty({ description: 'ID lớp học' })
  @IsNotEmpty()
  @IsString()
  @Matches(UUID_REGEX, { message: 'classId phải là UUID hợp lệ' })
  classId: string;

  @ApiProperty({ description: 'ID môn học' })
  @IsNotEmpty()
  @IsString()
  @Matches(UUID_REGEX, { message: 'subjectId phải là UUID hợp lệ' })
  subjectId: string;

  @ApiProperty({ description: 'Số tiết/tuần', minimum: 1, maximum: 20 })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  periodsPerWeek: number;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  note?: string;
}
