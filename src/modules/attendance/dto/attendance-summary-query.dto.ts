import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class AttendanceSummaryQueryDto extends PaginationDto {
  @ApiProperty({ description: 'Tháng (1-12)', example: 7 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ description: 'Năm', example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;

  @ApiPropertyOptional({ description: 'Lọc theo giáo viên' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;
}
