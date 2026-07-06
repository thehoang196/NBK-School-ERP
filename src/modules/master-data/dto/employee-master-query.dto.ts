import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsUUID,
  IsObject,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { Gender } from '../../../common/enums/status.enum';

export class EmployeeMasterQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Tìm kiếm theo mã NV hoặc họ tên' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Lọc theo trường (school_id)' })
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo cơ sở' })
  @IsOptional()
  @IsString()
  campusName?: string;

  @ApiPropertyOptional({ description: 'Lọc theo khối' })
  @IsOptional()
  @IsString()
  gradeName?: string;

  @ApiPropertyOptional({ description: 'Lọc theo tổ bộ môn' })
  @IsOptional()
  @IsString()
  departmentName?: string;

  @ApiPropertyOptional({ description: 'Lọc theo chức danh' })
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiPropertyOptional({ description: 'Lọc theo giới tính', enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({
    description: 'Lọc theo trường mở rộng (JSON key=value)',
  })
  @IsOptional()
  @IsObject()
  extendedFieldFilters?: Record<string, string>;
}
