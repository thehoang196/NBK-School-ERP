import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';

export class UpdateTimetableSlotDto {
  @ApiPropertyOptional({ description: 'Ngày trong tuần (2=Thứ 2, 7=Thứ 7)' })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(7)
  dayOfWeek?: number;

  @ApiPropertyOptional({ description: 'ID tiết học' })
  @IsOptional()
  @IsUUID()
  periodId?: string;

  @ApiPropertyOptional({ description: 'ID giáo viên' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({ description: 'ID môn học' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'ID phòng học' })
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiPropertyOptional({ description: 'Có phải tiết đôi không' })
  @IsOptional()
  @IsBoolean()
  isDoublePeriod?: boolean;
}
