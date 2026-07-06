import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateAttendanceRecordDto } from './create-attendance-record.dto';

export class UpdateAttendanceRecordDto extends PartialType(
  OmitType(CreateAttendanceRecordDto, ['teacherId', 'workDate'] as const),
) {}
