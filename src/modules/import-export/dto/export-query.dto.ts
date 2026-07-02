import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum ExportViewType {
  CLASS = 'class',
  TEACHER = 'teacher',
  FULL = 'full',
}

export class ExportQueryDto {
  @ApiPropertyOptional({ description: 'ID phiên bản TKB (nếu không truyền sẽ lấy bản đang công bố)' })
  @IsOptional()
  @IsUUID()
  versionId?: string;

  @ApiPropertyOptional({ description: 'ID lớp (nếu viewType = class)' })
  @IsOptional()
  @IsUUID()
  classId?: string;

  @ApiPropertyOptional({ description: 'ID giáo viên (nếu viewType = teacher)' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({
    description: 'Loại hiển thị: theo lớp, theo giáo viên, hoặc toàn trường',
    enum: ExportViewType,
    default: ExportViewType.FULL,
  })
  @IsEnum(ExportViewType)
  viewType: ExportViewType = ExportViewType.FULL;

  @ApiPropertyOptional({ description: 'ID trường' })
  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
