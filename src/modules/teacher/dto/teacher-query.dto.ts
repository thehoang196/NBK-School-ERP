import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsUUID, Matches } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { TeacherStatus, TeacherType } from '../../../common/enums/status.enum';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class TeacherQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Lọc theo trường (schoolId)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'schoolId phải là UUID hợp lệ' })
  schoolId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo tổ bộ môn' })
  @IsOptional()
  @IsString({ message: 'departmentId phải là chuỗi' })
  @Matches(UUID_REGEX, { message: 'departmentId phải là UUID hợp lệ' })
  departmentId?: string;

  @ApiPropertyOptional({
    enum: TeacherType,
    description: 'Lọc theo loại giáo viên',
  })
  @IsOptional()
  @IsEnum(TeacherType, { message: 'Loại giáo viên không hợp lệ' })
  teacherType?: TeacherType;

  @ApiPropertyOptional({
    enum: TeacherStatus,
    description: 'Lọc theo trạng thái',
  })
  @IsOptional()
  @IsEnum(TeacherStatus, { message: 'Trạng thái không hợp lệ' })
  status?: TeacherStatus;

  @ApiPropertyOptional({ description: 'Tìm kiếm theo tên hoặc mã giáo viên' })
  @IsOptional()
  @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi' })
  search?: string;
}
