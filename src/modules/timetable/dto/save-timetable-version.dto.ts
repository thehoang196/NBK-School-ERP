import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsUUID,
  IsArray,
  MaxLength,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSlotDto } from './create-slot.dto';

export class SaveTimetableVersionDto {
  @ApiProperty({
    description: 'Tên phiên bản TKB',
    example: 'TKB v2 - HK1 2025-2026',
    maxLength: 100,
  })
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'ID học kỳ', format: 'uuid' })
  @IsNotEmpty()
  @IsUUID()
  semesterId: string;

  @ApiPropertyOptional({
    description: 'Ngày áp dụng',
    example: '2025-09-01',
  })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiPropertyOptional({
    description: 'Ghi chú',
    maxLength: 500,
  })
  @IsOptional()
  @MaxLength(500)
  note?: string;

  @ApiProperty({
    description: 'Danh sách ô TKB',
    type: [CreateSlotDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSlotDto)
  slots: CreateSlotDto[];
}
