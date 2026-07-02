import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsDateString,
  IsOptional,
  IsArray,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';

export class CreatePolicyDto {
  @ApiProperty({ description: 'ID trường' })
  @IsUUID()
  schoolId: string;

  @ApiProperty({ description: 'Tên chính sách', example: 'Chính sách lương GV THPT' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'ID cơ sở (nullable)' })
  @IsOptional()
  @IsUUID()
  campusId?: string;

  @ApiPropertyOptional({ description: 'Cấp học (nullable)', example: 'THPT' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  schoolLevel?: string;

  @ApiProperty({ description: 'Danh sách ID thành phần lương áp dụng', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  payComponentIds: string[];

  @ApiProperty({ description: 'Ngày bắt đầu hiệu lực', example: '2026-01-01' })
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional({ description: 'Ngày kết thúc hiệu lực (nullable)' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
