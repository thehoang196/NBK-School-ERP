import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsUUID,
  IsArray,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { SchoolScopedQueryDto } from '../../../../common/dto/school-scoped-query.dto';
import { WeekType } from '../../enums';

export class WeekQueryDto extends SchoolScopedQueryDto {
  @ApiPropertyOptional({
    description: 'Lọc theo học kỳ',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4', { message: 'semesterId phải là UUID hợp lệ' })
  semesterId?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo tuần nghỉ lễ',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'isHoliday phải là giá trị boolean' })
  isHoliday?: boolean;

  @ApiPropertyOptional({
    description: 'Lọc theo loại tuần (có thể truyền nhiều giá trị)',
    enum: WeekType,
    isArray: true,
    example: [WeekType.REGULAR, WeekType.EXAM],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(WeekType, {
    each: true,
    message: 'Mỗi weekType phải là một trong: regular, exam, holiday, makeup',
  })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  weekType?: WeekType[];
}
