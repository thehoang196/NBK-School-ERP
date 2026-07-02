import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsObject } from 'class-validator';

export class SimulateDto {
  @ApiProperty({ description: 'ID giáo viên' })
  @IsUUID()
  teacherId: string;

  @ApiProperty({ description: 'ID kỳ lương' })
  @IsUUID()
  payPeriodId: string;

  @ApiProperty({ description: 'ID trường' })
  @IsUUID()
  schoolId: string;

  @ApiPropertyOptional({
    description: 'Override tạm thời giá trị biến. Ví dụ: { "LESSON_RATE": 350000, "OT_RATE": 50000 }',
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  @IsOptional()
  @IsObject()
  variableOverrides?: Record<string, number>;
}
