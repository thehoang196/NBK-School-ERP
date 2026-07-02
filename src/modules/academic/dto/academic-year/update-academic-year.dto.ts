import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsBoolean,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { AcademicStatus } from '../../../../common/enums/status.enum';

export class UpdateAcademicYearDto {
  @ApiPropertyOptional({ description: 'Tên năm học', example: '2024-2025' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Ngày bắt đầu', example: '2024-09-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Ngày kết thúc', example: '2025-06-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Năm học hiện tại', default: false })
  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;

  @ApiPropertyOptional({ enum: AcademicStatus })
  @IsOptional()
  @IsEnum(AcademicStatus)
  status?: AcademicStatus;
}
