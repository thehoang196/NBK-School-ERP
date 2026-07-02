import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
  Matches,
  IsMilitaryTime,
  Min,
} from 'class-validator';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreatePeriodDefinitionDto {
  @ApiProperty({ description: 'ID trường' })
  @IsNotEmpty()
  @IsString()
  @Matches(UUID_REGEX, { message: 'schoolId phải là UUID hợp lệ' })
  schoolId: string;

  @ApiProperty({ description: 'ID ca học' })
  @IsNotEmpty()
  @IsString()
  @Matches(UUID_REGEX, { message: 'sessionId phải là UUID hợp lệ' })
  sessionId: string;

  @ApiProperty({ description: 'Số thứ tự tiết', example: 1 })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  periodNumber: number;

  @ApiProperty({ description: 'Giờ bắt đầu (HH:mm)', example: '07:00' })
  @IsNotEmpty()
  @IsMilitaryTime()
  startTime: string;

  @ApiProperty({ description: 'Giờ kết thúc (HH:mm)', example: '07:45' })
  @IsNotEmpty()
  @IsMilitaryTime()
  endTime: string;

  @ApiPropertyOptional({ description: 'Là giờ nghỉ giải lao', default: false })
  @IsOptional()
  @IsBoolean()
  isBreak?: boolean;
}
