import { IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TimetableVersionStatus } from '../../../common/enums/status.enum';

/**
 * DTO for submitting a timetable generation request.
 */
export class SubmitGenerationDto {
  @ApiProperty({
    description: 'ID của học kỳ cần sinh thời khóa biểu',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID('4', { message: 'semesterId phải là UUID hợp lệ' })
  semesterId: string;

  @ApiPropertyOptional({
    description: 'Tên mô tả cho phiên bản TKB (tùy chọn)',
    example: 'TKB HK1 2024-2025 lần 1',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'name phải là chuỗi' })
  @MaxLength(100, { message: 'name không được vượt quá 100 ký tự' })
  name?: string;
}

/**
 * Response returned after successful generation submission.
 */
export class GenerationSubmissionResultDto {
  @ApiProperty({ description: 'ID của job trong queue' })
  jobId: string;

  @ApiProperty({ description: 'ID của phiên bản TKB mới tạo' })
  versionId: string;

  @ApiProperty({
    description: 'Trạng thái hiện tại của phiên bản',
    enum: TimetableVersionStatus,
  })
  status: TimetableVersionStatus;
}

/**
 * Response for querying job status.
 */
export class GenerationJobStatusDto {
  @ApiProperty({ description: 'ID của job' })
  jobId: string;

  @ApiProperty({ description: 'ID của phiên bản TKB' })
  versionId: string;

  @ApiProperty({
    description: 'Trạng thái job trong queue',
    enum: ['waiting', 'active', 'completed', 'failed'],
  })
  status: 'waiting' | 'active' | 'completed' | 'failed';

  @ApiProperty({
    description: 'Phần trăm tiến trình (0–100)',
    minimum: 0,
    maximum: 100,
  })
  progress: number;

  @ApiProperty({
    description: 'Giai đoạn hiện tại',
    example: 'fet_running',
  })
  stage: string;

  @ApiPropertyOptional({ description: 'Thông báo lỗi (nếu có)' })
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'Thời gian hoàn thành' })
  completedAt?: Date;
}
