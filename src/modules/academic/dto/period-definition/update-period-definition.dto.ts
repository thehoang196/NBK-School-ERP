import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsBoolean, IsOptional, IsMilitaryTime, Min } from 'class-validator';

export class UpdatePeriodDefinitionDto {
  @ApiPropertyOptional({ description: 'Số thứ tự tiết', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  periodNumber?: number;

  @ApiPropertyOptional({ description: 'Giờ bắt đầu (HH:mm)', example: '07:00' })
  @IsOptional()
  @IsMilitaryTime()
  startTime?: string;

  @ApiPropertyOptional({ description: 'Giờ kết thúc (HH:mm)', example: '07:45' })
  @IsOptional()
  @IsMilitaryTime()
  endTime?: string;

  @ApiPropertyOptional({ description: 'Là giờ nghỉ giải lao', default: false })
  @IsOptional()
  @IsBoolean()
  isBreak?: boolean;
}
