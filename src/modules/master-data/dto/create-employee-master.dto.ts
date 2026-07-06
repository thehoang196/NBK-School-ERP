import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsInt,
  IsNumber,
  IsObject,
  MaxLength,
  Min,
} from 'class-validator';
import { Gender } from '../../../common/enums/status.enum';

export class CreateEmployeeMasterDto {
  @ApiProperty({ description: 'School ID (UUID)', example: 'uuid-here' })
  @IsUUID()
  schoolId: string;

  @ApiProperty({ description: 'Mã nhân viên', example: 'NV001', maxLength: 20 })
  @IsString()
  @MaxLength(20)
  employeeCode: string;

  @ApiPropertyOptional({ description: 'Tên cơ sở', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  campusName?: string;

  @ApiProperty({
    description: 'Họ và tên',
    example: 'Nguyễn Văn A',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  fullName: string;

  @ApiPropertyOptional({ description: 'Tên gọi', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  shortName?: string;

  @ApiPropertyOptional({ description: 'Khối', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  gradeName?: string;

  @ApiPropertyOptional({ description: 'Tổ bộ môn', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  departmentName?: string;

  @ApiPropertyOptional({ description: 'Chức danh/chức vụ', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobTitle?: string;

  @ApiPropertyOptional({ description: 'Cấp bậc quản lý', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  managementLevel?: string;

  @ApiPropertyOptional({ description: 'Giới tính', enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ description: 'Max tiết/tuần', example: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxPeriodsPerWeek?: number;

  @ApiPropertyOptional({ description: 'Số ngày công', example: 5.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  workingDays?: number;

  @ApiPropertyOptional({ description: 'Trường mở rộng', type: 'object' })
  @IsOptional()
  @IsObject()
  extendedFields?: Record<string, unknown>;
}
