import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsInt, Min, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { RuleActionType } from '../../enums';

export class RuleConditionDto {
  @ApiProperty({ description: 'Trường điều kiện', example: 'school_level' })
  @IsString()
  @IsNotEmpty()
  field: string;

  @ApiProperty({ description: 'Toán tử', example: '==' })
  @IsString()
  @IsNotEmpty()
  operator: string;

  @ApiProperty({ description: 'Giá trị', example: 'THPT' })
  @IsNotEmpty()
  value: string | number | string[];

  @ApiPropertyOptional({ description: 'Toán tử logic nối tiếp', enum: ['AND', 'OR'] })
  @IsOptional()
  @IsString()
  logicOp?: 'AND' | 'OR';
}

export class CreateRuleDto {
  @ApiProperty({ description: 'ID trường' })
  @IsUUID()
  @IsNotEmpty()
  schoolId: string;

  @ApiProperty({ description: 'Tên quy tắc', example: 'Đơn giá tiết IELTS' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Danh sách điều kiện', type: [RuleConditionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleConditionDto)
  conditions: RuleConditionDto[];

  @ApiProperty({ description: 'Loại hành động', enum: RuleActionType })
  @IsEnum(RuleActionType)
  actionType: RuleActionType;

  @ApiProperty({ description: 'Mục tiêu hành động (variable code hoặc coefficient name)', example: 'LESSON_RATE' })
  @IsString()
  @IsNotEmpty()
  actionTarget: string;

  @ApiProperty({ description: 'Giá trị hành động', example: '350000' })
  @IsString()
  @IsNotEmpty()
  actionValue: string;

  @ApiPropertyOptional({ description: 'Mức ưu tiên (số lớn hơn = ưu tiên cao hơn)', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}
