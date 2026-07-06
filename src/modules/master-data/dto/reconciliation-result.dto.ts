import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReconciliationStatus } from '../enums/master-data.enum';
import { ReconciliationReportData } from '../interfaces/reconciliation.interface';

export class ReconciliationResultDto {
  @ApiProperty({ description: 'ID phiên đối chiếu' })
  id: string;

  @ApiProperty({ description: 'School ID' })
  schoolId: string;

  @ApiProperty({ description: 'Module nguồn' })
  sourceModule: string;

  @ApiProperty({
    description: 'Trạng thái đối chiếu',
    enum: ReconciliationStatus,
  })
  status: ReconciliationStatus;

  @ApiProperty({ description: 'Tổng số bản ghi', example: 100 })
  totalRecords: number;

  @ApiProperty({ description: 'Số bản ghi khớp', example: 90 })
  matchedRecords: number;

  @ApiProperty({ description: 'Số bản ghi xung đột', example: 7 })
  conflictRecords: number;

  @ApiProperty({ description: 'Số bản ghi mới', example: 3 })
  newRecords: number;

  @ApiPropertyOptional({ description: 'Dữ liệu báo cáo chi tiết' })
  reportData: ReconciliationReportData | null;

  @ApiProperty({ description: 'Người thực hiện' })
  triggeredBy: string;

  @ApiProperty({ description: 'Thời gian tạo' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Thời gian hoàn thành' })
  completedAt: Date | null;
}
