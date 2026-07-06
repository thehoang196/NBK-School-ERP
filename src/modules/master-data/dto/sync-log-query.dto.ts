import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { SyncDirection, SyncStatus } from '../enums/master-data.enum';

export class SyncLogQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Lọc theo trường (school_id)' })
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo mã nhân viên' })
  @IsOptional()
  @IsString()
  employeeCode?: string;

  @ApiPropertyOptional({ description: 'Lọc theo module nguồn' })
  @IsOptional()
  @IsString()
  sourceModule?: string;

  @ApiPropertyOptional({ description: 'Lọc theo trạng thái', enum: SyncStatus })
  @IsOptional()
  @IsEnum(SyncStatus)
  status?: SyncStatus;

  @ApiPropertyOptional({
    description: 'Lọc theo hướng đồng bộ',
    enum: SyncDirection,
  })
  @IsOptional()
  @IsEnum(SyncDirection)
  direction?: SyncDirection;
}
