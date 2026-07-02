import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TimetableStatus } from '../../../common/enums/status.enum';

export class TimetableVersionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', description: 'ID học kỳ' })
  semesterId: string;

  @ApiProperty({ example: 'TKB v1 - HK1 2025-2026' })
  name: string;

  @ApiProperty({ description: 'Số phiên bản', example: 1 })
  versionNumber: number;

  @ApiProperty({ enum: TimetableStatus, description: 'Trạng thái phiên bản' })
  status: TimetableStatus;

  @ApiPropertyOptional({ example: '2025-09-01', description: 'Ngày áp dụng' })
  effectiveDate: string | null;

  @ApiPropertyOptional({ description: 'Thời điểm công bố' })
  publishedAt: Date | null;

  @ApiPropertyOptional({ format: 'uuid', description: 'Người công bố' })
  publishedBy: string | null;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  note: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
