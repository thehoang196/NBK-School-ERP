import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class TeachingAssignmentQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Lọc theo học kỳ' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'semesterId phải là UUID hợp lệ' })
  semesterId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo giáo viên' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'teacherId phải là UUID hợp lệ' })
  teacherId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo lớp' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'classId phải là UUID hợp lệ' })
  classId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo môn học' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'subjectId phải là UUID hợp lệ' })
  subjectId?: string;
}
