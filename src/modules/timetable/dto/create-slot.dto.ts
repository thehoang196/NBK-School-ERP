import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateSlotDto {
  @ApiProperty({ description: 'ID lớp', format: 'uuid' })
  @IsNotEmpty()
  @IsUUID()
  classId: string;

  @ApiProperty({
    description: 'Ngày trong tuần (2=Thứ 2, 7=Thứ 7)',
    minimum: 2,
    maximum: 7,
  })
  @IsInt()
  @Min(2)
  @Max(7)
  dayOfWeek: number;

  @ApiProperty({ description: 'ID tiết học', format: 'uuid' })
  @IsNotEmpty()
  @IsUUID()
  periodId: string;

  @ApiProperty({ description: 'ID môn học', format: 'uuid' })
  @IsNotEmpty()
  @IsUUID()
  subjectId: string;

  @ApiProperty({ description: 'ID giáo viên', format: 'uuid' })
  @IsNotEmpty()
  @IsUUID()
  teacherId: string;

  @ApiPropertyOptional({ description: 'ID phòng học', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiPropertyOptional({
    description: 'Có phải tiết đôi không',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDoublePeriod?: boolean;
}
