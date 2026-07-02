import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsInt,
  IsOptional,
  IsEnum,
  Min,
} from 'class-validator';
import { AcademicStatus } from '../../../../common/enums/status.enum';

export class UpdateSemesterDto {
  @ApiPropertyOptional({ description: 'Tên học kỳ', example: 'Học kỳ 1' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Số thứ tự học kỳ', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  semesterNumber?: number;

  @ApiPropertyOptional({ description: 'Ngày bắt đầu', example: '2024-09-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Ngày kết thúc', example: '2025-01-15' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: AcademicStatus })
  @IsOptional()
  @IsEnum(AcademicStatus)
  status?: AcademicStatus;
}
