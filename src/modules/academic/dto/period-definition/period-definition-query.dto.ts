import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { GradeLevel } from '../../enums';

export class PeriodDefinitionQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Lọc theo ca học (sessionId)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID('4', { message: 'sessionId phải là UUID hợp lệ' })
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo cấp học',
    enum: GradeLevel,
    example: GradeLevel.PRIMARY,
  })
  @IsOptional()
  @IsEnum(GradeLevel, {
    message:
      'gradeLevel phải là giá trị hợp lệ: primary, middle_school, high_school',
  })
  gradeLevel?: GradeLevel;
}
