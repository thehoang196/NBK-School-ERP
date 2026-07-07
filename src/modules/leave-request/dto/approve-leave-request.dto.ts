import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ApproveLeaveRequestDto {
  @ApiPropertyOptional({ description: 'Ghi chú của admin khi duyệt' })
  @IsOptional()
  @IsString()
  adminNote?: string;
}
