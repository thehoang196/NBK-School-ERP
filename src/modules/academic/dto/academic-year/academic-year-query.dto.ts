import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { SchoolScopedQueryDto } from '../../../../common/dto/school-scoped-query.dto';
import { AcademicStatus } from '../../../../common/enums/status.enum';

export class AcademicYearQueryDto extends SchoolScopedQueryDto {
  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái năm học',
    enum: AcademicStatus,
    example: AcademicStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(AcademicStatus, {
    message:
      'Trạng thái phải là một trong các giá trị: planning, active, completed',
  })
  status?: AcademicStatus;

  @ApiPropertyOptional({
    description: 'Lọc năm học hiện tại (true/false)',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'isCurrent phải là giá trị boolean (true/false)' })
  isCurrent?: boolean;
}
