import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { RuleActionType } from '../../enums';
import { EntityStatus } from '../../../../common/enums/status.enum';

export class RuleQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Lọc theo trường' })
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo loại hành động', enum: RuleActionType })
  @IsOptional()
  @IsEnum(RuleActionType)
  actionType?: RuleActionType;

  @ApiPropertyOptional({ description: 'Lọc theo trạng thái', enum: EntityStatus })
  @IsOptional()
  @IsEnum(EntityStatus)
  status?: EntityStatus;

  @ApiPropertyOptional({ description: 'Tìm kiếm theo tên' })
  @IsOptional()
  @IsString()
  search?: string;
}
