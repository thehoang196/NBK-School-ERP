import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RejectPeriodSwapDto {
  @ApiProperty({ description: 'Lý do từ chối' })
  @IsString()
  @MinLength(1)
  reason: string;
}
