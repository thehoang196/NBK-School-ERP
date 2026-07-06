import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsString,
  IsIn,
} from 'class-validator';
import { TeacherType } from '../../../common/enums/status.enum';

export class OrgTeacherQueryDto {
  @ApiPropertyOptional({ description: 'Filter theo trường cụ thể' })
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional({
    description: 'Filter theo loại giáo viên',
    enum: TeacherType,
  })
  @IsOptional()
  @IsEnum(TeacherType)
  teacherType?: TeacherType;

  @ApiPropertyOptional({ description: 'Filter theo tổ bộ môn' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({
    description:
      'Chỉ hiện giáo viên có phân công cross-school (secondary assignments)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  hasCrossSchool?: boolean;

  @ApiPropertyOptional({ description: 'Tìm kiếm theo tên hoặc mã nhân viên' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Trường sắp xếp' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder: 'ASC' | 'DESC' = 'DESC';
}
