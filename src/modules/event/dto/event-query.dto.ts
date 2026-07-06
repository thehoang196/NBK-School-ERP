import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsDateString,
  IsUUID,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { EventType, EventStatus } from '../entities/event.entity';

export class EventQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Lọc theo trường' })
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional({
    enum: EventType,
    description: 'Lọc theo loại sự kiện',
  })
  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType;

  @ApiPropertyOptional({
    enum: EventStatus,
    description: 'Lọc theo trạng thái',
  })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({ description: 'Lọc từ ngày (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startFrom?: string;

  @ApiPropertyOptional({ description: 'Lọc đến ngày (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startTo?: string;
}

export class CalendarQueryDto {
  @ApiPropertyOptional({ description: 'ID trường' })
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional({ description: 'Năm', example: 2024 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ description: 'Tháng (1-12)', example: 9 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}
