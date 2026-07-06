import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class AuditLogQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Lọc theo loại thực thể',
    example: 'formula',
  })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ description: 'Lọc theo người thực hiện' })
  @IsOptional()
  @IsUUID()
  performedBy?: string;

  @ApiPropertyOptional({ description: 'Lọc theo hành động', example: 'create' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Từ ngày', example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Đến ngày', example: '2026-01-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
