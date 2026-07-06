import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AcademicStatus } from '../../../../common/enums/status.enum';

export class CreateAcademicYearDto {
  @ApiProperty({
    description: 'ID trường học',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty({ message: 'ID trường học không được để trống' })
  @IsUUID('4', { message: 'schoolId phải là UUID hợp lệ' })
  schoolId: string;

  @ApiProperty({
    description: 'Tên năm học',
    example: '2025-2026',
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'Tên năm học không được để trống' })
  @IsString({ message: 'Tên năm học phải là chuỗi ký tự' })
  @MaxLength(50, { message: 'Tên năm học không được vượt quá 50 ký tự' })
  name: string;

  @ApiProperty({
    description: 'Ngày bắt đầu năm học',
    example: '2025-09-01',
  })
  @IsNotEmpty({ message: 'Ngày bắt đầu không được để trống' })
  @IsDateString(
    {},
    { message: 'Ngày bắt đầu phải là định dạng ngày hợp lệ (YYYY-MM-DD)' },
  )
  startDate: string;

  @ApiProperty({
    description: 'Ngày kết thúc năm học',
    example: '2026-06-30',
  })
  @IsNotEmpty({ message: 'Ngày kết thúc không được để trống' })
  @IsDateString(
    {},
    { message: 'Ngày kết thúc phải là định dạng ngày hợp lệ (YYYY-MM-DD)' },
  )
  endDate: string;

  @ApiPropertyOptional({
    description: 'Trạng thái năm học',
    enum: AcademicStatus,
    default: AcademicStatus.PLANNING,
    example: AcademicStatus.PLANNING,
  })
  @IsOptional()
  @IsEnum(AcademicStatus, {
    message:
      'Trạng thái phải là một trong các giá trị: planning, active, completed',
  })
  status?: AcademicStatus;

  @ApiPropertyOptional({
    description: 'Đánh dấu là năm học hiện tại',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'isCurrent phải là giá trị boolean' })
  isCurrent?: boolean;
}
