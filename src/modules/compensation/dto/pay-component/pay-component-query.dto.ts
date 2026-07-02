import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { PayComponentType } from '../../enums';
import { EntityStatus } from '../../../../common/enums/status.enum';

export class PayComponentQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Lọc theo trường' })
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo loại', enum: PayComponentType })
  @IsOptional()
  @IsEnum(PayComponentType)
  type?: PayComponentType;

  @ApiPropertyOptional({ description: 'Lọc theo trạng thái', enum: EntityStatus })
  @IsOptional()
  @IsEnum(EntityStatus)
  status?: EntityStatus;

  @ApiPropertyOptional({ description: 'Tìm kiếm theo tên hoặc mã' })
  @IsOptional()
  @IsString()
  search?: string;
}
