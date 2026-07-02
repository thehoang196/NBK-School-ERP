import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, Matches } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { AcademicStatus } from '../../../../common/enums/status.enum';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SemesterQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Lọc theo năm học' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'academicYearId phải là UUID hợp lệ' })
  academicYearId?: string;

  @ApiPropertyOptional({ enum: AcademicStatus, description: 'Lọc theo trạng thái' })
  @IsOptional()
  @IsEnum(AcademicStatus)
  status?: AcademicStatus;
}
