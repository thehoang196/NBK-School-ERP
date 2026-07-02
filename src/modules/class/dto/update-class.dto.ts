import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsInt, Min, Matches } from 'class-validator';
import { EntityStatus } from '../../../common/enums/status.enum';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UpdateClassDto {
  @ApiPropertyOptional({ description: 'ID khối' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'gradeId phải là UUID hợp lệ' })
  gradeId?: string;

  @ApiPropertyOptional({ description: 'ID năm học' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'academicYearId phải là UUID hợp lệ' })
  academicYearId?: string;

  @ApiPropertyOptional({ description: 'Tên lớp', example: '10A1' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'ID giáo viên chủ nhiệm' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'homeroomTeacherId phải là UUID hợp lệ' })
  homeroomTeacherId?: string;

  @ApiPropertyOptional({ description: 'Sĩ số' })
  @IsOptional()
  @IsInt()
  @Min(0)
  studentCount?: number;

  @ApiPropertyOptional({ enum: EntityStatus })
  @IsOptional()
  @IsEnum(EntityStatus)
  status?: EntityStatus;
}
