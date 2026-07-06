import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
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

export class CreateEventDto {
  @ApiProperty({
    description: 'ID trường',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty()
  @IsUUID()
  schoolId: string;

  @ApiProperty({
    description: 'Tiêu đề sự kiện',
    example: 'Nghỉ lễ Quốc khánh',
    maxLength: 200,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết sự kiện' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: EventType, description: 'Loại sự kiện' })
  @IsNotEmpty()
  @IsEnum(EventType)
  eventType: EventType;

  @ApiProperty({
    description: 'Ngày bắt đầu (ISO 8601)',
    example: '2024-09-02T00:00:00.000Z',
  })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'Ngày kết thúc (ISO 8601)',
    example: '2024-09-02T23:59:59.000Z',
  })
  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ description: 'Sự kiện cả ngày', default: false })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiPropertyOptional({
    description: 'Ảnh hưởng thời khóa biểu (hủy tiết)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  affectsSchedule?: boolean;

  @ApiPropertyOptional({ description: 'Sự kiện lặp lại', default: false })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({
    description: 'Quy tắc lặp (RRULE format dạng JSON)',
    type: Object,
  })
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

  @ApiPropertyOptional({ enum: EventStatus, default: EventStatus.ACTIVE })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
