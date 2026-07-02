import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { VariableDataType, VariableScope } from '../../enums';

export class UpdateVariableDto {
  @ApiPropertyOptional({ description: 'Tên hiển thị' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Kiểu dữ liệu', enum: VariableDataType })
  @IsOptional()
  @IsEnum(VariableDataType)
  dataType?: VariableDataType;

  @ApiPropertyOptional({ description: 'Giá trị mặc định' })
  @IsOptional()
  @IsString()
  defaultValue?: string | null;

  @ApiPropertyOptional({ description: 'Phạm vi áp dụng', enum: VariableScope })
  @IsOptional()
  @IsEnum(VariableScope)
  scope?: VariableScope;

  @ApiPropertyOptional({ description: 'ID phạm vi' })
  @IsOptional()
  @IsUUID()
  scopeId?: string | null;

  @ApiPropertyOptional({ description: 'Cấp học' })
  @IsOptional()
  @IsString()
  scopeLevel?: string | null;

  @ApiPropertyOptional({ description: 'Mô tả' })
  @IsOptional()
  @IsString()
  description?: string | null;
}
