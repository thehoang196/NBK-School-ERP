import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, ValidateNested } from 'class-validator';
import { CreateAttendanceRecordDto } from './create-attendance-record.dto';

export class BulkCreateAttendanceDto {
  @ApiProperty({
    type: [CreateAttendanceRecordDto],
    description: 'Danh sách bản ghi chấm công',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateAttendanceRecordDto)
  @ArrayMinSize(1)
  records: CreateAttendanceRecordDto[];
}
