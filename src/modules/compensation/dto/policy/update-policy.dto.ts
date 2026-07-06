import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsDateString,
  IsOptional,
  IsArray,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { EntityStatus } from '../../../../common/enums/status.enum';

export class UpdatePolicyDto {
  @ApiPropertyOptional({ description: 'Tên chính sách' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'ID cơ sở' })
  @IsOptional()
  @IsUUID()
  campusId?: string | null;

  @ApiPropertyOptional({ description: 'Cấp học' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  schoolLevel?: string | null;

  @ApiPropertyOptional({
    description: 'Danh sách ID thành phần lương',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  payComponentIds?: string[];

  @ApiPropertyOptional({ description: 'Ngày bắt đầu hiệu lực' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({ description: 'Ngày kết thúc hiệu lực' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;

  @ApiPropertyOptional({ enum: EntityStatus, description: 'Trạng thái' })
  @IsOptional()
  @IsEnum(EntityStatus)
  status?: EntityStatus;
}
