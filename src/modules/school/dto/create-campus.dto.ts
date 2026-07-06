import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { CampusStatus } from '../../../common/enums/status.enum';

export class CreateCampusDto {
  @ApiProperty({ example: 'CS01', maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @ApiProperty({ example: 'Cơ sở 1 - Quận 1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: '123 Đường ABC, Quận 1, TP.HCM' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ description: 'ID của trường trực thuộc' })
  @IsUUID()
  @IsNotEmpty()
  schoolId: string;

  @ApiPropertyOptional({ enum: CampusStatus, default: CampusStatus.ACTIVE })
  @IsOptional()
  @IsEnum(CampusStatus)
  status?: CampusStatus;
}
