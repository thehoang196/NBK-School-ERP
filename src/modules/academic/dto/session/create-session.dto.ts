import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  Matches,
  IsMilitaryTime,
  Min,
} from 'class-validator';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateSessionDto {
  @ApiProperty({ description: 'ID trường' })
  @IsNotEmpty()
  @IsString()
  @Matches(UUID_REGEX, { message: 'schoolId phải là UUID hợp lệ' })
  schoolId: string;

  @ApiProperty({ description: 'Tên ca học', example: 'Ca sáng' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'Giờ bắt đầu (HH:mm)', example: '07:00' })
  @IsNotEmpty()
  @IsMilitaryTime()
  startTime: string;

  @ApiProperty({ description: 'Giờ kết thúc (HH:mm)', example: '11:30' })
  @IsNotEmpty()
  @IsMilitaryTime()
  endTime: string;

  @ApiPropertyOptional({ description: 'Thứ tự sắp xếp', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
