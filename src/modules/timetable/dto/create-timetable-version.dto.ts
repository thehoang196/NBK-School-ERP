import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDateString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateTimetableVersionDto {
  @ApiProperty({ description: 'ID học kỳ', format: 'uuid' })
  @IsNotEmpty()
  @IsUUID()
  semesterId: string;

  @ApiProperty({ example: 'TKB v1 - HK1 2025-2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: '2025-09-01' })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
