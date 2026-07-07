import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsObject } from 'class-validator';

export class ImportEmployeeDto {
  @ApiProperty({ description: 'Mã nhân viên' })
  @IsString()
  employeeCode: string;

  @ApiPropertyOptional({ description: 'Tên cơ sở' })
  @IsOptional()
  @IsString()
  campusName?: string;

  @ApiProperty({ description: 'Họ và tên' })
  @IsString()
  fullName: string;

  @ApiPropertyOptional({ description: 'Tên gọi' })
  @IsOptional()
  @IsString()
  shortName?: string;

  @ApiPropertyOptional({ description: 'Khối' })
  @IsOptional()
  @IsString()
  gradeName?: string;

  @ApiPropertyOptional({ description: 'Tổ bộ môn' })
  @IsOptional()
  @IsString()
  departmentName?: string;

  @ApiPropertyOptional({ description: 'Chức danh/chức vụ' })
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiPropertyOptional({ description: 'Cấp bậc quản lý' })
  @IsOptional()
  @IsString()
  managementLevel?: string;

  @ApiPropertyOptional({ description: 'Giới tính' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: 'Max tiết/tuần' })
  @IsOptional()
  maxPeriodsPerWeek?: number;

  @ApiPropertyOptional({ description: 'Số ngày công' })
  @IsOptional()
  workingDays?: number;

  @ApiPropertyOptional({
    description: 'Các trường bổ sung từ import',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  additionalFields?: Record<string, unknown>;
}

export class ImportEmployeeRequestDto {
  @ApiProperty({ description: 'School ID (UUID)' })
  @IsUUID()
  schoolId: string;

  @ApiProperty({ description: 'Module nguồn import' })
  @IsString()
  sourceModule: string;
}
