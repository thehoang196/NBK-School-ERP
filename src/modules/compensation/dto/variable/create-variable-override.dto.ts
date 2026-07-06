import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { VariableScope } from '../../enums';

export class CreateVariableOverrideDto {
  @ApiProperty({ description: 'Phạm vi override', enum: VariableScope })
  @IsEnum(VariableScope)
  scope: VariableScope;

  @ApiPropertyOptional({ description: 'ID phạm vi (school_id)' })
  @IsOptional()
  @IsUUID()
  scopeId?: string | null;

  @ApiPropertyOptional({ description: 'Cấp học', example: 'THPT' })
  @IsOptional()
  @IsString()
  scopeLevel?: string | null;

  @ApiProperty({ description: 'Giá trị override', example: '200000' })
  @IsString()
  @IsNotEmpty()
  value: string;
}
