import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  IsObject,
  MaxLength,
  Min,
  IsUUID,
} from 'class-validator';
import {
  ValidationRuleType,
  ValidationEntityTarget,
  RuleConfig,
} from '../entities/validation-rule.entity';

export class CreateValidationRuleDto {
  @ApiProperty({ description: 'ID trường' })
  @IsUUID()
  schoolId: string;

  @ApiProperty({
    description: 'Entity áp dụng rule',
    enum: ValidationEntityTarget,
  })
  @IsEnum(ValidationEntityTarget)
  entityTarget: ValidationEntityTarget;

  @ApiProperty({
    description: 'Tên field cần validate',
    example: 'maxPeriodsPerWeek',
  })
  @IsString()
  @MaxLength(100)
  fieldName: string;

  @ApiProperty({ description: 'Loại rule', enum: ValidationRuleType })
  @IsEnum(ValidationRuleType)
  ruleType: ValidationRuleType;

  @ApiProperty({
    description: 'Cấu hình rule (JSON)',
    example: { min: 1, max: 50 },
  })
  @IsObject()
  ruleConfig: RuleConfig;

  @ApiProperty({ description: 'Thông báo lỗi khi vi phạm rule (tiếng Việt)' })
  @IsString()
  @MaxLength(255)
  errorMessage: string;

  @ApiPropertyOptional({ description: 'Rule có active không', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Thứ tự ưu tiên (số nhỏ chạy trước)',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}
