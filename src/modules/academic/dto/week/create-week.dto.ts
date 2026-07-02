import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsInt,
  IsBoolean,
  IsOptional,
  Matches,
  Min,
} from 'class-validator';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateWeekDto {
  @ApiProperty({ description: 'ID học kỳ' })
  @IsNotEmpty()
  @IsString()
  @Matches(UUID_REGEX, { message: 'semesterId phải là UUID hợp lệ' })
  semesterId: string;

  @ApiProperty({ description: 'Số tuần', example: 1 })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  weekNumber: number;

  @ApiProperty({ description: 'Ngày bắt đầu', example: '2024-09-02' })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Ngày kết thúc', example: '2024-09-08' })
  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Là tuần nghỉ', default: false })
  @IsOptional()
  @IsBoolean()
  isHoliday?: boolean;
}
