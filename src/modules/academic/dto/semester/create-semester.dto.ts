import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsInt,
  IsOptional,
  IsEnum,
  Matches,
  Min,
} from 'class-validator';
import { AcademicStatus } from '../../../../common/enums/status.enum';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateSemesterDto {
  @ApiProperty({ description: 'ID năm học' })
  @IsNotEmpty()
  @IsString()
  @Matches(UUID_REGEX, { message: 'academicYearId phải là UUID hợp lệ' })
  academicYearId: string;

  @ApiProperty({ description: 'Tên học kỳ', example: 'Học kỳ 1' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'Số thứ tự học kỳ', example: 1 })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  semesterNumber: number;

  @ApiProperty({ description: 'Ngày bắt đầu', example: '2024-09-01' })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Ngày kết thúc', example: '2025-01-15' })
  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ enum: AcademicStatus, default: AcademicStatus.PLANNING })
  @IsOptional()
  @IsEnum(AcademicStatus)
  status?: AcademicStatus;
}
