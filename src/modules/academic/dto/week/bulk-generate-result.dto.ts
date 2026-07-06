import { ApiProperty } from '@nestjs/swagger';
import { WeekType } from '../../enums';

export class BulkGenerateWeekItemDto {
  @ApiProperty({ description: 'ID tuần' })
  id: string;

  @ApiProperty({ description: 'Số tuần', example: 1 })
  weekNumber: number;

  @ApiProperty({ description: 'Ngày bắt đầu', example: '2024-09-02' })
  startDate: string;

  @ApiProperty({ description: 'Ngày kết thúc', example: '2024-09-08' })
  endDate: string;

  @ApiProperty({
    description: 'Loại tuần',
    enum: WeekType,
    example: WeekType.REGULAR,
  })
  weekType: WeekType;
}

export class BulkGenerateResultDto {
  @ApiProperty({ description: 'Số lượng tuần đã sinh', example: 18 })
  count: number;

  @ApiProperty({
    description: 'Danh sách tuần đã sinh',
    type: [BulkGenerateWeekItemDto],
  })
  weeks: BulkGenerateWeekItemDto[];
}
