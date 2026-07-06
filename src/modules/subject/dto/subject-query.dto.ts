import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { SubjectType } from '../../../common/enums/status.enum';

export class SubjectQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Lọc theo trường (schoolId)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'schoolId phải là UUID hợp lệ' })
  schoolId?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo loại môn học',
    enum: SubjectType,
    example: SubjectType.REQUIRED,
  })
  @IsOptional()
  @IsEnum(SubjectType, {
    message:
      'Loại môn học phải là một trong: required, elective, extracurricular',
  })
  subjectType?: SubjectType;

  @ApiPropertyOptional({
    description: 'Tìm kiếm theo tên hoặc mã môn học',
    example: 'Toán',
  })
  @IsOptional()
  @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi ký tự' })
  search?: string;
}
