import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { RoomType, RoomStatus } from '../../../common/enums/status.enum';

export class RoomQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: RoomType, description: 'Lọc theo loại phòng' })
  @IsOptional()
  @IsEnum(RoomType, { message: 'Loại phòng không hợp lệ' })
  roomType?: RoomType;

  @ApiPropertyOptional({ enum: RoomStatus, description: 'Lọc theo trạng thái' })
  @IsOptional()
  @IsEnum(RoomStatus, { message: 'Trạng thái phòng không hợp lệ' })
  status?: RoomStatus;

  @ApiPropertyOptional({ description: 'Lọc theo tòa nhà', example: 'A' })
  @IsOptional()
  @IsString({ message: 'Tòa nhà phải là chuỗi' })
  building?: string;

  @ApiPropertyOptional({ description: 'Tìm kiếm theo tên hoặc mã phòng' })
  @IsOptional()
  @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi' })
  search?: string;
}
