import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  IsEnum,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExportEntityTarget } from '../entities/export-template.entity';

export class ExportFieldMappingDto {
  @ApiProperty({ description: 'Tên field trong DB', example: 'employeeCode' })
  @IsString()
  dbField: string;

  @ApiProperty({ description: 'Tên hiển thị', example: 'Mã NV' })
  @IsString()
  displayName: string;

  @ApiProperty({ description: 'Độ rộng cột', example: 15 })
  width: number;

  @ApiPropertyOptional({ description: 'Transform function', example: 'date' })
  @IsOptional()
  @IsString()
  transform?: string;

  @ApiPropertyOptional({ description: 'Format string' })
  @IsOptional()
  @IsString()
  format?: string;
}

export class CreateExportTemplateDto {
  @ApiProperty({ description: 'ID trường' })
  @IsUUID()
  schoolId: string;

  @ApiProperty({ description: 'Entity target', enum: ExportEntityTarget })
  @IsEnum(ExportEntityTarget)
  entityTarget: ExportEntityTarget;

  @ApiProperty({ description: 'Tên template', example: 'HR Export' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Mô tả' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiProperty({
    description: 'Danh sách field mappings',
    type: [ExportFieldMappingDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExportFieldMappingDto)
  fieldMappings: ExportFieldMappingDto[];

  @ApiPropertyOptional({
    description: 'Đặt làm template mặc định',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
