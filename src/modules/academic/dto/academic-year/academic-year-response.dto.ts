import { ApiProperty } from '@nestjs/swagger';
import { AcademicStatus } from '../../../../common/enums/status.enum';

export class AcademicYearResponseDto {
  @ApiProperty({ description: 'ID năm học' })
  id: string;

  @ApiProperty({ description: 'ID trường' })
  schoolId: string;

  @ApiProperty({ description: 'Tên năm học', example: '2024-2025' })
  name: string;

  @ApiProperty({ description: 'Ngày bắt đầu', example: '2024-09-01' })
  startDate: string;

  @ApiProperty({ description: 'Ngày kết thúc', example: '2025-06-30' })
  endDate: string;

  @ApiProperty({ description: 'Năm học hiện tại' })
  isCurrent: boolean;

  @ApiProperty({ enum: AcademicStatus, description: 'Trạng thái' })
  status: AcademicStatus;

  @ApiProperty({ description: 'Ngày tạo' })
  createdAt: Date;

  @ApiProperty({ description: 'Ngày cập nhật' })
  updatedAt: Date;
}
