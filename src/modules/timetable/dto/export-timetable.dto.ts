import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  IsDateString,
} from 'class-validator';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ExportTimetableQueryDto {
  @ApiProperty({ description: 'ID phiên bản TKB cần xuất' })
  @Matches(UUID_REGEX, { message: 'versionId phải là UUID hợp lệ' })
  @IsNotEmpty()
  versionId: string;

  @ApiPropertyOptional({ description: 'ID khối (nếu muốn xuất riêng 1 khối)' })
  @IsOptional()
  @IsString()
  gradeId?: string;

  @ApiPropertyOptional({
    description: 'Ngày bắt đầu áp dụng',
    example: '2025-09-01',
  })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({
    description: 'Ngày kết thúc áp dụng',
    example: '2026-01-15',
  })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
