import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsBoolean,
  Min,
  Matches,
} from 'class-validator';
import { SubjectType, RoomType } from '../../../common/enums/status.enum';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateSubjectDto {
  @ApiProperty({ description: 'ID trường', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsNotEmpty()
  @IsString()
  @Matches(UUID_REGEX, { message: 'schoolId phải là UUID hợp lệ' })
  schoolId: string;

  @ApiPropertyOptional({ description: 'Mã môn học (tự sinh nếu để trống)', example: 'TOAN' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ description: 'Tên môn học', example: 'Toán' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Tên viết tắt', example: 'T' })
  @IsOptional()
  @IsString()
  shortName?: string;

  @ApiPropertyOptional({ enum: SubjectType, default: SubjectType.REQUIRED })
  @IsOptional()
  @IsEnum(SubjectType)
  subjectType?: SubjectType;

  @ApiPropertyOptional({ description: 'Số tiết/tuần', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  periodsPerWeek?: number;

  @ApiPropertyOptional({ enum: RoomType, default: RoomType.STANDARD })
  @IsOptional()
  @IsEnum(RoomType)
  requiresRoomType?: RoomType;

  @ApiPropertyOptional({ description: 'Mã màu', example: '#FF5733' })
  @IsOptional()
  @IsString()
  colorCode?: string;

  @ApiPropertyOptional({ description: 'Có học tiết đôi', default: false })
  @IsOptional()
  @IsBoolean()
  isDoublePeriod?: boolean;
}
