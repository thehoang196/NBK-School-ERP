import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  IsDateString,
  IsObject,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { EventType, EventStatus } from '../entities/event.entity';

export class UpdateEventDto {
  @ApiPropertyOptional({ description: 'Tiêu đề sự kiện', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: EventType, description: 'Loại sự kiện' })
  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType;

  @ApiPropertyOptional({ description: 'Ngày bắt đầu (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Ngày kết thúc (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Sự kiện cả ngày' })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiPropertyOptional({ description: 'Ảnh hưởng thời khóa biểu' })
  @IsOptional()
  @IsBoolean()
  affectsSchedule?: boolean;

  @ApiPropertyOptional({ description: 'Sự kiện lặp lại' })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({ description: 'Quy tắc lặp (JSON)', type: Object })
  @IsOptional()
  @IsObject()
  recurrenceRule?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Danh sách ID khối bị ảnh hưởng',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', {
    each: true,
    message: 'Mỗi phần tử affectedGrades phải là UUID hợp lệ',
  })
  affectedGrades?: string[];

  @ApiPropertyOptional({
    description: 'Danh sách ID lớp bị ảnh hưởng',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', {
    each: true,
    message: 'Mỗi phần tử affectedClasses phải là UUID hợp lệ',
  })
  affectedClasses?: string[];

  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
