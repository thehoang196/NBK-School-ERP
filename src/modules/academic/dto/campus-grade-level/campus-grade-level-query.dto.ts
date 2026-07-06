import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, Matches } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { GradeLevel } from '../../enums';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CampusGradeLevelQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Lọc theo cơ sở (campus)' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'campusId phải là UUID hợp lệ' })
  campusId?: string;

  @ApiPropertyOptional({
    enum: GradeLevel,
    description: 'Lọc theo cấp học',
  })
  @IsOptional()
  @IsEnum(GradeLevel, {
    message: `gradeLevel phải là một trong các giá trị: ${Object.values(GradeLevel).join(', ')}`,
  })
  gradeLevel?: GradeLevel;
}
