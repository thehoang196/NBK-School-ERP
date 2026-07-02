import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsOptional, IsInt, Min, Max } from 'class-validator';

export class GenerateTimetableDto {
  @ApiProperty({ description: 'ID học kỳ' })
  @IsUUID()
  @IsNotEmpty()
  semesterId: string;

  @ApiProperty({ description: 'ID phiên bản TKB để lưu kết quả' })
  @IsUUID()
  @IsNotEmpty()
  versionId: string;

  @ApiPropertyOptional({ description: 'Thời gian tối đa để FET chạy (giây)', default: 300 })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(3600)
  timeoutSeconds?: number;
}

export class GenerationStatusDto {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string | null;
  result: GenerationResultDto | null;
}

export class GenerationResultDto {
  totalSlots: number;
  conflicts: number;
  completedAt: Date;
}
