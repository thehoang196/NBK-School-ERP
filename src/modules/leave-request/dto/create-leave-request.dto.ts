import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { LeaveRequestType } from '../enums';

export class CreateLeaveRequestDto {
  @ApiProperty({ enum: LeaveRequestType, description: 'Loại nghỉ' })
  @IsEnum(LeaveRequestType)
  leaveType: LeaveRequestType;

  @ApiProperty({ description: 'Ngày bắt đầu (YYYY-MM-DD)', example: '2026-07-10' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Ngày kết thúc (YYYY-MM-DD)', example: '2026-07-11' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: 'Số ngày nghỉ', example: 2 })
  @IsNumber()
  @Min(0.5)
  totalDays: number;

  @ApiProperty({ description: 'Lý do nghỉ' })
  @IsString()
  reason: string;
}
