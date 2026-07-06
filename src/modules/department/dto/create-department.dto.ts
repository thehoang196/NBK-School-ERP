import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({
    description: 'Tên tổ bộ môn',
    example: 'Tổ Toán - Tin',
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Tên tổ bộ môn không được để trống' })
  @IsString({ message: 'Tên tổ bộ môn phải là chuỗi ký tự' })
  @MaxLength(100, { message: 'Tên tổ bộ môn không được vượt quá 100 ký tự' })
  name: string;

  @ApiPropertyOptional({
    description: 'ID tổ trưởng (UUID của giáo viên)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID('4', { message: 'headTeacherId phải là UUID hợp lệ' })
  headTeacherId?: string;

  @ApiPropertyOptional({
    description:
      'ID trường (bắt buộc với SUPER_ADMIN, các role khác lấy từ JWT)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'schoolId phải là UUID hợp lệ' })
  schoolId?: string;
}
