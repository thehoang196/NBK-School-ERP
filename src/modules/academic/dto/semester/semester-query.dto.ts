import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { SchoolScopedQueryDto } from '../../../../common/dto/school-scoped-query.dto';
import { AcademicStatus } from '../../../../common/enums/status.enum';

export class SemesterQueryDto extends SchoolScopedQueryDto {
  @ApiPropertyOptional({
    description: 'Lọc theo ID năm học',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4', { message: 'academicYearId phải là UUID hợp lệ' })
  academicYearId?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái',
    enum: AcademicStatus,
  })
  @IsOptional()
  @IsEnum(AcademicStatus, {
    message: 'Trạng thái phải là một trong: planning, active, completed',
  })
  status?: AcademicStatus;
}
