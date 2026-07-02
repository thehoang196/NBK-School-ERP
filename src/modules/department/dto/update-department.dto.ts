import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, Matches } from 'class-validator';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ description: 'Tên tổ bộ môn', example: 'Tổ Toán - Tin' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'ID tổ trưởng' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'headTeacherId phải là UUID hợp lệ' })
  headTeacherId?: string | null;
}
