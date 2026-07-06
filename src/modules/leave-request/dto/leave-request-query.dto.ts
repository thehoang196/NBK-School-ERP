import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsUUID, IsDateString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { LeaveRequestStatus, LeaveRequestType } from '../enums';

export class LeaveRequestQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Lọc theo giáo viên' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({ enum: LeaveRequestStatus })
  @IsOptional()
  @IsEnum(LeaveRequestStatus)
  status?: LeaveRequestStatus;

  @ApiPropertyOptional({ enum: LeaveRequestType })
  @IsOptional()
  @IsEnum(LeaveRequestType)
  leaveType?: LeaveRequestType;

  @ApiPropertyOptional({ description: 'Từ ngày (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Đến ngày (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
