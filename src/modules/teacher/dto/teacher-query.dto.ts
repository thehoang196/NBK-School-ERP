import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, Matches } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { TeacherStatus } from '../../../common/enums/status.enum';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class TeacherQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Lọc theo trường' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'schoolId phải là UUID hợp lệ' })
  schoolId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo tổ bộ môn' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'departmentId phải là UUID hợp lệ' })
  departmentId?: string;

  @ApiPropertyOptional({ enum: TeacherStatus, description: 'Lọc theo trạng thái' })
  @IsOptional()
  @IsEnum(TeacherStatus)
  status?: TeacherStatus;

  @ApiPropertyOptional({ description: 'Tìm kiếm theo tên hoặc mã' })
  @IsOptional()
  @IsString()
  search?: string;
}
