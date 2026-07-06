import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { VariableDataType, VariableScope } from '../../enums';

export class VariableQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Lọc theo phạm vi', enum: VariableScope })
  @IsOptional()
  @IsEnum(VariableScope)
  scope?: VariableScope;

  @ApiPropertyOptional({
    description: 'Lọc theo kiểu dữ liệu',
    enum: VariableDataType,
  })
  @IsOptional()
  @IsEnum(VariableDataType)
  dataType?: VariableDataType;

  @ApiPropertyOptional({ description: 'Tìm kiếm theo tên hoặc mã' })
  @IsOptional()
  @IsString()
  search?: string;
}
