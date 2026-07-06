import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export enum ExportFormat {
  EXCEL = 'excel',
  CSV = 'csv',
  JSON = 'json',
}

export class ExportTeachersQueryDto {
  @ApiProperty({ description: 'ID trường' })
  @IsUUID()
  schoolId: string;

  @ApiProperty({ description: 'Định dạng file xuất', enum: ExportFormat })
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @ApiPropertyOptional({
    description:
      'ID template export (nếu không truyền sẽ dùng template mặc định)',
  })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo khối (grade ID)' })
  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo tổ bộ môn (department ID)' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái (active/inactive/all)',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Tìm kiếm tên/mã nhân viên' })
  @IsOptional()
  @IsString()
  search?: string;
}
