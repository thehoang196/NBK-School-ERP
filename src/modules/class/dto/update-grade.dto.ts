import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';

export class UpdateGradeDto {
  @ApiPropertyOptional({ description: 'Tên khối', example: 'Khối 10' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Cấp lớp (1-12)', example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  level?: number;
}
