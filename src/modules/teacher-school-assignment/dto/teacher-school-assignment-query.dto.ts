import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { AssignmentStatus } from '../enums/assignment-status.enum';

export class TeacherSchoolAssignmentQueryDto {
  @ApiPropertyOptional({
    description: 'Lọc theo giáo viên',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo trường',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái',
    enum: AssignmentStatus,
  })
  @IsOptional()
  @IsEnum(AssignmentStatus)
  status?: AssignmentStatus;

  @ApiPropertyOptional({
    description: 'Bao gồm các phân công không hoạt động',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeInactive: boolean = false;

  @ApiPropertyOptional({
    description: 'Trang hiện tại',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Số bản ghi mỗi trang',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  limit: number = 20;
}
