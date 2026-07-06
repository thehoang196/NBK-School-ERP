import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsInt,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';
import { WeekType } from '../../enums';

export class CreateWeekDto {
  @ApiProperty({
    description: 'ID học kỳ',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsNotEmpty({ message: 'semesterId không được để trống' })
  @IsUUID('4', { message: 'semesterId phải là UUID hợp lệ' })
  semesterId: string;

  @ApiPropertyOptional({
    description: 'Số tuần (tự động gán nếu không cung cấp)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsInt({ message: 'weekNumber phải là số nguyên' })
  @Min(1, { message: 'weekNumber phải lớn hơn hoặc bằng 1' })
  weekNumber?: number;

  @ApiProperty({ description: 'Ngày bắt đầu tuần', example: '2024-09-02' })
  @IsNotEmpty({ message: 'Ngày bắt đầu không được để trống' })
  @IsDateString({}, { message: 'startDate phải là ngày hợp lệ (ISO 8601)' })
  startDate: string;

  @ApiProperty({ description: 'Ngày kết thúc tuần', example: '2024-09-08' })
  @IsNotEmpty({ message: 'Ngày kết thúc không được để trống' })
  @IsDateString({}, { message: 'endDate phải là ngày hợp lệ (ISO 8601)' })
  endDate: string;

  @ApiPropertyOptional({
    description: 'Ghi chú cho tuần',
    example: 'Tuần thi giữa kỳ',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi ký tự' })
  @MaxLength(255, { message: 'Ghi chú không được vượt quá 255 ký tự' })
  note?: string;

  @ApiPropertyOptional({
    description: 'Đánh dấu tuần nghỉ lễ',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'isHoliday phải là giá trị boolean' })
  isHoliday?: boolean;

  @ApiPropertyOptional({
    description: 'Loại tuần',
    enum: WeekType,
    default: WeekType.REGULAR,
    example: WeekType.REGULAR,
  })
  @IsOptional()
  @IsEnum(WeekType, {
    message: 'weekType phải là một trong: regular, exam, holiday, makeup',
  })
  weekType?: WeekType = WeekType.REGULAR;
}
