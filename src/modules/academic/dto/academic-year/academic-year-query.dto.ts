import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, Matches } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { AcademicStatus } from '../../../../common/enums/status.enum';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AcademicYearQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Lọc theo trường' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'schoolId phải là UUID hợp lệ' })
  schoolId?: string;

  @ApiPropertyOptional({ enum: AcademicStatus, description: 'Lọc theo trạng thái' })
  @IsOptional()
  @IsEnum(AcademicStatus)
  status?: AcademicStatus;
}
