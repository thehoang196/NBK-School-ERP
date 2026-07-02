import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, IsOptional, IsMilitaryTime, Min } from 'class-validator';

export class UpdateSessionDto {
  @ApiPropertyOptional({ description: 'Tên ca học', example: 'Ca sáng' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Giờ bắt đầu (HH:mm)', example: '07:00' })
  @IsOptional()
  @IsMilitaryTime()
  startTime?: string;

  @ApiPropertyOptional({ description: 'Giờ kết thúc (HH:mm)', example: '11:30' })
  @IsOptional()
  @IsMilitaryTime()
  endTime?: string;

  @ApiPropertyOptional({ description: 'Thứ tự sắp xếp' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
