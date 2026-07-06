import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ImportBatchStatus,
  ImportEntityType,
} from '../entities/import-batch.entity';
import { ImportError } from './import-result.dto';

export class ImportBatchResponseDto {
  @ApiProperty({ description: 'ID batch import' })
  batchId: string;

  @ApiProperty({ description: 'Trạng thái', enum: ImportBatchStatus })
  status: ImportBatchStatus;

  @ApiProperty({ description: 'Loại dữ liệu import', enum: ImportEntityType })
  entityType: ImportEntityType;

  @ApiProperty({ description: 'Tên file' })
  fileName: string;

  @ApiProperty({ description: 'Tổng số dòng' })
  totalRows: number;

  @ApiProperty({ description: 'Số dòng thành công' })
  successCount: number;

  @ApiProperty({ description: 'Số dòng lỗi' })
  errorCount: number;

  @ApiProperty({ description: 'Tiến độ (%)', minimum: 0, maximum: 100 })
  progress: number;

  @ApiPropertyOptional({ description: 'Chi tiết lỗi' })
  errors?: ImportError[];

  @ApiPropertyOptional({ description: 'Thời gian bắt đầu xử lý' })
  startedAt?: Date | null;

  @ApiPropertyOptional({ description: 'Thời gian hoàn thành' })
  completedAt?: Date | null;

  @ApiProperty({ description: 'Thời gian tạo batch' })
  createdAt: Date;
}
