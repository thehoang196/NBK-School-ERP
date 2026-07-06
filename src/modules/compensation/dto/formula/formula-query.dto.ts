import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { FormulaStatus } from '../../enums';

export class FormulaQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Lọc theo trường' })
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo pay component' })
  @IsOptional()
  @IsUUID()
  payComponentId?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái',
    enum: FormulaStatus,
  })
  @IsOptional()
  @IsEnum(FormulaStatus)
  status?: FormulaStatus;

  @ApiPropertyOptional({ description: 'Tìm kiếm theo expression' })
  @IsOptional()
  @IsString()
  search?: string;
}
