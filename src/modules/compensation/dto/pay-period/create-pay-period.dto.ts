import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsDateString,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { PayPeriodStatus } from '../../enums';

export class CreatePayPeriodDto {
  @ApiProperty({ description: 'ID trường' })
  @IsUUID()
  schoolId: string;

  @ApiProperty({ description: 'Tên kỳ lương', example: 'Tháng 01/2026' })
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiProperty({ description: 'Ngày bắt đầu', example: '2026-01-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Ngày kết thúc', example: '2026-01-31' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ enum: PayPeriodStatus, default: PayPeriodStatus.OPEN })
  @IsOptional()
  @IsEnum(PayPeriodStatus)
  status?: PayPeriodStatus;
}
