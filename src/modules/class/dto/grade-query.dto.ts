import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsIn, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class GradeQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Lọc theo trường (schoolId - được inject từ JWT context)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'schoolId phải là UUID hợp lệ' })
  schoolId?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo cấp lớp (10, 11, 12)',
    example: 10,
    enum: [10, 11, 12],
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Cấp lớp phải là số nguyên' })
  @IsIn([10, 11, 12], { message: 'Cấp lớp phải là 10, 11 hoặc 12' })
  level?: number;

  @ApiPropertyOptional({
    description: 'Tìm kiếm theo tên khối',
    example: 'Khối 10',
  })
  @IsOptional()
  @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi ký tự' })
  search?: string;
}
