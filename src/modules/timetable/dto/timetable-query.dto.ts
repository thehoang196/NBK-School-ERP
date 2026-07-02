import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { TimetableStatus } from '../../../common/enums/status.enum';

export class TimetableVersionQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Lọc theo học kỳ' })
  @IsOptional()
  @IsUUID()
  semesterId?: string;

  @ApiPropertyOptional({ enum: TimetableStatus })
  @IsOptional()
  @IsEnum(TimetableStatus)
  status?: TimetableStatus;
}

export class TimetableSlotQueryDto {
  @ApiPropertyOptional({ description: 'ID phiên bản' })
  @IsOptional()
  @IsUUID()
  versionId?: string;

  @ApiPropertyOptional({ description: 'ID lớp' })
  @IsOptional()
  @IsUUID()
  classId?: string;

  @ApiPropertyOptional({ description: 'ID giáo viên' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({ description: 'ID phòng' })
  @IsOptional()
  @IsUUID()
  roomId?: string;
}

export class CompareVersionsDto {
  @ApiProperty({ description: 'ID phiên bản A', format: 'uuid' })
  @IsUUID()
  versionAId: string;

  @ApiProperty({ description: 'ID phiên bản B', format: 'uuid' })
  @IsUUID()
  versionBId: string;
}

export class PublishVersionDto {
  @ApiPropertyOptional({ description: 'ID tuần bắt đầu áp dụng' })
  @IsOptional()
  @IsUUID()
  startWeekId?: string;
}
