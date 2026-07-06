import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsUUID, IsEnum } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { AttendanceStatus } from '../enums';

export class AttendanceQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Lọc theo giáo viên' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({
    description: 'Từ ngày (YYYY-MM-DD)',
    example: '2026-07-01',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Đến ngày (YYYY-MM-DD)',
    example: '2026-07-31',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ enum: AttendanceStatus, description: 'Lọc theo trạng thái' })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;
}
