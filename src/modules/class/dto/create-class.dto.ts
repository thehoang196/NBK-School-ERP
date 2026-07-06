import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsUUID,
} from 'class-validator';

export class CreateClassDto {
  @ApiPropertyOptional({
    description: 'ID trường (bắt buộc cho SUPER_ADMIN)',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'schoolId phải là UUID hợp lệ' })
  schoolId?: string;

  @ApiProperty({
    description: 'ID khối',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsNotEmpty({ message: 'gradeId không được để trống' })
  @IsUUID('4', { message: 'gradeId phải là UUID hợp lệ' })
  gradeId: string;

  @ApiProperty({
    description: 'ID năm học',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsNotEmpty({ message: 'academicYearId không được để trống' })
  @IsUUID('4', { message: 'academicYearId phải là UUID hợp lệ' })
  academicYearId: string;

  @ApiProperty({ description: 'Tên lớp', example: '10A1' })
  @IsNotEmpty({ message: 'Tên lớp không được để trống' })
  @IsString({ message: 'Tên lớp phải là chuỗi ký tự' })
  name: string;

  @ApiPropertyOptional({
    description: 'ID giáo viên chủ nhiệm',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsOptional()
  @IsUUID('4', { message: 'homeroomTeacherId phải là UUID hợp lệ' })
  homeroomTeacherId?: string;

  @ApiPropertyOptional({
    description: 'Sĩ số học sinh',
    example: 40,
    default: 0,
  })
  @IsOptional()
  @IsInt({ message: 'Sĩ số phải là số nguyên' })
  @Min(0, { message: 'Sĩ số không được nhỏ hơn 0' })
  studentCount?: number;
}
