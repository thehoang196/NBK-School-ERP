import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsOptional,
  IsArray,
  IsString,
  IsBoolean,
} from 'class-validator';

export class MergeTeachersDto {
  @ApiProperty({ description: 'ID giáo viên chính (được giữ lại)' })
  @IsUUID()
  primaryId: string;

  @ApiProperty({ description: 'ID giáo viên phụ (bị merge và soft-delete)' })
  @IsUUID()
  secondaryId: string;

  @ApiPropertyOptional({
    description:
      'Danh sách fields muốn giữ lại từ giáo viên phụ (override vào giáo viên chính)',
    example: ['phone', 'email', 'citizenId'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keepFieldsFromSecondary?: string[];

  @ApiPropertyOptional({
    description:
      'Có giữ lại lịch sử của giáo viên phụ không (soft-delete thay vì hard delete)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  preserveHistory?: boolean;
}
