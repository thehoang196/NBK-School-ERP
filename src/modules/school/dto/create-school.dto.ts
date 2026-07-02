import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, IsOptional, IsUUID, IsEnum, IsEmail } from 'class-validator';
import { SchoolStatus } from '../../../common/enums/status.enum';

export class CreateSchoolDto {
  @ApiProperty({ example: 'TH01', maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @ApiProperty({ example: 'Trường THPT Nguyễn Huệ' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: '123 Đường ABC, Quận 1, TP.HCM' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '0901234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'contact@nguyenhue.edu.vn' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Nguyễn Văn B' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  principalName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentSchoolId?: string;

  @ApiPropertyOptional({ enum: SchoolStatus, default: SchoolStatus.ACTIVE })
  @IsOptional()
  @IsEnum(SchoolStatus)
  status?: SchoolStatus;
}
