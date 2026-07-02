import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsInt, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { RuleActionType } from '../../enums';
import { RuleConditionDto } from './create-rule.dto';
import { EntityStatus } from '../../../../common/enums/status.enum';

export class UpdateRuleDto {
  @ApiPropertyOptional({ description: 'Tên quy tắc' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Danh sách điều kiện', type: [RuleConditionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleConditionDto)
  conditions?: RuleConditionDto[];

  @ApiPropertyOptional({ description: 'Loại hành động', enum: RuleActionType })
  @IsOptional()
  @IsEnum(RuleActionType)
  actionType?: RuleActionType;

  @ApiPropertyOptional({ description: 'Mục tiêu hành động' })
  @IsOptional()
  @IsString()
  actionTarget?: string;

  @ApiPropertyOptional({ description: 'Giá trị hành động' })
  @IsOptional()
  @IsString()
  actionValue?: string;

  @ApiPropertyOptional({ description: 'Mức ưu tiên' })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ description: 'Trạng thái', enum: EntityStatus })
  @IsOptional()
  @IsEnum(EntityStatus)
  status?: EntityStatus;
}
