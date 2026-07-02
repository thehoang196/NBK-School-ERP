import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEnum, IsInt, Min, Matches } from 'class-validator';
import { EntityStatus } from '../../../common/enums/status.enum';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateClassDto {
  @ApiProperty({ description: 'ID trường', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsNotEmpty()
  @IsString()
  @Matches(UUID_REGEX, { message: 'schoolId phải là UUID hợp lệ' })
  schoolId: string;

  @ApiProperty({ description: 'ID khối' })
  @IsNotEmpty()
  @IsString()
  @Matches(UUID_REGEX, { message: 'gradeId phải là UUID hợp lệ' })
  gradeId: string;

  @ApiProperty({ description: 'ID năm học' })
  @IsNotEmpty()
  @IsString()
  @Matches(UUID_REGEX, { message: 'academicYearId phải là UUID hợp lệ' })
  academicYearId: string;

  @ApiProperty({ description: 'Tên lớp', example: '10A1' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'ID giáo viên chủ nhiệm' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'homeroomTeacherId phải là UUID hợp lệ' })
  homeroomTeacherId?: string;

  @ApiPropertyOptional({ description: 'Sĩ số', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  studentCount?: number;

  @ApiPropertyOptional({ enum: EntityStatus, default: EntityStatus.ACTIVE })
  @IsOptional()
  @IsEnum(EntityStatus)
  status?: EntityStatus;
}
