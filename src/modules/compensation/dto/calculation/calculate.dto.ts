import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsArray } from 'class-validator';

export class CalculateDto {
  @ApiProperty({ description: 'ID trường' })
  @IsUUID()
  schoolId: string;

  @ApiProperty({ description: 'ID kỳ lương' })
  @IsUUID()
  payPeriodId: string;

  @ApiPropertyOptional({ description: 'Danh sách ID giáo viên (nếu để trống sẽ tính cho tất cả)', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  teacherIds?: string[];
}
