import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsBoolean,
  Min,
} from 'class-validator';
import { SubjectType, RoomType } from '../../../common/enums/status.enum';

export class UpdateSubjectDto {
  @ApiPropertyOptional({ description: 'Mã môn học', example: 'TOAN' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Tên môn học', example: 'Toán' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Tên viết tắt', example: 'T' })
  @IsOptional()
  @IsString()
  shortName?: string;

  @ApiPropertyOptional({ enum: SubjectType })
  @IsOptional()
  @IsEnum(SubjectType)
  subjectType?: SubjectType;

  @ApiPropertyOptional({ description: 'Số tiết/tuần' })
  @IsOptional()
  @IsInt()
  @Min(0)
  periodsPerWeek?: number;

  @ApiPropertyOptional({ enum: RoomType })
  @IsOptional()
  @IsEnum(RoomType)
  requiresRoomType?: RoomType;

  @ApiPropertyOptional({ description: 'Mã màu', example: '#FF5733' })
  @IsOptional()
  @IsString()
  colorCode?: string;

  @ApiPropertyOptional({ description: 'Có học tiết đôi' })
  @IsOptional()
  @IsBoolean()
  isDoublePeriod?: boolean;
}
