import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsMilitaryTime,
} from 'class-validator';
import { AttendanceStatus, AttendanceMethod, LeaveType } from '../enums';

export class CreateAttendanceRecordDto {
  @ApiProperty({ description: 'ID giáo viên' })
  @IsUUID()
  teacherId: string;

  @ApiProperty({ description: 'Ngày công (YYYY-MM-DD)', example: '2026-07-01' })
  @IsDateString()
  workDate: string;

  @ApiPropertyOptional({ description: 'Giờ vào (HH:mm)', example: '07:30' })
  @IsOptional()
  @IsMilitaryTime()
  checkIn?: string;

  @ApiPropertyOptional({ description: 'Giờ ra (HH:mm)', example: '17:00' })
  @IsOptional()
  @IsMilitaryTime()
  checkOut?: string;

  @ApiProperty({ enum: AttendanceStatus, description: 'Trạng thái chấm công' })
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @ApiPropertyOptional({
    enum: AttendanceMethod,
    description: 'Phương thức chấm công',
    default: AttendanceMethod.MANUAL,
  })
  @IsOptional()
  @IsEnum(AttendanceMethod)
  method?: AttendanceMethod;

  @ApiPropertyOptional({ enum: LeaveType, description: 'Loại nghỉ phép' })
  @IsOptional()
  @IsEnum(LeaveType)
  leaveType?: LeaveType;

  @ApiPropertyOptional({
    description: 'Số giờ tăng ca',
    minimum: 0,
    maximum: 12,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(12)
  overtimeHours?: number;

  @ApiPropertyOptional({
    description: 'Hệ số ngày công (0-1)',
    minimum: 0,
    maximum: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  workCoefficient?: number;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  note?: string;
}
