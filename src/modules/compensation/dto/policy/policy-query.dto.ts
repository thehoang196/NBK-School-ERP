import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsString, IsEnum } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { EntityStatus } from '../../../../common/enums/status.enum';

export class PolicyQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Lọc theo trường' })
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo cơ sở' })
  @IsOptional()
  @IsUUID()
  campusId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo cấp học' })
  @IsOptional()
  @IsString()
  schoolLevel?: string;

  @ApiPropertyOptional({ enum: EntityStatus, description: 'Lọc theo trạng thái' })
  @IsOptional()
  @IsEnum(EntityStatus)
  status?: EntityStatus;
}
