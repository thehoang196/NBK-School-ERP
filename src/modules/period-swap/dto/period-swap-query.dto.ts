import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { PeriodSwapStatus } from '../enums';

export class PeriodSwapQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Lọc theo giáo viên (requester hoặc target)' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({ enum: PeriodSwapStatus })
  @IsOptional()
  @IsEnum(PeriodSwapStatus)
  status?: PeriodSwapStatus;
}
