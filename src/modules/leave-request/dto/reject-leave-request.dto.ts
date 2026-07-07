import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RejectLeaveRequestDto {
  @ApiProperty({ description: 'Lý do từ chối đơn nghỉ' })
  @IsString()
  @MinLength(1)
  reason: string;
}
