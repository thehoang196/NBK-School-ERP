import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class MemberQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Tìm kiếm theo tên hoặc email giáo viên',
    example: 'Nguyễn',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
