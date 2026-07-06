import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsDateString, IsInt, IsString, Min, Max } from 'class-validator';

export class CreatePeriodSwapDto {
  @ApiProperty({ description: 'ID giáo viên được đề nghị đổi' })
  @IsUUID()
  targetId: string;

  @ApiProperty({ description: 'Ngày tiết của mình (YYYY-MM-DD)', example: '2026-07-10' })
  @IsDateString()
  requesterDate: string;

  @ApiProperty({ description: 'Tiết của mình (thứ tự)', example: 3 })
  @IsInt()
  @Min(1)
  @Max(12)
  requesterPeriod: number;

  @ApiProperty({ description: 'Ngày tiết đổi sang (YYYY-MM-DD)', example: '2026-07-11' })
  @IsDateString()
  targetDate: string;

  @ApiProperty({ description: 'Tiết đổi sang (thứ tự)', example: 2 })
  @IsInt()
  @Min(1)
  @Max(12)
  targetPeriod: number;

  @ApiProperty({ description: 'Lý do đổi tiết' })
  @IsString()
  reason: string;
}
