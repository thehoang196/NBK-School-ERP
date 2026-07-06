import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsBoolean,
  IsUUID,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';
import { SubjectType, RoomType } from '../../../common/enums/status.enum';

export class CreateSubjectDto {
  @ApiProperty({
    description: 'ID trường',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty({ message: 'ID trường không được để trống' })
  @IsUUID('4', { message: 'ID trường phải là UUID hợp lệ' })
  schoolId: string;

  @ApiProperty({
    description: 'Mã môn học',
    example: 'TOAN',
    maxLength: 20,
  })
  @IsNotEmpty({ message: 'Mã môn học không được để trống' })
  @IsString({ message: 'Mã môn học phải là chuỗi ký tự' })
  @MaxLength(20, { message: 'Mã môn học không được vượt quá 20 ký tự' })
  code: string;

  @ApiProperty({
    description: 'Tên môn học',
    example: 'Toán học',
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Tên môn học không được để trống' })
  @IsString({ message: 'Tên môn học phải là chuỗi ký tự' })
  @MaxLength(100, { message: 'Tên môn học không được vượt quá 100 ký tự' })
  name: string;

  @ApiPropertyOptional({
    description: 'Tên viết tắt hiển thị trên TKB',
    example: 'Toán',
    maxLength: 10,
  })
  @IsOptional()
  @IsString({ message: 'Tên viết tắt phải là chuỗi ký tự' })
  @MaxLength(10, { message: 'Tên viết tắt không được vượt quá 10 ký tự' })
  shortName?: string;

  @ApiPropertyOptional({
    description: 'Loại môn học',
    enum: SubjectType,
    default: SubjectType.REQUIRED,
    example: SubjectType.REQUIRED,
  })
  @IsOptional()
  @IsEnum(SubjectType, {
    message:
      'Loại môn học phải là một trong: required, elective, extracurricular',
  })
  subjectType?: SubjectType;

  @ApiPropertyOptional({
    description: 'Số tiết/tuần mặc định',
    example: 4,
    default: 0,
    minimum: 0,
    maximum: 20,
  })
  @IsOptional()
  @IsInt({ message: 'Số tiết/tuần phải là số nguyên' })
  @Min(0, { message: 'Số tiết/tuần không được nhỏ hơn 0' })
  @Max(20, { message: 'Số tiết/tuần không được vượt quá 20' })
  periodsPerWeek?: number;

  @ApiPropertyOptional({
    description: 'Loại phòng yêu cầu',
    enum: RoomType,
    default: RoomType.STANDARD,
    example: RoomType.STANDARD,
  })
  @IsOptional()
  @IsEnum(RoomType, {
    message:
      'Loại phòng phải là một trong: standard, lab, gym, music, art, other',
  })
  requiresRoomType?: RoomType;

  @ApiPropertyOptional({
    description: 'Mã màu hiển thị (định dạng #RRGGBB)',
    example: '#FF5733',
  })
  @IsOptional()
  @IsString({ message: 'Mã màu phải là chuỗi ký tự' })
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Mã màu phải có định dạng #RRGGBB (ví dụ: #FF5733)',
  })
  colorCode?: string;

  @ApiPropertyOptional({
    description: 'Môn học có yêu cầu tiết đôi không',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Giá trị tiết đôi phải là true hoặc false' })
  isDoublePeriod?: boolean;
}
