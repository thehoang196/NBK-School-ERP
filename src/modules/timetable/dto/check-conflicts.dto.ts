import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsOptional,
  Matches,
} from 'class-validator';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CheckConflictsDto {
  @ApiProperty({ description: 'ID phiên bản TKB' })
  @Matches(UUID_REGEX, { message: 'versionId phải là UUID hợp lệ' })
  @IsNotEmpty()
  versionId: string;

  @ApiProperty({
    description: 'Ngày trong tuần (2=Thứ 2, 7=Thứ 7)',
    minimum: 2,
    maximum: 7,
  })
  @IsInt()
  @Min(2)
  @Max(7)
  dayOfWeek: number;

  @ApiProperty({ description: 'ID tiết học' })
  @Matches(UUID_REGEX, { message: 'periodId phải là UUID hợp lệ' })
  @IsNotEmpty()
  periodId: string;

  @ApiProperty({ description: 'ID giáo viên' })
  @Matches(UUID_REGEX, { message: 'teacherId phải là UUID hợp lệ' })
  @IsNotEmpty()
  teacherId: string;

  @ApiProperty({ description: 'ID lớp' })
  @Matches(UUID_REGEX, { message: 'classId phải là UUID hợp lệ' })
  @IsNotEmpty()
  classId: string;

  @ApiPropertyOptional({ description: 'ID phòng học' })
  @IsOptional()
  @Matches(UUID_REGEX, { message: 'roomId phải là UUID hợp lệ' })
  roomId?: string;

  @ApiPropertyOptional({ description: 'ID slot hiện tại (exclude khi update)' })
  @IsOptional()
  @Matches(UUID_REGEX, { message: 'excludeSlotId phải là UUID hợp lệ' })
  excludeSlotId?: string;
}
