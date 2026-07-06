import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsBoolean,
  IsObject,
  MaxLength,
} from 'class-validator';
import { FieldDataType } from '../enums/master-data.enum';
import { ValidationRules } from '../interfaces/reconciliation.interface';

export class RegisterFieldDto {
  @ApiProperty({ description: 'School ID (UUID)' })
  @IsUUID()
  schoolId: string;

  @ApiProperty({
    description: 'Tên trường',
    example: 'certificationLevel',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  fieldName: string;

  @ApiProperty({ description: 'Kiểu dữ liệu', enum: FieldDataType })
  @IsEnum(FieldDataType)
  dataType: FieldDataType;

  @ApiProperty({
    description: 'Module nguồn',
    example: 'teaching-assignment',
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50)
  sourceModule: string;

  @ApiProperty({
    description: 'Nhãn hiển thị',
    example: 'Trình độ chứng chỉ',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  displayLabel: string;

  @ApiPropertyOptional({ description: 'Quy tắc validation', type: 'object' })
  @IsOptional()
  @IsObject()
  validationRules?: ValidationRules;

  @ApiPropertyOptional({ description: 'Trường bắt buộc', default: false })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}
