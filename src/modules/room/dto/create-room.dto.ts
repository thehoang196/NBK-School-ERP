import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsArray,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';
import { RoomType, RoomStatus } from '../../../common/enums/status.enum';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateRoomDto {
  @ApiProperty({
    description: 'ID trường',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty({ message: 'schoolId không được để trống' })
  @IsString({ message: 'schoolId phải là chuỗi' })
  @Matches(UUID_REGEX, { message: 'schoolId phải là UUID hợp lệ' })
  schoolId: string;

  @ApiProperty({ description: 'Mã phòng', example: 'P101' })
  @IsNotEmpty({ message: 'Mã phòng không được để trống' })
  @IsString({ message: 'Mã phòng phải là chuỗi' })
  @MaxLength(20, { message: 'Mã phòng tối đa 20 ký tự' })
  code: string;

  @ApiProperty({ description: 'Tên phòng', example: 'Phòng 101' })
  @IsNotEmpty({ message: 'Tên phòng không được để trống' })
  @IsString({ message: 'Tên phòng phải là chuỗi' })
  @MaxLength(100, { message: 'Tên phòng tối đa 100 ký tự' })
  name: string;

  @ApiPropertyOptional({ description: 'Tòa nhà', example: 'A' })
  @IsOptional()
  @IsString({ message: 'Tòa nhà phải là chuỗi' })
  @MaxLength(50, { message: 'Tên tòa nhà tối đa 50 ký tự' })
  building?: string;

  @ApiPropertyOptional({ description: 'Tầng', example: 1 })
  @IsOptional()
  @IsInt({ message: 'Tầng phải là số nguyên' })
  @Min(0, { message: 'Tầng phải >= 0' })
  @Max(20, { message: 'Tầng phải <= 20' })
  floor?: number;

  @ApiPropertyOptional({
    description: 'Sức chứa (số học sinh)',
    example: 40,
    default: 40,
  })
  @IsOptional()
  @IsInt({ message: 'Sức chứa phải là số nguyên' })
  @Min(1, { message: 'Sức chứa phải >= 1' })
  @Max(500, { message: 'Sức chứa phải <= 500' })
  capacity?: number;

  @ApiPropertyOptional({
    enum: RoomType,
    description: 'Loại phòng',
    example: RoomType.STANDARD,
    default: RoomType.STANDARD,
  })
  @IsOptional()
  @IsEnum(RoomType, { message: 'Loại phòng không hợp lệ' })
  roomType?: RoomType;

  @ApiPropertyOptional({
    description: 'Danh sách trang thiết bị',
    type: [String],
    example: ['Máy chiếu', 'Bảng tương tác', 'Điều hòa'],
  })
  @IsOptional()
  @IsArray({ message: 'Trang thiết bị phải là mảng' })
  @IsString({ each: true, message: 'Mỗi trang thiết bị phải là chuỗi' })
  facilities?: string[];

  @ApiPropertyOptional({
    enum: RoomStatus,
    description: 'Trạng thái phòng',
    example: RoomStatus.AVAILABLE,
    default: RoomStatus.AVAILABLE,
  })
  @IsOptional()
  @IsEnum(RoomStatus, { message: 'Trạng thái phòng không hợp lệ' })
  status?: RoomStatus;
}
