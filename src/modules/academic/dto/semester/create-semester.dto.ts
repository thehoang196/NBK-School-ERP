import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsInt,
  IsOptional,
  IsEnum,
  IsUUID,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { AcademicStatus } from '../../../../common/enums/status.enum';

export class CreateSemesterDto {
  @ApiProperty({
    description: 'ID năm học',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsNotEmpty({ message: 'academicYearId không được để trống' })
  @IsUUID('4', { message: 'academicYearId phải là UUID hợp lệ' })
  academicYearId: string;

  @ApiProperty({ description: 'Tên học kỳ', example: 'Học kỳ 1' })
  @IsNotEmpty({ message: 'Tên học kỳ không được để trống' })
  @IsString({ message: 'Tên học kỳ phải là chuỗi ký tự' })
  @MaxLength(50, { message: 'Tên học kỳ không được vượt quá 50 ký tự' })
  name: string;

  @ApiProperty({ description: 'Số thứ tự học kỳ (1 hoặc 2)', example: 1 })
  @IsNotEmpty({ message: 'Số thứ tự học kỳ không được để trống' })
  @IsInt({ message: 'Số thứ tự học kỳ phải là số nguyên' })
  @Min(1, { message: 'Số thứ tự học kỳ phải lớn hơn hoặc bằng 1' })
  @Max(4, { message: 'Số thứ tự học kỳ không được vượt quá 4' })
  semesterNumber: number;

  @ApiProperty({ description: 'Ngày bắt đầu học kỳ', example: '2024-09-01' })
  @IsNotEmpty({ message: 'Ngày bắt đầu không được để trống' })
  @IsDateString(
    {},
    { message: 'Ngày bắt đầu phải là định dạng ngày hợp lệ (YYYY-MM-DD)' },
  )
  startDate: string;

  @ApiProperty({ description: 'Ngày kết thúc học kỳ', example: '2025-01-15' })
  @IsNotEmpty({ message: 'Ngày kết thúc không được để trống' })
  @IsDateString(
    {},
    { message: 'Ngày kết thúc phải là định dạng ngày hợp lệ (YYYY-MM-DD)' },
  )
  endDate: string;

  @ApiPropertyOptional({
    description: 'Trạng thái học kỳ',
    enum: AcademicStatus,
    default: AcademicStatus.PLANNING,
  })
  @IsOptional()
  @IsEnum(AcademicStatus, {
    message: 'Trạng thái phải là một trong: planning, active, completed',
  })
  status?: AcademicStatus;
}
