import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EntityStatus } from '../../../common/enums/status.enum';

export class ClassQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Lọc theo trường (SUPER_ADMIN)',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4', { message: 'schoolId phải là UUID hợp lệ' })
  schoolId?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo khối',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID('4', { message: 'gradeId phải là UUID hợp lệ' })
  gradeId?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo năm học',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID('4', { message: 'academicYearId phải là UUID hợp lệ' })
  academicYearId?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái',
    enum: EntityStatus,
    example: EntityStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(EntityStatus, { message: 'Trạng thái phải là active hoặc inactive' })
  status?: EntityStatus;

  @ApiPropertyOptional({ description: 'Tìm kiếm theo tên lớp', example: '10A' })
  @IsOptional()
  @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi ký tự' })
  search?: string;
}
