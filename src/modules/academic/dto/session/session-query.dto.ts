import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum, IsString } from 'class-validator';
import { SchoolScopedQueryDto } from '../../../../common/dto/school-scoped-query.dto';
import { GradeLevel } from '../../enums';

export class SessionQueryDto extends SchoolScopedQueryDto {
  @ApiPropertyOptional({
    description: 'Lọc theo cơ sở (campus)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID('4', { message: 'campusId phải là UUID hợp lệ' })
  campusId?: string;

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

  @ApiPropertyOptional({
    description: 'Tìm kiếm theo tên ca học',
    example: 'Sáng',
  })
  @IsOptional()
  @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi ký tự' })
  search?: string;
}
