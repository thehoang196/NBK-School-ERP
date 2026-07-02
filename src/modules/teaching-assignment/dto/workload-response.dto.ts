import { ApiProperty } from '@nestjs/swagger';

export class WorkloadResponseDto {
  @ApiProperty({ description: 'ID giáo viên' })
  teacherId: string;

  @ApiProperty({ description: 'Tên giáo viên' })
  teacherName: string;

  @ApiProperty({ description: 'Tổng số tiết/tuần được phân công' })
  totalPeriods: number;

  @ApiProperty({ description: 'Số tiết tối đa/tuần' })
  maxPeriodsPerWeek: number;

  @ApiProperty({ description: 'Số tiết tối thiểu/tuần' })
  minPeriodsPerWeek: number;

  @ApiProperty({ description: 'Trạng thái tải (UNDER, NORMAL, OVER)' })
  workloadStatus: WorkloadStatus;
}

export enum WorkloadStatus {
  UNDER = 'UNDER',
  NORMAL = 'NORMAL',
  OVER = 'OVER',
}
