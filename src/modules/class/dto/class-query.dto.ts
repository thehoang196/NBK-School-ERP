import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ClassQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Lọc theo trường' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'schoolId phải là UUID hợp lệ' })
  schoolId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo khối' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'gradeId phải là UUID hợp lệ' })
  gradeId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo năm học' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'academicYearId phải là UUID hợp lệ' })
  academicYearId?: string;

  @ApiPropertyOptional({ description: 'Tìm kiếm theo tên lớp' })
  @IsOptional()
  @IsString()
  search?: string;
}
